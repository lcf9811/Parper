/**
 * SSE Service - 管理 Server-Sent Events 流
 * 支持事件缓冲：当无客户端连接时缓存事件，客户端连接后重放
 */
import { Response } from 'express';

export interface SSEEvent {
  type: 'input' | 'output' | 'step' | 'error' | 'complete';
  content?: string;
  stepType?: 'llm_call' | 'tool_call' | 'knowledge_retrieval';
  stepName?: string;
  stepStatus?: 'pending' | 'running' | 'completed' | 'error';
  timestamp: string;
  executionId: string;
  metadata?: any;
}

interface ClientConnection {
  res: Response;
  executionId: string;
  connectedAt: Date;
}

interface BufferedEvent {
  eventType: string; // SSE event name (e.g. 'message', 'complete')
  data: any;
}

const MAX_BUFFERED_EVENTS = 200; // 最多缓冲 200 个事件

class SSEService {
  private clients: Map<string, ClientConnection> = new Map();
  // 事件缓冲区：executionId → 事件列表（无客户端连接时缓存）
  private eventBuffers: Map<string, BufferedEvent[]> = new Map();

  /**
   * 注册新的 SSE 客户端连接
   */
  registerClient(executionId: string, res: Response): void {
    // 如果已存在同 executionId 的连接，先移除旧连接的监听器再关闭，
    // 防止旧 res 的 close 事件误删新客户端（BE-06 竞态修复）
    const existing = this.clients.get(executionId);
    if (existing) {
      existing.res.removeAllListeners('close');
      existing.res.removeAllListeners('error');
      this.closeConnection(executionId);
    }

    // 设置 SSE 响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
    });

    // 注册客户端
    this.clients.set(executionId, {
      res,
      executionId,
      connectedAt: new Date(),
    });

    console.log(`[SSE] Client connected for execution: ${executionId}`);

    // 重放缓冲的事件（如果有）
    const buffer = this.eventBuffers.get(executionId);
    if (buffer && buffer.length > 0) {
      console.log(`[SSE] Replaying ${buffer.length} buffered events for execution: ${executionId}`);
      // 异步重放，避免阻塞注册
      setImmediate(() => {
        for (const evt of buffer) {
          this.sendEvent(res, evt.eventType, evt.data);
        }
        // 重放完成后清理缓冲
        this.eventBuffers.delete(executionId);
      });
    }

    // 发送初始连接成功事件
    this.sendEvent(res, 'connected', {
      executionId,
      timestamp: new Date().toISOString(),
      message: 'SSE connection established',
    });

    // 监听客户端断开连接
    res.on('close', () => {
      this.removeClient(executionId);
    });

    res.on('error', (err) => {
      console.error(`[SSE] Connection error for ${executionId}:`, err);
      this.removeClient(executionId);
    });
  }

  /**
   * 发送事件到指定 executionId 的客户端
   */
  sendEvent(res: Response, event: string, data: any): boolean {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch (err) {
      console.error('[SSE] Failed to send event:', err);
      return false;
    }
  }

  /**
   * 广播事件到指定 executionId
   * 如果没有客户端连接，则缓冲事件（供后续连接重放）
   */
  emit(executionId: string, eventType: string, data: any): boolean {
    const client = this.clients.get(executionId);
    if (!client) {
      // 无客户端连接，缓冲事件
      let buffer = this.eventBuffers.get(executionId);
      if (!buffer) {
        buffer = [];
        this.eventBuffers.set(executionId, buffer);
      }
      // 限制缓冲大小，避免内存泄漏
      if (buffer.length >= MAX_BUFFERED_EVENTS) {
        buffer.shift(); // 移除最旧的事件
      }
      buffer.push({ eventType, data });
      return true; // 缓冲成功
    }
    return this.sendEvent(client.res, eventType, data);
  }

  /**
   * 发送消息事件
   */
  emitMessage(executionId: string, event: Omit<SSEEvent, 'executionId'>): boolean {
    return this.emit(executionId, 'message', {
      ...event,
      executionId,
    });
  }

  /**
   * 发送输入接收确认
   */
  emitInput(executionId: string, content: string): boolean {
    return this.emitMessage(executionId, {
      type: 'input',
      content,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发送输出内容块
   */
  emitOutput(executionId: string, content: string, isPartial: boolean = true): boolean {
    return this.emitMessage(executionId, {
      type: 'output',
      content,
      timestamp: new Date().toISOString(),
      metadata: { isPartial },
    });
  }

  /**
   * 发送执行步骤更新
   */
  emitStep(
    executionId: string,
    stepType: 'llm_call' | 'tool_call' | 'knowledge_retrieval',
    stepName: string,
    stepStatus: 'pending' | 'running' | 'completed' | 'error',
    metadata?: any
  ): boolean {
    return this.emitMessage(executionId, {
      type: 'step',
      stepType,
      stepName,
      stepStatus,
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  /**
   * 发送完成事件
   */
  emitComplete(executionId: string, status: 'done' | 'error', result?: any): boolean {
    return this.emit(executionId, 'complete', {
      status,
      executionId,
      timestamp: new Date().toISOString(),
      result,
    });
  }

  /**
   * 发送错误事件
   */
  emitError(executionId: string, error: string): boolean {
    return this.emitMessage(executionId, {
      type: 'error',
      content: error,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 移除客户端连接
   */
  removeClient(executionId: string): void {
    const client = this.clients.get(executionId);
    if (client) {
      this.clients.delete(executionId);
      console.log(`[SSE] Client disconnected for execution: ${executionId}`);
    }
  }

  /**
   * 关闭指定 executionId 的连接
   */
  closeConnection(executionId: string): void {
    const client = this.clients.get(executionId);
    if (client) {
      try {
        client.res.end();
      } catch (err) {
        // 忽略关闭时的错误
      }
      this.clients.delete(executionId);
    }
  }

  /**
   * 获取活跃连接数
   */
  getActiveConnections(): number {
    return this.clients.size;
  }

  /**
   * 检查指定 executionId 是否有活跃连接
   */
  hasConnection(executionId: string): boolean {
    return this.clients.has(executionId);
  }
}

export const sseService = new SSEService();

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Input, List, Modal, Badge, message, Tooltip, Dropdown, Popconfirm } from 'antd';
import { PlusOutlined, SendOutlined, SettingOutlined, EditOutlined, DeleteOutlined, MoreOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { getSessions, createSession, getMessages, sendChatStream, getTools, getSkills, updateSessionTitle, deleteSession, getExecution, getSessionExecutions } from '../api/client';
import ChatMessage from '../components/ChatMessage';
import ToolSelector from '../components/ToolSelector';
import SkillSelector from '../components/SkillSelector';
import ExecutionLog from '../components/ExecutionLog';
import StreamingMessage, { Step } from '../components/StreamingMessage';

const { TextArea } = Input;

// SSE 事件类型
interface SSEMessageEvent {
  type: 'input' | 'output' | 'step' | 'error' | 'complete';
  content?: string;
  stepType?: 'llm_call' | 'tool_call' | 'knowledge_retrieval';
  stepName?: string;
  stepStatus?: 'pending' | 'running' | 'completed' | 'error';
  timestamp: string;
  executionId: string;
  metadata?: any;
}

interface SSECompleteEvent {
  status: 'done' | 'error';
  executionId: string;
  timestamp: string;
  result?: any;
}

export default function Chat() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [allTools, setAllTools] = useState<string[]>([]);
  const [allSkills, setAllSkills] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [lastExecutionId, setLastExecutionId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  
  // 流式显示状态
  const [streamingSteps, setStreamingSteps] = useState<Step[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  
  // 重命名状态
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renamingSession, setRenamingSession] = useState<any>(null);
  const [newTitle, setNewTitle] = useState('');
  
  // SSE 相关引用（使用 ref 避免闭包捕获过期值）
  const eventSourceRef = useRef<EventSource | null>(null);
  const streamingContentRef = useRef('');
  const isStreamingRef = useRef(false); // 跟踪是否正在流式输出
  const sessionIdRef = useRef<string | null>(null); // 跟踪当前会话 ID
  const executionIdRef = useRef<string | null>(null); // 跟踪当前执行 ID（用于 polling fallback）
  const executionPollRef = useRef<number | null>(null); // execution polling 定时器
  const streamingTimeoutRef = useRef<number | null>(null); // FE-01: streamingTimeout 防泄漏
  const sendLockRef = useRef(false); // FE-04: 发送竞态锁
  const isMountedRef = useRef(true); // FE-10: 组件挂载状态
  const abortControllerRef = useRef<AbortController | null>(null); // FE-16: 请求取消
  const prevMessageIdsRef = useRef<Set<string>>(new Set()); // 追踪上次加载的消息 ID，用于检测外部新消息
  const externalStreamingRef = useRef<string | null>(null); // 当前外部流式 executionId

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // FE-10: 组件卸载时标记
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 持久化选中状态到 localStorage（刷新不丢失）
  useEffect(() => {
    localStorage.setItem('wagent_selected_tools', JSON.stringify(selectedTools));
  }, [selectedTools]);

  useEffect(() => {
    localStorage.setItem('wagent_selected_skills', JSON.stringify(selectedSkills));
  }, [selectedSkills]);

  // 加载会话列表和所有可用工具/技能
  useEffect(() => {
    loadSessions();
    loadAllToolsAndSkills();
    
    // 清理 SSE 连接和 execution polling
    return () => {
      isStreamingRef.current = false;
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (eventSourceRef.current) {
        (eventSourceRef.current as any).__removeListeners?.();
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (executionPollRef.current) {
        clearInterval(executionPollRef.current);
        executionPollRef.current = null;
      }
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
        streamingTimeoutRef.current = null;
      }
    };
  }, []);

  const loadAllToolsAndSkills = async () => {
    try {
      const [toolsData, skillsData] = await Promise.all([
        getTools(),
        getSkills()
      ]);
      if (!isMountedRef.current) return;
      const enabledTools = toolsData.filter((t: any) => t.enabled).map((t: any) => t.name);
      const enabledSkills = skillsData.filter((s: any) => s.enabled).map((s: any) => s.name);
      setAllTools(enabledTools);
      setAllSkills(enabledSkills);

      // 从 localStorage 恢复用户之前的选择，如果没有则使用默认值
      try {
        const savedTools = JSON.parse(localStorage.getItem('wagent_selected_tools') || 'null');
        const savedSkills = JSON.parse(localStorage.getItem('wagent_selected_skills') || 'null');

        // 验证保存的选择仍然有效（工具/技能可能已被禁用）
        const validSavedTools = savedTools ? savedTools.filter((t: string) => enabledTools.includes(t)) : null;
        const validSavedSkills = savedSkills ? savedSkills.filter((s: string) => enabledSkills.includes(s)) : null;

        setSelectedTools(validSavedTools?.length ? validSavedTools : enabledTools);
        const defaultSkill = enabledSkills.includes('general_assistant') ? ['general_assistant'] : [];
        setSelectedSkills(validSavedSkills?.length ? validSavedSkills : defaultSkill);
      } catch {
        // localStorage 解析失败，使用默认值
        setSelectedTools(enabledTools);
        const defaultSkill = enabledSkills.includes('general_assistant') ? ['general_assistant'] : [];
        setSelectedSkills(defaultSkill);
      }
    } catch (err) {
      console.error('加载工具技能失败:', err);
    }
  };

  useEffect(() => {
    if (currentSession) {
      loadMessages(currentSession);

      // 轮询检查新消息（用于 webhook 等外部消息源）
      const intervalId = setInterval(() => {
        if (!isStreamingRef.current) { // 使用 ref 而非 state
          console.log('[Chat] Polling: loading messages');
          loadMessages(currentSession, true);
        } else {
          console.log('[Chat] Polling: skipping (streaming)');
        }
      }, 3000); // 每3秒检查一次

      return () => clearInterval(intervalId);
    }
  }, [currentSession]);

  // 滚动到底部的函数，仅在用户发送消息时调用
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadSessions = async () => {
    try {
      const data = await getSessions();
      if (!isMountedRef.current) return;
      setSessions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMessages = async (sessionId: string, fromPolling: boolean = false) => {
    try {
      const data = await getMessages(sessionId);
      if (!isMountedRef.current) return;
      console.log('[Chat] loadMessages called, raw count:', data.length, 'session:', sessionId.substring(0, 8));
      // Transform database fields (snake_case) to component props (camelCase)
      const transformedData = data.map((m: any) => ({
        ...m,
        // Ensure content is never null/undefined
        content: m.content || '(无内容)',
        // Use created_at as timestamp for display
        timestamp: m.created_at ? new Date(m.created_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : null,
        // Pass source field for webhook messages
        source: m.source || 'user',
      }));
      // Filter out messages with completely empty content
      const validMessages = transformedData.filter((m: any) => m.content && m.content.trim() !== '');
      if (validMessages.length !== transformedData.length) {
        console.warn(`[Chat] Filtered out ${transformedData.length - validMessages.length} empty messages`);
      }
      // FE-17: 按 id 去重，保留最后出现的
      const seen = new Set<string>();
      const deduped: any[] = [];
      for (let i = validMessages.length - 1; i >= 0; i--) {
        const m = validMessages[i];
        if (!seen.has(m.id)) {
          seen.add(m.id);
          deduped.unshift(m);
        }
      }
      // 检测外部新消息（webhook 等来源）
      const newIds = new Set(deduped.map(m => m.id));
      if (fromPolling && !isStreamingRef.current) {
        const prevIds = prevMessageIdsRef.current;
        // 找出新增的消息 ID
        const addedIds = deduped.filter(m => !prevIds.has(m.id)).map(m => m.id);
        if (addedIds.length > 0) {
          console.log('[Chat] Detected new messages from external source:', addedIds);
          // 检查是否有运行中的执行，建立 SSE 连接进行流式显示
          try {
            const executions = await getSessionExecutions(sessionId);
            // 找最近的一个 running 或 pending 状态的执行
            const activeExecution = executions
              .filter((e: any) => e.status === 'running' || e.status === 'pending')
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            if (activeExecution && externalStreamingRef.current !== activeExecution.id) {
              console.log('[Chat] Connecting to SSE stream for external execution:', activeExecution.id);
              connectToExternalStream(activeExecution.id);
            }
          } catch (e) {
            console.error('[Chat] Failed to check external executions:', e);
          }
        }
        // 更新追踪的消息 ID
        prevMessageIdsRef.current = newIds;
      }
      // FE-06: 数据无变化则跳过 setMessages，避免全量重渲染
      setMessages(prev => {
        if (prev.length === deduped.length && prev.length > 0) {
          const hasChanges = deduped.some((m: any, i: number) => {
            const pm = prev[i];
            return !pm || pm.id !== m.id || pm.content !== m.content || pm.role !== m.role;
          });
          if (!hasChanges) return prev;
        }
        return deduped;
      });
      // 首次加载时也更新追踪 ID
      if (!fromPolling) {
        prevMessageIdsRef.current = new Set(deduped.map(m => m.id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewSession = async () => {
    try {
      const session = await createSession();
      setSessions(prev => [session, ...prev]);
      setCurrentSession(session.id);
      setMessages([]);
      setLastExecutionId(null);
      setSelectedTools(allTools);
      const defaultSkill = allSkills.includes('general_assistant') ? ['general_assistant'] : [];
      setSelectedSkills(defaultSkill);
      localStorage.setItem('wagent_selected_tools', JSON.stringify(allTools));
      localStorage.setItem('wagent_selected_skills', JSON.stringify(defaultSkill));
    } catch (err) {
      message.error('创建会话失败');
    }
  };

  // 重命名会话
  const handleRename = (session: any) => {
    setRenamingSession(session);
    setNewTitle(session.title);
    setRenameModalVisible(true);
  };

  const confirmRename = async () => {
    if (!renamingSession || !newTitle.trim()) return;
    try {
      await updateSessionTitle(renamingSession.id, newTitle.trim());
      message.success('重命名成功');
      loadSessions();
      setRenameModalVisible(false);
    } catch (err) {
      message.error('重命名失败');
    }
  };

  // 删除会话
  const handleDelete = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      message.success('会话已删除');
      if (currentSession === sessionId) {
        setCurrentSession(null);
        setMessages([]);
      }
      loadSessions();
    } catch (err) {
      message.error('删除失败');
    }
  };

  // 删除会话确认弹窗
  const handleDeleteWithConfirm = (session: any) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除此会话吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => handleDelete(session.id),
    });
  };

  // 生成会话操作菜单
  const getSessionMenuItems = (session: any) => [
    {
      key: 'rename',
      icon: <EditOutlined />,
      label: '重命名',
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
    },
  ];

  // 处理菜单点击事件
  const handleMenuClick = (session: any) => (e: any) => {
    // 阻止事件冒泡，避免触发会话选中
    e.domEvent.stopPropagation();
    e.domEvent.preventDefault();
    if (e.key === 'rename') {
      handleRename(session);
    } else if (e.key === 'delete') {
      handleDeleteWithConfirm(session);
    }
  };

  /**
   * Execution polling fallback: when SSE connection fails,
   * poll the execution status directly to get the result.
   */
  const startExecutionPolling = useCallback((eid: string) => {
    if (executionPollRef.current) {
      clearInterval(executionPollRef.current);
    }
    console.log('[Chat] Starting execution polling fallback for:', eid);
    let pollCount = 0;
    executionPollRef.current = window.setInterval(async () => {
      pollCount++;
      try {
        const exec = await getExecution(eid);
        console.log(`[Chat] Polling #${pollCount}: status=${exec?.status}`);
        if (exec?.status === 'completed') {
          clearInterval(executionPollRef.current!);
          executionPollRef.current = null;
          console.log('[Chat] Execution completed via polling, loading messages');
          isStreamingRef.current = false;
          setIsStreaming(false);
          setStreamingSteps([]);
          streamingContentRef.current = '';
          setStreamingContent('');
          const sid = sessionIdRef.current;
          if (sid) {
            loadMessages(sid);
          }
          loadSessions();
          // Clean up SSE if still open
          if (eventSourceRef.current) {
            (eventSourceRef.current as any).__removeListeners?.();
            eventSourceRef.current.onerror = null;
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        } else if (exec?.status === 'failed') {
          clearInterval(executionPollRef.current!);
          executionPollRef.current = null;
          console.error('[Chat] Execution failed via polling:', exec.error);
          isStreamingRef.current = false;
          setIsStreaming(false);
          message.error('执行失败: ' + (exec.error || '未知错误'));
          loadSessions();
          if (eventSourceRef.current) {
            (eventSourceRef.current as any).__removeListeners?.();
            eventSourceRef.current.onerror = null;
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        } else if (pollCount > 120) {
          // 60 second timeout (500ms * 120)
          console.warn('[Chat] Execution polling timeout');
          clearInterval(executionPollRef.current!);
          executionPollRef.current = null;
          isStreamingRef.current = false;
          setIsStreaming(false);
          message.error('执行超时，请重试');
          loadSessions();
        }
      } catch (err) {
        console.error('[Chat] Polling error:', err);
      }
    }, 500);
  }, []);

  // 处理 SSE 事件
  const handleSSEMessage = useCallback((event: MessageEvent) => {
    try {
      const data: SSEMessageEvent = JSON.parse(event.data);
      // FE-02: 跨会话消息污染防护——忽略不属于当前 execution 的事件
      if (data.executionId !== executionIdRef.current) {
        console.log('[SSE] Ignoring stale event for execution:', data.executionId);
        return;
      }
      console.log('[SSE] message event type:', data.type, 'content length:', data.content ? data.content.length : 0);

      switch (data.type) {
        case 'input':
          // 输入已接收
          setReceivedAt(new Date(data.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
          break;
          
        case 'output':
          // 输出内容块
          if (data.content) {
            if (data.metadata?.isPartial) {
              // 累积部分输出
              streamingContentRef.current += data.content;
              setStreamingContent(streamingContentRef.current);
            } else {
              // 完整输出
              streamingContentRef.current = data.content;
              setStreamingContent(data.content);
            }
          }
          break;
          
        case 'step':
          // 执行步骤更新
          setStreamingSteps(prev => {
            const existingIndex = prev.findIndex(s => s.name === data.stepName);
            const newStep: Step = {
              type: data.stepType!,
              name: data.stepName!,
              status: data.stepStatus!,
              output: data.metadata,
            };
            
            if (existingIndex >= 0) {
              // 更新现有步骤
              const updated = [...prev];
              updated[existingIndex] = { ...updated[existingIndex], ...newStep };
              return updated;
            } else {
              // 添加新步骤
              return [...prev, newStep];
            }
          });
          break;
          
        case 'error':
          message.error(data.content || '执行出错');
          break;
      }
    } catch (err) {
      console.error('[SSE] Failed to parse message:', err);
    }
  }, []);

  const handleSSEComplete = useCallback((event: MessageEvent) => {
    console.log('[SSE] complete event received');
    try {
      const data: SSECompleteEvent = JSON.parse(event.data);
      // FE-02: 跨会话消息污染防护
      if (data.executionId !== executionIdRef.current) {
        console.log('[SSE] Ignoring stale complete event for execution:', data.executionId);
        return;
      }
      console.log('[SSE] complete data:', JSON.stringify(data).substring(0, 200));
      setCompletedAt(new Date(data.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
      setLastExecutionId(data.executionId);

      // FE-01: 清理 streamingTimeout
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
        streamingTimeoutRef.current = null;
      }

      // FE-03: 临时消息使用 executionId 作为稳定 key，避免轮询 remount
      const finalContent = streamingContentRef.current?.trim();
      console.log('[SSE] finalContent length:', finalContent ? finalContent.length : 0);
      if (finalContent) {
        setMessages(prev => {
          const tempId = 'resp-' + data.executionId;
          // 如果已存在同 executionId 的临时消息，更新它；否则添加
          const existingIndex = prev.findIndex(m => m.id === tempId);
          const assistantMsg = {
            role: 'assistant',
            content: finalContent,
            id: tempId,
            completedAt: new Date(data.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
          };
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = assistantMsg;
            return updated;
          }
          const updated = [...prev, assistantMsg];
          console.log('[SSE] Added assistant msg, total:', updated.length);
          return updated;
        });
      }

      // 立即清理流式状态（不再使用延迟，避免闪烁）
      console.log('[SSE] Cleaning up streaming state');
      isStreamingRef.current = false;
      externalStreamingRef.current = null;
      setIsStreaming(false);
      setStreamingSteps([]);
      streamingContentRef.current = '';
      setStreamingContent('');
      loadSessions();

      // FE-03: 完成后立即同步一次服务器消息，避免轮询延迟覆盖
      const sid = sessionIdRef.current;
      if (sid) {
        setTimeout(() => loadMessages(sid), 500);
      }

      // 关闭 SSE 连接（先清除 onerror 避免关闭时触发）
      if (eventSourceRef.current) {
        (eventSourceRef.current as any).__removeListeners?.();
        eventSourceRef.current.onerror = null;
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      // 清理 execution polling（如果存在）
      if (executionPollRef.current) {
        clearInterval(executionPollRef.current);
        executionPollRef.current = null;
      }
    } catch (err) {
      console.error('[SSE] Failed to parse complete event:', err);
      // complete 事件解析失败时，也从服务器加载
      isStreamingRef.current = false;
      setIsStreaming(false);
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
        streamingTimeoutRef.current = null;
      }
      const sid = sessionIdRef.current;
      if (sid) {
        loadMessages(sid);
      }
    }
  }, []);

  /**
   * 连接外部执行的 SSE 流（用于 webhook 触发的流式显示）
   * 复用已有的 SSE 事件处理器，自动重放缓冲的事件
   */
  const connectToExternalStream = useCallback((eid: string) => {
    // 关闭旧的 SSE 连接
    if (eventSourceRef.current) {
      (eventSourceRef.current as any).__removeListeners?.();
      eventSourceRef.current.onerror = null;
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (executionPollRef.current) {
      clearInterval(executionPollRef.current);
      executionPollRef.current = null;
    }

    console.log('[Chat] Connecting to external SSE stream for execution:', eid);
    externalStreamingRef.current = eid;
    executionIdRef.current = eid;
    sessionIdRef.current = currentSession;

    // 重置流式状态
    isStreamingRef.current = true;
    setIsStreaming(true);
    setStreamingSteps([]);
    streamingContentRef.current = '';
    setStreamingContent('');
    setReceivedAt(null);
    setCompletedAt(null);

    // 建立 SSE 连接
    const eventSource = new EventSource(`/api/chat/stream/${eid}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] External connection opened for execution:', eid);
    };

    eventSource.addEventListener('connected', (e) => {
      console.log('[SSE] External connected:', (e as MessageEvent).data);
    });
    eventSource.addEventListener('message', handleSSEMessage);
    eventSource.addEventListener('complete', handleSSEComplete);

    const removeAllListeners = () => {
      eventSource.removeEventListener('connected', () => {});
      eventSource.removeEventListener('message', handleSSEMessage);
      eventSource.removeEventListener('complete', handleSSEComplete);
    };
    (eventSource as any).__removeListeners = removeAllListeners;

    eventSource.onerror = () => {
      console.log('[SSE] External onerror, readyState:', eventSource.readyState);
      // 如果流式还在进行中，启动 fallback polling
      if (isStreamingRef.current && eid) {
        console.warn('[SSE] External connection lost, starting fallback polling');
        isStreamingRef.current = false;
        externalStreamingRef.current = null;
        startExecutionPolling(eid);
      }
      (eventSource as any).__removeListeners?.();
      eventSource.close();
      eventSourceRef.current = null;
    };

    // 超时回退
    streamingTimeoutRef.current = window.setTimeout(() => {
      if (isStreamingRef.current) {
        console.warn('[SSE] External streaming timeout, loading messages from server');
        isStreamingRef.current = false;
        externalStreamingRef.current = null;
        setIsStreaming(false);
        setStreamingSteps([]);
        if (eventSourceRef.current) {
          (eventSourceRef.current as any).__removeListeners?.();
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        if (currentSession) loadMessages(currentSession);
      }
    }, 30000);
  }, [currentSession, handleSSEMessage, handleSSEComplete, startExecutionPolling]);

  const handleSend = async () => {
    // FE-04: 同步竞态锁——防止双击快速发送
    if (!inputText.trim() || loading || sendLockRef.current || isStreamingRef.current) return;
    sendLockRef.current = true;

    console.log('[Chat] handleSend start, messages:', messages.length);

    // FE-16: 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 关闭之前的 SSE 连接和 execution polling
    if (eventSourceRef.current) {
      (eventSourceRef.current as any).__removeListeners?.();
      eventSourceRef.current.onerror = null;
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (executionPollRef.current) {
      clearInterval(executionPollRef.current);
      executionPollRef.current = null;
    }
    isStreamingRef.current = false; // 重置流式状态
    externalStreamingRef.current = null;

    let sessionId = currentSession;
    if (!sessionId) {
      const session = await createSession();
      setSessions(prev => [session, ...prev]);
      setCurrentSession(session.id);
      sessionId = session.id;
    }

    const userMsg = inputText.trim();
    const userTimestamp = new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    setInputText('');
    setMessages(prev => {
      const updated = [...prev, {
        role: 'user',
        content: userMsg,
        id: 'temp-' + Date.now(),
        receivedAt: userTimestamp,
      }];
      console.log('[Chat] User msg added, total:', updated.length);
      return updated;
    });

    // 用户发送消息时滚动到底部
    setTimeout(() => scrollToBottom(), 100);

    setLoading(true);

    // 重置流式状态（同步更新 ref 和 state）
    isStreamingRef.current = true;
    sessionIdRef.current = sessionId;
    setIsStreaming(true);
    setStreamingSteps([]);
    streamingContentRef.current = '';
    setStreamingContent('');
    setReceivedAt(null);
    setCompletedAt(null);

    try {
      // FE-16: 创建新的 AbortController
      abortControllerRef.current = new AbortController();

      // 1. 启动流式执行，获取 executionId
      const { executionId } = await sendChatStream({
        sessionId: sessionId!,
        message: userMsg,
        tools: selectedTools,
        skills: selectedSkills,
      }, abortControllerRef.current.signal);

      console.log('[Chat] Got executionId:', executionId);
      executionIdRef.current = executionId;
      setLastExecutionId(executionId);

      // 2. 建立 SSE 连接
      const eventSource = new EventSource(`/api/chat/stream/${executionId}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[SSE] Connection opened for execution:', executionId);
        // 如果连接建立时流式已经结束，直接关闭
        if (!isStreamingRef.current) {
          eventSource.close();
        }
      };

      // FE-05: 监听所有事件类型，使用具名回调以便移除
      const handleConnected = (e: MessageEvent) => {
        console.log('[SSE] Connected:', e.data);
      };
      eventSource.addEventListener('connected', handleConnected);
      eventSource.addEventListener('message', handleSSEMessage);
      eventSource.addEventListener('complete', handleSSEComplete);

      // FE-05: 存储移除函数到 eventSource 实例，以便外部回调也能统一移除
      const removeAllListeners = () => {
        eventSource.removeEventListener('connected', handleConnected);
        eventSource.removeEventListener('message', handleSSEMessage);
        eventSource.removeEventListener('complete', handleSSEComplete);
      };
      (eventSource as any).__removeListeners = removeAllListeners;

      eventSource.onerror = (err) => {
        console.log('[SSE] onerror fired, readyState:', eventSource.readyState, 'isStreamingRef:', isStreamingRef.current);

        // SSE 连接断开时，启动 execution polling fallback
        // 直接轮询数据库中的执行状态，不依赖 SSE
        if (isStreamingRef.current && executionId) {
          console.warn('[SSE] Connection lost, starting execution polling fallback');
          isStreamingRef.current = false; // 停止 SSE 逻辑
          startExecutionPolling(executionId);
          // 清理旧连接
          if (eventSourceRef.current) {
            (eventSourceRef.current as any).__removeListeners?.();
            eventSourceRef.current.onerror = null;
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          return;
        }

        // 非流式状态或首次连接失败：静默关闭
        (eventSource as any).__removeListeners?.();
        eventSource.close();
        eventSourceRef.current = null;
      };

      // FE-01: 超时回退——如果长时间未收到 complete 事件，从服务器加载消息
      // 将 timeout ID 存入 ref，在成功/错误路径统一清理
      streamingTimeoutRef.current = window.setTimeout(() => {
        if (isStreamingRef.current) {
          console.warn('[SSE] Streaming timeout (30s), loading messages from server');
          isStreamingRef.current = false;
          setIsStreaming(false);
          setStreamingSteps([]);
          if (eventSourceRef.current) {
            (eventSourceRef.current as any).__removeListeners?.();
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          const sid = sessionIdRef.current;
          if (sid) {
            loadMessages(sid);
          }
        }
      }, 30000); // 30秒超时

    } catch (err: any) {
      // FE-16: 忽略主动取消的错误
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        console.log('[Chat] Request aborted');
      } else {
        isStreamingRef.current = false;
        message.error('发送失败: ' + (err?.response?.data?.error || err.message));
        if (isMountedRef.current) {
          setMessages(prev => [...prev, { role: 'assistant', content: '发送失败，请重试', id: 'err-' + Date.now() }]);
          setIsStreaming(false);
          setStreamingSteps([]);
        }
      }
      streamingContentRef.current = '';
      setStreamingContent('');
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
        streamingTimeoutRef.current = null;
      }
    } finally {
      setLoading(false);
      sendLockRef.current = false; // FE-04: 释放发送锁
      abortControllerRef.current = null;
    }
  };

  const selectedToolsCount = selectedTools.length;
  const selectedSkillsCount = selectedSkills.length;

  return (
    <div className="chat-container">
      {/* 左侧：会话列表 */}
      <div className={`chat-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <div style={{ padding: 12, whiteSpace: 'nowrap' }}>
          <Button type="primary" icon={<PlusOutlined />} block onClick={handleNewSession}>
            新建会话
          </Button>
        </div>
        <List
          size="small"
          dataSource={sessions}
          style={{ flex: 1, overflow: 'auto' }}
          renderItem={(s: any) => (
            <List.Item
              style={{
                cursor: 'pointer',
                padding: '8px 12px',
                background: currentSession === s.id ? '#e6f7ff' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                onClick={() => setCurrentSession(s.id)}
                style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {s.title}
              </span>
              <Dropdown
                menu={{ items: getSessionMenuItems(s), onClick: handleMenuClick(s) }}
                trigger={['click']}
              >
                <Button
                  type="primary"
                  size="small"
                  icon={<MoreOutlined />}
                  onClick={e => e.stopPropagation()}
                  style={{
                    background: '#1890ff',
                    borderColor: '#1890ff',
                    color: '#fff',
                    minWidth: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
              </Dropdown>
            </List.Item>
          )}
        />
      </div>

      {/* 左侧折叠/展开按钮 */}
      <div className="sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
        <span style={{ fontSize: 16, color: '#666', fontWeight: 500 }}>
          {sidebarCollapsed ? '›' : '‹'}
        </span>
      </div>

      {/* 中间：聊天区 */}
      <div className="chat-main">
        <div style={{ 
          padding: '8px 16px', 
          borderBottom: '1px solid #e8e8e8', 
          background: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontWeight: 500 }}>
            {currentSession ? sessions.find(s => s.id === currentSession)?.title || '当前会话' : '请选择一个会话'}
          </div>
          <Tooltip title="配置工具和技能">
            <Button 
              icon={<SettingOutlined />}
              onClick={() => setConfigModalVisible(true)}
            >
              配置
              {(selectedToolsCount > 0 || selectedSkillsCount > 0) && (
                <Badge 
                  count={selectedToolsCount + selectedSkillsCount} 
                  style={{ marginLeft: 4 }}
                  size="small"
                />
              )}
            </Button>
          </Tooltip>
        </div>

        <div className="chat-messages">
          {messages.map((m, index) => (
            <ChatMessage 
              key={m.id || index}
              role={m.role} 
              content={m.content}
              timestamp={m.timestamp}
              receivedAt={m.receivedAt}
              completedAt={m.completedAt}
              source={m.source}
            />
          ))}
          
          {isStreaming && (
            <StreamingMessage 
              steps={streamingSteps} 
              finalContent={streamingContent}
              isComplete={!!completedAt}
              receivedAt={receivedAt}
              completedAt={completedAt}
            />
          )}
          
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-input-area">
          <div style={{ display: 'flex', gap: 8 }}>
            <TextArea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="输入消息..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              onPressEnter={e => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              style={{ flex: 1 }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={loading}
              disabled={loading || isStreaming}
              onClick={handleSend}
            >
              发送
            </Button>
          </div>
        </div>
      </div>

      {/* 右侧折叠/展开按钮 */}
      <div className="panel-toggle" onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}>
        <span style={{ fontSize: 16, color: '#666', fontWeight: 500 }}>
          {rightPanelCollapsed ? '‹' : '›'}
        </span>
      </div>

      {/* 右侧：执行日志 */}
      <div className={`side-panel${rightPanelCollapsed ? ' collapsed' : ''}`}>
        <ExecutionLog executionId={lastExecutionId} />
      </div>

      {/* 配置弹窗 */}
      <Modal
        title="工具和技能配置"
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setConfigModalVisible(false)}>
            完成
          </Button>
        ]}
        width={600}
      >
        <div style={{ marginBottom: 24 }}>
          <h4>选择工具 ({selectedToolsCount} 个已选择)</h4>
          <ToolSelector selected={selectedTools} onChange={setSelectedTools} />
        </div>
        <div>
          <h4>选择技能 ({selectedSkillsCount} 个已选择)</h4>
          <SkillSelector selected={selectedSkills} onChange={setSelectedSkills} />
        </div>
      </Modal>

      {/* 重命名弹窗 */}
      <Modal
        title="重命名会话"
        open={renameModalVisible}
        onOk={confirmRename}
        onCancel={() => setRenameModalVisible(false)}
      >
        <Input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="输入新名称"
          onPressEnter={confirmRename}
        />
      </Modal>
    </div>
  );
}

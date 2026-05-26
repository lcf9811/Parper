import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Input, List, Modal, Badge, message, Tooltip, Dropdown, Popconfirm } from 'antd';
import { PlusOutlined, SendOutlined, SettingOutlined, EditOutlined, DeleteOutlined, MoreOutlined } from '@ant-design/icons';
import { getSessions, createSession, getMessages, sendChatStream, getTools, getSkills, updateSessionTitle, deleteSession, getExecution } from '../api/client';
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载会话列表和所有可用工具/技能
  useEffect(() => {
    loadSessions();
    loadAllToolsAndSkills();
    
    // 清理 SSE 连接和 execution polling
    return () => {
      isStreamingRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (executionPollRef.current) {
        clearInterval(executionPollRef.current);
        executionPollRef.current = null;
      }
    };
  }, []);

  const loadAllToolsAndSkills = async () => {
    try {
      const [toolsData, skillsData] = await Promise.all([
        getTools(),
        getSkills()
      ]);
      const enabledTools = toolsData.filter((t: any) => t.enabled).map((t: any) => t.name);
      const enabledSkills = skillsData.filter((s: any) => s.enabled).map((s: any) => s.name);
      setAllTools(enabledTools);
      setAllSkills(enabledSkills);
      // 默认全选工具，但只默认选中 general_assistant 技能，避免过多 skill prompt 导致 LLM 混乱
      setSelectedTools(enabledTools);
      const defaultSkill = enabledSkills.includes('general_assistant') ? ['general_assistant'] : [];
      setSelectedSkills(defaultSkill);
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
          loadMessages(currentSession);
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
      setSessions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const data = await getMessages(sessionId);
      console.log('[Chat] loadMessages called, raw count:', data.length, 'session:', sessionId.substring(0, 8));
      // Transform database fields (snake_case) to component props (camelCase)
      const transformedData = data.map((m: any) => ({
        ...m,
        // Ensure content is never null/undefined
        content: m.content || '(无内容)',
        // Use created_at as timestamp for display
        timestamp: m.created_at ? new Date(m.created_at).toLocaleTimeString() : null,
        // Pass source field for webhook messages
        source: m.source || 'user',
      }));
      // Filter out messages with completely empty content
      const validMessages = transformedData.filter((m: any) => m.content && m.content.trim() !== '');
      if (validMessages.length !== transformedData.length) {
        console.warn(`[Chat] Filtered out ${transformedData.length - validMessages.length} empty messages`);
      }
      setMessages(validMessages);
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
      console.log('[SSE] message event type:', data.type, 'content length:', data.content ? data.content.length : 0);

      switch (data.type) {
        case 'input':
          // 输入已接收
          setReceivedAt(new Date(data.timestamp).toLocaleTimeString());
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
      console.log('[SSE] complete data:', JSON.stringify(data).substring(0, 200));
      setCompletedAt(new Date(data.timestamp).toLocaleTimeString());
      setLastExecutionId(data.executionId);

      // 将流式内容添加到消息列表
      const finalContent = streamingContentRef.current?.trim();
      console.log('[SSE] finalContent length:', finalContent ? finalContent.length : 0);
      if (finalContent) {
        setMessages(prev => {
          const updated = [...prev, {
            role: 'assistant',
            content: finalContent,
            id: 'resp-' + Date.now(),
            completedAt: new Date(data.timestamp).toLocaleTimeString(),
          }];
          console.log('[SSE] Added assistant msg, total:', updated.length);
          return updated;
        });
      } else {
        // 如果没有收到内容，从服务器加载（fallback）
        console.warn('[Chat] SSE complete but no content received, loading from server');
        const sid = sessionIdRef.current;
        if (sid) {
          loadMessages(sid);
        }
      }

      // 立即清理流式状态（不再使用延迟，避免闪烁）
      console.log('[SSE] Cleaning up streaming state, messages length before:', (messages || []).length);
      isStreamingRef.current = false;
      setIsStreaming(false);
      setStreamingSteps([]);
      streamingContentRef.current = '';
      setStreamingContent('');
      loadSessions();

      // 关闭 SSE 连接（先清除 onerror 避免关闭时触发）
      if (eventSourceRef.current) {
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
      const sid = sessionIdRef.current;
      if (sid) {
        loadMessages(sid);
      }
    }
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    console.log('[Chat] handleSend start, messages:', messages.length);

    // 关闭之前的 SSE 连接和 execution polling
    if (eventSourceRef.current) {
      eventSourceRef.current.onerror = null;
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (executionPollRef.current) {
      clearInterval(executionPollRef.current);
      executionPollRef.current = null;
    }
    isStreamingRef.current = false; // 重置流式状态

    let sessionId = currentSession;
    if (!sessionId) {
      const session = await createSession();
      setSessions(prev => [session, ...prev]);
      setCurrentSession(session.id);
      sessionId = session.id;
    }

    const userMsg = inputText.trim();
    const userTimestamp = new Date().toLocaleTimeString();
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
      // 1. 启动流式执行，获取 executionId
      const { executionId } = await sendChatStream({
        sessionId: sessionId!,
        message: userMsg,
        tools: selectedTools,
        skills: selectedSkills,
      });

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

      // 监听所有事件类型
      eventSource.addEventListener('connected', (e) => {
        console.log('[SSE] Connected:', e.data);
      });
      eventSource.addEventListener('message', handleSSEMessage);
      eventSource.addEventListener('complete', handleSSEComplete);

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
            eventSourceRef.current.onerror = null;
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          return;
        }

        // 非流式状态或首次连接失败：静默关闭
        eventSource.close();
        eventSourceRef.current = null;
      };

      // 超时回退：如果长时间未收到 complete 事件，从服务器加载消息
      const streamingTimeout = setTimeout(() => {
        if (isStreamingRef.current) {
          console.warn('[SSE] Streaming timeout (30s), loading messages from server');
          isStreamingRef.current = false;
          setIsStreaming(false);
          setStreamingSteps([]);
          if (eventSourceRef.current) {
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
      isStreamingRef.current = false;
      message.error('发送失败: ' + (err?.response?.data?.error || err.message));
      setMessages(prev => [...prev, { role: 'assistant', content: '发送失败，请重试', id: 'err-' + Date.now() }]);
      setIsStreaming(false);
      setStreamingSteps([]);
      streamingContentRef.current = '';
      setStreamingContent('');
    } finally {
      setLoading(false);
    }
  };

  const selectedToolsCount = selectedTools.length;
  const selectedSkillsCount = selectedSkills.length;

  return (
    <div className="chat-container">
      {/* 左侧：会话列表 */}
      <div className="chat-sidebar">
        <div style={{ padding: 12 }}>
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
              onClick={handleSend}
            >
              发送
            </Button>
          </div>
        </div>
      </div>

      {/* 右侧：执行日志 */}
      <div className="side-panel">
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

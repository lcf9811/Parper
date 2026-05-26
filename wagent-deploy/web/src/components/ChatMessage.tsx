import { Tag } from 'antd';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface Props {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  timestamp?: string | null;
  receivedAt?: string | null;
  completedAt?: string | null;
  source?: 'user' | 'webhook' | null;
}

export default function ChatMessage({ role, content, timestamp, receivedAt, completedAt, source }: Props) {
  const isUser = role === 'user';
  const isWebhook = source === 'webhook';
  
  // Ensure content is not empty/null
  const safeContent = content || '';
  
  // 格式化时间显示
  const formatTime = (time: string | null | undefined) => {
    if (!time) return null;
    // 如果 time 已经是格式化的字符串（如 "10:30:45"），直接返回
    if (time.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
      return time;
    }
    try {
      const date = new Date(time);
      if (isNaN(date.getTime())) {
        // 无效的日期，返回原始字符串
        return time;
      }
      return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return time;
    }
  };

  return (
    <div className={`message-item ${role}`}>
      <div className={`message-bubble ${role}`}>
        <div style={{ marginBottom: 4 }}>
          {isUser ? (
            isWebhook ? (
              <Tag icon={<RobotOutlined />} color="orange">后台消息</Tag>
            ) : (
              <Tag icon={<UserOutlined />} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}>用户</Tag>
            )
          ) : (
            <Tag icon={<RobotOutlined />} color="geekblue">助手</Tag>
          )}
          {/* 显示时间戳 - 用户消息使用白色，助手消息使用灰色 */}
          {isUser && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginLeft: 8 }}>
              {formatTime(receivedAt) || formatTime(timestamp) || ''}
            </span>
          )}
          {/* webhook 消息显示发送时间 */}
          {isUser && isWebhook && !receivedAt && timestamp && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginLeft: 8 }}>
              {formatTime(timestamp)}
            </span>
          )}
          {!isUser && (
            <span style={{ fontSize: 11, color: '#666', marginLeft: 8 }}>
              {formatTime(completedAt) || formatTime(timestamp) || ''}
            </span>
          )}
        </div>
        <div className="message-content">
          {isUser ? (
            <div>{safeContent}</div>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {safeContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

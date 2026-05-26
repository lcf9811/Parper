import { useEffect, useRef } from 'react';
import { Spin, Steps, Collapse } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

export interface Step {
  type: 'llm_call' | 'tool_call' | 'knowledge_retrieval';
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  input?: any;
  output?: any;
  durationMs?: number;
}

interface Props {
  steps: Step[];
  finalContent?: string;
  isComplete: boolean;
  receivedAt?: string | null;
  completedAt?: string | null;
}

export default function StreamingMessage({ steps, finalContent, isComplete, receivedAt, completedAt }: Props) {
  const stepsEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [steps, finalContent]);

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'llm_call': return '🤖';
      case 'tool_call': return '🔧';
      case 'knowledge_retrieval': return '📚';
      default: return '•';
    }
  };

  const getStepStatus = (status: string) => {
    switch (status) {
      case 'completed': return 'finish';
      case 'running': return 'process';
      case 'error': return 'error';
      default: return 'wait';
    }
  };

  return (
    <div className="message-item assistant">
      <div className="message-bubble assistant streaming">
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: '#52c41a', fontWeight: 500 }}>
            <RobotOutlined style={{ marginRight: 4 }} />
            助手
          </span>
          {!isComplete && (
            <Spin size="small" style={{ marginLeft: 8 }} />
          )}
          {receivedAt && (
            <span style={{ fontSize: 11, color: '#999', marginLeft: 8 }}>
              开始处理: {receivedAt}
            </span>
          )}
        </div>

        {/* 执行步骤 */}
        {steps.length > 0 && (
          <Collapse 
            size="small" 
            defaultActiveKey={['steps']}
            style={{ marginBottom: 12, background: '#f5f5f5' }}
          >
            <Collapse.Panel header={`执行步骤 (${steps.length})`} key="steps">
              <Steps 
                direction="vertical" 
                size="small"
                current={steps.filter(s => s.status === 'completed').length}
              >
                {steps.map((step, index) => (
                  <Steps.Step
                    key={index}
                    title={
                      <span style={{ fontSize: 12 }}>
                        {getStepIcon(step.type)} {step.name}
                        {step.durationMs && (
                          <span style={{ color: '#999', marginLeft: 4 }}>
                            ({step.durationMs}ms)
                          </span>
                        )}
                      </span>
                    }
                    status={getStepStatus(step.status) as any}
                    description={
                      step.status === 'running' ? (
                        <Spin size="small" />
                      ) : step.output ? (
                        <span style={{ fontSize: 11, color: '#666' }}>
                          {JSON.stringify(step.output).substring(0, 100)}
                          {JSON.stringify(step.output).length > 100 ? '...' : ''}
                        </span>
                      ) : null
                    }
                  />
                ))}
              </Steps>
            </Collapse.Panel>
          </Collapse>
        )}

        {/* 生成中提示 */}
        {!isComplete && steps.length > 0 && steps[steps.length - 1]?.status === 'running' && (
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
            正在{steps[steps.length - 1]?.name}...
          </div>
        )}

        {/* 最终内容 */}
        {(finalContent && finalContent.trim() !== '') ? (
          <div className="message-content" style={{ marginTop: 8, minHeight: '1.5em' }}>
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
                {finalContent}
              </ReactMarkdown>
            </div>
          </div>
        ) : isComplete ? (
          <div className="message-content" style={{ marginTop: 8, color: '#999', fontStyle: 'italic' }}>
            (无内容)
          </div>
        ) : null}

        {/* 完成时间 */}
        {completedAt && (
          <div style={{ fontSize: 11, color: '#999', marginTop: 8 }}>
            完成时间: {completedAt}
          </div>
        )}

        <div ref={stepsEndRef} />
      </div>
    </div>
  );
}

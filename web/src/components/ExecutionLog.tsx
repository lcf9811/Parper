import { useEffect, useState } from 'react';
import { Collapse, Tag, Typography, Spin } from 'antd';
import { getExecutionSteps } from '../api/client';

const { Text } = Typography;

interface Props {
  executionId: string | null;
}

export default function ExecutionLog({ executionId }: Props) {
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!executionId) return;
    let pollId: number | null = null;

    const loadSteps = async () => {
      try {
        const data = await getExecutionSteps(executionId);
        setSteps(data);
        // 若最后一步已完成/出错，停止轮询
        const lastStep = data[data.length - 1];
        const isFinished = lastStep && (lastStep.stepStatus === 'completed' || lastStep.stepStatus === 'error');
        if (isFinished && pollId) {
          clearInterval(pollId);
          pollId = null;
        }
      } catch (e) {
        console.error(e);
      }
    };

    // 立即加载 + 开始轮询
    setLoading(true);
    loadSteps().finally(() => setLoading(false));
    pollId = window.setInterval(() => {
      loadSteps();
    }, 2000);

    return () => {
      if (pollId) clearInterval(pollId);
    };
  }, [executionId]);

  if (!executionId) {
    return <Text type="secondary">发送消息后查看执行日志</Text>;
  }

  if (loading) return <Spin size="small" />;

  const typeColors: Record<string, string> = {
    llm_call: 'blue',
    tool_call: 'green',
    knowledge_retrieval: 'orange',
  };

  return (
    <div>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>执行日志</Text>
      <Collapse size="small" accordion>
        {steps.map((step, i) => (
          <Collapse.Panel
            key={step.id}
            header={
              <span>
                <Tag color={typeColors[step.type] || 'default'}>{step.type}</Tag>
                {step.name && <Text code>{step.name}</Text>}
                {step.duration_ms && <Text type="secondary" style={{ marginLeft: 8 }}>{step.duration_ms}ms</Text>}
              </span>
            }
          >
            {step.input && (
              <div style={{ marginBottom: 8 }}>
                <Text strong>Input:</Text>
                <pre style={{ fontSize: 12, background: '#f6f6f6', padding: 8, borderRadius: 4, overflow: 'auto' }}>
                  {JSON.stringify(step.input, null, 2)}
                </pre>
              </div>
            )}
            {step.output && (
              <div>
                <Text strong>Output:</Text>
                <pre style={{ fontSize: 12, background: '#f6f6f6', padding: 8, borderRadius: 4, overflow: 'auto' }}>
                  {JSON.stringify(step.output, null, 2)}
                </pre>
              </div>
            )}
          </Collapse.Panel>
        ))}
      </Collapse>
      {steps.length === 0 && <Text type="secondary">暂无步骤</Text>}
    </div>
  );
}

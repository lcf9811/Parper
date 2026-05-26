import { useState, useEffect } from 'react';
import { Card, Table, Tag, Collapse, Typography } from 'antd';
import { getExecutions, getExecutionSteps } from '../api/client';

const { Text } = Typography;

export default function Architecture() {
  const [executions, setExecutions] = useState<any[]>([]);
  const [selectedSteps, setSelectedSteps] = useState<any[]>([]);
  const [selectedExecId, setSelectedExecId] = useState<string | null>(null);

  useEffect(() => {
    loadExecutions();
  }, []);

  const loadExecutions = async () => {
    try {
      setExecutions(await getExecutions());
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewSteps = async (executionId: string) => {
    try {
      const steps = await getExecutionSteps(executionId);
      setSelectedSteps(steps);
      setSelectedExecId(executionId);
    } catch (err) {
      console.error(err);
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'default',
    running: 'processing',
    completed: 'success',
    failed: 'error',
  };

  const execColumns = [
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={statusColors[v]}>{v}</Tag>,
    },
    {
      title: '输入',
      dataIndex: 'input',
      key: 'input',
      ellipsis: true,
    },
    {
      title: '耗时',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      width: 100,
      render: (v: number | null) => v ? `${v}ms` : '-',
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => (
        <a onClick={() => handleViewSteps(record.id)}>查看步骤</a>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>架构 & 执行日志</h2>

      {/* 架构概要 */}
      <Card title="当前架构" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <Card size="small" title="图模式">
            <Tag color="blue">react_single_agent</Tag>
            <p style={{ marginTop: 8, color: '#666' }}>
              StateGraph + ToolNode + toolsCondition<br />
              ReAct 风格工具路由
            </p>
          </Card>
          <Card size="small" title="内置工具">
            <Tag>current_time</Tag>
            <Tag>knowledge_lookup</Tag>
            <Tag>skill_catalog</Tag>
          </Card>
          <Card size="small" title="内置技能">
            <Tag>general_assistant</Tag>
            <Tag>planner</Tag>
            <Tag>researcher</Tag>
            <Tag>builder</Tag>
          </Card>
        </div>
      </Card>

      {/* 执行记录 */}
      <Card title="执行记录" style={{ marginBottom: 24 }}>
        <Table
          dataSource={executions}
          columns={execColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>

      {/* 执行步骤 */}
      {selectedExecId && (
        <Card title={`执行步骤 - ${selectedExecId.substring(0, 8)}...`}>
          <Collapse accordion>
            {selectedSteps.map(step => (
              <Collapse.Panel
                key={step.id}
                header={
                  <span>
                    <Tag color={step.type === 'llm_call' ? 'blue' : step.type === 'tool_call' ? 'green' : 'orange'}>
                      {step.type}
                    </Tag>
                    {step.name && <Text code>{step.name}</Text>}
                    {step.duration_ms && <Text type="secondary" style={{ marginLeft: 8 }}>{step.duration_ms}ms</Text>}
                  </span>
                }
              >
                {step.input && (
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>Input:</Text>
                    <pre style={{ fontSize: 12, background: '#f6f6f6', padding: 8, borderRadius: 4 }}>
                      {JSON.stringify(step.input, null, 2)}
                    </pre>
                  </div>
                )}
                {step.output && (
                  <div>
                    <Text strong>Output:</Text>
                    <pre style={{ fontSize: 12, background: '#f6f6f6', padding: 8, borderRadius: 4 }}>
                      {JSON.stringify(step.output, null, 2)}
                    </pre>
                  </div>
                )}
              </Collapse.Panel>
            ))}
          </Collapse>
          {selectedSteps.length === 0 && <Text type="secondary">暂无步骤</Text>}
        </Card>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Table, Switch, Tag, message } from 'antd';
import { getTools, toggleTool } from '../api/client';

export default function Tools() {
  const [tools, setTools] = useState<any[]>([]);

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    try {
      setTools(await getTools());
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await toggleTool(id, enabled);
      message.success(enabled ? '已启用' : '已禁用');
      loadTools();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '显示名称', dataIndex: 'display_name', key: 'display_name' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '类型',
      dataIndex: 'built_in',
      key: 'built_in',
      render: (v: boolean) => v ? <Tag color="blue">内置</Tag> : <Tag>自定义</Tag>,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean, record: any) => (
        <Switch checked={enabled} onChange={v => handleToggle(record.id, v)} />
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>工具管理</h2>
      <Table dataSource={tools} columns={columns} rowKey="id" pagination={false} />
    </div>
  );
}

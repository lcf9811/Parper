import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, message, Space } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { getMemories, createMemory, deleteMemory, searchMemories } from '../api/client';

const { TextArea } = Input;
const { Option } = Select;

interface Memory {
  id: string;
  type: 'fact' | 'preference' | 'summary';
  content: string;
  context: string | null;
  importance: number;
  created_at: string;
  updated_at: string;
}

const typeLabels: Record<string, string> = {
  fact: '事实',
  preference: '偏好',
  summary: '总结',
};

const typeColors: Record<string, string> = {
  fact: 'blue',
  preference: 'green',
  summary: 'orange',
};

export default function Memories() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const data = await getMemories();
      setMemories(data);
    } catch (err) {
      message.error('加载记忆失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadMemories();
      return;
    }
    setLoading(true);
    try {
      const data = await searchMemories(searchQuery);
      setMemories(data);
    } catch (err) {
      message.error('搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await createMemory(values);
      message.success('记忆已添加');
      setModalVisible(false);
      form.resetFields();
      loadMemories();
    } catch (err) {
      message.error('添加失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMemory(id);
      message.success('记忆已删除');
      loadMemories();
    } catch (err) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color={typeColors[type]}>{typeLabels[type]}</Tag>
      ),
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      render: (text: string) => (
        <div style={{ maxWidth: 400, whiteSpace: 'pre-wrap' }}>{text}</div>
      ),
    },
    {
      title: '上下文',
      dataIndex: 'context',
      key: 'context',
      render: (text: string | null) => text || '-',
    },
    {
      title: '重要度',
      dataIndex: 'importance',
      key: 'importance',
      width: 100,
      render: (value: number) => (
        <Tag color={value >= 8 ? 'red' : value >= 5 ? 'orange' : 'default'}>
          {value}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: Memory) => (
        <Popconfirm
          title="确认删除"
          description="确定要删除这条记忆吗？"
          onConfirm={() => handleDelete(record.id)}
          okText="删除"
          cancelText="取消"
        >
          <Button icon={<DeleteOutlined />} danger size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="长期记忆管理"
        extra={
          <Space>
            <Input
              placeholder="搜索记忆..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onPressEnter={handleSearch}
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
            />
            <Button onClick={handleSearch}>搜索</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
              添加记忆
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={memories}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="添加记忆"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true }]}
            initialValue="fact"
          >
            <Select>
              <Option value="fact">事实</Option>
              <Option value="preference">偏好</Option>
              <Option value="summary">总结</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <TextArea rows={4} placeholder="记忆内容" />
          </Form.Item>
          <Form.Item name="context" label="上下文">
            <TextArea rows={2} placeholder="可选：补充上下文信息" />
          </Form.Item>
          <Form.Item name="importance" label="重要程度" initialValue={5}>
            <Select>
              <Option value={10}>10 - 非常重要</Option>
              <Option value={8}>8 - 很重要</Option>
              <Option value={5}>5 - 一般</Option>
              <Option value={3}>3 - 较低</Option>
              <Option value={1}>1 - 低</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

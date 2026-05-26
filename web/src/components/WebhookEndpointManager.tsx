import { useState, useEffect } from 'react';
import { Card, Button, Table, Tag, Modal, Form, Select, Input, message, Space, Tooltip, Popconfirm, Switch, Alert } from 'antd';
import { PlusOutlined, CopyOutlined, DeleteOutlined, EditOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { 
  getWebhookEndpoints, 
  createWebhookEndpoint, 
  updateWebhookEndpoint,
  deleteWebhookEndpoint, 
  toggleWebhookEndpoint,
  getSessions, 
  getTools, 
  getSkills 
} from '../api/client';

interface WebhookEndpoint {
  id: string;
  session_id: string;
  webhook_url: string;
  full_url: string;
  bearer_key: string;
  selected_tools: string[];
  selected_skills: string[];
  description: string;
  enabled: boolean;
  created_at: string;
}

export default function WebhookEndpointManager() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [tools, setTools] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpoint | null>(null);
  const [form] = Form.useForm();
  const [showBearerKey, setShowBearerKey] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eps, sess, ts, sks] = await Promise.all([
        getWebhookEndpoints(),
        getSessions(),
        getTools(),
        getSkills()
      ]);
      setEndpoints(eps);
      setSessions(sess);
      setTools(ts.filter((t: any) => t.enabled));
      setSkills(sks.filter((s: any) => s.enabled));
    } catch (err: any) {
      message.error('加载数据失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await createWebhookEndpoint({
        sessionId: values.sessionId,
        selectedTools: values.selectedTools || [],
        selectedSkills: values.selectedSkills || [],
        description: values.description
      });
      message.success('Webhook 端点创建成功');
      setModalVisible(false);
      form.resetFields();
      loadData();
    } catch (err: any) {
      message.error('创建失败: ' + err.message);
    }
  };

  const handleUpdate = async (values: any) => {
    if (!editingEndpoint) return;
    try {
      await updateWebhookEndpoint(editingEndpoint.id, {
        sessionId: values.sessionId,
        selectedTools: values.selectedTools || [],
        selectedSkills: values.selectedSkills || [],
        description: values.description
      });
      message.success('Webhook 端点更新成功');
      setModalVisible(false);
      setEditingEndpoint(null);
      form.resetFields();
      loadData();
    } catch (err: any) {
      message.error('更新失败: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWebhookEndpoint(id);
      message.success('已删除');
      loadData();
    } catch (err: any) {
      message.error('删除失败: ' + err.message);
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await toggleWebhookEndpoint(id, enabled);
      message.success(enabled ? '已启用' : '已禁用');
      loadData();
    } catch (err: any) {
      message.error('操作失败: ' + err.message);
    }
  };

  const openEditModal = (record: WebhookEndpoint) => {
    setEditingEndpoint(record);
    form.setFieldsValue({
      sessionId: record.session_id,
      description: record.description,
      selectedTools: record.selected_tools,
      selectedSkills: record.selected_skills,
    });
    setModalVisible(true);
  };

  const openCreateModal = () => {
    setEditingEndpoint(null);
    form.resetFields();
    setModalVisible(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`${label} 已复制到剪贴板`);
  };

  const toggleBearerKeyVisibility = (id: string) => {
    setShowBearerKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const columns = [
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: WebhookEndpoint) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleToggleEnabled(record.id, checked)}
          size="small"
        />
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 150,
      ellipsis: true,
      render: (text: string) => text || '-'
    },
    {
      title: '关联会话',
      dataIndex: 'session_id',
      key: 'session_id',
      width: 150,
      ellipsis: true,
      render: (id: string) => {
        const session = sessions.find(s => s.id === id);
        return session ? session.title : id.substring(0, 8) + '...';
      }
    },
    {
      title: 'Webhook URL',
      dataIndex: 'full_url',
      key: 'full_url',
      width: 280,
      render: (url: string) => (
        <Space size={4}>
          <span style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', whiteSpace: 'normal', display: 'inline-block', maxWidth: 250 }}>{url}</span>
          <Tooltip title="复制 URL">
            <Button 
              icon={<CopyOutlined />} 
              size="small"
              onClick={() => copyToClipboard(url, 'Webhook URL')}
            />
          </Tooltip>
        </Space>
      )
    },
    {
      title: 'Bearer Key',
      dataIndex: 'bearer_key',
      key: 'bearer_key',
      width: 200,
      render: (key: string, record: WebhookEndpoint) => {
        const isVisible = showBearerKey[record.id];
        return (
          <Space size={4}>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {isVisible ? key : '••••••••••••••••••••••••••'}
            </span>
            <Tooltip title={isVisible ? '隐藏' : '显示'}>
              <Button 
                icon={isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />} 
                size="small"
                onClick={() => toggleBearerKeyVisibility(record.id)}
              />
            </Tooltip>
            <Tooltip title="复制 Bearer Key">
              <Button 
                icon={<CopyOutlined />} 
                size="small"
                onClick={() => copyToClipboard(key, 'Bearer Key')}
              />
            </Tooltip>
          </Space>
        );
      }
    },
    {
      title: '选中工具',
      dataIndex: 'selected_tools',
      key: 'selected_tools',
      width: 200,
      render: (tools: string[]) => (
        <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {tools?.slice(0, 3).map(t => <Tag key={t}>{t}</Tag>)}
          {tools?.length > 3 && <Tag>+{tools.length - 3}</Tag>}
        </div>
      )
    },
    {
      title: '选中技能',
      dataIndex: 'selected_skills',
      key: 'selected_skills',
      width: 200,
      render: (skills: string[]) => (
        <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {skills?.slice(0, 3).map(s => <Tag key={s} color="blue">{s}</Tag>)}
          {skills?.length > 3 && <Tag>+{skills.length - 3}</Tag>}
        </div>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: WebhookEndpoint) => (
        <Space size={4}>
          <Tooltip title="编辑">
            <Button 
              icon={<EditOutlined />} 
              size="small"
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除?"
            description="删除后将无法恢复，相关 Webhook 调用将失败。"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '0' }}>
      <Card 
        title="Webhook 端点管理" 
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新建 Webhook
          </Button>
        }
        bodyStyle={{ padding: 0 }}
      >
        <Table 
          dataSource={endpoints} 
          columns={columns} 
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 1400 }}
          pagination={{ 
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </Card>

      <Modal
        title={editingEndpoint ? "编辑 Webhook 端点" : "新建 Webhook 端点"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingEndpoint(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
        destroyOnClose
      >
        {/* 编辑时显示 Webhook 信息 */}
        {editingEndpoint && (
          <div style={{ marginBottom: 16 }}>
            <Alert
              type="info"
              showIcon
              message="Webhook 端点信息"
              description={
                <div style={{ marginTop: 8 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Webhook URL:</strong>
                    <Space size={4} style={{ marginLeft: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                        {editingEndpoint.full_url}
                      </span>
                      <Button
                        icon={<CopyOutlined />}
                        size="small"
                        onClick={() => copyToClipboard(editingEndpoint.full_url, 'Webhook URL')}
                      />
                    </Space>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Hook 路径:</strong>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, marginLeft: 8 }}>{editingEndpoint.webhook_url}</span>
                  </div>
                  <div>
                    <strong>Bearer Key:</strong>
                    <Space size={4} style={{ marginLeft: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {showBearerKey[editingEndpoint.id] ? editingEndpoint.bearer_key : '••••••••••••••••••••••••••'}
                      </span>
                      <Button
                        icon={showBearerKey[editingEndpoint.id] ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        size="small"
                        onClick={() => toggleBearerKeyVisibility(editingEndpoint.id)}
                      />
                      <Button
                        icon={<CopyOutlined />}
                        size="small"
                        onClick={() => copyToClipboard(editingEndpoint.bearer_key, 'Bearer Key')}
                      />
                    </Space>
                  </div>
                </div>
              }
            />
          </div>
        )}
        <Form 
          form={form} 
          layout="vertical" 
          onFinish={editingEndpoint ? handleUpdate : handleCreate}
        >
          <Form.Item 
            name="sessionId" 
            label="关联会话" 
            rules={[{ required: true, message: '请选择会话' }]}
          >
            <Select placeholder="选择要关联的会话">
              {sessions.map(s => (
                <Select.Option key={s.id} value={s.id}>{s.title}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input placeholder="如：代码审查 Webhook" />
          </Form.Item>

          <Form.Item name="selectedTools" label="选择工具">
            <Select mode="multiple" placeholder="选择可用的工具">
              {tools.map(t => (
                <Select.Option key={t.name} value={t.name}>{t.display_name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="selectedSkills" label="选择技能">
            <Select mode="multiple" placeholder="选择可用的技能">
              {skills.map(s => (
                <Select.Option key={s.name} value={s.name}>{s.display_name}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingEndpoint ? '保存' : '创建'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                setEditingEndpoint(null);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

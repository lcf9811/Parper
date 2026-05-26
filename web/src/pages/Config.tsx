import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, Switch, InputNumber, message, Space, Tag, Popconfirm, Tabs } from 'antd';
import { 
  getProviders, createProvider, updateProvider, activateProvider, deleteProvider, 
  getLangGraphConfig, updateLangGraphConfig, 
  getWebhookConfig, updateWebhookConfig 
} from '../api/client';
import WebhookEndpointManager from '../components/WebhookEndpointManager';

const { TabPane } = Tabs;

export default function Config() {
  const [providers, setProviders] = useState<any[]>([]);
  const [lgConfig, setLgConfig] = useState<any>(null);
  const [editingProvider, setEditingProvider] = useState<any>(null);
  const [webhookConfig, setWebhookConfig] = useState<any>({ defaultWebhookUrl: '', enabled: false, mappings: [] });
  const [activeTab, setActiveTab] = useState('providers');
  const [providerForm] = Form.useForm();
  const [lgForm] = Form.useForm();
  const [webhookForm] = Form.useForm();

  useEffect(() => {
    loadProviders();
    loadLgConfig();
    loadWebhookConfig();
  }, []);

  const loadProviders = async () => {
    try {
      setProviders(await getProviders());
    } catch (err) {
      console.error(err);
    }
  };

  const loadLgConfig = async () => {
    try {
      const c = await getLangGraphConfig();
      setLgConfig(c);
      lgForm.setFieldsValue(c);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProvider = async (values: any) => {
    try {
      if (editingProvider) {
        await updateProvider(editingProvider.id, values);
        message.success('Provider 已更新');
      } else {
        await createProvider(values);
        message.success('Provider 已创建');
      }
      setEditingProvider(null);
      providerForm.resetFields();
      loadProviders();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateProvider(id);
      message.success('已激活');
      loadProviders();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      await deleteProvider(id);
      message.success('已删除');
      loadProviders();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleSaveLgConfig = async (values: any) => {
    try {
      await updateLangGraphConfig(values);
      message.success('LangGraph 配置已保存');
      loadLgConfig();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const loadWebhookConfig = async () => {
    try {
      const c = await getWebhookConfig();
      setWebhookConfig(c);
      webhookForm.setFieldsValue(c);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveWebhookConfig = async (values: any) => {
    try {
      await updateWebhookConfig(values);
      message.success('Webhook 配置已保存');
      loadWebhookConfig();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: '100%', width: '100%', margin: '0 auto' }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* LLM Provider */}
        <TabPane tab="LLM Provider" key="providers">
          <Card title="LLM Provider 配置">
            <div style={{ marginBottom: 16 }}>
              {providers.map(p => (
                <Card key={p.id} size="small" style={{ marginBottom: 8 }}
                  extra={
                    <Space>
                      {p.is_active ? <Tag color="green">已激活</Tag> : (
                        <Button size="small" onClick={() => handleActivate(p.id)}>激活</Button>
                      )}
                      <Button size="small" onClick={() => { setEditingProvider(p); providerForm.setFieldsValue(p); }}>编辑</Button>
                      <Popconfirm title="确认删除？" onConfirm={() => handleDeleteProvider(p.id)}>
                        <Button size="small" danger>删除</Button>
                      </Popconfirm>
                    </Space>
                  }
                >
                  <p><strong>{p.name}</strong></p>
                  <p>模型: {p.default_model} | Base URL: {p.api_base_url || '默认'}</p>
                  {p.planner_model && <p>Planner: {p.planner_model}</p>}
                  {p.reviewer_model && <p>Reviewer: {p.reviewer_model}</p>}
                </Card>
              ))}
            </div>

            <Card size="small" title={editingProvider ? '编辑 Provider' : '新增 Provider'}>
              <Form form={providerForm} layout="vertical" onFinish={handleSaveProvider}>
                <Form.Item name="name" label="名称" rules={[{ required: true }]}>
                  <Input placeholder="如 OpenAI, Moonshot Kimi" />
                </Form.Item>
                <Form.Item name="api_base_url" label="API Base URL">
                  <Input placeholder="如 https://api.moonshot.ai/v1" />
                </Form.Item>
                <Form.Item name="api_key" label="API Key">
                  <Input.Password placeholder="sk-..." />
                </Form.Item>
                <Form.Item name="default_model" label="默认模型" rules={[{ required: true }]}>
                  <Input placeholder="如 gpt-4.1-mini, kimi-k2.5" />
                </Form.Item>
                <Form.Item name="planner_model" label="Planner 模型">
                  <Input placeholder="如 kimi-k2-thinking" />
                </Form.Item>
                <Form.Item name="reviewer_model" label="Reviewer 模型">
                  <Input placeholder="如 kimi-k2.5" />
                </Form.Item>
                <Button type="primary" htmlType="submit">保存</Button>
                {editingProvider && (
                  <Button style={{ marginLeft: 8 }} onClick={() => { setEditingProvider(null); providerForm.resetFields(); }}>取消</Button>
                )}
              </Form>
            </Card>
          </Card>
        </TabPane>

        {/* LangGraph Config */}
        <TabPane tab="LangGraph 配置" key="langgraph">
          <Card title="LangGraph 运行时配置">
            <Form form={lgForm} layout="vertical" onFinish={handleSaveLgConfig}>
              <Form.Item name="graph_mode" label="图模式">
                <Select options={[
                  { label: 'ReAct Single Agent', value: 'react_single_agent' },
                  { label: 'Planner-Executor-Reviewer (规划中)', value: 'planner_executor_reviewer' },
                ]} />
              </Form.Item>
              <Form.Item name="knowledge_top_k" label="知识检索 Top-K">
                <InputNumber min={1} max={20} />
              </Form.Item>
              <Form.Item name="max_history_messages" label="最大历史消息数">
                <InputNumber min={1} max={100} />
              </Form.Item>
              <Form.Item name="auto_knowledge_retrieval" label="自动知识检索" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="tool_loop_enabled" label="工具循环" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="interrupt_before_tools" label="工具调用前中断" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="stream_mode" label="流式模式">
                <Select options={[
                  { label: '关闭', value: 'none' },
                  { label: '流式输出', value: 'stream' },
                ]} />
              </Form.Item>
              <Button type="primary" htmlType="submit">保存配置</Button>
            </Form>
          </Card>
        </TabPane>

        {/* Webhook Endpoints */}
        <TabPane tab="Webhook 端点" key="webhook-endpoints">
          <WebhookEndpointManager />
        </TabPane>

        {/* Webhook Global Config */}
        <TabPane tab="Webhook 全局配置" key="webhook-config">
          <Card title="Webhook 全局配置">
            <Form form={webhookForm} layout="vertical" onFinish={handleSaveWebhookConfig}>
              <Form.Item name="enabled" label="启用 Webhook" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="defaultWebhookUrl" label="默认 Webhook 地址">
                <Input placeholder="http://example.com/webhook" />
              </Form.Item>
              <Form.Item label="Skill 映射配置">
                <p style={{ color: '#666', fontSize: 12 }}>为特定 Skill 配置独立的 Webhook 地址</p>
              </Form.Item>
              <Form.List name="mappings">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                        <Form.Item
                          {...restField}
                          name={[name, 'skill']}
                          rules={[{ required: true, message: '请输入 Skill 名称' }]}
                        >
                          <Input placeholder="Skill 名称" />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          name={[name, 'webhookUrl']}
                          rules={[{ required: true, message: '请输入 Webhook 地址' }]}
                        >
                          <Input placeholder="Webhook 地址" style={{ width: 300 }} />
                        </Form.Item>
                        <Button onClick={() => remove(name)}>删除</Button>
                      </Space>
                    ))}
                    <Form.Item>
                      <Button type="dashed" onClick={() => add()} block>
                        添加 Skill 映射
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
              <Button type="primary" htmlType="submit">保存 Webhook 配置</Button>
            </Form>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
}

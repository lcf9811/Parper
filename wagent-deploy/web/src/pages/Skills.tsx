import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Popconfirm, Tag, Select, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getSkills, createSkill, updateSkill, deleteSkill } from '../api/client';

const { TextArea } = Input;

// 预定义标签颜色映射
const TAG_COLORS: Record<string, string> = {
  '通用': 'blue',
  '代码': 'green',
  '运维': 'orange',
  '规划': 'purple',
  '研究': 'cyan',
  '业务': 'red',
  '水处理': 'magenta',
  '编排': 'gold',
};

// 预定义标签选项
const TAG_OPTIONS = [
  { label: '通用', value: '通用' },
  { label: '代码', value: '代码' },
  { label: '运维', value: '运维' },
  { label: '规划', value: '规划' },
  { label: '研究', value: '研究' },
  { label: '业务', value: '业务' },
  { label: '水处理', value: '水处理' },
  { label: '编排', value: '编排' },
];

const getTagColor = (tag: string) => TAG_COLORS[tag] || 'default';

export default function Skills() {
  const [skills, setSkills] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      setSkills(await getSkills());
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (values: any) => {
    try {
      const data = {
        ...values,
        tags: values.tags || [],
      };
      if (editing) {
        await updateSkill(editing.id, data);
        message.success('技能已更新');
      } else {
        await createSkill(data);
        message.success('技能已创建');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      loadSkills();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSkill(id);
      message.success('已删除');
      loadSkills();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 180 },
    { title: '显示名称', dataIndex: 'display_name', key: 'display_name', width: 160 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      width: 180,
      render: (tags: string[]) => (
        <Space size={[0, 4]} wrap>
          {tags?.map(tag => (
            <Tag key={tag} color={getTagColor(tag)}>{tag}</Tag>
          ))}
          {(!tags || tags.length === 0) && <Tag>未分类</Tag>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (v: boolean) => v ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: any) => (
        <>
          <Button type="link" size="small" onClick={() => {
            setEditing(record);
            form.setFieldsValue({ ...record, tags: record.tags || [] });
            setModalOpen(true);
          }}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>技能管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          新增技能
        </Button>
      </div>

      <Table
        dataSource={skills}
        columns={columns}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          pageSizeOptions: ['5', '10', '20', '50'],
        }}
      />

      <Modal
        title={editing ? '编辑技能' : '新增技能'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
        onOk={() => form.submit()}
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="技能标识" rules={[{ required: true }]}>
            <Input placeholder="如 general_assistant" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称" rules={[{ required: true }]}>
            <Input placeholder="如 通用助手" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="简短描述该技能" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="选择或输入标签" options={TAG_OPTIONS} />
          </Form.Item>
          <Form.Item name="system_prompt" label="System Prompt" rules={[{ required: true }]}>
            <TextArea rows={8} placeholder="该技能对应的系统提示词..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

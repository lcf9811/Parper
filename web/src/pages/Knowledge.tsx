import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, message, Popconfirm, Tag, Drawer } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getKnowledge, addKnowledge, deleteKnowledge, getChunks } from '../api/client';

const { TextArea } = Input;

export default function Knowledge() {
  const [docs, setDocs] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [chunks, setChunks] = useState<any[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    try {
      setDocs(await getKnowledge());
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdd = async (values: any) => {
    try {
      await addKnowledge(values);
      message.success('文档已入库');
      setModalOpen(false);
      form.resetFields();
      loadDocs();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteKnowledge(id);
      message.success('已删除');
      loadDocs();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleViewChunks = async (docId: string, title: string) => {
    try {
      const data = await getChunks(docId);
      setChunks(data);
      setDrawerTitle(title);
      setDrawerOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'default',
    chunked: 'green',
    failed: 'red',
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '来源', dataIndex: 'source', key: 'source', ellipsis: true },
    { title: '分块数', dataIndex: 'chunk_count', key: 'chunk_count' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={statusColors[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <>
          <Button type="link" size="small" onClick={() => handleViewChunks(record.id, record.title)}>
            查看分块
          </Button>
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
        <h2>知识库</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
          录入文档
        </Button>
      </div>

      <Table dataSource={docs} columns={columns} rowKey="id" pagination={false} />

      <Modal
        title="录入知识文档"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="文档标题" />
          </Form.Item>
          <Form.Item name="source" label="来源">
            <Input placeholder="URL 或文件名（可选）" />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}>
            <TextArea rows={10} placeholder="粘贴文档内容..." />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`分块预览 - ${drawerTitle}`}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={500}
      >
        {chunks.map((c, i) => (
          <div key={c.id} style={{ marginBottom: 16, padding: 12, background: '#f6f6f6', borderRadius: 8 }}>
            <div style={{ marginBottom: 4, color: '#999', fontSize: 12 }}>
              块 #{c.chunk_index} | {c.char_count} 字符
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{c.content}</div>
          </div>
        ))}
        {chunks.length === 0 && <p>暂无分块数据</p>}
      </Drawer>
    </div>
  );
}

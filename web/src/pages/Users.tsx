import { useState, useEffect } from 'react';
import { Card, Table, Button, Popconfirm, message, Tag, Space, Modal, Form, Input, Switch } from 'antd';
import { DeleteOutlined, PlusOutlined, KeyOutlined } from '@ant-design/icons';
import { getUsers, createUser, resetUserPassword, deleteUser } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface User {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [createForm] = Form.useForm();
  const [resetForm] = Form.useForm();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      message.error(err.response?.data?.error || '加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    try {
      await createUser({
        username: values.username,
        password: values.password,
        displayName: values.displayName,
        isAdmin: values.isAdmin
      });
      message.success('用户创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadUsers();
    } catch (err: any) {
      message.error(err.response?.data?.error || '创建失败');
    }
  };

  const handleResetPassword = async (values: any) => {
    if (!resettingUser) return;
    try {
      await resetUserPassword(resettingUser.id, values.newPassword);
      message.success('密码重置成功');
      setResetModalVisible(false);
      setResettingUser(null);
      resetForm.resetFields();
    } catch (err: any) {
      message.error(err.response?.data?.error || '重置失败');
    }
  };

  const openResetModal = (user: User) => {
    setResettingUser(user);
    resetForm.resetFields();
    setResetModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id);
      message.success('用户已删除');
      loadUsers();
    } catch (err: any) {
      message.error(err.response?.data?.error || '删除失败');
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (text: string) => text || '-',
    },
    {
      title: '角色',
      dataIndex: 'isAdmin',
      key: 'isAdmin',
      render: (isAdmin: boolean) => isAdmin ? <Tag color="red">管理员</Tag> : <Tag>普通用户</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: User) => (
        <Space>
          <Button 
            size="small" 
            icon={<KeyOutlined />}
            onClick={() => openResetModal(record)}
          >
            重置密码
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除此用户吗"
            onConfirm={() => handleDelete(record.id)}
            disabled={record.id === currentUser?.id}
            okText="删除"
            cancelText="取消"
          >
            <Button 
              icon={<DeleteOutlined />} 
              danger 
              size="small"
              disabled={record.id === currentUser?.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card 
        title="用户管理"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建用户
          </Button>
        }
      >
        <Table 
          dataSource={users} 
          columns={columns} 
          rowKey="id"
          loading={loading}
          size="small"
        />
      </Card>

      <Modal
        title="创建用户"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={null}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="显示名称"
          >
            <Input placeholder="显示名称（可选）" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6位' }
            ]}
          >
            <Input.Password placeholder="密码" />
          </Form.Item>
          <Form.Item
            name="isAdmin"
            label="管理员权限"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`重置密码 - ${resettingUser?.username || ''}`}
        open={resetModalVisible}
        onCancel={() => {
          setResetModalVisible(false);
          setResettingUser(null);
          resetForm.resetFields();
        }}
        footer={null}
      >
        <Form form={resetForm} layout="vertical" onFinish={handleResetPassword}>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' }
            ]}
          >
            <Input.Password placeholder="新密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              重置密码
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

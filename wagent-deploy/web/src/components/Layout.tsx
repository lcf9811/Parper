import { useState, useEffect } from 'react';
import { getSiteSettings, applySiteSettings } from '../pages/SiteSettings';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Layout as AntLayout, Menu, Dropdown, Button, Avatar } from 'antd';
import {
  MessageOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  BookOutlined,
  ApartmentOutlined,
  UserOutlined,
  LogoutOutlined,
  TeamOutlined,
  DatabaseOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { appConfig } from '../config/appConfig';

const { Sider, Content, Header } = AntLayout;

const menuItems = [
  { key: '/', icon: <MessageOutlined />, label: 'Agent Chat' },
  { key: '/config', icon: <SettingOutlined />, label: 'Config' },
  { key: '/skills', icon: <ThunderboltOutlined />, label: 'Skills' },
  { key: '/tools', icon: <ToolOutlined />, label: 'Tools' },
  { key: '/knowledge', icon: <BookOutlined />, label: 'Knowledge' },
  { key: '/memories', icon: <DatabaseOutlined />, label: 'Memories' },
  { key: '/architecture', icon: <ApartmentOutlined />, label: 'Architecture' },
];

// Logo 组件 - 从 localStorage 读取站点设置
function Logo() {
  const [logoConfig, setLogoConfig] = useState({ type: 'text', value: 'WAgent' });

  useEffect(() => {
    // Load from localStorage
    try {
      const stored = localStorage.getItem('wagent_site_settings');
      if (stored) {
        const settings = JSON.parse(stored);
        if (settings.logoType === 'image') {
          const imageUrl = settings.logoImageData || settings.logoImageUrl;
          if (imageUrl) {
            setLogoConfig({ type: 'image', value: imageUrl });
          } else {
            setLogoConfig({ type: 'text', value: settings.logoText || settings.siteName || 'WAgent' });
          }
        } else {
          setLogoConfig({ type: 'text', value: settings.logoText || settings.siteName || 'WAgent' });
        }
      }
    } catch (e) {
      console.error('Failed to load logo settings:', e);
    }

    // Listen for storage changes
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem('wagent_site_settings');
        if (stored) {
          const settings = JSON.parse(stored);
          if (settings.logoType === 'image') {
            const imageUrl = settings.logoImageData || settings.logoImageUrl;
            if (imageUrl) {
              setLogoConfig({ type: 'image', value: imageUrl });
            } else {
              setLogoConfig({ type: 'text', value: settings.logoText || settings.siteName || 'WAgent' });
            }
          } else {
            setLogoConfig({ type: 'text', value: settings.logoText || settings.siteName || 'WAgent' });
          }
        }
      } catch (e) {
        console.error('Failed to load logo settings:', e);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event from SiteSettings page
    window.addEventListener('site-settings-changed', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('site-settings-changed', handleStorageChange);
    };
  }, []);

  if (logoConfig.type === 'image') {
    return (
      <img
        src={logoConfig.value}
        alt="Logo"
        style={{ height: 32, objectFit: 'contain' }}
      />
    );
  }

  return (
    <span style={{
      fontSize: 18,
      fontWeight: 700,
      color: '#fff',
    }}>
      {logoConfig.value}
    </span>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isLoading } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // 应用站点设置
  useEffect(() => {
    const settings = getSiteSettings();
    applySiteSettings(settings);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserDisplayName = () => {
    if (!user) return 'User';
    const name = user.displayName || user.username;
    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return 'User';
    }
    return String(name);
  };

  const userMenuItems = [
    {
      key: 'profile',
      label: getUserDisplayName(),
      disabled: true,
    },
    { type: 'divider' as const },
    ...(user?.isAdmin ? [{
      key: 'users',
      icon: <TeamOutlined />,
      label: <Link to="/users" onClick={() => setDropdownOpen(false)}>用户管理</Link>,
    }] : []),
      {
      key: 'site-settings',
      icon: <GlobalOutlined />,
      label: <Link to="/site-settings" onClick={() => setDropdownOpen(false)}>站点设置</Link>,
    },
    {
      key: 'config',
      icon: <SettingOutlined />,
      label: <Link to="/config" onClick={() => setDropdownOpen(false)}>系统配置</Link>,
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {/* 顶部固定 Header */}
      <Header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: 'linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #6366f1 100%)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 48,
          lineHeight: '48px',
          boxShadow: '0 2px 12px rgba(79, 70, 229, 0.25)',
        }}
      >
        {/* 左侧 Logo */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <Logo />
          </Link>
        </div>

        {/* 右侧用户信息和配置入口 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            borderRadius: 4,
          }}
        >
          {user ? (
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              destroyOnHidden={true}
              autoAdjustOverflow={false}
              open={dropdownOpen}
              onOpenChange={setDropdownOpen}
            >
              <Button
                type="text"
                style={{
                  padding: '0 12px',
                  color: '#fff',
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 4,
                }}
              >
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  style={{
                    marginRight: 8,
                    backgroundColor: '#818cf8',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    color: '#fff',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 14,
                    fontWeight: 700,
                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                  }}
                  title={user?.displayName || user?.username || 'User'}
                >
                  {user?.displayName || user?.username || 'User'}
                </span>
              </Button>
            </Dropdown>
          ) : (
            <div
              style={{
                color: 'rgba(255,255,255,0.65)',
                fontSize: 13,
                padding: '4px 12px',
              }}
            >
              {isLoading ? '...' : '未登录'}
            </div>
          )}
        </div>
      </Header>

      {/* 左侧菜单栏 - 位于 Header 下方 */}
      <Sider
        width={200}
        style={{
          overflow: 'auto',
          height: 'calc(100vh - 48px)',
          position: 'fixed',
          left: 0,
          top: 48,
          bottom: 0,
          background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)',
        }}
      >
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            borderRight: 0,
            paddingTop: 8,
            background: 'transparent',
          }}
        />
      </Sider>

      {/* 主内容区 */}
      <AntLayout style={{ marginLeft: 200, marginTop: 48 }}>
        <Content style={{ minHeight: 'calc(100vh - 48px)', background: '#f0f2f5' }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
}

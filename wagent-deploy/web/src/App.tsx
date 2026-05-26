import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Chat from './pages/Chat';
import Config from './pages/Config';
import Skills from './pages/Skills';
import Tools from './pages/Tools';
import Knowledge from './pages/Knowledge';
import Architecture from './pages/Architecture';
import Users from './pages/Users';
import Memories from './pages/Memories';
import SiteSettings from './pages/SiteSettings';

function AppRoutes() {
  return (
    <Routes>
      {/* 登录页 - 无需认证 */}
      <Route path="/login" element={<Login />} />
      
      {/* 需要认证的路由 */}
      <Route element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route path="/" element={<Chat />} />
        <Route path="/config" element={<Config />} />
        <Route path="/skills" element={<Skills />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/architecture" element={<Architecture />} />
        <Route path="/memories" element={<Memories />} />
        
        {/* 站点设置 - 所有登录用户可访问 */}
        <Route path="/site-settings" element={<SiteSettings />} />
        
        {/* 管理员路由 */}
        <Route path="/users" element={
          <PrivateRoute requireAdmin>
            <Users />
          </PrivateRoute>
        } />
      </Route>
      
      {/* 默认重定向 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

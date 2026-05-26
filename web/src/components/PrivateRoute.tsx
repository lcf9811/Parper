import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface PrivateRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function PrivateRoute({ children, requireAdmin = false }: PrivateRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div style={{ padding: 48, textAlign: 'center' }}>加载中...</div>;
  }

  if (!user) {
    // 未登录，重定向到登录页
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !user.isAdmin) {
    // 需要管理员权限但当前用户不是管理员
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

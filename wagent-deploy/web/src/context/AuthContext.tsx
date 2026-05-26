import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/client';

interface User {
  id: string;
  username: string;
  displayName: string | null;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'wagent_token';
const USER_KEY = 'wagent_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 验证 user 数据是否完整
  const isValidUser = (u: any): u is User => {
    return u && typeof u === 'object' && 
           (u.username || u.displayName) && // 至少有一个名称字段
           u.id !== undefined;
  };

  // 从服务器重新获取用户信息
  const refreshUser = async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setUser(null);
      setToken(null);
      return;
    }
    
    try {
      setToken(storedToken);
      const response = await api.get('/auth/me');
      const userData = response.data || response;
      if (userData && (userData.username || userData.displayName)) {
        const normalizedUser: User = {
          id: String(userData.id),
          username: userData.username || '',
          displayName: userData.displayName || null,
          isAdmin: userData.isAdmin || false,
        };
        setUser(normalizedUser);
        localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
      } else {
        throw new Error('Invalid user data');
      }
    } catch (err) {
      console.error('[Auth] Failed to refresh user:', err);
      // 如果刷新失败，清除登录状态
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);
      
      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          
          // 验证 user 数据完整性
          if (isValidUser(parsedUser)) {
            setToken(storedToken);
            setUser(parsedUser);
          } else {
            // 数据不完整，从服务器重新获取
            console.warn('[Auth] User data incomplete, refreshing from server...');
            await refreshUser();
          }
        } catch (err) {
          console.error('[Auth] Failed to parse stored user:', err);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

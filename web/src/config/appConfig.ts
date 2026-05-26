// 应用配置 - 可配置的 Logo 和主题
export interface LogoConfig {
  type: 'text' | 'image';
  value: string;
}

export const appConfig = {
  // Logo 配置
  logo: {
    type: 'text' as const,
    value: 'WAgent',
  } as LogoConfig,
  
  // 主题配置
  theme: {
    primaryColor: '#1890ff',
    sidebarWidth: 200,
    headerHeight: 48,
  },
  
  // 功能开关
  features: {
    showBreadcrumb: false,
    enableMemory: true,
  },
};

export default appConfig;

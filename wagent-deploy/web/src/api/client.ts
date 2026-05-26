import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

// 请求拦截器 - 自动添加 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('wagent_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理 401 错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期或无效，清除登录状态
      localStorage.removeItem('wagent_token');
      localStorage.removeItem('wagent_user');
      // 如果不是在登录页，则跳转到登录页
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ---- Memories ----
export const getMemories = (type?: string) => 
  api.get('/memories', { params: { type } }).then(r => r.data);
export const searchMemories = (q: string) => 
  api.get('/memories/search', { params: { q } }).then(r => r.data);
export const createMemory = (data: any) => 
  api.post('/memories', data).then(r => r.data);
export const updateMemory = (id: string, data: any) => 
  api.put(`/memories/${id}`, data).then(r => r.data);
export const deleteMemory = (id: string) => 
  api.delete(`/memories/${id}`).then(r => r.data);

// ---- Auth ----
export const login = (username: string, password: string) =>
  api.post('/auth/login', { username, password }).then(r => r.data);

export const register = (data: { username: string; password: string; displayName?: string }) =>
  api.post('/auth/register', data).then(r => r.data);

export const logout = () =>
  api.post('/auth/logout').then(r => r.data);

export const getMe = () =>
  api.get('/auth/me').then(r => r.data);

export const getUsers = () =>
  api.get('/users').then(r => r.data);
export const createUser = (data: any) =>
  api.post('/users', data).then(r => r.data);
export const resetUserPassword = (id: string, newPassword: string) =>
  api.post(`/users/${id}/reset-password`, { newPassword }).then(r => r.data);
export const deleteUser = (id: string) =>
  api.delete(`/users/${id}`).then(r => r.data);

// ---- Sessions ----
export const getSessions = () => api.get('/sessions').then(r => r.data);
export const createSession = (title?: string) => api.post('/sessions', { title }).then(r => r.data);
export const updateSessionTitle = (id: string, title: string) => api.put(`/sessions/${id}`, { title }).then(r => r.data);
export const deleteSession = (id: string) => api.delete(`/sessions/${id}`).then(r => r.data);
export const getMessages = (sessionId: string) => api.get(`/sessions/${sessionId}/messages`).then(r => r.data);

// ---- Chat ----
export const sendChat = (data: { sessionId: string; message: string; tools?: string[]; skills?: string[] }) =>
  api.post('/chat', data).then(r => r.data);

export const sendChatStream = (data: { sessionId: string; message: string; tools?: string[]; skills?: string[] }) =>
  api.post('/chat/stream', data).then(r => r.data);

// ---- Tools ----
export const getTools = () => api.get('/tools').then(r => r.data);
export const toggleTool = (id: string, enabled: boolean) => api.put(`/tools/${id}`, { enabled }).then(r => r.data);

// ---- Skills ----
export const getSkills = () => api.get('/skills').then(r => r.data);
export const createSkill = (data: any) => api.post('/skills', data).then(r => r.data);
export const updateSkill = (id: string, data: any) => api.put(`/skills/${id}`, data).then(r => r.data);
export const deleteSkill = (id: string) => api.delete(`/skills/${id}`).then(r => r.data);

// ---- Knowledge ----
export const getKnowledge = () => api.get('/knowledge').then(r => r.data);
export const addKnowledge = (data: { title: string; source?: string; content: string }) =>
  api.post('/knowledge', data).then(r => r.data);
export const deleteKnowledge = (id: string) => api.delete(`/knowledge/${id}`).then(r => r.data);
export const getChunks = (docId: string) => api.get(`/knowledge/${docId}/chunks`).then(r => r.data);

// ---- Executions ----
export const getExecutions = () => api.get('/executions').then(r => r.data);
export const getExecution = (executionId: string) =>
  api.get(`/executions/${executionId}`).then(r => r.data);
export const getExecutionSteps = (executionId: string) =>
  api.get(`/executions/${executionId}/steps`).then(r => r.data);

// ---- Config ----
export const getProviders = () => api.get('/config/providers').then(r => r.data);
export const createProvider = (data: any) => api.post('/config/providers', data).then(r => r.data);
export const updateProvider = (id: string, data: any) => api.put(`/config/providers/${id}`, data).then(r => r.data);
export const activateProvider = (id: string) => api.put(`/config/providers/${id}/activate`).then(r => r.data);
export const deleteProvider = (id: string) => api.delete(`/config/providers/${id}`).then(r => r.data);
export const getLangGraphConfig = () => api.get('/config/langgraph').then(r => r.data);
export const updateLangGraphConfig = (data: any) => api.put('/config/langgraph', data).then(r => r.data);

// ---- Webhook Config ----
export const getWebhookConfig = () => api.get('/webhook/config').then(r => r.data);
export const updateWebhookConfig = (data: any) => api.put('/webhook/config', data).then(r => r.data);

// ---- Webhook Endpoints ----
export const getWebhookEndpoints = () => api.get('/webhook/endpoints').then(r => r.data);
export const createWebhookEndpoint = (data: any) => api.post('/webhook/endpoints', data).then(r => r.data);
export const updateWebhookEndpoint = (id: string, data: any) => api.put(`/webhook/endpoints/${id}`, data).then(r => r.data);
export const deleteWebhookEndpoint = (id: string) => api.delete(`/webhook/endpoints/${id}`).then(r => r.data);
export const toggleWebhookEndpoint = (id: string, enabled: boolean) => 
  api.put(`/webhook/endpoints/${id}/toggle`, { enabled }).then(r => r.data);

export default api;

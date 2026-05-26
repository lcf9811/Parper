import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { ProxyOptions } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        // SSE 流式连接需要禁用缓冲
        configure: (proxy: any, options: ProxyOptions) => {
          proxy.on('proxyRes', (proxyRes: any, req: any, res: any) => {
            // 如果是 SSE 流，禁用缓冲
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              res.setHeader('Cache-Control', 'no-cache');
              res.setHeader('Connection', 'keep-alive');
              res.setHeader('X-Accel-Buffering', 'no');
            }
          });
        },
      },
    },
  },
});

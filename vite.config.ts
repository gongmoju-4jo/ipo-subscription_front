/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 서버는 /api 요청을 게이트웨이로 넘긴다. 브라우저 입장에서는 같은 출처라 게이트웨이에 CORS 설정이 필요 없다.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const target = env.VITE_PROXY_TARGET || 'http://localhost:8080';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
      },
    },
    test: {
      environment: 'node',
    },
  };
});

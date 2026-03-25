import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api/vllm': {
        target: 'http://192.168.0.234:9015',
        rewrite: (path) => path.replace(/^\/api\/vllm/, ''),
        changeOrigin: true,
      },
      '/api/fastapi': {
        target: 'http://192.168.0.234:9016',
        rewrite: (path) => path.replace(/^\/api\/fastapi/, ''),
        changeOrigin: true,
      },
    },
  },
})

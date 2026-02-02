import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    base: '/', // Changed from '/' for Electron local loading
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          // target: env.VITE_API_URL?.replace(/\/api$/, '') || 'https://system.fuchsius.com',
          target: 'http://localhost:3005',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: false,
    },
    define: {
      // 'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'https://system.fuchsius.com/api')
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:3005/api')
    }
  }
})

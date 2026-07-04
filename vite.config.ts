import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host      : '0.0.0.0',
    port      : 3001,
    strictPort: true,
    proxy: {
      '/api': {
        target     : 'http://192.0.0.4:8000',
        changeOrigin: true,
      }
    }
  }
})

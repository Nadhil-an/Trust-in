import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://10.196.205.21:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://10.196.205.21:8000',
        ws: true,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            // Suppress the ECONNABORTED proxy error in the console 
            // since it happens normally when the browser reloads during dev.
            if (err.code !== 'ECONNABORTED') {
              console.log('proxy error', err);
            }
          });
        }
      },
      '/media': {
        target: 'http://10.196.205.21:8000',
        changeOrigin: true,
      },
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://10.123.202.21:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://10.123.202.21:8000',
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
        target: 'http://10.123.202.21:8000',
        changeOrigin: true,
      },
    },
  },
})

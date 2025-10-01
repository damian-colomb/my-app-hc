// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/historia-clinica/' : '/', // Solo usar base path en producción
  // Reducir logs en desarrollo
  logLevel: command === 'serve' ? 'error' : 'info',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    // Configuración optimizada para desarrollo
    hmr: {
      overlay: false, // Deshabilitar overlay de errores para mejor UX
      clientPort: 5173,
      // Reducir logs del HMR
      clientLogLevel: 'error'
    },
    proxy: {
      // Todo lo que empiece con /api va al backend
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
        // Configuración optimizada del proxy
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Agregar headers de optimización
            proxyReq.setHeader('Connection', 'keep-alive');
            proxyReq.setHeader('Keep-Alive', 'timeout=5, max=1000');
          });
        }
      },
    },
  },
  // Optimizaciones de build
  build: {
    target: 'esnext',
    minify: 'terser',
    // Cache busting automático
    rollupOptions: {
      output: {
        // Generar nombres únicos para evitar caché
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          icons: ['@heroicons/react', 'react-icons'],
          utils: ['axios']
        }
      }
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  // Optimizaciones de dependencias
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      '@heroicons/react/24/outline'
    ]
  }
}))
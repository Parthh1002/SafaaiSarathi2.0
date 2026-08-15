import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Ports 5173 / 5000 / 8000 are occupied on this machine, so the stack runs on
// 5273 (web), 5100 (api) and 8100 (ai).
const API_TARGET = process.env.VITE_API_TARGET || 'http://127.0.0.1:5100';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5273,
    strictPort: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
      '/socket.io': { target: API_TARGET, ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep the heavy, rarely-changing libraries in their own chunks so the
        // citizen phone build stays small on a slow connection.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          map: ['leaflet', 'react-leaflet'],
          charts: ['recharts'],
          three: ['three', '@react-three/fiber'],
        },
      },
    },
  },
});

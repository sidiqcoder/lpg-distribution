import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (!/^https:\/\/[^/]+\.supabase\.co$/.test(env.VITE_SUPABASE_URL || '')) {
    throw new Error('Isi VITE_SUPABASE_URL di client/.env.local atau environment Vercel.');
  }
  return {
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
  };
});

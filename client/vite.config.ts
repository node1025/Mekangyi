import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

const storeConfigured = Boolean(String(process.env.VITE_PORTONE_STORE_ID || '').trim());
const localPayment =
  process.env.VITE_LOCAL_PAYMENT === 'true' ||
  process.env.LOCAL_PAYMENT_MODE === 'true' ||
  !storeConfigured;

export default defineConfig({
  plugins: [vue()],
  define: {
    'import.meta.env.VITE_BUILD_STAMP': JSON.stringify(String(Date.now())),
    'import.meta.env.VITE_LOCAL_PAYMENT': JSON.stringify(localPayment ? 'true' : 'false')
  },
  server: {
    host: '127.0.0.1',
    port: 5175,
    proxy: { '/api': 'http://127.0.0.1:5002', '/uploads': 'http://127.0.0.1:8080' }
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }
});

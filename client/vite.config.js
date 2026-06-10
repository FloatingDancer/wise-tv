import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../',
  server: {
    port: 5173,
    headers: {
      // Allow loading inside Discord iframe
      'Content-Security-Policy': "frame-ancestors https://*.discord.com https://discord.com https://*.discordapp.com",
      'X-Frame-Options': 'ALLOW-FROM https://discord.com'
    }
  }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Taimwell',
        short_name: 'Taimwell',
        description: 'Give what matters your time.',
        theme_color: '#F1F5F9',
        background_color: '#F1F5F9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        // Android: lets Taimwell appear in the system share sheet (WhatsApp, Slack, email…).
        // iPhone uses the "Send to Taimwell" Shortcut instead (see README).
        share_target: {
          action: '/capture',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' }
        }
      } as any,
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
      }
    })
  ],
  server: { port: 5173 }
});

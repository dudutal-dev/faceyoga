import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// התוכן (וידאו, קריינות, מניפסט) מוגש מ-content/ שבשורש הריפו, כקבצים סטטיים.
// בבנייה הוא מועתק ל-dist (ההכרעה: וידאו בתוך האפליקציה עצמה).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  publicDir: path.resolve(__dirname, '../content'),
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt', // הרענון מנוהל ב-src/pwa.ts: אוטומטי מחוץ למפגש, באנר בתוכו
      injectRegister: false,
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'טאי צ\'י 150',
        short_name: 'טאי צ\'י 150',
        description: 'תרגול טאי צ\'י אישי בעברית, 150 דקות בשבוע',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        orientation: 'any',
        background_color: '#2F5D3A',
        theme_color: '#2F5D3A',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // וידאו ואודיו נטענים לפי דרישה ונשמרים במטמון בזמן ריצה (ההורדה המלאה — שלב 8)
        globPatterns: ['**/*.{js,css,html,json,png,svg,woff2}'],
        globIgnores: ['**/video/**', '**/audio/**', '**/scripts/**', '**/forms/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          { urlPattern: ({ url }) => /\/(video|audio)\//.test(url.pathname), handler: 'CacheFirst', options: { cacheName: 'taichi-media', rangeRequests: true, expiration: { maxEntries: 500 } } },
        ],
      },
    }),
  ],
  server: { port: 5173, host: true },
  test: { environment: 'node', setupFiles: ['./src/test-setup.ts'], globals: true },
});

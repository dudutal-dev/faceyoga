import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import fs from 'node:fs';

// קבצי ה-WASM של MediaPipe (14MB) לא נכנסים לגיט: מוגשים מ-node_modules בפיתוח ומועתקים ל-dist/mediapipe בבנייה.
const WASM_DIR = path.resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/wasm');
const WASM = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm'].filter(f => fs.existsSync(path.join(WASM_DIR, f)));
function mediapipeWasm(): Plugin {
  return {
    name: 'mediapipe-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/\/mediapipe\/(vision_wasm[\w]+\.(?:js|wasm))/);
        if (!m || !WASM.includes(m[1]!)) return next();
        res.setHeader('Content-Type', m[1]!.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        fs.createReadStream(path.join(WASM_DIR, m[1]!)).pipe(res);
      });
    },
    closeBundle() { // מקורות כבדים מתוך content/ שלא צריכים להגיע לטלפון
      const dist = path.resolve(__dirname, 'dist');
      for (const f of ['character/front.png', 'character/side.png']) fs.rmSync(path.join(dist, f), { force: true });
      fs.rmSync(path.join(dist, 'scripts'), { recursive: true, force: true });
    },
    generateBundle() { for (const f of WASM) this.emitFile({ type: 'asset', fileName: `mediapipe/${f}`, source: fs.readFileSync(path.join(WASM_DIR, f)) }); },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  publicDir: path.resolve(__dirname, '../content'),
  plugins: [
    react(), tailwindcss(), mediapipeWasm(),
    VitePWA({
      registerType: 'prompt', injectRegister: false, includeAssets: ['icons/*.png'],
      manifest: {
        name: 'פָּנִים 12 · יוגה לפנים', short_name: 'פנים 12', description: 'יוגה לפנים בעברית: מדריכה, קול, מראה ומאמנת פנים. בלי שרת ובלי חשבון.',
        lang: 'he', dir: 'rtl', display: 'standalone', orientation: 'portrait', background_color: '#fbf6f1', theme_color: '#b26e60',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}', 'manifest.json'],
        globIgnores: ['**/video/**', '**/audio/**', '**/scripts/**', '**/mediapipe/**', '**/stills/**', '**/character/*.png'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          { urlPattern: ({ url }) => /\/(video|audio|stills|character|mediapipe)\//.test(url.pathname), handler: 'CacheFirst', options: { cacheName: 'faceyoga-media', rangeRequests: true, expiration: { maxEntries: 600 } } },
          { urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com', handler: 'CacheFirst', options: { cacheName: 'fonts', expiration: { maxEntries: 20 } } },
        ],
      },
    }),
  ],
  server: { port: 5173, host: true },
  test: { environment: 'node', setupFiles: ['./src/test-setup.ts'], globals: true },
});

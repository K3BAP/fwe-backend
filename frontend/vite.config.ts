import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // In Produktion läuft die App unter https://team15.wi1cm.uni-trier.de/public/.
  // Im Dev-Server (vite serve) bleibt sie unter / erreichbar.
  const base = command === 'build' ? '/public/' : '/'

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icon.svg'],
        manifest: {
          name: 'City-Rallye',
          short_name: 'Rallye',
          description: 'Stadt-Rallye des FSR Informatik der Universität Trier',
          lang: 'de',
          theme_color: '#4f46e5',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            { src: `${base}icon.svg`, sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
            { src: `${base}icon.svg`, sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
            { src: `${base}icon-maskable.svg`, sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
          ],
        },
        workbox: {
          // API/Foto-Requests nie aus dem Cache bedienen.
          navigateFallbackDenylist: [new RegExp(`^${base}api`), new RegExp(`^${base}media`)],
        },
      }),
    ],
    // Build direkt in das CodeIgniter public/-Verzeichnis, ohne index.php zu löschen.
    build: {
      outDir: '../public',
      emptyOutDir: false,
    },
    server: {
      proxy: {
        '/api': 'http://localhost:8080',
        '/media': 'http://localhost:8080',
      },
    },
  }
})

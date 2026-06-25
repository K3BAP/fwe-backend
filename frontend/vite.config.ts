import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // In Produktion läuft die App unter https://team15.wi1cm.uni-trier.de/public/.
  // Im Dev-Server (vite serve) bleibt sie unter / erreichbar.
  const base = command === 'build' ? '/public/' : '/'

  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
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

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

/** Split the two heaviest dependency groups so the first paint isn't waiting
 *  on the calendar. Rolldown wants a function, not the old object form. */
function manualChunks(id: string) {
  if (!id.includes('node_modules')) return
  if (id.includes('@fullcalendar')) return 'calendar'
  if (id.includes('react-markdown') || id.includes('remark') || id.includes('micromark')) {
    return 'markdown'
  }
  if (id.includes('@supabase')) return 'supabase'
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // GitHub Pages project sites are served from /<repo>/. Set VITE_BASE=/Atlas/
  // in .env.production (or in the deploy workflow) when deploying there.
  const base = env.VITE_BASE || '/'

  return {
    base,
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Atlas',
          short_name: 'Atlas',
          description: 'A calm second brain for tasks, notes, and time.',
          theme_color: '#0a0a0b',
          background_color: '#0a0a0b',
          display: 'standalone',
          orientation: 'portrait',
          start_url: base,
          scope: base,
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // Supabase responses are handled by the app's own cache, never by SW.
          navigateFallbackDenylist: [/^\/api/],
        },
      }),
    ],
    build: {
      target: 'es2022',
      // The main chunk sits a little over the 500 kB default. Splitting it
      // further would trade a smaller first file for more round trips.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: { manualChunks },
      },
    },
  }
})

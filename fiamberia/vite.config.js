import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-32.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Fiambería La Picadita',
        short_name: 'La Picadita',
        description: 'Sistema de ventas y control de stock para la fiambrería',
        theme_color: '#2D6A4F',
        background_color: '#F0EDE6',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'es-AR',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // No cachear llamadas a Firestore/Auth: la app ya maneja su propio
        // caché y persistencia offline de Firestore. El service worker solo
        // cachea el shell de la app (HTML/JS/CSS/íconos) para que abra
        // instantáneo y funcione sin conexión.
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})

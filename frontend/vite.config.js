import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Public-tunnel support (Tailscale Funnel / Cloudflare): accept any Host
    // header, and serve the API same-origin under /api so external visitors
    // don't need to reach 127.0.0.1:8000 themselves. ws: true also carries
    // the live-call WebSocket through the same tunnel.
    allowedHosts: true,
    // Bind IPv4 explicitly: "localhost" can resolve to ::1-only, which
    // refuses 127.0.0.1 — silently breaking the Playwright baseURL AND the
    // Tailscale Funnel proxy (both target 127.0.0.1:3000).
    host: "0.0.0.0",
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})

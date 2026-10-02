import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2020', sourcemap: false },
  // Hosts that serve the built app with `npm start` (for example Render) use their own domain name.
  preview: { allowedHosts: true },
})

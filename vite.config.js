import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Change `base` to your GitHub repository name when deploying.
// For local development the leading slash is fine — Vite handles it.
export default defineConfig({
  plugins: [react()],
  base: '/govalgin-annotation/',
})
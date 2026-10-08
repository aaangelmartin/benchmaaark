import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dataRefresh } from './scripts/vite-data-refresh.ts'

export default defineConfig({
  // github pages serves the site under /<repo>/, set by the deploy workflow
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), dataRefresh({ maxAgeHours: 6 })],
  // two entries, one per brand: / is aaa., /laaabs/ is laaabs.
  build: { rollupOptions: { input: { main: 'index.html', laaabs: 'laaabs/index.html' } } },
})

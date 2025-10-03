import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',                // served at site root under FastAPI
  build: { outDir: 'dist', sourcemap: true }
})

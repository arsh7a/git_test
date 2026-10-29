import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base: './' lets the finished site be opened from any folder or web address.
export default defineConfig({
  plugins: [react()],
  base: './',
})

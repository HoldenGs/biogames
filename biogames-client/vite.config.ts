import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    https: false, // Disable HTTPS
    port: 3000, // Or whatever port you prefer
    strictPort: true, // Ensure Vite doesn't try other ports if 3000 is taken
    host: true, // Expose to all network interfaces
  },
  base: './', // Use relative paths for all assets
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // Minimize bundle size
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,  // Remove console.log in production
      }
    }
  }
})

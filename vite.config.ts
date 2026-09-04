import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base 用相对路径,GitHub Pages 任意仓库名/子路径均可正常加载
export default defineConfig({
  plugins: [react()],
  base: './',
})

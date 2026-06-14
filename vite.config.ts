import { defineConfig } from 'vite';

// GitHub Pages 為子路徑（/Tiny-Tennis/），用相對路徑讓資源正確載入
export default defineConfig({
  base: './',
});

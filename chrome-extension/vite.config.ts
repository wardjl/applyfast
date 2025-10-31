import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import path from 'path';

const stripUseClientDirective = (): Plugin => ({
  name: 'strip-use-client-directive',
  enforce: 'pre',
  transform(code, id) {
    if (!id.match(/\.(jsx|tsx|ts|js|mjs)$/)) {
      return null;
    }
    const directivePattern = /(^|\n)\s*['"]use client['"]\s*;?/g;
    if (directivePattern.test(code)) {
      return {
        code: code.replace(directivePattern, '$1'),
        map: null,
      };
    }
    return null;
  },
});

export default defineConfig({
  plugins: [
    stripUseClientDirective(),
    react(),
    crx({ manifest: manifest as any }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../'),
      '@/components': path.resolve(__dirname, '../components'),
      '@/lib': path.resolve(__dirname, '../lib'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        'side-panel': path.resolve(__dirname, 'side-panel.html'),
        'content-script': path.resolve(__dirname, 'src/content-script/index.tsx'),
      },
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],
          'convex-vendor': ['convex', 'convex/react'],
          'ui-vendor': ['lucide-react', '@radix-ui/react-slot', '@radix-ui/react-label'],
        },
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    hmr: {
      port: 5174,
    },
  },
});

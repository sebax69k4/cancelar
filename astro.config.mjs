// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';

import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    // Pre-empaqueta al arrancar las dependencias de las islas React. Si Vite las descubre
    // recién al abrir una página (ej. @dnd-kit en /ordenes), re-optimiza en caliente y el
    // navegador puede quedar pidiendo la versión vieja (504 "Outdated Optimize Dep").
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-dev-runtime',
        '@dnd-kit/core',
        '@dnd-kit/utilities',
        '@tanstack/react-query',
        'react-hook-form',
        '@hookform/resolvers/zod',
        'zod',
        'lucide-react',
        'clsx',
        'tailwind-merge',
      ],
    },
  },

  adapter: node({
    mode: 'standalone'
  })
});
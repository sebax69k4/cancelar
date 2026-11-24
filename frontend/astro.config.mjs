// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';

import node from '@astrojs/node';
import { loadEnv } from 'vite';

// La dirección del backend queda fija dentro del build: sin ella, la app publicada no sabría a
// qué servidor hablar (las pantallas corren en el navegador y el error recién se vería ahí).
/** @type {{ argv: string[]; env: Record<string, string | undefined>; cwd(): string }} */
const proceso = /** @type {any} */ (globalThis).process;
const modo = proceso.argv.includes('dev') ? 'development' : 'production';
const { PUBLIC_API_URL } = { ...loadEnv(modo, proceso.cwd(), 'PUBLIC_'), ...proceso.env };
if (!PUBLIC_API_URL?.trim()) {
  throw new Error('Falta PUBLIC_API_URL: creá frontend/.env con PUBLIC_API_URL=https://api.TU-DOMINIO/api (ver .env.example)');
}

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
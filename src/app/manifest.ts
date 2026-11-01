import type { MetadataRoute } from 'next';

/** Faz o site abrir como app (sem barra do navegador) quando adicionado à tela de início. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Treinos do Felipe',
    short_name: 'Treinos',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4F3EF',
    theme_color: '#F4F3EF',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}

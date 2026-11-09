import vue from '@vitejs/plugin-vue';
import autoprefixer from 'autoprefixer';
import laravel from 'laravel-vite-plugin';
import path from 'path';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/js/app.ts'],
            refresh: true,
        }),
        vue({
            template: {
                transformAssetUrls: {
                    base: null,
                    includeAbsolute: false,
                },
            },
        }),
    ],
    // No Docker o Vite escuta em 0.0.0.0. O browser externo acessa via IP do Tailscale.
    server: {
        host: '0.0.0.0',
        origin: `http://${process.env.VITE_HMR_HOST || '100.127.187.110'}:${process.env.VITE_PORT ?? 5173}`,
        cors: true,
        hmr: { host: process.env.VITE_HMR_HOST || '100.127.187.110' },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './resources/js'),
        },
    },
    css: {
        postcss: {
            plugins: [tailwindcss, autoprefixer],
        },
    },
});

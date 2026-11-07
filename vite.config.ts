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
    // No Docker o Vite escuta em 0.0.0.0, mas o navegador precisa de um endereço que alcance: o `public/hot` e o HMR usam localhost.
    server: {
        host: '0.0.0.0',
        origin: `http://localhost:${process.env.VITE_PORT ?? 5173}`,
        cors: true,
        hmr: { host: 'localhost' },
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

<script setup lang="ts">
import { computed } from 'vue';
/** Silhueta 2D de cada tipo de dado (viewBox 100×100), com o valor no centro. */
const props = defineProps<{ faces: number; valor?: number | string; destaque?: 'critico' | 'falha' | null }>();

const formas: Record<number, string> = {
    4: '50,8 94,86 6,86',
    6: '14,14 86,14 86,86 14,86',
    8: '50,4 92,50 50,96 8,50',
    10: '50,4 90,38 50,96 10,38',
    12: '50,6 93,37 77,88 23,88 7,37',
    20: '50,4 90,27 90,73 50,96 10,73 10,27',
    100: '32,6 68,6 94,32 94,68 68,94 32,94 6,68 6,32',
};
const arestas: Record<number, string> = {
    20: 'M50 4 L50 96 M10 27 L90 73 M90 27 L10 73',
    8: 'M8 50 L92 50',
    4: 'M50 8 L50 86',
    12: 'M50 6 L50 40 M93 37 L72 50 M7 37 L28 50 M77 88 L62 64 M23 88 L38 64',
    10: 'M50 4 L50 96',
};
/** Faces sem silhueta própria (d3, d30...) usam a forma genérica de oito lados. */
const forma = computed(() => formas[props.faces] ?? formas[100]);
const cor = computed(() => (props.destaque === 'critico' ? '#4ade80' : props.destaque === 'falha' ? '#f87171' : '#ecc96c'));
const tamanhoFonte = computed(() => (String(props.valor ?? '').length > 2 ? 24 : String(props.valor ?? '').length > 1 ? 32 : 38));
</script>

<template>
    <svg viewBox="0 0 100 100" class="size-full overflow-visible" role="img" :aria-label="`d${faces}${valor !== undefined ? ': ' + valor : ''}`">
        <defs>
            <linearGradient :id="`dg-${faces}`" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#36313d" />
                <stop offset="1" stop-color="#0d0a12" />
            </linearGradient>
        </defs>
        <polygon :points="forma" :fill="`url(#dg-${faces})`" :stroke="cor" stroke-width="4" stroke-linejoin="round" />
        <path v-if="arestas[faces]" :d="arestas[faces]" :stroke="cor" stroke-opacity=".35" stroke-width="2" fill="none" />
        <text
            v-if="valor !== undefined"
            x="50"
            :y="faces === 4 ? 66 : 50"
            text-anchor="middle"
            dominant-baseline="central"
            :font-size="tamanhoFonte"
            font-weight="700"
            font-family="Georgia, serif"
            :fill="cor"
            stroke="#0d0a12"
            stroke-width="6"
            stroke-linejoin="round"
            paint-order="stroke"
        >
            {{ valor }}
        </text>
    </svg>
</template>

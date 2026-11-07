<script setup lang="ts">
import { Layers } from 'lucide-vue-next';
import { CAMADAS, type Camada } from '../engine/tipos';

defineProps<{ camada: Camada }>();
defineEmits<{ camada: [Camada] }>();
</script>

<template>
    <div
        class="pointer-events-auto absolute bottom-4 left-3 z-10 w-44 rounded-lg border border-ouro-500/20 bg-preto-950/90 p-1.5 backdrop-blur"
        role="radiogroup"
        aria-label="Camada ativa"
    >
        <p class="flex items-center gap-1.5 px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400">
            <Layers class="size-3.5" /> Camada
        </p>
        <button
            v-for="c in [...CAMADAS].reverse()"
            :key="c.id"
            type="button"
            role="radio"
            :aria-checked="camada === c.id"
            :title="c.dica"
            class="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
            :class="camada === c.id ? 'bg-ouro-500 font-semibold text-preto-950' : 'text-preto-200 hover:bg-preto-800'"
            @click="$emit('camada', c.id)"
        >
            {{ c.nome }}
            <span v-if="c.id === 'mestre'" class="text-[10px] uppercase opacity-70">oculta</span>
        </button>
    </div>
</template>

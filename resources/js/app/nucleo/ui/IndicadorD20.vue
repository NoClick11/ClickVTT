<script setup lang="ts">
import DadoIcone from '../../components/DadoIcone.vue';

/**
 * O d20 discreto de uma área rolável, com o badge V/D quando um efeito dá vantagem ou desvantagem. Tamanho e posição
 * vêm de quem usa (`class`: ex. `size-5`, `absolute right-1 top-1`); o badge se ancora num invólucro interno, então a
 * posição de fora não interfere.
 */
withDefaults(defineProps<{ modo?: 'vantagem' | 'desvantagem' | null }>(), { modo: null });
</script>

<template>
    <span class="inline-block shrink-0" aria-hidden="true">
        <span class="relative block size-full">
            <DadoIcone :faces="20" />
            <span
                v-if="modo"
                class="absolute -right-1.5 -top-1.5 flex size-3 items-center justify-center rounded-full text-[8px] font-bold leading-none text-preto-950"
                :class="modo === 'vantagem' ? 'bg-green-400' : 'bg-red-400'"
                >{{ modo === 'vantagem' ? 'V' : 'D' }}</span
            >
        </span>
    </span>
</template>

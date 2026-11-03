<script setup lang="ts">
import DadoIcone from '../components/DadoIcone.vue';

/** Botão de rolagem (d20) no estilo Roll20. Por enquanto só visual: as rolagens da ficha vêm depois. */
defineProps<{ rotulo: string }>();
</script>

<template>
    <button type="button" class="flex size-6 shrink-0 items-center justify-center rounded text-ouro-400 transition hover:bg-ouro-500/15 hover:text-ouro-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400" :aria-label="`Rolar ${rotulo}`" :title="`Rolar ${rotulo}`">
        <span class="size-5"><DadoIcone dado="d20" /></span>
    </button>
</template>

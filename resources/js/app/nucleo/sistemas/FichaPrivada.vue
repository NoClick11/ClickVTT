<script setup lang="ts">
import type { PersonagemFicha } from './tipos';

defineProps<{ personagem: PersonagemFicha }>();
</script>

<template>
    <div class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-preto-300">
        <p class="font-semibold text-preto-100">{{ personagem.nome }}</p>
        <p>A ficha deste personagem é visível só para o mestre e para quem joga com ele.</p>
    </div>
</template>

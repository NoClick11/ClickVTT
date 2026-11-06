<script setup lang="ts">
import type { PersonagemFicha } from './tipos';

defineProps<{ personagem: PersonagemFicha; sistema: string }>();
</script>

<template>
    <div class="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-preto-300">
        <p class="font-semibold text-preto-100">{{ personagem.nome }}</p>
        <p>
            A ficha de <strong class="text-ouro-300">{{ sistema }}</strong> ainda não foi implementada.
        </p>
    </div>
</template>

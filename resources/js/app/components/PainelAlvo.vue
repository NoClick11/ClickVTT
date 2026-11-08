<script setup lang="ts">
import { Crosshair, X } from 'lucide-vue-next';

/**
 * Aviso do alvo mirado (flutua na base da tela): quem está travado na mira. Enquanto houver alvo, todo ataque de quem mira vai contra
 * ele: rola contra a defesa e, se acertar, o chat libera o botão de dano. Só mostra e emite; quem fala com o servidor é a mesa.
 */
defineProps<{ nome: string; cor: string }>();
const emit = defineEmits<{ limpar: [] }>();
</script>

<template>
    <section
        class="pointer-events-auto absolute bottom-[9.25rem] left-1/2 z-10 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-red-400/50 bg-preto-950/95 px-2.5 py-2 shadow-xl backdrop-blur"
        aria-label="Alvo mirado"
    >
        <div class="flex items-center gap-2">
            <Crosshair class="size-4 shrink-0 text-red-400" aria-hidden="true" />
            <span class="size-2.5 shrink-0 rounded-full" :style="{ background: cor }" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate text-sm font-semibold text-preto-100">Alvo: {{ nome }}</span>
            <button
                type="button"
                class="rounded p-1 text-preto-400 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                aria-label="Limpar o alvo"
                title="Limpar o alvo (Esc)"
                @click="emit('limpar')"
            >
                <X class="size-4" />
            </button>
        </div>
    </section>
</template>

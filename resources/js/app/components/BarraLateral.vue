<script setup lang="ts">
import { MessageSquare, Users } from 'lucide-vue-next';
import type { Component } from 'vue';

export type AbaLateral = 'chat' | 'personagens';

defineProps<{ aba: AbaLateral; aberta: boolean; naoLidas: number }>();
const emit = defineEmits<{ 'update:aba': [AbaLateral]; 'update:aberta': [boolean] }>();

const abas: { id: AbaLateral; rotulo: string; icone: Component }[] = [
    { id: 'chat', rotulo: 'Chat', icone: MessageSquare },
    { id: 'personagens', rotulo: 'Personagens', icone: Users },
];
</script>

<template>
    <!-- Barra lateral fixa à direita (Foundry/Roll20): conteúdo da aba + faixa vertical de abas na borda. -->
    <aside class="pointer-events-auto absolute bottom-0 right-0 top-12 z-10 flex" aria-label="Barra lateral">
        <div v-show="aberta" class="flex w-[min(20rem,calc(85vw-2.75rem))] min-w-0 flex-col border-l border-ouro-500/25 bg-preto-950/95 shadow-2xl backdrop-blur">
            <section v-show="aba === 'chat'" class="flex min-h-0 flex-1 flex-col" role="tabpanel" id="painel-chat" aria-label="Chat"><slot name="chat" /></section>
            <section v-show="aba === 'personagens'" class="flex min-h-0 flex-1 flex-col" role="tabpanel" id="painel-personagens" aria-label="Personagens"><slot name="personagens" /></section>
        </div>

        <nav class="flex w-11 shrink-0 flex-col items-center gap-1 border-l border-ouro-500/25 bg-preto-950/95 py-2 backdrop-blur" role="tablist" aria-orientation="vertical" aria-label="Abas da barra lateral">
            <button
                v-for="a in abas"
                :key="a.id"
                type="button"
                role="tab"
                :id="`aba-${a.id}`"
                :aria-selected="aberta && aba === a.id"
                :aria-controls="`painel-${a.id}`"
                :title="a.rotulo"
                :aria-label="a.rotulo"
                class="relative flex size-9 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                :class="aberta && aba === a.id ? 'bg-ouro-500 text-preto-950' : 'text-preto-300 hover:bg-preto-800 hover:text-ouro-200'"
                @click="aberta && aba === a.id ? emit('update:aberta', false) : (emit('update:aba', a.id), emit('update:aberta', true))"
            >
                <component :is="a.icone" class="size-5" />
                <span v-if="a.id === 'chat' && naoLidas" class="absolute -left-1 -top-1 min-w-4 rounded-full bg-ouro-500 px-1 text-center text-[10px] font-semibold leading-4 text-preto-950 ring-2 ring-preto-950">{{ naoLidas > 99 ? '99+' : naoLidas }}</span>
            </button>
        </nav>
    </aside>
</template>

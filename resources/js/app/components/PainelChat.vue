<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { ChevronDown, MessageSquare, Send, Sparkles } from 'lucide-vue-next';
import { nextTick, ref, watch } from 'vue';
import type { Mensagem } from '../tipos-mesa';
import DadoIcone from './DadoIcone.vue';

const props = defineProps<{ mensagens: Mensagem[]; animacao: boolean; meuId: number }>();
const emit = defineEmits<{ enviar: [texto: string]; 'update:animacao': [boolean] }>();

const aberto = ref(true);
const texto = ref('');
const lista = ref<HTMLElement | null>(null);
const naoLidas = ref(0);

watch(
    () => props.mensagens.length,
    async () => {
        if (!aberto.value) naoLidas.value++;
        await nextTick();
        if (lista.value) lista.value.scrollTop = lista.value.scrollHeight;
    },
    { flush: 'post' },
);
watch(aberto, async (v) => {
    if (v) {
        naoLidas.value = 0;
        await nextTick();
        if (lista.value) lista.value.scrollTop = lista.value.scrollHeight;
    }
});

function enviar() {
    const t = texto.value.trim();
    if (!t) return;
    emit('enviar', t);
    texto.value = '';
}
const destaque = (m: Mensagem, v: number) => (m.dados?.faces === 20 && v === 20 ? 'critico' : m.dados?.faces === 20 && v === 1 ? 'falha' : null);
const hora = (m: Mensagem) => (m.criada_em ? new Date(m.criada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
</script>

<template>
    <section class="pointer-events-auto absolute bottom-16 right-3 z-10 flex w-80 flex-col rounded-lg border border-ouro-500/20 bg-preto-950/92 text-sm text-preto-100 backdrop-blur" aria-label="Chat">
        <header class="flex items-center justify-between gap-2 px-3 py-2">
            <button type="button" class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400" :aria-expanded="aberto" @click="aberto = !aberto">
                <MessageSquare class="size-3.5" /> Chat
                <span v-if="!aberto && naoLidas" class="rounded-full bg-ouro-500 px-1.5 text-[10px] text-preto-950">{{ naoLidas }}</span>
                <ChevronDown class="size-3.5 transition" :class="aberto ? '' : '-rotate-90'" />
            </button>
            <label class="flex cursor-pointer items-center gap-1.5 text-xs text-preto-300" title="Animação dos dados">
                <Sparkles class="size-3.5" :class="animacao ? 'text-ouro-400' : ''" />
                <input type="checkbox" class="size-3.5 accent-ouro-500" :checked="animacao" aria-label="Animação dos dados" @change="emit('update:animacao', ($event.target as HTMLInputElement).checked)" />
            </label>
        </header>

        <template v-if="aberto">
            <ol ref="lista" class="flex h-64 flex-col gap-1.5 overflow-y-auto border-t border-preto-800 px-3 py-2" aria-live="polite">
                <li v-if="!mensagens.length" class="m-auto text-center text-xs text-preto-400">Nenhuma mensagem ainda. Role um dado ou escreva algo.</li>
                <li v-for="m in mensagens" :key="m.id" class="rounded-md bg-preto-900/70 px-2.5 py-1.5">
                    <p class="flex items-baseline justify-between gap-2 text-xs">
                        <span class="truncate font-semibold" :style="{ color: m.autor?.cor ?? '#ecc96c' }">{{ m.autor?.nome ?? 'Sistema' }}<span v-if="m.autor?.id === meuId" class="font-normal text-preto-400"> (você)</span></span>
                        <span class="shrink-0 text-[10px] text-preto-500">{{ hora(m) }}</span>
                    </p>
                    <p v-if="m.tipo === 'texto'" class="break-words text-preto-100">{{ m.texto }}</p>
                    <template v-else-if="m.visibilidade === 'secreto_oculto'">
                        <p class="text-xs italic text-preto-300">🎲 {{ m.texto }}</p>
                    </template>
                    <template v-else-if="m.dados">
                        <p class="text-xs text-preto-300">
                            rolou {{ m.texto }}
                            <span v-if="m.visibilidade === 'mestre'" class="ml-1 rounded bg-preto-800 px-1 text-[10px] uppercase text-ouro-300">privada</span>
                            <span v-if="m.visibilidade === 'secreto'" class="ml-1 rounded bg-preto-800 px-1 text-[10px] uppercase text-ouro-300">segredo</span>
                        </p>
                        <div class="mt-1 flex flex-wrap items-center gap-1.5">
                            <span v-for="(v, i) in m.dados.resultados" :key="i" class="size-8"><DadoIcone :dado="m.dados.dado" :valor="v" :destaque="destaque(m, v)" /></span>
                            <strong v-if="m.dados.quantidade > 1" class="ml-1 text-base text-ouro-200">= {{ m.dados.total }}</strong>
                        </div>
                    </template>
                </li>
            </ol>
            <form class="flex gap-1.5 border-t border-preto-800 p-2" @submit.prevent="enviar">
                <input v-model="texto" type="text" maxlength="1000" placeholder="Mensagem…" aria-label="Mensagem do chat" class="h-8 min-w-0 flex-1 rounded-md border border-preto-700 bg-preto-900 px-2.5 text-sm text-preto-100 placeholder:text-preto-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ouro-400" />
                <Button type="submit" size="icon" class="size-8 bg-ouro-500 text-preto-950 hover:bg-ouro-400" aria-label="Enviar"><Send class="size-4" /></Button>
            </form>
        </template>
    </section>
</template>

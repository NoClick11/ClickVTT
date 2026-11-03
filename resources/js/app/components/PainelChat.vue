<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { MessageSquare, Send, Sparkles } from 'lucide-vue-next';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { Mensagem } from '../tipos-mesa';
import DadoIcone from './DadoIcone.vue';

const props = defineProps<{ mensagens: Mensagem[]; animacao: boolean; meuId: number; visivel: boolean }>();
const emit = defineEmits<{ enviar: [texto: string]; 'update:animacao': [boolean] }>();

const texto = ref('');
const lista = ref<HTMLElement | null>(null);

watch(
    () => props.mensagens.length,
    async () => {
        await nextTick();
        if (lista.value) lista.value.scrollTop = lista.value.scrollHeight;
    },
    { flush: 'post' },
);
onMounted(() => lista.value && (lista.value.scrollTop = lista.value.scrollHeight));
// A aba continua montada (v-show): ao reaparecer, volta para o fim da conversa.
watch(() => props.visivel, async (v) => {
    if (v) {
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
/**
 * Agrupa mensagens seguidas da mesma pessoa (como no Roll20): o nome aparece só na primeira.
 * Quebra o grupo quando muda o autor ou quando passa mais de 1 hora desde a mensagem anterior.
 */
const INTERVALO_MAX_MS = 60 * 60 * 1000;
interface Grupo {
    chave: number;
    autor: Mensagem['autor'];
    inicio: Mensagem;
    mensagens: Mensagem[];
}
const grupos = computed<Grupo[]>(() => {
    const saida: Grupo[] = [];
    let anterior: Mensagem | null = null;
    for (const m of props.mensagens) {
        const atual = saida[saida.length - 1];
        const mesmoAutor = !!anterior && (anterior.autor?.id ?? null) === (m.autor?.id ?? null);
        const tempo = (x: Mensagem) => (x.criada_em ? new Date(x.criada_em).getTime() : 0);
        const recente = !!anterior && tempo(m) - tempo(anterior) <= INTERVALO_MAX_MS;
        if (atual && mesmoAutor && recente) atual.mensagens.push(m);
        else saida.push({ chave: m.id, autor: m.autor, inicio: m, mensagens: [m] });
        anterior = m;
    }

    return saida;
});

const destaque = (m: Mensagem, v: number) => (m.dados?.faces === 20 && v === 20 ? 'critico' : m.dados?.faces === 20 && v === 1 ? 'falha' : null);
const hora = (m: Mensagem) => (m.criada_em ? new Date(m.criada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col text-sm text-preto-100">
        <header class="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-preto-800 px-3">
            <h2 class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400"><MessageSquare class="size-3.5" /> Chat</h2>
            <label class="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-xs text-preto-300 hover:text-ouro-200" title="Animação dos dados">
                <Sparkles class="size-3.5" :class="animacao ? 'text-ouro-400' : ''" />
                <input type="checkbox" class="size-3.5 accent-ouro-500" :checked="animacao" aria-label="Animação dos dados" @change="emit('update:animacao', ($event.target as HTMLInputElement).checked)" />
            </label>
        </header>

        <ol ref="lista" class="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-2" aria-live="polite">
            <li v-if="!mensagens.length" class="m-auto max-w-48 text-center text-xs text-preto-400">Nenhuma mensagem ainda. Role um dado ou escreva algo.</li>
            <li v-for="g in grupos" :key="g.chave" class="rounded-md bg-preto-900/70 px-2.5 py-1.5">
                <p class="flex items-baseline justify-between gap-2 text-xs">
                    <span class="truncate font-semibold" :style="{ color: g.autor?.cor ?? '#ecc96c' }">{{ g.autor?.nome ?? 'Sistema' }}<span v-if="g.autor?.id === meuId" class="font-normal text-preto-400"> (você)</span></span>
                    <span class="shrink-0 text-[10px] text-preto-500">{{ hora(g.inicio) }}</span>
                </p>
                <div v-for="m in g.mensagens" :key="m.id" class="mt-1.5 border-t border-preto-800/70 pt-1.5 first-of-type:mt-0.5 first-of-type:border-t-0 first-of-type:pt-0" :title="hora(m)" data-mensagem>
                    <p v-if="m.tipo === 'texto'" class="break-words text-preto-100">{{ m.texto }}</p>
                    <p v-else-if="m.visibilidade === 'secreto_oculto'" class="text-xs italic text-preto-300">🎲 {{ m.texto }}</p>
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
                </div>
            </li>
        </ol>

        <form class="flex shrink-0 gap-1.5 border-t border-preto-800 p-2" @submit.prevent="enviar">
            <input v-model="texto" type="text" maxlength="1000" placeholder="Mensagem…" aria-label="Mensagem do chat" class="h-9 min-w-0 flex-1 rounded-md border border-preto-700 bg-preto-900 px-2.5 text-sm text-preto-100 placeholder:text-preto-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ouro-400" />
            <Button type="submit" size="icon" class="size-9 bg-ouro-500 text-preto-950 hover:bg-ouro-400" aria-label="Enviar"><Send class="size-4" /></Button>
        </form>
    </div>
</template>

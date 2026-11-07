<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-vue-next';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { AcaoDaRolagem } from '../nucleo/rolagem';
import type { Mensagem } from '../tipos-mesa';
import CartaoRolagem from './CartaoRolagem.vue';

const props = defineProps<{ mensagens: Mensagem[]; meuId: number; visivel: boolean; mestre: boolean; alvoNome?: string | null; aplicados?: string[] }>();
const emit = defineEmits<{ enviar: [texto: string]; acao: [mensagem: Mensagem, acao: AcaoDaRolagem]; aplicarDano: [mensagem: Mensagem] }>();

/** Os botões do card (ex.: Dano) são de quem rolou — e do mestre, que controla todos os personagens. */
const podeAgir = (m: Mensagem) => m.autor?.personagem_id != null && (m.autor.id === props.meuId || props.mestre);

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
watch(
    () => props.visivel,
    async (v) => {
        if (v) {
            await nextTick();
            if (lista.value) lista.value.scrollTop = lista.value.scrollHeight;
        }
    },
);

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

const hora = (m: Mensagem) => (m.criada_em ? new Date(m.criada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col text-sm text-preto-100">
        <ol ref="lista" class="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-2" aria-live="polite">
            <li v-if="!mensagens.length" class="m-auto max-w-48 text-center text-xs text-preto-400">
                Nenhuma mensagem ainda. Role um dado ou escreva algo.
            </li>
            <li v-for="g in grupos" :key="g.chave" class="rounded-md bg-preto-900/70 px-2.5 py-1.5">
                <p class="flex items-baseline justify-between gap-2 text-xs">
                    <span class="truncate font-semibold" :style="{ color: g.autor?.cor ?? '#ecc96c' }"
                        >{{ g.autor?.nome ?? 'Sistema' }}<span v-if="g.autor?.id === meuId" class="font-normal text-preto-400"> (você)</span></span
                    >
                    <span class="shrink-0 text-[10px] text-preto-500">{{ hora(g.inicio) }}</span>
                </p>
                <div
                    v-for="m in g.mensagens"
                    :key="m.id"
                    class="mt-1.5 border-t border-preto-800/70 pt-1.5 first-of-type:mt-0.5 first-of-type:border-t-0 first-of-type:pt-0"
                    :title="hora(m)"
                    data-mensagem
                >
                    <p v-if="m.tipo === 'texto'" class="break-words text-preto-100">{{ m.texto }}</p>
                    <p v-else-if="m.visibilidade === 'secreto_oculto'" class="text-xs italic text-preto-300">🎲 {{ m.texto }}</p>
                    <CartaoRolagem
                        v-else-if="m.dados"
                        :mensagem="m"
                        :pode-agir="podeAgir(m)"
                        :alvo-nome="alvoNome"
                        :aplicado="(aplicados ?? []).includes(String(m.id))"
                        @acao="(msg, acao) => emit('acao', msg, acao)"
                        @aplicar-dano="(msg) => emit('aplicarDano', msg)"
                    />
                </div>
            </li>
        </ol>

        <form class="flex shrink-0 gap-1.5 border-t border-preto-800 p-2" @submit.prevent="enviar">
            <input
                v-model="texto"
                type="text"
                maxlength="1000"
                placeholder="Mensagem…"
                aria-label="Mensagem do chat"
                class="h-9 min-w-0 flex-1 rounded-md border border-preto-700 bg-preto-900 px-2.5 text-sm text-preto-100 placeholder:text-preto-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ouro-400"
            />
            <Button type="submit" size="icon" class="size-9 bg-ouro-500 text-preto-950 hover:bg-ouro-400" aria-label="Enviar"
                ><Send class="size-4"
            /></Button>
        </form>
    </div>
</template>

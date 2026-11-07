<script setup lang="ts">
import { computed } from 'vue';
import { dadosRolados, destaqueDado, destaqueDaRolagem, resumoFormula, type AcaoDaRolagem } from '../nucleo/rolagem';
import type { Mensagem } from '../tipos-mesa';
import DadoIcone from './DadoIcone.vue';

/**
 * Card de uma rolagem no chat (estilo Roll20/Foundry): título e fórmula curta no alto, os dados à esquerda, o TOTAL
 * grande à direita e, embaixo, os botões que o sistema oferece em seguida (ex.: rolar o dano depois do ataque).
 * Crítico e falha mudam a cor do card inteiro.
 */
const props = defineProps<{ mensagem: Mensagem; podeAgir: boolean; alvoNome?: string | null; aplicado?: boolean }>();
const emit = defineEmits<{
    acao: [mensagem: Mensagem, acao: AcaoDaRolagem];
    aplicarDano: [mensagem: Mensagem];
    pedirSalvaguarda: [mensagem: Mensagem];
}>();

const dados = computed(() => props.mensagem.dados!);
const titulo = computed(() => dados.value.rotulo ?? 'Rolagem');
const destaque = computed(() => destaqueDaRolagem(dados.value));
const dadosIndividuais = computed(() => dadosRolados(dados.value));
/** Poucos dados ficam grandes (o número se lê bem); muitos (uma bola de fogo) ficam compactos. */
const tamanhoDado = computed(() => (dadosIndividuais.value.length <= 2 ? 'size-12' : dadosIndividuais.value.length <= 4 ? 'size-10' : 'size-8'));
/** O ataque contra um alvo: janela de reação aberta ou resolvido. O dano só abre no acerto (sem alvo, como sempre). */
const resolucao = computed(() => dados.value.sistema?.resolucao ?? null);
const acoes = computed(() =>
    props.podeAgir && (!resolucao.value || (resolucao.value.estado === 'resolvido' && resolucao.value.acerto))
        ? (dados.value.sistema?.acoes ?? [])
        : [],
);
const sinal = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
/** Rolagem de dano e quem pode agir: oferece "Aplicar" ao alvo mirado (o tipo, se houver, aparece no botão). */
const dano = computed(() => (props.podeAgir ? (dados.value.sistema?.dano ?? null) : null));
/** Ataque de uma Técnica que acertou (ou sem alvo mirado): a Salvaguarda do efeito pode ser pedida ao atingido. */
const secundaria = computed(() => {
    const t = dados.value.sistema?.tecnica;
    if (!props.podeAgir || !t?.secundaria || dados.value.sistema?.destaque === 'falha') return null;
    const r = resolucao.value;

    return !r || (r.estado === 'resolvido' && r.acerto) ? t.secundaria : null;
});
const marca = computed(() => (dados.value.sistema?.destaque === 'falha' ? 'Falha crítica' : 'Crítico!'));

/** Faixa da lateral: a cor do resultado, ou a de quem rolou. */
const faixa = computed(() =>
    destaque.value === 'critico' ? '#4ade80' : destaque.value === 'falha' ? '#f87171' : (props.mensagem.autor?.cor ?? '#d4a843'),
);
const moldura = computed(() =>
    destaque.value === 'critico'
        ? 'border-green-400/40 from-green-950/70'
        : destaque.value === 'falha'
          ? 'border-red-400/40 from-red-950/60'
          : 'border-preto-700 from-preto-800/80',
);
const corTotal = computed(() => (destaque.value === 'critico' ? 'text-green-300' : destaque.value === 'falha' ? 'text-red-300' : 'text-ouro-100'));

/** O dado do botão acompanha o dado do dano (`1d8+4` → d8). */
const facesDe = (a: AcaoDaRolagem) => Number(/d(\d+)/.exec(a.resumo)?.[1] ?? 6);
const estiloBotao = (a: AcaoDaRolagem, indice: number) =>
    a.destaque === 'critico'
        ? 'border-green-400/70 bg-green-500/20 text-green-100 hover:bg-green-500/30'
        : indice === 0
          ? 'border-ouro-500/60 bg-ouro-500/10 text-ouro-100 hover:bg-ouro-500/20'
          : 'border-preto-700 bg-preto-900/60 text-preto-300 hover:border-ouro-500/40 hover:text-ouro-100';
</script>

<template>
    <article
        class="relative overflow-hidden rounded-lg border bg-gradient-to-br to-preto-950 shadow-md shadow-black/30"
        :class="moldura"
        :aria-label="`${titulo}: ${dados.total}`"
    >
        <span class="absolute inset-y-0 left-0 w-1" :style="{ backgroundColor: faixa }" aria-hidden="true" />

        <div class="py-2.5 pl-4 pr-3">
            <header class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <h4 class="truncate font-serif text-[15px] font-semibold leading-tight text-ouro-50">{{ titulo }}</h4>
                    <p v-if="dados.sistema?.municao?.nota" class="mt-0.5 text-[11px] leading-snug text-preto-300">{{ dados.sistema.municao.nota }}</p>
                    <p class="mt-0.5 truncate font-mono text-[11px] text-preto-400">{{ resumoFormula(dados) }}</p>
                </div>
                <div class="flex shrink-0 gap-1">
                    <span
                        v-if="mensagem.visibilidade === 'mestre'"
                        class="rounded-full border border-ouro-500/40 px-1.5 text-[10px] uppercase tracking-wide text-ouro-300"
                        >privada</span
                    >
                    <span
                        v-else-if="mensagem.visibilidade === 'secreto'"
                        class="rounded-full border border-ouro-500/40 px-1.5 text-[10px] uppercase tracking-wide text-ouro-300"
                        >segredo</span
                    >
                </div>
            </header>

            <div class="mt-2.5 flex items-center justify-between gap-3">
                <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span
                        v-for="(r, i) in dadosIndividuais"
                        :key="i"
                        class="drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]"
                        :class="[tamanhoDado, r.descartado ? 'opacity-30' : '']"
                        :title="r.descartado ? `d${r.faces} descartado` : `d${r.faces}`"
                        ><DadoIcone :faces="r.faces" :valor="r.valor" :destaque="destaqueDado(r, dados.sistema?.margem)"
                    /></span>
                </div>
                <div class="shrink-0 text-right">
                    <p class="font-serif text-4xl font-bold tabular-nums leading-none" :class="corTotal" :aria-label="`Total ${dados.total}`">
                        {{ dados.total }}
                    </p>
                    <p v-if="dados.sistema?.destaque" class="mt-1 text-[10px] font-bold uppercase tracking-widest" :class="corTotal">{{ marca }}</p>
                </div>
            </div>

            <div
                v-if="resolucao"
                class="mt-3 rounded-md border px-2.5 py-1.5 text-xs"
                :class="
                    resolucao.estado === 'aguardando'
                        ? 'border-sky-400/50 bg-sky-500/10 text-sky-100'
                        : resolucao.acerto
                          ? 'border-green-400/50 bg-green-500/10 text-green-100'
                          : 'border-red-400/50 bg-red-500/10 text-red-100'
                "
                role="status"
            >
                <template v-if="resolucao.estado === 'aguardando'"
                    >Aguardando reações de {{ resolucao.alvo }}… (defesa {{ resolucao.defesa }})</template
                >
                <template v-else>
                    <strong>{{ resolucao.acerto ? (resolucao.critico ? 'Crítico!' : 'Acerta') : resolucao.falha ? 'Falha crítica' : 'Erra' }}</strong>
                    {{ resolucao.alvo }}: {{ dados.total }} contra defesa {{ resolucao.defesa }}
                    <span v-if="resolucao.mods?.length" class="opacity-80"
                        >({{ resolucao.base }} {{ resolucao.mods.map((m) => `${m.fonte} ${sinal(m.valor)}`).join(', ') }})</span
                    >
                </template>
            </div>

            <div v-if="dano" class="mt-3 border-t border-preto-700/60 pt-2.5">
                <button
                    type="button"
                    :disabled="!alvoNome || aplicado"
                    class="flex w-full items-center gap-2 rounded-md border border-red-400/60 bg-red-500/10 px-2.5 py-1.5 text-left text-xs font-semibold text-red-100 transition hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 disabled:cursor-not-allowed disabled:opacity-50"
                    :title="
                        alvoNome
                            ? `Aplicar ${dados.total} de dano${dano.tipo ? ' de ' + dano.tipo : ''} a ${alvoNome}`
                            : 'Mire num token (botão Mirar ou tecla T + clique) para aplicar o dano'
                    "
                    @click="emit('aplicarDano', mensagem)"
                >
                    <span class="flex-1">{{ aplicado ? 'Dano aplicado' : alvoNome ? `Aplicar a ${alvoNome}` : 'Mire um alvo para aplicar' }}</span>
                    <span v-if="dano.tipo" class="rounded bg-preto-950/60 px-1.5 text-[10px] uppercase">{{ dano.tipo }}</span>
                    <span class="font-mono text-[11px] opacity-80">{{ dados.total }}</span>
                </button>
            </div>

            <div v-if="secundaria" class="mt-3 border-t border-preto-700/60 pt-2.5">
                <button
                    type="button"
                    class="flex w-full items-center gap-2 rounded-md border border-orange-400/60 bg-orange-500/10 px-2.5 py-1.5 text-left text-xs transition hover:bg-orange-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                    :title="`O alvo rola a Salvaguarda de ${secundaria.atributo.toUpperCase()}: se falhar, ${secundaria.efeito}`"
                    @click="emit('pedirSalvaguarda', mensagem)"
                >
                    <span class="flex-1 font-semibold text-orange-100"
                        >Pedir Salvaguarda de {{ secundaria.atributo.toUpperCase() }}{{ secundaria.desvantagem ? ' (desvantagem)' : '' }}</span
                    >
                    <span class="max-w-40 truncate text-[11px] text-orange-200/80">{{ secundaria.efeito }}</span>
                </button>
            </div>

            <ul
                v-if="props.podeAgir && dados.sistema?.expertise?.length"
                class="mt-3 grid gap-1 rounded-md border border-ouro-500/40 bg-ouro-500/10 p-2 text-xs text-ouro-100"
                aria-label="Expertise da arma"
            >
                <li v-for="e in dados.sistema.expertise" :key="e.id"><strong class="text-ouro-200">Expertise:</strong> {{ e.texto }}</li>
            </ul>
            <div v-if="acoes.length" class="mt-3 grid gap-1.5 border-t border-preto-700/60 pt-2.5">
                <button
                    v-for="(a, i) in acoes"
                    :key="a.id"
                    type="button"
                    class="flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                    :class="estiloBotao(a, i)"
                    :title="`Rolar ${a.rotulo.toLowerCase()} de ${a.rotuloRolagem} (${a.resumo})`"
                    @click="emit('acao', mensagem, a)"
                >
                    <span class="size-5 shrink-0"><DadoIcone :faces="facesDe(a)" /></span>
                    <span class="flex-1 font-semibold">{{ a.rotulo }}</span>
                    <span class="font-mono text-[11px] opacity-80">{{ a.resumo }}</span>
                </button>
            </div>
        </div>
    </article>
</template>

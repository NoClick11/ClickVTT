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
const props = defineProps<{ mensagem: Mensagem; podeAgir: boolean }>();
const emit = defineEmits<{ acao: [mensagem: Mensagem, acao: AcaoDaRolagem] }>();

const dados = computed(() => props.mensagem.dados!);
const titulo = computed(() => dados.value.rotulo ?? 'Rolagem');
const destaque = computed(() => destaqueDaRolagem(dados.value));
const dadosIndividuais = computed(() => dadosRolados(dados.value));
/** Poucos dados ficam grandes (o número se lê bem); muitos (uma bola de fogo) ficam compactos. */
const tamanhoDado = computed(() => (dadosIndividuais.value.length <= 2 ? 'size-12' : dadosIndividuais.value.length <= 4 ? 'size-10' : 'size-8'));
const acoes = computed(() => (props.podeAgir ? (dados.value.sistema?.acoes ?? []) : []));
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

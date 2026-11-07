<script setup lang="ts">
import { computed } from 'vue';
import { dadosDaTecnica, dadosRolados, resumoFormula } from '../nucleo/rolagem';
import type { Mensagem } from '../tipos-mesa';

/**
 * Card de uma Técnica de Salvaguarda no chat: a CD, um botão de rolar para cada alvo (só o dono do personagem, ou o mestre) e, quando
 * todos rolaram, o dano que o servidor rolou e o que cada um recebeu (todo se falhou; metade ou nada se passou).
 */
const props = defineProps<{ mensagem: Mensagem; meusPersonagens: number[]; mestre: boolean; ocupados?: number[] }>();
const emit = defineEmits<{ rolar: [mensagem: Mensagem, personagemId: number] }>();

const d = computed(() => dadosDaTecnica(props.mensagem));
const resolvido = computed(() => d.value.estado === 'resolvido');
const podeRolar = (id: number) => props.mestre || props.meusPersonagens.includes(id);
const sigla = computed(() => d.value.tecnica.atributo.toUpperCase());
const faltam = computed(() => d.value.alvos.filter((a) => a.estado === 'pendente').length);
const dadosDoAlvo = (a: (typeof d.value.alvos)[number]) =>
    dadosRolados({ expressao: '', rotulo: null, termos: a.termos ?? [], total: a.total ?? 0 })
        .map((x) => (x.descartado ? `(${x.valor})` : String(x.valor)))
        .join(' / ');
const aoPassar = computed(() => (d.value.tecnica.aoPassar === 'metade' ? 'metade do dano' : 'nenhum dano'));
</script>

<template>
    <article
        class="relative overflow-hidden rounded-lg border border-orange-400/40 bg-gradient-to-br from-orange-950/50 to-preto-950 shadow-md shadow-black/30"
        :aria-label="`${d.tecnica.nome}: Salvaguarda de ${sigla}, CD ${d.tecnica.cd}`"
    >
        <span class="absolute inset-y-0 left-0 w-1 bg-orange-400" aria-hidden="true" />
        <div class="py-2.5 pl-4 pr-3">
            <header class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <h4 class="truncate font-serif text-[15px] font-semibold leading-tight text-ouro-50">{{ d.tecnica.nome }}</h4>
                    <p class="mt-0.5 text-[11px] text-preto-300">
                        Salvaguarda de {{ sigla }}<span v-if="d.tecnica.desvantagem"> com desvantagem</span>
                        <span v-if="d.tecnica.dano"> · passou: {{ aoPassar }}</span>
                    </p>
                    <p v-if="d.tecnica.efeito" class="mt-0.5 text-[11px] text-orange-200">Quem falhar: {{ d.tecnica.efeito }}</p>
                </div>
                <div class="shrink-0 text-right">
                    <p class="font-serif text-3xl font-bold tabular-nums leading-none text-orange-200">{{ d.tecnica.cd }}</p>
                    <p class="mt-0.5 text-[10px] uppercase tracking-widest text-preto-400">CD</p>
                </div>
            </header>

            <ul class="mt-2.5 grid gap-1.5">
                <li
                    v-for="a in d.alvos"
                    :key="a.personagem_id"
                    class="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                    :class="
                        a.estado === 'pendente'
                            ? 'border-preto-700 bg-preto-900/60'
                            : a.passou
                              ? 'border-green-400/50 bg-green-500/10'
                              : 'border-red-400/50 bg-red-500/10'
                    "
                >
                    <span class="min-w-0 flex-1 truncate font-semibold text-preto-100">{{ a.nome }}</span>
                    <template v-if="a.estado === 'pendente'">
                        <button
                            v-if="podeRolar(a.personagem_id)"
                            type="button"
                            :disabled="ocupados?.includes(a.personagem_id)"
                            class="rounded-md border border-orange-400/70 bg-orange-500/15 px-2.5 py-1 font-semibold text-orange-100 transition hover:bg-orange-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 disabled:opacity-50"
                            :title="`Rolar a Salvaguarda de ${sigla} de ${a.nome}${d.tecnica.desvantagem ? ' (desvantagem)' : ''}`"
                            @click="emit('rolar', mensagem, a.personagem_id)"
                        >
                            Rolar {{ sigla }}
                        </button>
                        <span v-else class="text-preto-400">aguardando</span>
                    </template>
                    <template v-else>
                        <span
                            class="font-mono text-[11px] text-preto-400"
                            :title="resumoFormula({ expressao: '', rotulo: null, termos: a.termos ?? [], total: a.total ?? 0 })"
                            >d20 {{ dadosDoAlvo(a) }}</span
                        >
                        <span class="font-serif text-lg font-bold tabular-nums" :class="a.passou ? 'text-green-300' : 'text-red-300'">{{
                            a.total
                        }}</span>
                        <span
                            class="w-14 text-right text-[10px] font-bold uppercase tracking-wide"
                            :class="a.passou ? 'text-green-300' : 'text-red-300'"
                            >{{ a.passou ? 'Passou' : 'Falhou' }}</span
                        >
                        <span
                            v-if="resolvido && d.tecnica.dano"
                            class="w-16 text-right font-mono text-[11px] text-preto-200"
                            :title="a.modo && a.modo !== 'normal' ? a.modo : ''"
                            >−{{ a.final ?? 0
                            }}<span v-if="a.base !== undefined && a.base !== a.final" class="opacity-60"> ({{ a.base }})</span></span
                        >
                    </template>
                </li>
            </ul>

            <p v-if="!resolvido" class="mt-2 text-[11px] text-preto-400" role="status">Falta rolar {{ faltam }}. O dano sai quando todos rolarem.</p>
            <div
                v-else-if="d.dano"
                class="mt-2.5 flex items-center justify-between gap-2 rounded-md border border-orange-400/50 bg-orange-500/10 px-2.5 py-1.5 text-xs text-orange-100"
                role="status"
            >
                <span
                    >Dano rolado: <strong>{{ d.dano.expressao }}</strong
                    ><span v-if="d.dano.tipo"> · {{ d.dano.tipo }}</span
                    ><span v-if="d.dano.repeticoes?.length"> · rolou {{ d.dano.repeticoes.length }}×: {{ d.dano.repeticoes.join(' e ') }}</span></span
                >
                <span class="font-serif text-2xl font-bold tabular-nums">{{ d.dano.total }}</span>
            </div>
        </div>
    </article>
</template>

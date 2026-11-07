<script setup lang="ts">
import { computed } from 'vue';
import { dadosDoGatilho, dadosRolados } from '../nucleo/rolagem';
import type { Mensagem } from '../tipos-mesa';

/**
 * Card de uma Técnica ativa (Quick Draw) no início do turno de quem está ao alcance: o jogador clica para rolar o ataque; no acerto o
 * servidor já rolou e aplicou o dano e o jogador escolhe um efeito. Só quem controla o atacante (ou o mestre) vê os botões.
 */
const props = defineProps<{ mensagem: Mensagem; meusPersonagens: number[]; mestre: boolean; ocupado?: boolean }>();
const emit = defineEmits<{ atacar: [mensagem: Mensagem]; escolher: [mensagem: Mensagem, opcao: string]; ignorar: [mensagem: Mensagem] }>();

const d = computed(() => dadosDoGatilho(props.mensagem));
const meu = computed(() => props.mestre || props.meusPersonagens.includes(d.value.atacante.personagem_id));
const natural = computed(() => {
    const dado = dadosRolados({ expressao: '', rotulo: null, termos: d.value.ataque?.termos ?? [], total: 0 }).find(
        (x) => x.faces === 20 && !x.descartado,
    );

    return dado?.valor ?? null;
});
</script>

<template>
    <article
        class="relative overflow-hidden rounded-lg border border-amber-400/40 bg-gradient-to-br from-amber-950/50 to-preto-950 shadow-md shadow-black/30"
        :aria-label="`${d.rotulo}: ${d.atacante.nome} contra ${d.alvo.nome}`"
    >
        <span class="absolute inset-y-0 left-0 w-1 bg-amber-400" aria-hidden="true" />
        <div class="py-2.5 pl-4 pr-3">
            <header class="min-w-0">
                <h4 class="truncate font-serif text-[15px] font-semibold leading-tight text-ouro-50">{{ d.rotulo }}</h4>
                <p v-if="d.vigia" class="mt-0.5 text-[11px] text-preto-300">
                    <strong class="text-preto-100">{{ d.alvo.nome }}</strong> {{ d.motivo === 'se move' ? 'se move' : 'age' }} dentro da esfera:
                    {{ d.atacante.nome }} pode atacar antes que complete (1 munição; faltam {{ d.rodadas }} rodada{{ d.rodadas === 1 ? '' : 's' }})
                </p>
                <p v-else class="mt-0.5 text-[11px] text-preto-300">
                    Início do turno de <strong class="text-preto-100">{{ d.alvo.nome }}</strong
                    >: {{ d.atacante.nome }} pode atacar (faltam {{ d.rodadas }} rodada{{ d.rodadas === 1 ? '' : 's' }})
                </p>
            </header>

            <div v-if="d.estado === 'pendente'" class="mt-2.5 flex flex-wrap gap-1.5">
                <template v-if="meu">
                    <button
                        type="button"
                        :disabled="ocupado"
                        class="rounded-md border border-amber-400/70 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 disabled:opacity-50"
                        @click="emit('atacar', mensagem)"
                    >
                        Atacar {{ d.alvo.nome }}
                    </button>
                    <button
                        type="button"
                        :disabled="ocupado"
                        class="rounded-md border border-preto-700 px-3 py-1.5 text-xs text-preto-300 transition hover:border-preto-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 disabled:opacity-50"
                        @click="emit('ignorar', mensagem)"
                    >
                        Não atacar
                    </button>
                </template>
                <span v-else class="text-[11px] text-preto-400">aguardando {{ d.atacante.nome }}</span>
            </div>

            <p v-else-if="d.estado === 'ignorado'" class="mt-2 text-[11px] text-preto-400" role="status">{{ d.atacante.nome }} não atacou.</p>

            <template v-else>
                <div
                    class="mt-2.5 flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                    :class="d.ataque?.acerto ? 'border-green-400/50 bg-green-500/10 text-green-100' : 'border-red-400/50 bg-red-500/10 text-red-100'"
                    role="status"
                >
                    <span>
                        <strong>{{
                            d.ataque?.critico ? 'Crítico!' : d.ataque?.acerto ? 'Acerta' : d.ataque?.falha ? 'Falha crítica' : 'Erra'
                        }}</strong>
                        {{ d.alvo.nome }}: d20 {{ natural }} → {{ d.ataque?.total }} contra defesa {{ d.ataque?.defesa }}
                    </span>
                </div>
                <div
                    v-if="d.dano"
                    class="mt-1.5 flex items-center justify-between gap-2 rounded-md border border-amber-400/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-100"
                    role="status"
                >
                    <span
                        >Dano {{ d.dano.expressao }}<span v-if="d.dano.tipo"> · {{ d.dano.tipo }}</span> — {{ d.alvo.nome }} recebeu
                        <strong>{{ d.dano.final }}</strong
                        ><span v-if="d.dano.final !== d.dano.total" class="opacity-70"> (de {{ d.dano.total }})</span></span
                    >
                </div>
                <div
                    v-if="d.salvaguarda"
                    class="mt-1.5 rounded-md border px-2.5 py-1.5 text-xs"
                    :class="
                        d.salvaguarda.passou ? 'border-green-400/40 bg-green-500/10 text-green-100' : 'border-red-400/50 bg-red-500/10 text-red-100'
                    "
                    role="status"
                >
                    Salvaguarda de Constituição de {{ d.alvo.nome }}: {{ d.salvaguarda.total }} contra CD {{ d.salvaguarda.cd }} —
                    <strong>{{ d.salvaguarda.passou ? 'passou' : 'falhou: encerra o turno' }}</strong>
                </div>
                <p v-if="d.municao" class="mt-1 text-[11px] text-preto-400">Munição gasta: {{ d.municao }}</p>
                <div v-if="d.estado === 'acertou'" class="mt-2 grid gap-1.5">
                    <template v-if="meu">
                        <p class="text-[11px] text-preto-300">Escolha o efeito:</p>
                        <button
                            v-for="o in d.opcoes"
                            :key="o.id"
                            type="button"
                            :disabled="ocupado"
                            class="rounded-md border border-amber-400/60 bg-amber-500/10 px-2.5 py-1.5 text-left text-xs text-amber-100 transition hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 disabled:opacity-50"
                            @click="emit('escolher', mensagem, o.id)"
                        >
                            {{ o.rotulo }}
                        </button>
                    </template>
                    <p v-else class="text-[11px] text-preto-400">aguardando {{ d.atacante.nome }} escolher o efeito</p>
                </div>
                <p v-else-if="d.estado === 'resolvido' && d.escolha" class="mt-1.5 text-[11px] text-amber-200" role="status">
                    Efeito: {{ d.escolha.texto }}
                </p>
            </template>
        </div>
    </article>
</template>

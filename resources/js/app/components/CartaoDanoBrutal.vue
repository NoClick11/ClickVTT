<script setup lang="ts">
import { computed } from 'vue';
import type { Mensagem } from '../tipos-mesa';

const props = defineProps<{
    mensagem: Mensagem;
    mestre: boolean;
    meusPersonagens?: number[];
    ocupado?: boolean;
}>();

const emit = defineEmits<{
    pedir: [mensagem: Mensagem];
    rolar: [mensagem: Mensagem];
    aplicar: [mensagem: Mensagem];
    ignorar: [mensagem: Mensagem];
}>();

const d = computed(
    () =>
        (props.mensagem.dados ?? {}) as {
            personagem_id: number;
            personagem_nome: string;
            dano: number;
            severidade: 'grave' | 'critico' | 'mortal';
            cd: number;
            estado: 'pendente' | 'aguardando_jogador' | 'falhou' | 'passou' | 'aplicado' | 'ignorado';
            resultado?: {
                total: number;
                passou: boolean;
                termos?: unknown[];
                expressao?: string;
            } | null;
        },
);

const podeRolar = computed(() => props.mestre || (props.meusPersonagens ?? []).includes(d.value.personagem_id));

const tituloSeveridade = computed(() => {
    switch (d.value.severidade) {
        case 'mortal':
            return 'Dano Brutal: Mortal';
        case 'critico':
            return 'Dano Brutal: Crítico';
        case 'grave':
        default:
            return 'Dano Brutal: Grave';
    }
});

const descricaoRegra = computed(() => {
    switch (d.value.severidade) {
        case 'mortal':
            return 'Perdeu mais de 2/3 dos PV máximos. Exige Salvaguarda de CON CD 16 com desvantagem pura.';
        case 'critico':
            return 'Perdeu mais da metade dos PV máximos. Exige Salvaguarda de CON CD 16 com desvantagem.';
        case 'grave':
        default:
            return 'Perdeu mais de 1/3 dos PV máximos. Exige Salvaguarda de CON CD 16.';
    }
});
</script>

<template>
    <article
        class="relative overflow-hidden rounded-lg border border-red-500/50 bg-gradient-to-br from-red-950/70 via-preto-950 to-preto-950 shadow-md shadow-black/40"
        :aria-label="`${tituloSeveridade} para ${d.personagem_nome}`"
    >
        <span class="absolute inset-y-0 left-0 w-1.5 bg-red-500" aria-hidden="true" />
        <div class="py-2.5 pl-4 pr-3">
            <header class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                        <span
                            v-if="mensagem.visibilidade === 'mestre'"
                            class="rounded border border-red-500/40 bg-red-600/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200"
                        >
                            Apenas Mestre
                        </span>
                        <span
                            v-else
                            class="rounded border border-red-500/40 bg-red-600/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200"
                        >
                            Salvaguarda
                        </span>
                        <h4 class="truncate font-serif text-[15px] font-semibold leading-tight text-red-100">
                            {{ tituloSeveridade }}
                        </h4>
                    </div>
                    <p class="mt-1 text-xs text-preto-200">
                        <strong class="text-white">{{ d.personagem_nome }}</strong> sofreu <span class="font-bold text-red-300">{{ d.dano }}</span> de
                        dano em um único golpe.
                    </p>
                    <p class="mt-0.5 text-[11px] text-preto-400">
                        {{ descricaoRegra }}
                    </p>
                </div>
                <div class="shrink-0 text-right">
                    <p class="font-serif text-3xl font-bold tabular-nums leading-none text-red-200">{{ d.cd ?? 16 }}</p>
                    <p class="mt-0.5 text-[10px] uppercase tracking-widest text-preto-400">CD CON</p>
                </div>
            </header>

            <!-- Ações iniciais do Mestre (quando pendente apenas para o mestre) -->
            <div v-if="d.estado === 'pendente' && mestre" class="mt-3 flex flex-wrap items-center gap-1.5 border-t border-preto-800/80 pt-2.5">
                <button
                    type="button"
                    :disabled="ocupado"
                    class="rounded-md border border-red-500/70 bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-100 transition hover:bg-red-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
                    title="Exige que o jogador faça a Salvaguarda de Constituição CD 16"
                    @click="emit('pedir', mensagem)"
                >
                    Pedir Salvaguarda ao Jogador
                </button>
                <button
                    type="button"
                    :disabled="ocupado"
                    class="rounded-md border border-red-700/60 bg-red-950/40 px-2.5 py-1 text-xs text-red-300 transition hover:bg-red-900/50 hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
                    title="Aplicar o Dano Brutal diretamente sem salvaguarda"
                    @click="emit('aplicar', mensagem)"
                >
                    Aplicar Direto (-{{ d.dano }} máx)
                </button>
                <button
                    type="button"
                    :disabled="ocupado"
                    class="rounded-md border border-preto-700 px-2.5 py-1 text-xs text-preto-400 transition hover:border-preto-500 hover:text-preto-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 disabled:opacity-50"
                    title="Descartar o alerta sem aplicar dano brutal"
                    @click="emit('ignorar', mensagem)"
                >
                    Ignorar
                </button>
            </div>

            <!-- Aguardando o jogador rolar -->
            <div v-else-if="d.estado === 'aguardando_jogador'" class="mt-3 border-t border-preto-800/80 pt-2.5">
                <div v-if="podeRolar" class="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        :disabled="ocupado"
                        class="rounded-md border border-red-500/80 bg-red-600/30 px-3 py-1.5 text-xs font-semibold text-red-100 shadow-sm transition hover:bg-red-600/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
                        :title="`Rolar Salvaguarda de Constituição CD ${d.cd ?? 16} para ${d.personagem_nome}`"
                        @click="emit('rolar', mensagem)"
                    >
                        🎲 Rolar Salvaguarda de CON (CD {{ d.cd ?? 16 }})
                    </button>
                    <span v-if="d.severidade === 'critico'" class="text-[11px] text-red-300"> (com desvantagem) </span>
                    <span v-else-if="d.severidade === 'mortal'" class="text-[11px] text-red-300"> (desvantagem pura) </span>
                    <template v-if="mestre">
                        <button
                            type="button"
                            :disabled="ocupado"
                            class="rounded-md border border-preto-700 px-2 py-1 text-xs text-preto-400 transition hover:border-preto-500 hover:text-preto-200 disabled:opacity-50"
                            title="Descartar"
                            @click="emit('ignorar', mensagem)"
                        >
                            Ignorar
                        </button>
                    </template>
                </div>
                <div v-else class="flex items-center gap-2 text-xs text-preto-300">
                    <span
                        >⏳ Aguardando <strong class="text-white">{{ d.personagem_nome }}</strong> rolar a Salvaguarda de Constituição CD
                        {{ d.cd ?? 16 }}...</span
                    >
                </div>
            </div>

            <!-- Se falhou na salvaguarda -->
            <div v-else-if="d.estado === 'falhou'" class="mt-3 space-y-2 border-t border-preto-800/80 pt-2.5">
                <div class="flex items-center gap-2 rounded border border-red-500/40 bg-red-950/30 px-2.5 py-1.5 text-xs text-red-200">
                    <span
                        >❌ <strong class="text-white">{{ d.personagem_nome }}</strong> falhou na Salvaguarda (total:
                        <strong class="text-red-300">{{ d.resultado?.total }}</strong> vs CD {{ d.cd ?? 16 }}). O ferimento foi grave!</span
                    >
                </div>
                <div v-if="mestre" class="flex flex-wrap gap-1.5">
                    <button
                        type="button"
                        :disabled="ocupado"
                        class="rounded-md border border-red-500/80 bg-red-600/30 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-600/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
                        title="Reduz os PV máximos do personagem no valor do dano sofrido"
                        @click="emit('aplicar', mensagem)"
                    >
                        🩸 Aplicar Dano Brutal (-{{ d.dano }} PV máx)
                    </button>
                    <button
                        type="button"
                        :disabled="ocupado"
                        class="rounded-md border border-preto-700 px-2.5 py-1 text-xs text-preto-400 transition hover:border-preto-500 hover:text-preto-200 disabled:opacity-50"
                        @click="emit('ignorar', mensagem)"
                    >
                        Ignorar
                    </button>
                </div>
                <p v-else class="text-[11px] text-preto-400">Aguardando o Mestre confirmar a aplicação do Dano Brutal.</p>
            </div>

            <!-- Se passou na salvaguarda -->
            <div v-else-if="d.estado === 'passou'" class="mt-3 border-t border-preto-800/80 pt-2.5">
                <div class="flex items-center gap-2 rounded border border-green-500/40 bg-green-950/30 px-2.5 py-1.5 text-xs text-green-200">
                    <span
                        >🛡️ <strong class="text-white">{{ d.personagem_nome }}</strong> passou na Salvaguarda! (total:
                        <strong class="text-green-300">{{ d.resultado?.total }}</strong> vs CD {{ d.cd ?? 16 }}). Dano Brutal evitado.</span
                    >
                </div>
            </div>

            <!-- Se já foi aplicado -->
            <div v-else-if="d.estado === 'aplicado'" class="mt-3 border-t border-preto-800/80 pt-2.5">
                <div class="flex items-center gap-2 rounded border border-red-500/50 bg-red-950/40 px-2.5 py-1.5 text-xs text-red-300">
                    <span
                        >🩸 <strong>Dano Brutal aplicado!</strong> PV máximos de {{ d.personagem_nome }} reduzidos em {{ d.dano }}. Exige cirurgia ou
                        tratamento médico.</span
                    >
                </div>
            </div>

            <!-- Se ignorado -->
            <div v-else-if="d.estado === 'ignorado'" class="mt-2.5 border-t border-preto-800/80 pt-2 text-[11px] text-preto-400">
                Alerta descartado pelo Mestre (sem Dano Brutal).
            </div>
        </div>
    </article>
</template>

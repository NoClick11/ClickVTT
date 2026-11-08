<script setup lang="ts">
import { computed } from 'vue';
import type { CategoriaAcao } from '../../nucleo/combate/acoes';
import { itemAtual, type Combate } from '../../nucleo/combate/estado';
import { totalDoTurno } from '../../nucleo/combate/movimento';

/**
 * Barra minimalista de controle do turno: exibe apenas deslocamento/movimento, status da reação e botão de disparada.
 */
const props = defineProps<{ combate: Combate; categorias: CategoriaAcao[]; mestre: boolean; meusPersonagens: number[] }>();
const emit = defineEmits<{
    devolver: [itemId: string, categoria: string];
    disparar: [personagemId: number];
    finalizar: [];
}>();

const atual = computed(() => (props.combate.fase === 'em_curso' ? itemAtual(props.combate) : null));

/** Se o turno atual pertence a um personagem deste jogador (ou se é o mestre). */
const podeFinalizar = computed(() => {
    const i = atual.value;
    if (!i) return false;
    return props.mestre || (i.personagem_id !== null && props.meusPersonagens.includes(i.personagem_id));
});

/** O deslocamento do turno em metros: o que já andou e o total (base do sistema + Disparada); sem total, o sistema não mede. */
const deslocamento = computed(() => {
    const i = atual.value;
    const total = i ? totalDoTurno(i) : null;

    return i && total !== null
        ? {
              usado: i.movimento.usado,
              total,
              pct: total > 0 ? Math.min(100, (i.movimento.usado / total) * 100) : 100,
              esgotado: i.movimento.usado >= total - 0.001,
          }
        : null;
});

const formatar = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',');

/** Se a reação já foi gasta nesta rodada. */
const reacaoGasta = computed(() => (atual.value?.acoes['reacao'] ?? 0) > 0);

/** A Disparada é de quem está no turno (ou do mestre). */
const podeDisparar = computed(() => {
    const i = atual.value;
    const cfg = props.categorias.find((c) => c.id === 'padrao');
    if (!i || !cfg || i.personagem_id === null) return false;
    const livre = !props.mestre && (i.acoes['padrao'] ?? 0) >= (cfg.porTurno ?? Infinity);

    return (props.mestre || props.meusPersonagens.includes(i.personagem_id)) && !livre;
});
</script>

<template>
    <section
        v-if="atual"
        class="pointer-events-auto absolute bottom-[5.75rem] left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-nowrap items-center gap-2.5 whitespace-nowrap rounded-full border border-ouro-500/30 bg-preto-950/90 px-3 py-1.5 text-xs shadow-xl shadow-black/60 backdrop-blur"
        aria-label="Ações do turno"
    >
        <span class="flex shrink-0 items-center gap-1.5 font-semibold text-ouro-200">
            <span class="size-2 shrink-0 rounded-full" :style="{ backgroundColor: atual.cor ?? '#ecc96c' }" aria-hidden="true" />
            <span class="max-w-[120px] truncate">{{ atual.nome }}</span>
        </span>

        <!-- Movimento -->
        <div
            v-if="deslocamento"
            class="flex shrink-0 items-center gap-2 border-l border-preto-800 pl-2.5 text-preto-200"
            :title="`Deslocamento do turno: ${formatar(deslocamento.usado)} de ${formatar(deslocamento.total)} m`"
        >
            <span class="shrink-0 text-[11px] font-medium text-preto-400">Movimento</span>
            <div
                class="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-preto-800"
                role="progressbar"
                :aria-valuenow="Math.round(deslocamento.pct)"
                aria-valuemin="0"
                aria-valuemax="100"
            >
                <div
                    class="h-full rounded-full transition-all"
                    :class="deslocamento.esgotado ? 'bg-red-500' : 'bg-emerald-400'"
                    :style="{ width: deslocamento.pct + '%' }"
                />
            </div>
            <span class="shrink-0 font-mono text-[11px] tabular-nums" :class="deslocamento.esgotado ? 'text-red-300' : 'text-preto-200'">
                {{ formatar(deslocamento.usado) }}/{{ formatar(deslocamento.total) }} m
            </span>
            <button
                v-if="mestre && deslocamento.usado > 0"
                type="button"
                class="shrink-0 rounded px-1 text-preto-400 transition hover:text-ouro-200"
                title="Devolver o deslocamento do turno"
                aria-label="Devolver o deslocamento"
                @click="emit('devolver', atual!.id, 'movimento')"
            >
                ↺
            </button>
        </div>

        <!-- Reação -->
        <component
            :is="mestre && reacaoGasta ? 'button' : 'div'"
            :type="mestre && reacaoGasta ? 'button' : undefined"
            class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium transition"
            :class="
                reacaoGasta
                    ? 'border border-preto-700 bg-preto-900/80 text-preto-400 hover:border-preto-600'
                    : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            "
            :title="
                reacaoGasta
                    ? mestre
                        ? 'Reação usada nesta rodada. Clique para devolver.'
                        : 'Reação usada nesta rodada.'
                    : 'Reação disponível nesta rodada.'
            "
            @click="mestre && reacaoGasta && emit('devolver', atual!.id, 'reacao')"
        >
            <span class="size-1.5 shrink-0 rounded-full" :class="reacaoGasta ? 'bg-preto-500' : 'bg-emerald-400'" />
            <span>Reação: {{ reacaoGasta ? 'Usada' : 'Disponível' }}</span>
        </component>

        <!-- Disparada -->
        <button
            v-if="podeDisparar"
            type="button"
            class="shrink-0 whitespace-nowrap rounded-full border border-ouro-400/50 bg-ouro-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-ouro-200 transition hover:bg-ouro-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
            title="Disparada: soma outro deslocamento ao turno"
            @click="emit('disparar', atual!.personagem_id!)"
        >
            Disparada
        </button>

        <!-- Finalizar Turno -->
        <button
            v-if="podeFinalizar"
            type="button"
            class="shrink-0 whitespace-nowrap rounded-full border border-emerald-500/50 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            title="Finalizar turno e passar a vez para o próximo combatente"
            @click="emit('finalizar')"
        >
            Finalizar turno
        </button>
    </section>
</template>

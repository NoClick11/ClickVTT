<script setup lang="ts">
import { computed } from 'vue';
import type { CategoriaAcao } from '../../nucleo/combate/acoes';
import { itemAtual, type Combate } from '../../nucleo/combate/estado';
import { totalDoTurno } from '../../nucleo/combate/movimento';

/**
 * Marcadores de ação de quem está no turno (Ação ●, Poderosa ●, Bônus ●, Livre 2, Reação ○): todos veem; o mestre clica
 * num marcador para devolver um uso. As categorias e os limites vêm do sistema. Só mostra e emite (`devolver`).
 */
const props = defineProps<{ combate: Combate; categorias: CategoriaAcao[]; mestre: boolean; meusPersonagens: number[] }>();
const emit = defineEmits<{ devolver: [itemId: string, categoria: string]; disparar: [personagemId: number] }>();

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
/** A Disparada é de quem está no turno (ou do mestre) e gasta a ação padrão do sistema. */
const podeDisparar = computed(() => {
    const i = atual.value;
    const cfg = props.categorias.find((c) => c.id === 'padrao');
    if (!i || !cfg || i.personagem_id === null) return false;
    const livre = !props.mestre && (i.acoes['padrao'] ?? 0) >= (cfg.porTurno ?? Infinity);

    return (props.mestre || props.meusPersonagens.includes(i.personagem_id)) && !livre;
});

const atual = computed(() => (props.combate.fase === 'em_curso' ? itemAtual(props.combate) : null));
/** Quantas bolinhas a categoria tem (o limite) e quantas já foram usadas; sem limite, só o número de usos. */
const marcadores = computed(() =>
    props.categorias.map((c) => {
        const limite = c.porTurno ?? c.porRodada;
        const usado = atual.value?.acoes[c.id] ?? 0;

        return { ...c, limite, usado, bolinhas: limite === null ? [] : Array.from({ length: limite }, (_, i) => i < usado) };
    }),
);
const dica = (c: { nome: string; porRodada: number | null }) =>
    c.porRodada !== null ? `${c.nome}: ${c.porRodada} por rodada` : `${c.nome}: por turno`;
</script>

<template>
    <section
        v-if="atual && categorias.length"
        class="bg-preto-950/92 pointer-events-auto absolute bottom-[5.75rem] left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-ouro-500/30 px-3 py-1.5 text-xs shadow-lg backdrop-blur"
        aria-label="Ações do turno"
    >
        <span class="flex items-center gap-1.5 font-semibold text-ouro-200">
            <span class="size-2.5 rounded-full" :style="{ backgroundColor: atual.cor ?? '#ecc96c' }" aria-hidden="true" />{{ atual.nome }}
        </span>
        <component
            :is="mestre ? 'button' : 'span'"
            v-for="m in marcadores"
            :key="m.id"
            :type="mestre ? 'button' : undefined"
            class="flex items-center gap-1 rounded px-1 text-preto-200"
            :class="mestre ? 'hover:bg-preto-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400' : ''"
            :title="mestre ? `${dica(m)}. Clique para devolver um uso.` : dica(m)"
            :aria-label="`${m.nome}: ${m.limite === null ? m.usado + ' usos' : m.usado + ' de ' + m.limite + ' usados'}`"
            @click="mestre && emit('devolver', atual!.id, m.id)"
        >
            {{ m.nome }}
            <span v-if="m.limite === null" class="tabular-nums text-preto-400">{{ m.usado }}</span>
            <span v-else class="flex gap-0.5" aria-hidden="true">
                <span
                    v-for="(gasta, i) in m.bolinhas"
                    :key="i"
                    class="size-2.5 rounded-full border"
                    :class="gasta ? 'border-preto-600 bg-preto-700' : 'border-ouro-400 bg-ouro-500'"
                />
            </span>
        </component>
        <span
            v-if="deslocamento"
            class="flex items-center gap-1.5 text-preto-200"
            :title="`Deslocamento do turno: ${formatar(deslocamento.usado)} de ${formatar(deslocamento.total)} m`"
        >
            Mover
            <span
                class="h-2 w-16 overflow-hidden rounded-full bg-preto-800"
                role="progressbar"
                :aria-valuenow="Math.round(deslocamento.pct)"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-label="Deslocamento usado"
            >
                <span
                    class="block h-full rounded-full transition-all"
                    :class="deslocamento.esgotado ? 'bg-red-500' : 'bg-green-400'"
                    :style="{ width: deslocamento.pct + '%' }"
                />
            </span>
            <span class="tabular-nums" :class="deslocamento.esgotado ? 'text-red-300' : ''"
                >{{ formatar(deslocamento.usado) }}/{{ formatar(deslocamento.total) }} m</span
            >
            <button
                v-if="mestre"
                type="button"
                class="rounded px-1 text-preto-400 hover:text-ouro-200"
                title="Devolver o deslocamento do turno"
                aria-label="Devolver o deslocamento"
                @click="emit('devolver', atual!.id, 'movimento')"
            >
                ↺
            </button>
        </span>
        <button
            v-if="podeDisparar"
            type="button"
            class="rounded-full border border-ouro-500/50 px-2.5 py-0.5 font-semibold text-ouro-100 transition hover:bg-ouro-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
            title="Disparada: gasta a ação e soma outro deslocamento ao turno"
            @click="emit('disparar', atual!.personagem_id!)"
        >
            Disparada
        </button>
    </section>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button';
import type { Personagem } from '@/site/types';
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-vue-next';
import { computed } from 'vue';
import type { ObjetoDto } from '../engine/tipos';
import { itemAtual, type Combate, type ItemTurno } from '../nucleo/combate/estado';

/**
 * Combat Tracker / Combat Carousel no estilo clássico do Foundry VTT:
 * - Contador de rodadas com moldura metálica e visual Foundry
 * - Fila de combatentes com avatares/retratos e badges de iniciativa
 * - Destaque luminoso dourado no combatente do turno atual
 * - Controles de avançar/voltar turno para o mestre
 */
const props = withDefaults(
    defineProps<{
        combate: Combate;
        mestre: boolean;
        meusPersonagens: number[];
        objetos?: ObjetoDto[];
        personagens?: Personagem[];
    }>(),
    { objetos: () => [], personagens: () => [] },
);

defineEmits<{ anterior: []; proximo: []; abrir: [] }>();

const atual = computed(() => (props.combate.fase === 'em_curso' ? itemAtual(props.combate) : null));

const seuTurno = computed(() => {
    return props.combate.fase === 'em_curso' && atual.value?.personagem_id != null && props.meusPersonagens.includes(atual.value.personagem_id);
});

/** Busca a imagem do token ou personagem se existir. */
function imagemDoCombatente(i: ItemTurno): string | null {
    if (i.objeto_id) {
        const obj = props.objetos.find((o) => o.id === i.objeto_id);
        if (obj?.arquivo) return obj.arquivo;
    }
    return null;
}

/** Cor da borda ou indicador conforme a disposição estilo Foundry (aliado verde, neutro amarelo, inimigo vermelho). */
function corDisposicao(i: ItemTurno): string {
    if (i.disposicao === 'jogadores') return 'border-b-blue-400';
    if (i.disposicao === 'aliado') return 'border-b-emerald-400';
    return 'border-b-rose-500';
}
</script>

<template>
    <div
        v-if="combate.ativo"
        class="pointer-events-auto absolute left-1/2 top-14 z-20 flex max-w-[85vw] -translate-x-1/2 items-center rounded-lg border border-[#5c5035]/80 bg-[#141312]/95 p-1.5 shadow-2xl shadow-black/80 backdrop-blur-md"
        role="status"
        aria-label="Ordem dos turnos de combate"
    >
        <!-- Contador de Rodadas estilo Foundry -->
        <div class="flex shrink-0 items-center gap-1.5 border-r border-[#3d382d] pl-1 pr-2.5">
            <div class="flex min-w-[54px] flex-col items-center justify-center rounded border border-[#4a4231] bg-[#1f1d19] px-2 py-0.5 shadow-inner">
                <span class="text-[9px] font-bold uppercase leading-none tracking-widest text-ouro-400/90">
                    {{ combate.fase === 'iniciativa' ? 'Fase' : 'Rodada' }}
                </span>
                <span class="font-serif text-sm font-extrabold leading-tight text-[#f4ebd0]">
                    {{ combate.fase === 'iniciativa' ? 'ROLAGEM' : combate.rodada }}
                </span>
            </div>

            <!-- Tag Seu Turno -->
            <span
                v-if="seuTurno"
                class="rounded border border-emerald-500/50 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.35)]"
            >
                Seu turno
            </span>
        </div>

        <!-- Botão Turno Anterior (Mestre) -->
        <Button
            v-if="mestre && combate.fase === 'em_curso'"
            size="icon"
            variant="ghost"
            class="size-8 shrink-0 rounded text-preto-400 hover:bg-[#26231e] hover:text-ouro-200"
            aria-label="Turno anterior"
            title="Turno anterior"
            @click="$emit('anterior')"
        >
            <ChevronLeft class="size-4" />
        </Button>

        <!-- Carrossel de Combatentes / Combat Cards -->
        <ol class="scrollbar-thin flex min-w-0 items-center gap-1.5 overflow-x-auto px-1.5 py-0.5">
            <li
                v-for="i in combate.itens"
                :key="i.id"
                class="group relative flex shrink-0 select-none flex-col items-center rounded-md border p-1 transition-all duration-150"
                :class="[
                    combate.atual === i.id
                        ? 'z-10 scale-105 border-ouro-400 bg-ouro-500/20 shadow-[0_0_14px_rgba(236,201,108,0.45)] ring-2 ring-ouro-400/60'
                        : 'border-[#2d2922] bg-[#1a1815]/90 opacity-70 hover:border-[#4d4536] hover:opacity-100',
                    corDisposicao(i),
                    'border-b-2',
                ]"
                :aria-current="combate.atual === i.id ? 'step' : undefined"
                :title="`${i.nome} (Iniciativa: ${i.iniciativa ?? '—'})`"
            >
                <!-- Indicador de Turno Ativo no topo -->
                <span
                    v-if="combate.atual === i.id"
                    class="absolute -top-1.5 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-ouro-400 shadow-sm"
                    aria-hidden="true"
                />

                <!-- Retrato / Avatar do Combatente -->
                <div class="relative flex size-9 items-center justify-center overflow-hidden rounded-full border border-ouro-500/20 bg-preto-950">
                    <img v-if="imagemDoCombatente(i)" :src="imagemDoCombatente(i)!" :alt="i.nome" class="size-full object-cover" loading="lazy" />
                    <span
                        v-else
                        class="flex size-full items-center justify-center font-serif text-sm font-bold text-preto-950"
                        :style="{ backgroundColor: i.cor ?? '#ecc96c' }"
                    >
                        {{ (i.nome || '?').slice(0, 1).toUpperCase() }}
                    </span>

                    <!-- Badge de Iniciativa -->
                    <span
                        class="py-0.2 absolute -bottom-0.5 -right-0.5 flex min-w-[18px] items-center justify-center rounded border border-ouro-500/40 bg-preto-950/95 px-1 font-mono text-[9px] font-bold text-ouro-300 shadow"
                    >
                        {{ i.iniciativa ?? '…' }}
                    </span>
                </div>

                <!-- Nome do Combatente -->
                <span
                    class="mt-1 max-w-[62px] truncate text-center text-[10px] font-medium leading-none"
                    :class="combate.atual === i.id ? 'font-bold text-ouro-200' : 'text-preto-300'"
                >
                    {{ i.nome }}
                </span>
            </li>
        </ol>

        <!-- Botão Próximo Turno (Mestre ou Jogador no seu turno) -->
        <Button
            v-if="(mestre || seuTurno) && combate.fase === 'em_curso'"
            size="icon"
            variant="ghost"
            class="size-8 shrink-0 rounded text-preto-400 hover:bg-[#26231e] hover:text-ouro-200"
            :aria-label="seuTurno && !mestre ? 'Finalizar meu turno' : 'Próximo turno'"
            :title="seuTurno && !mestre ? 'Finalizar meu turno' : 'Próximo turno'"
            @click="$emit('proximo')"
        >
            <ChevronRight class="size-4" />
        </Button>

        <!-- Botão Abrir Painel de Combate -->
        <Button
            v-if="mestre"
            size="icon"
            variant="ghost"
            class="ml-0.5 size-8 shrink-0 rounded text-preto-400 hover:bg-[#26231e] hover:text-ouro-200"
            aria-label="Abrir o painel do combate"
            title="Abrir o painel de combate"
            @click="$emit('abrir')"
        >
            <ListOrdered class="size-4" />
        </Button>
    </div>
</template>

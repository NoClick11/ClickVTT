<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-vue-next';
import { computed } from 'vue';
import { itemAtual, type Combate } from '../nucleo/combate/estado';

/** Ordem dos turnos para todos: quem está agindo em destaque; o mestre passa a vez e abre o painel do combate. */
const props = defineProps<{ combate: Combate; mestre: boolean; meusPersonagens: number[] }>();
defineEmits<{ anterior: []; proximo: []; abrir: [] }>();

const seuTurno = computed(() => {
    const atual = itemAtual(props.combate);

    return props.combate.fase === 'em_curso' && atual?.personagem_id != null && props.meusPersonagens.includes(atual.personagem_id);
});
</script>

<template>
    <div
        v-if="combate.ativo"
        class="bg-preto-950/92 pointer-events-auto absolute left-1/2 top-14 z-20 flex max-w-[70vw] -translate-x-1/2 items-center gap-2 rounded-full border px-2 py-1.5 shadow-lg backdrop-blur"
        :class="seuTurno ? 'border-green-400/70' : 'border-ouro-500/30'"
        role="status"
        aria-label="Ordem dos turnos"
    >
        <Button
            v-if="mestre && combate.fase === 'em_curso'"
            size="icon"
            variant="ghost"
            class="size-7 shrink-0"
            aria-label="Turno anterior"
            @click="$emit('anterior')"
            ><ChevronLeft class="size-4"
        /></Button>
        <span class="shrink-0 px-1 text-[11px] font-semibold uppercase tracking-wider" :class="seuTurno ? 'text-green-300' : 'text-ouro-400'">
            {{ combate.fase === 'iniciativa' ? 'Iniciativa' : seuTurno ? 'Seu turno' : `Rodada ${combate.rodada}` }}
        </span>
        <ol class="flex min-w-0 items-center gap-1.5 overflow-x-auto">
            <li
                v-for="i in combate.itens"
                :key="i.id"
                class="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition"
                :class="
                    combate.atual === i.id
                        ? 'scale-105 border-ouro-300 bg-ouro-500 font-semibold text-preto-950'
                        : 'border-preto-700 bg-preto-900 text-preto-100'
                "
                :aria-current="combate.atual === i.id ? 'step' : undefined"
            >
                <span class="size-2.5 rounded-full" :style="{ backgroundColor: i.cor ?? '#ecc96c' }" />
                {{ i.nome }}
                <span v-if="i.iniciativa !== null" class="tabular-nums opacity-70">{{ i.iniciativa }}</span>
                <span v-else-if="combate.fase === 'iniciativa'" class="opacity-50">…</span>
            </li>
        </ol>
        <Button
            v-if="mestre && combate.fase === 'em_curso'"
            size="icon"
            variant="ghost"
            class="size-7 shrink-0"
            aria-label="Próximo turno"
            @click="$emit('proximo')"
            ><ChevronRight class="size-4"
        /></Button>
        <Button v-if="mestre" size="icon" variant="ghost" class="size-7 shrink-0" aria-label="Abrir o painel do combate" @click="$emit('abrir')"
            ><ListOrdered class="size-4"
        /></Button>
    </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-vue-next';
import { computed } from 'vue';
import type { Combate } from '../tipos-mesa';

const props = defineProps<{ combate: Combate; mestre: boolean }>();
defineEmits<{ anterior: []; proximo: []; abrir: [] }>();

/** Ordem: maior iniciativa primeiro; sem iniciativa ao final (ordem de entrada). */
const ordenados = computed(() => [...props.combate.itens].sort((a, b) => (b.iniciativa ?? -Infinity) - (a.iniciativa ?? -Infinity)));
</script>

<template>
    <div v-if="combate.ativo" class="pointer-events-auto absolute left-1/2 top-14 z-20 flex max-w-[70vw] -translate-x-1/2 items-center gap-2 rounded-full border border-ouro-500/30 bg-preto-950/92 px-2 py-1.5 shadow-lg backdrop-blur" role="status" aria-label="Ordem dos turnos">
        <Button v-if="mestre" size="icon" variant="ghost" class="size-7 shrink-0" aria-label="Turno anterior" @click="$emit('anterior')"><ChevronLeft class="size-4" /></Button>
        <span class="shrink-0 px-1 text-[11px] font-semibold uppercase tracking-wider text-ouro-400">Rodada {{ combate.rodada }}</span>
        <ol class="flex min-w-0 items-center gap-1.5 overflow-x-auto">
            <li
                v-for="i in ordenados"
                :key="i.id"
                class="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition"
                :class="combate.atual === i.id ? 'scale-105 border-ouro-300 bg-ouro-500 font-semibold text-preto-950' : 'border-preto-700 bg-preto-900 text-preto-100'"
                :aria-current="combate.atual === i.id ? 'step' : undefined"
            >
                <span class="size-2.5 rounded-full" :style="{ backgroundColor: i.cor ?? '#ecc96c' }" />
                {{ i.nome }}
                <span v-if="i.iniciativa !== null" class="tabular-nums opacity-70">{{ i.iniciativa }}</span>
            </li>
        </ol>
        <Button v-if="mestre" size="icon" variant="ghost" class="size-7 shrink-0" aria-label="Próximo turno" @click="$emit('proximo')"><ChevronRight class="size-4" /></Button>
        <Button v-if="mestre" size="icon" variant="ghost" class="size-7 shrink-0" aria-label="Editar turnos" @click="$emit('abrir')"><ListOrdered class="size-4" /></Button>
    </div>
</template>

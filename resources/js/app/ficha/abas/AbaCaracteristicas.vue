<script setup lang="ts">
import { computed } from 'vue';
import type { FichaDnd5e } from '../dnd5e';

const props = defineProps<{ ficha: FichaDnd5e }>();
const grupos = computed(() => [
    { titulo: 'Ativas', itens: props.ficha.caracteristicas.filter((c) => c.tipo === 'ativa') },
    { titulo: 'Passivas', itens: props.ficha.caracteristicas.filter((c) => c.tipo === 'passiva') },
]);
</script>

<template>
    <div class="grid gap-3 p-3">
        <section class="flex items-center gap-3 rounded-lg border border-ouro-500/30 bg-preto-900/60 p-3" aria-label="Classe">
            <span class="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-ouro-500/50 bg-preto-950 font-serif text-xl font-semibold text-ouro-200">{{ ficha.nivel }}</span>
            <div class="min-w-0">
                <p class="font-serif text-lg font-semibold text-ouro-50">{{ ficha.classe }}</p>
                <p class="text-xs text-preto-400">{{ ficha.subclasse }} · dado de vida {{ ficha.dadosVida.tipo }}</p>
            </div>
        </section>

        <section v-for="g in grupos" :key="g.titulo" class="rounded-lg border border-preto-800 bg-preto-900/60" :aria-label="g.titulo">
            <h3 class="border-b border-preto-800 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400">{{ g.titulo }}</h3>
            <ul class="divide-y divide-preto-800/70 text-sm">
                <li v-for="c in g.itens" :key="c.nome" class="flex items-center gap-3 px-3 py-2">
                    <span class="min-w-0 flex-1"><span class="block truncate">{{ c.nome }}</span><span class="block truncate text-xs text-preto-400">{{ c.origem }}</span></span>
                    <span v-if="c.usos" class="flex shrink-0 gap-1" :title="`${c.usos.atual}/${c.usos.max} usos`" role="img" :aria-label="`${c.usos.atual} de ${c.usos.max} usos`"><span v-for="i in c.usos.max" :key="i" class="size-3 rounded-full border" :class="i <= c.usos.atual ? 'border-ouro-400 bg-ouro-500' : 'border-preto-600'" /></span>
                </li>
                <li v-if="!g.itens.length" class="px-3 py-2 text-xs text-preto-500">Nenhuma característica.</li>
            </ul>
        </section>
    </div>
</template>

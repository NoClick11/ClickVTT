<script setup lang="ts">
import { ref } from 'vue';

/** Condições do D&D 5e como interruptores (visual). */
const condicoes = ['Agarrado', 'Amedrontado', 'Atordoado', 'Caído', 'Cego', 'Contido', 'Enfeitiçado', 'Envenenado', 'Incapacitado', 'Inconsciente', 'Invisível', 'Paralisado', 'Petrificado', 'Surdo'];
const ativas = ref<string[]>(['Envenenado']);
const alternar = (c: string) => (ativas.value = ativas.value.includes(c) ? ativas.value.filter((x) => x !== c) : [...ativas.value, c]);
</script>

<template>
    <div class="grid gap-3 p-3">
        <section class="rounded-lg border border-preto-800 bg-preto-900/60" aria-label="Condições">
            <h3 class="border-b border-preto-800 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400">Condições</h3>
            <div class="flex flex-wrap gap-1.5 p-3">
                <button v-for="c in condicoes" :key="c" type="button" class="rounded-full border px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400" :class="ativas.includes(c) ? 'border-red-400 bg-red-500/20 text-red-200' : 'border-preto-700 text-preto-300 hover:border-ouro-500/50'" :aria-pressed="ativas.includes(c)" @click="alternar(c)">{{ c }}</button>
            </div>
        </section>
        <section class="rounded-lg border border-preto-800 bg-preto-900/60" aria-label="Efeitos ativos">
            <h3 class="border-b border-preto-800 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400">Efeitos Ativos</h3>
            <p class="px-3 py-6 text-center text-xs text-preto-500">Nenhum efeito ativo. (Os efeitos de magias e itens aparecerão aqui.)</p>
        </section>
    </div>
</template>

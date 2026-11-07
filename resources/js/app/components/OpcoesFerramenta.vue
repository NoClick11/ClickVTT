<script setup lang="ts">
import type { EstiloPintura, Ferramenta } from '../engine/tipos';

defineProps<{ ferramenta: Ferramenta; estilo: EstiloPintura }>();
const emit = defineEmits<{ 'update:estilo': [EstiloPintura] }>();

const cores = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ffffff', '#0d0a12'];
const espessuras = [2, 4, 8, 14];
const tamanhos = [18, 28, 44, 72];
</script>

<template>
    <div
        class="bg-preto-950/92 pointer-events-auto absolute left-16 top-16 z-10 rounded-lg border border-ouro-500/20 p-2 backdrop-blur"
        role="group"
        :aria-label="ferramenta === 'pintar' ? 'Opções do pincel' : 'Opções do texto'"
    >
        <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cor">
            <button
                v-for="c in cores"
                :key="c"
                type="button"
                role="radio"
                :aria-checked="estilo.cor === c"
                :aria-label="`Cor ${c}`"
                class="size-6 rounded-full border-2 transition"
                :class="estilo.cor === c ? 'scale-110 border-ouro-300' : 'border-preto-700 hover:border-preto-300'"
                :style="{ backgroundColor: c }"
                @click="emit('update:estilo', { ...estilo, cor: c })"
            />
        </div>
        <div class="mt-2 flex gap-1.5" role="radiogroup" :aria-label="ferramenta === 'pintar' ? 'Espessura' : 'Tamanho'">
            <template v-if="ferramenta === 'pintar'">
                <button
                    v-for="e in espessuras"
                    :key="e"
                    type="button"
                    role="radio"
                    :aria-checked="estilo.espessura === e"
                    :aria-label="`Espessura ${e}`"
                    class="flex size-8 items-center justify-center rounded-md border"
                    :class="estilo.espessura === e ? 'border-ouro-400 bg-ouro-500/15' : 'border-preto-700'"
                    @click="emit('update:estilo', { ...estilo, espessura: e })"
                >
                    <span class="rounded-full bg-preto-100" :style="{ width: Math.min(e, 18) + 'px', height: Math.min(e, 18) + 'px' }" />
                </button>
            </template>
            <template v-else>
                <button
                    v-for="t in tamanhos"
                    :key="t"
                    type="button"
                    role="radio"
                    :aria-checked="estilo.tamanho === t"
                    :aria-label="`Tamanho ${t}`"
                    class="h-8 min-w-9 rounded-md border px-1.5 font-serif"
                    :class="estilo.tamanho === t ? 'border-ouro-400 bg-ouro-500/15 text-ouro-200' : 'border-preto-700 text-preto-200'"
                    @click="emit('update:estilo', { ...estilo, tamanho: t })"
                >
                    A<span class="text-[10px] opacity-60">{{ t }}</span>
                </button>
            </template>
        </div>
    </div>
</template>

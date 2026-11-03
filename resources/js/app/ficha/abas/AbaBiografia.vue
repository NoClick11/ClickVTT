<script setup lang="ts">
import { inject, ref } from 'vue';
import { CHAVE_EDITAR, type FichaDnd5e } from '../dnd5e';

defineProps<{ ficha: FichaDnd5e }>();
const editar = inject(CHAVE_EDITAR, ref(false));
const caixa = 'min-h-20 w-full resize-none rounded-md border border-preto-700 bg-preto-950 px-2.5 py-2 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none read-only:cursor-default';
const rotulo = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ouro-400';
</script>

<template>
    <div class="grid gap-3 p-3">
        <div class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))]">
            <label><span :class="rotulo">Traços de Personalidade</span><textarea :value="ficha.biografia.personalidade" :readonly="!editar" :class="caixa" /></label>
            <label><span :class="rotulo">Ideais</span><textarea :value="ficha.biografia.ideais" :readonly="!editar" :class="caixa" /></label>
            <label><span :class="rotulo">Vínculos</span><textarea :value="ficha.biografia.vinculos" :readonly="!editar" :class="caixa" /></label>
            <label><span :class="rotulo">Defeitos</span><textarea :value="ficha.biografia.defeitos" :readonly="!editar" :class="caixa" /></label>
            <label><span :class="rotulo">Aparência</span><textarea :value="ficha.biografia.aparencia" :readonly="!editar" :class="caixa" /></label>
        </div>
        <label><span :class="rotulo">Biografia</span><textarea :value="ficha.biografia.texto" :readonly="!editar" :class="caixa" class="min-h-40" /></label>
    </div>
</template>

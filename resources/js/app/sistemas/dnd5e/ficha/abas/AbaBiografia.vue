<script setup lang="ts">
import CampoTexto from '../../../../nucleo/ui/CampoTexto.vue';
import { useFicha } from '../../contexto';
import type { FichaDnd5e } from '../../regras';

defineProps<{ ficha: FichaDnd5e }>();
const { editar, salvar } = useFicha();

const caixa =
    'min-h-20 w-full resize-none rounded-md border border-preto-700 bg-preto-950 px-2.5 py-2 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none read-only:cursor-default';
const rotulo = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ouro-400';
const campos = [
    { id: 'personalidade', rotulo: 'Traços de Personalidade' },
    { id: 'ideais', rotulo: 'Ideais' },
    { id: 'vinculos', rotulo: 'Vínculos' },
    { id: 'defeitos', rotulo: 'Defeitos' },
    { id: 'aparencia', rotulo: 'Aparência' },
] as const;
</script>

<template>
    <div class="grid gap-3 p-3">
        <div class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(14rem,1fr))]">
            <label v-for="c in campos" :key="c.id"
                ><span :class="rotulo">{{ c.rotulo }}</span
                ><CampoTexto
                    multilinha
                    :model-value="ficha.biografia[c.id]"
                    :maximo="5000"
                    :somente-leitura="!editar"
                    :class="caixa"
                    @salvar="salvar({ [`biografia.${c.id}`]: $event })"
            /></label>
        </div>
        <label
            ><span :class="rotulo">Biografia</span
            ><CampoTexto
                multilinha
                :model-value="ficha.biografia.texto"
                :maximo="20000"
                :somente-leitura="!editar"
                :class="caixa"
                class="min-h-40"
                @salvar="salvar({ 'biografia.texto': $event })"
        /></label>
    </div>
</template>

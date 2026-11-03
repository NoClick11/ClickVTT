<script setup lang="ts">
import { inject, ref } from 'vue';
import BotaoD20 from './BotaoD20.vue';
import { ATRIBUTOS, CHAVE_EDITAR, comSinal, modificador, type FichaDnd5e } from './dnd5e';

defineProps<{ ficha: FichaDnd5e }>();
const editar = inject(CHAVE_EDITAR, ref(false));
</script>

<template>
    <section class="grid shrink-0 grid-cols-3 gap-2 border-b border-ouro-500/20 p-3 sm:grid-cols-6" aria-label="Atributos">
        <div v-for="a in ATRIBUTOS" :key="a.id" class="relative flex flex-col items-center rounded-lg border border-preto-700 bg-preto-950 px-1 pb-4 pt-2" :title="a.nome">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-ouro-400">{{ a.sigla }}</span>
            <span class="font-serif text-2xl font-bold leading-none text-ouro-50">{{ comSinal(modificador(ficha.atributos[a.id])) }}</span>
            <BotaoD20 :rotulo="`teste de ${a.nome}`" class="absolute right-0.5 top-0.5" />
            <!-- valor do atributo, em "pílula" na base do cartão -->
            <input :value="ficha.atributos[a.id]" :readonly="!editar" type="text" inputmode="numeric" :aria-label="`Valor de ${a.nome}`" class="absolute -bottom-2.5 w-10 rounded-full border border-ouro-500/50 bg-preto-900 text-center text-xs font-semibold tabular-nums text-ouro-100 focus-visible:border-ouro-300 focus-visible:outline-none read-only:cursor-default" />
        </div>
    </section>
</template>

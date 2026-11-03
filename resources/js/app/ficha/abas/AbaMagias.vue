<script setup lang="ts">
import { ATRIBUTOS, comSinal, type FichaDnd5e } from '../dnd5e';
import BotaoD20 from '../BotaoD20.vue';

const props = defineProps<{ ficha: FichaDnd5e }>();
const atributo = ATRIBUTOS.find((a) => a.id === props.ficha.magias.atributo)!;
const rotuloNivel = (n: number) => (n === 0 ? 'Truques' : `${n}º nível`);
const espaco = (n: number) => props.ficha.magias.espacos.find((e) => e.nivel === n);
const caixa = 'rounded-lg border border-preto-700 bg-preto-950 px-2 py-1.5 text-center';
const titulo = 'text-[10px] font-semibold uppercase tracking-wider text-preto-500';
</script>

<template>
    <div class="grid gap-3 p-3">
        <section class="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Conjuração">
            <div :class="caixa"><p :class="titulo">Atributo</p><p class="font-serif text-lg font-semibold text-ouro-100">{{ atributo.sigla }}</p></div>
            <div :class="caixa"><p :class="titulo">CD</p><p class="font-serif text-lg font-semibold text-ouro-100">{{ ficha.magias.cd }}</p></div>
            <div :class="caixa"><p :class="titulo">Ataque</p><p class="flex items-center justify-center gap-1 font-serif text-lg font-semibold text-ouro-100">{{ comSinal(ficha.magias.ataque) }} <BotaoD20 rotulo="ataque de magia" /></p></div>
            <div :class="caixa"><p :class="titulo">Preparadas</p><p class="font-serif text-lg font-semibold tabular-nums text-ouro-100">{{ ficha.magias.preparadas.atual }} / {{ ficha.magias.preparadas.max }}</p></div>
        </section>

        <section v-for="n in ficha.magias.lista" :key="n.nivel" class="rounded-lg border border-preto-800 bg-preto-900/60" :aria-label="rotuloNivel(n.nivel)">
            <h3 class="flex items-center justify-between border-b border-preto-800 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400">
                <span>{{ rotuloNivel(n.nivel) }}</span>
                <span v-if="espaco(n.nivel)" class="flex items-center gap-1.5 normal-case tracking-normal text-preto-300" :title="`Espaços: ${espaco(n.nivel)!.total - espaco(n.nivel)!.usados} de ${espaco(n.nivel)!.total} disponíveis`">
                    Espaços
                    <span class="flex gap-1"><span v-for="i in espaco(n.nivel)!.total" :key="i" class="size-3 rounded-full border" :class="i <= espaco(n.nivel)!.total - espaco(n.nivel)!.usados ? 'border-ouro-400 bg-ouro-500' : 'border-preto-600'" /></span>
                </span>
            </h3>
            <ul class="divide-y divide-preto-800/70 text-sm">
                <li v-for="m in n.magias" :key="m.nome" class="flex items-center gap-3 px-3 py-1.5">
                    <span class="size-3 shrink-0 rounded-full border" :class="m.preparada ? 'border-ouro-400 bg-ouro-500/70' : 'border-preto-600'" role="img" :aria-label="m.preparada ? 'Preparada' : 'Não preparada'" />
                    <span class="min-w-0 flex-1 truncate" :class="m.preparada ? '' : 'text-preto-400'">{{ m.nome }}</span>
                    <span class="shrink-0 rounded bg-preto-800 px-1.5 text-[10px] uppercase text-preto-300">{{ m.escola }}</span>
                    <BotaoD20 :rotulo="m.nome" />
                </li>
            </ul>
        </section>
    </div>
</template>

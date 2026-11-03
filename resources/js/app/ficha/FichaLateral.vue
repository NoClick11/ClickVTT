<script setup lang="ts">
import { Bookmark, Heart, Shield, Skull } from 'lucide-vue-next';
import { computed, inject, ref } from 'vue';
import BotaoD20 from './BotaoD20.vue';
import { CHAVE_EDITAR, comSinal, type FichaDnd5e } from './dnd5e';

const props = defineProps<{ ficha: FichaDnd5e; cor: string }>();
const editar = inject(CHAVE_EDITAR, ref(false));

const pvPct = computed(() => Math.max(0, Math.min(100, (props.ficha.pv.atual / props.ficha.pv.max) * 100)));
const pvCor = computed(() => (pvPct.value > 50 ? '#22c55e' : pvPct.value > 25 ? '#eab308' : '#ef4444'));
const dvPct = computed(() => (props.ficha.dadosVida.restantes / props.ficha.dadosVida.max) * 100);
const campoNum = 'w-10 rounded border border-transparent bg-transparent text-center tabular-nums focus-visible:border-ouro-400 focus-visible:outline-none read-only:cursor-default';
const titulo = 'text-[10px] font-semibold uppercase tracking-wider text-preto-500';

const favoritos = [
    { nome: 'Maça', info: '+4 · 1d6+1' },
    { nome: 'Curar Ferimentos', info: 'Nv 1 · 2/4' },
    { nome: 'Percepção', info: '+6' },
];
</script>

<template>
    <aside class="flex w-52 shrink-0 flex-col gap-3 overflow-y-auto border-r border-ouro-500/20 bg-preto-900/40 p-3 [&>*]:shrink-0" aria-label="Resumo do personagem">
        <!-- retrato (por enquanto a inicial na cor do personagem) -->
        <div class="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-ouro-500/30" :style="{ background: `radial-gradient(circle at 30% 25%, ${cor}, #0d0a12 85%)` }" role="img" :aria-label="`Retrato de ${ficha.nome}`">
            <span class="font-serif text-7xl font-semibold text-preto-950/80 mix-blend-overlay">{{ ficha.nome.slice(0, 1).toUpperCase() }}</span>
            <!-- CA -->
            <div class="absolute -bottom-px left-1/2 flex -translate-x-1/2 translate-y-1/3 items-center justify-center" title="Classe de Armadura" aria-label="Classe de Armadura">
                <Shield class="size-16 fill-preto-950 stroke-ouro-400" stroke-width="1.5" />
                <span class="absolute flex flex-col items-center leading-none"><span class="font-serif text-2xl font-bold text-ouro-100">{{ ficha.ca }}</span><span class="text-[8px] font-semibold uppercase tracking-wider text-preto-400">CA</span></span>
            </div>
        </div>

        <!-- exaustão -->
        <div class="mt-4 flex items-center justify-between" role="group" aria-label="Exaustão">
            <span :class="titulo">Exaustão</span>
            <span class="flex gap-1"><span v-for="i in 6" :key="i" class="size-2.5 rounded-full border" :class="i <= ficha.exaustao ? 'border-red-400 bg-red-500' : 'border-preto-600'" /></span>
        </div>

        <!-- iniciativa, deslocamento, proficiência -->
        <div class="grid grid-cols-3 gap-1.5 text-center">
            <div class="rounded-md border border-preto-700 bg-preto-950 p-1.5">
                <p :class="titulo">Inic.</p>
                <p class="flex items-center justify-center gap-0.5 font-serif text-lg font-semibold text-ouro-100">{{ comSinal(ficha.iniciativa) }}</p>
                <BotaoD20 rotulo="iniciativa" class="mx-auto" />
            </div>
            <div class="rounded-md border border-preto-700 bg-preto-950 p-1.5">
                <p :class="titulo">Desl.</p>
                <p class="font-serif text-lg font-semibold text-ouro-100">{{ ficha.deslocamento }}</p>
            </div>
            <div class="rounded-md border border-preto-700 bg-preto-950 p-1.5">
                <p :class="titulo">Prof.</p>
                <p class="font-serif text-lg font-semibold text-ouro-100">{{ comSinal(ficha.bonusProficiencia) }}</p>
            </div>
        </div>

        <!-- pontos de vida -->
        <section aria-label="Pontos de vida">
            <p :class="titulo" class="mb-1 flex items-center gap-1"><Heart class="size-3 text-red-400" /> Pontos de Vida</p>
            <div class="relative h-7 overflow-hidden rounded-md border border-preto-700 bg-preto-950" role="progressbar" :aria-valuenow="ficha.pv.atual" aria-valuemin="0" :aria-valuemax="ficha.pv.max" aria-label="Pontos de vida">
                <div class="absolute inset-y-0 left-0 transition-all" :style="{ width: pvPct + '%', backgroundColor: pvCor, opacity: 0.55 }" />
                <div class="absolute inset-0 flex items-center justify-center gap-1 text-sm font-semibold tabular-nums">
                    <input :value="ficha.pv.atual" :readonly="!editar" :class="campoNum" aria-label="PV atuais" /> <span class="text-preto-400">/</span> <input :value="ficha.pv.max" :readonly="!editar" :class="campoNum" aria-label="PV máximos" />
                </div>
            </div>
            <label class="mt-1 flex items-center justify-between text-xs text-preto-400">PV temporários <input :value="ficha.pv.temp" :readonly="!editar" :class="campoNum" aria-label="PV temporários" /></label>
        </section>

        <!-- dados de vida -->
        <section aria-label="Dados de vida">
            <p :class="titulo" class="mb-1">Dados de Vida</p>
            <div class="relative h-6 overflow-hidden rounded-md border border-preto-700 bg-preto-950">
                <div class="absolute inset-y-0 left-0 bg-ouro-500/40" :style="{ width: dvPct + '%' }" />
                <p class="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">{{ ficha.dadosVida.restantes }} / {{ ficha.dadosVida.max }} {{ ficha.dadosVida.tipo }}</p>
            </div>
        </section>

        <!-- testes contra a morte -->
        <section aria-label="Testes contra a morte">
            <p :class="titulo" class="mb-1 flex items-center gap-1"><Skull class="size-3" /> Testes contra a Morte</p>
            <div class="grid gap-1 text-xs">
                <div class="flex items-center justify-between"><span class="text-preto-400">Sucessos</span><span class="flex gap-1"><span v-for="i in 3" :key="i" class="size-3 rounded-full border" :class="i <= ficha.morte.sucessos ? 'border-green-400 bg-green-500' : 'border-preto-600'" /></span></div>
                <div class="flex items-center justify-between"><span class="text-preto-400">Falhas</span><span class="flex gap-1"><span v-for="i in 3" :key="i" class="size-3 rounded-full border" :class="i <= ficha.morte.falhas ? 'border-red-400 bg-red-500' : 'border-preto-600'" /></span></div>
            </div>
        </section>

        <!-- favoritos -->
        <section aria-label="Favoritos">
            <p :class="titulo" class="mb-1 flex items-center gap-1"><Bookmark class="size-3" /> Favoritos</p>
            <ul class="grid gap-1">
                <li v-for="f in favoritos" :key="f.nome" class="flex items-center justify-between rounded border border-preto-800 bg-preto-950 px-2 py-1 text-xs"><span class="truncate">{{ f.nome }}</span><span class="shrink-0 text-preto-400">{{ f.info }}</span></li>
            </ul>
            <p class="mt-1 text-[10px] text-preto-500">Arraste itens, magias e perícias para cá (em breve).</p>
        </section>
    </aside>
</template>

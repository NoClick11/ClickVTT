<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Coffee, Moon, Star } from 'lucide-vue-next';
import { computed, inject, ref } from 'vue';
import { CHAVE_EDITAR, type FichaDnd5e } from './dnd5e';

const props = defineProps<{ ficha: FichaDnd5e; cor: string }>();
const editar = inject(CHAVE_EDITAR, ref(false));
const emit = defineEmits<{ 'update:editar': [boolean] }>();

const xpPct = computed(() => Math.min(100, Math.round((props.ficha.xp.atual / props.ficha.xp.proximo) * 100)));
const campo = 'w-full border-b border-transparent bg-transparent px-0.5 text-sm text-preto-100 focus-visible:border-ouro-400 focus-visible:outline-none read-only:cursor-default';
const rotulo = 'mt-0.5 block text-[10px] font-semibold uppercase tracking-wider text-preto-500';
</script>

<template>
    <header class="shrink-0 border-b border-ouro-500/20 bg-preto-900/60 px-4 py-3">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <!-- alternador Jogar/Editar (canto esquerdo, como no Foundry) -->
            <div class="flex shrink-0 overflow-hidden rounded-md border border-preto-700 text-xs" role="group" aria-label="Modo da ficha">
                <button type="button" class="px-2.5 py-1 transition" :class="!editar ? 'bg-ouro-500 font-semibold text-preto-950' : 'text-preto-300 hover:bg-preto-800'" :aria-pressed="!editar" @click="emit('update:editar', false)">Jogar</button>
                <button type="button" class="px-2.5 py-1 transition" :class="editar ? 'bg-ouro-500 font-semibold text-preto-950' : 'text-preto-300 hover:bg-preto-800'" :aria-pressed="editar" @click="emit('update:editar', true)">Editar</button>
            </div>

            <div class="min-w-48 flex-1">
                <input :value="ficha.nome" :readonly="!editar" aria-label="Nome do personagem" class="w-full border-b border-transparent bg-transparent font-serif text-2xl font-semibold leading-tight text-ouro-50 focus-visible:border-ouro-400 focus-visible:outline-none read-only:cursor-default" :style="{ textShadow: `0 0 18px ${cor}55` }" />
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-ouro-400">{{ ficha.classe }} {{ ficha.nivel }} <span class="text-preto-400">· {{ ficha.subclasse }}</span></p>
            </div>

            <div class="flex shrink-0 items-center gap-1.5">
                <span class="flex size-9 items-center justify-center rounded-full border-2 border-ouro-500/60 bg-preto-950 font-serif text-lg font-semibold text-ouro-200" title="Nível" aria-label="Nível">{{ ficha.nivel }}</span>
                <button type="button" class="flex size-9 items-center justify-center rounded-full border transition" :class="ficha.inspiracao ? 'border-ouro-400 bg-ouro-500/20 text-ouro-300' : 'border-preto-700 text-preto-500 hover:text-ouro-300'" :aria-pressed="ficha.inspiracao" title="Inspiração" aria-label="Inspiração"><Star class="size-4" :class="ficha.inspiracao ? 'fill-current' : ''" /></button>
                <Button size="icon" variant="outline" class="size-9 border-preto-700 text-preto-300 hover:text-ouro-200" title="Descanso curto" aria-label="Descanso curto"><Coffee class="size-4" /></Button>
                <Button size="icon" variant="outline" class="size-9 border-preto-700 text-preto-300 hover:text-ouro-200" title="Descanso longo" aria-label="Descanso longo"><Moon class="size-4" /></Button>
            </div>
        </div>

        <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <label><input :value="ficha.especie" :readonly="!editar" :class="campo" /><span :class="rotulo">Espécie</span></label>
            <label><input :value="ficha.antecedente" :readonly="!editar" :class="campo" /><span :class="rotulo">Antecedente</span></label>
            <label><input :value="ficha.alinhamento" :readonly="!editar" :class="campo" /><span :class="rotulo">Alinhamento</span></label>
            <div>
                <div class="h-1.5 overflow-hidden rounded-full bg-preto-800" role="progressbar" :aria-valuenow="xpPct" aria-valuemin="0" aria-valuemax="100" aria-label="Experiência"><div class="h-full rounded-full bg-ouro-500" :style="{ width: xpPct + '%' }" /></div>
                <span :class="rotulo" class="tabular-nums">XP {{ ficha.xp.atual.toLocaleString('pt-BR') }} / {{ ficha.xp.proximo.toLocaleString('pt-BR') }}</span>
            </div>
        </div>
    </header>
</template>

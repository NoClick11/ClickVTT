<script setup lang="ts">
import { computed } from 'vue';
import { MOEDAS, type FichaDnd5e } from '../dnd5e';

const props = defineProps<{ ficha: FichaDnd5e }>();
const pct = computed(() => Math.min(100, (props.ficha.carga.atual / props.ficha.carga.max) * 100));
const peso = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
</script>

<template>
    <div class="grid gap-3 p-3">
        <div class="grid gap-3 sm:grid-cols-2">
            <section class="rounded-lg border border-preto-800 bg-preto-900/60 p-3" aria-label="Carga">
                <p class="mb-1.5 flex justify-between text-[11px] font-semibold uppercase tracking-wider text-ouro-400"><span>Carga</span><span class="tabular-nums text-preto-300">{{ peso(ficha.carga.atual) }} / {{ ficha.carga.max }} kg</span></p>
                <div class="h-2 overflow-hidden rounded-full bg-preto-800" role="progressbar" :aria-valuenow="ficha.carga.atual" aria-valuemin="0" :aria-valuemax="ficha.carga.max" aria-label="Carga"><div class="h-full rounded-full bg-ouro-500" :style="{ width: pct + '%' }" /></div>
            </section>
            <section class="rounded-lg border border-preto-800 bg-preto-900/60 p-3" aria-label="Moedas">
                <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400">Moedas</p>
                <div class="flex justify-between gap-1">
                    <label v-for="m in MOEDAS" :key="m.id" class="flex flex-col items-center gap-0.5 text-center">
                        <span class="text-[10px] font-semibold" :style="{ color: m.cor }" :title="m.nome">{{ m.sigla }}</span>
                        <input :value="ficha.moedas[m.id]" readonly :aria-label="m.nome" class="w-11 rounded border border-preto-700 bg-preto-950 py-0.5 text-center text-sm tabular-nums" />
                    </label>
                </div>
            </section>
        </div>

        <section v-for="s in ficha.inventario" :key="s.secao" class="rounded-lg border border-preto-800 bg-preto-900/60" :aria-label="s.secao">
            <h3 class="flex items-center justify-between border-b border-preto-800 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400"><span>{{ s.secao }}</span><span class="text-preto-500">Qtd · Peso</span></h3>
            <ul class="divide-y divide-preto-800/70 text-sm">
                <li v-for="i in s.itens" :key="i.nome" class="flex items-center gap-3 px-3 py-1.5">
                    <span class="flex size-4 shrink-0 items-center justify-center rounded border" :class="i.equipado ? 'border-ouro-400 bg-ouro-500/70 text-preto-950' : 'border-preto-600'" :title="i.equipado ? 'Equipado' : 'Não equipado'" role="img" :aria-label="i.equipado ? 'Equipado' : 'Não equipado'"><span v-if="i.equipado" class="text-[10px] font-bold leading-none">✓</span></span>
                    <span class="min-w-0 flex-1"><span class="block truncate">{{ i.nome }}</span><span v-if="i.detalhe" class="block truncate text-xs text-preto-400">{{ i.detalhe }}</span></span>
                    <span class="w-8 shrink-0 text-right tabular-nums text-preto-300">{{ i.qtd }}</span>
                    <span class="w-12 shrink-0 text-right tabular-nums text-preto-400">{{ peso(i.peso * i.qtd) }}</span>
                </li>
            </ul>
        </section>
    </div>
</template>

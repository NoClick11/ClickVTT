<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { computed } from 'vue';
import { resumoEfeito } from '../../nucleo/efeitos/resumo';
import { iconeDoStatus } from '../../nucleo/status';
import { formatoDeResumo } from './alvos';
import { CONDICOES } from './condicoes';
import { useFicha } from './contexto';
import type { FichaOnePiece } from './regras';

/**
 * Efeitos do personagem: escolhe quais estão ativos (condições como Envenenado, Caído...). Cada efeito ativo aparece como
 * um ícone no token do mapa, para a mesa toda. Os efeitos de itens e características também são listados, só para consulta.
 */
const props = defineProps<{ open: boolean; ficha: FichaOnePiece }>();
const emit = defineEmits<{ 'update:open': [boolean] }>();
const { efeitos, salvar } = useFicha();

const ativas = computed(() => props.ficha.condicoes ?? []);
const ligada = (id: string) => ativas.value.includes(id);
/** Liga/desliga um efeito (vale na hora, em jogo): salva a lista inteira, na ordem em que foram ligados. */
const alternar = (id: string) => salvar({ condicoes: ligada(id) ? ativas.value.filter((c) => c !== id) : [...ativas.value, id] });

/** Os efeitos que vêm de itens, características e ajustes, agrupados pela fonte (as condições já estão na lista acima). */
const porFonte = computed(() => {
    const nomes = new Set(CONDICOES.map((c) => c.nome));
    const grupos = new Map<string, string[]>();
    for (const e of efeitos.value) if (!nomes.has(e.fonte)) grupos.set(e.fonte, [...(grupos.get(e.fonte) ?? []), resumoEfeito(e, formatoDeResumo)]);

    return [...grupos].map(([fonte, resumos]) => ({ fonte, resumos }));
});
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">Efeitos</DialogTitle>
                <DialogDescription>Marque os efeitos ativos. Cada um aparece como um ícone no token do mapa, para todos verem.</DialogDescription>
            </DialogHeader>

            <ul class="grid gap-1.5 sm:grid-cols-2" aria-label="Efeitos disponíveis">
                <li v-for="c in CONDICOES" :key="c.id">
                    <button
                        type="button"
                        class="flex w-full items-start gap-2.5 rounded-lg border p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                        :class="ligada(c.id) ? 'border-red-400 bg-red-500/15' : 'border-preto-700 hover:border-ouro-500/50'"
                        :aria-pressed="ligada(c.id)"
                        @click="alternar(c.id)"
                    >
                        <span
                            class="flex size-9 shrink-0 items-center justify-center rounded-full border-2 bg-preto-950 text-lg"
                            :style="{ borderColor: iconeDoStatus(c.id).cor }"
                            aria-hidden="true"
                            >{{ iconeDoStatus(c.id).icone }}</span
                        >
                        <span class="min-w-0">
                            <span class="block text-sm font-semibold" :class="ligada(c.id) ? 'text-red-200' : 'text-preto-100'">{{ c.nome }}</span>
                            <span class="line-clamp-3 text-xs text-preto-400">{{ c.descricao }}</span>
                            <span
                                v-if="ligada(c.id)"
                                class="mt-0.5 block text-[11px]"
                                :class="c.efeitos.length ? 'text-green-300' : 'text-preto-500'"
                                >{{
                                    c.efeitos.length ? 'Ajusta sozinho as vantagens e desvantagens.' : 'Sem efeito automático: aplique à mão.'
                                }}</span
                            >
                        </span>
                    </button>
                </li>
            </ul>

            <section v-if="porFonte.length" class="rounded-lg border border-preto-800" aria-label="Efeitos de itens e características">
                <h3 class="border-b border-preto-800 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400">
                    Efeitos de itens e características
                </h3>
                <ul class="divide-y divide-preto-800/70 text-sm">
                    <li v-for="g in porFonte" :key="g.fonte" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                        <span class="min-w-28 font-semibold text-preto-100">{{ g.fonte }}</span>
                        <span class="flex flex-wrap gap-1"
                            ><span v-for="(r, i) in g.resumos" :key="i" class="rounded bg-preto-800 px-1.5 py-0.5 text-[11px] text-ouro-200">{{
                                r
                            }}</span></span
                        >
                    </li>
                </ul>
            </section>
        </DialogContent>
    </Dialog>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Crosshair, Crown, Users } from 'lucide-vue-next';
import { computed } from 'vue';
import type { PaginaDto } from '../engine/tipos';
import type { PersonagemElenco } from '../tipos-mesa';

const props = defineProps<{
    elenco: PersonagemElenco[];
    meuId: number;
    mestre: boolean;
    /** só mestre: página de cada personagem */
    paginaDe: Record<number, PaginaDto | undefined>;
    /** ids de personagens que têm token na página aberta */
    comToken: number[];
}>();
defineEmits<{ focar: [personagemId: number] }>();

const mestres = computed(() => props.elenco.filter((p) => p.papel === 'mestre'));
const jogadores = computed(() => props.elenco.filter((p) => p.papel !== 'mestre'));
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col text-sm text-preto-100">
        <header class="flex h-11 shrink-0 items-center border-b border-preto-800 px-3">
            <h2 class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400"><Users class="size-3.5" /> Personagens</h2>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            <template v-for="grupo in [{ titulo: 'Mestre', itens: mestres }, { titulo: 'Jogadores', itens: jogadores }]" :key="grupo.titulo">
                <section v-if="grupo.itens.length" class="mb-3">
                    <h3 class="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-preto-400">{{ grupo.titulo }}</h3>
                    <ul class="grid gap-1.5">
                        <li v-for="p in grupo.itens" :key="p.id" class="flex items-center gap-2.5 rounded-md bg-preto-900/70 px-2.5 py-2">
                            <span class="flex size-9 shrink-0 items-center justify-center rounded-full font-serif text-base font-semibold text-preto-950" :style="{ backgroundColor: p.cor }" aria-hidden="true">{{ p.nome.slice(0, 1).toUpperCase() }}</span>
                            <div class="min-w-0 flex-1">
                                <p class="flex items-center gap-1.5 truncate font-medium">
                                    <span class="truncate" :style="{ color: p.cor }">{{ p.nome }}</span>
                                    <Crown v-if="p.papel === 'mestre'" class="size-3 shrink-0 text-ouro-400" aria-label="Mestre" />
                                    <span v-if="p.id === meuId" class="shrink-0 text-xs font-normal text-preto-400">(você)</span>
                                </p>
                                <p v-if="mestre && paginaDe[p.id]" class="truncate text-xs text-preto-400">em {{ paginaDe[p.id]!.nome }}</p>
                            </div>
                            <Button v-if="comToken.includes(p.id)" size="icon" variant="ghost" class="size-8 shrink-0 text-preto-300 hover:text-ouro-200" :aria-label="`Ir ao token de ${p.nome}`" :title="`Ir ao token de ${p.nome}`" @click="$emit('focar', p.id)"><Crosshair class="size-4" /></Button>
                        </li>
                    </ul>
                </section>
            </template>
            <p v-if="!elenco.length" class="mt-6 text-center text-xs text-preto-400">Nenhum personagem nesta mesa.</p>
        </div>
    </div>
</template>

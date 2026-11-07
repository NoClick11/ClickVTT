<script setup lang="ts">
import { Button } from '@/components/ui/button';
import type { Jogador, Personagem } from '@/site/types';
import { Crosshair, Crown, Plus, Users } from 'lucide-vue-next';
import type { PaginaDto } from '../engine/tipos';
import { MIME_PERSONAGEM } from '../nucleo/itens/arrastar';

const arrastar = (e: DragEvent, id: number) => {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData(MIME_PERSONAGEM, String(id));
    e.dataTransfer.setData('text/plain', '');
    e.dataTransfer.effectAllowed = 'copy';
};

defineProps<{
    personagens: Personagem[];
    jogadores: Jogador[];
    meuId: number;
    mestre: boolean;
    /** personagem ativo (chat e dados saem como ele) */
    ativoId: number | null;
    /** personagens que este jogador controla */
    meusPersonagens: number[];
    /** só mestre: página de cada jogador */
    paginaDe: Record<number, PaginaDto | undefined>;
    /** ids de personagens que têm token na página aberta */
    comToken: number[];
}>();
defineEmits<{
    abrir: [personagemId: number];
    focar: [personagemId: number];
    atribuir: [personagemId: number];
    criar: [];
    /** Botão direito (só o mestre): o menu de opções do personagem. */
    menu: [personagemId: number, tela: { x: number; y: number }];
}>();
</script>

<template>
    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-sm text-preto-100">
        <section class="mb-4">
            <div class="mb-1.5 flex items-center justify-between gap-2 px-0.5">
                <h3 class="text-[11px] font-semibold uppercase tracking-wider text-preto-400">Personagens</h3>
                <button
                    v-if="mestre"
                    type="button"
                    class="flex items-center gap-1 rounded-md bg-ouro-500 px-2.5 py-1 text-xs font-semibold text-preto-950 hover:bg-ouro-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-300"
                    @click="$emit('criar')"
                >
                    <Plus class="size-3.5" /> Novo personagem
                </button>
            </div>
            <ul class="grid gap-1.5">
                <li
                    v-for="p in personagens"
                    :key="p.id"
                    class="flex items-center gap-1 rounded-md border bg-preto-900/70 pr-1.5 transition"
                    :draggable="mestre"
                    :title="mestre ? 'Arraste para o mapa para criar o token; botão direito para mais opções' : undefined"
                    @dragstart="mestre && arrastar($event, p.id)"
                    @contextmenu="mestre && ($event.preventDefault(), $emit('menu', p.id, { x: $event.clientX, y: $event.clientY }))"
                    :class="ativoId === p.id ? 'border-ouro-400' : 'border-transparent hover:border-preto-700'"
                >
                    <!-- Clicar no personagem abre a ficha e, se for seu, o torna o personagem ativo -->
                    <button
                        type="button"
                        class="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                        :aria-label="`Abrir a ficha de ${p.nome}`"
                        @click="$emit('abrir', p.id)"
                    >
                        <span
                            class="relative flex size-9 shrink-0 items-center justify-center rounded-full font-serif text-base font-semibold text-preto-950"
                            :style="{ backgroundColor: p.cor }"
                            aria-hidden="true"
                        >
                            {{ p.nome.slice(0, 1).toUpperCase() }}
                            <span
                                v-if="ativoId === p.id"
                                class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-ouro-400 ring-2 ring-preto-900"
                                title="Personagem ativo"
                            />
                        </span>
                        <span class="min-w-0 flex-1">
                            <span class="flex items-center gap-1.5 truncate font-medium" :style="{ color: p.cor }">
                                <span class="truncate">{{ p.nome }}</span>
                                <span
                                    v-if="ativoId === p.id"
                                    class="shrink-0 rounded bg-ouro-500/20 px-1 text-[10px] font-normal uppercase text-ouro-300"
                                    >ativo</span
                                >
                            </span>
                            <span class="flex flex-wrap items-center gap-1 text-xs text-preto-400">
                                <template v-if="p.jogadores.length"
                                    ><span v-for="j in p.jogadores" :key="j.id" :style="{ color: j.cor }">{{ j.nome }}</span></template
                                >
                                <span v-else>sem jogador (NPC)</span>
                            </span>
                        </span>
                    </button>
                    <Button
                        v-if="comToken.includes(p.id)"
                        size="icon"
                        variant="ghost"
                        class="size-8 shrink-0 text-preto-300 hover:text-ouro-200"
                        :aria-label="`Ir ao token de ${p.nome}`"
                        :title="`Ir ao token de ${p.nome}`"
                        @click="$emit('focar', p.id)"
                        ><Crosshair class="size-4"
                    /></Button>
                    <Button
                        v-if="mestre"
                        size="icon"
                        variant="ghost"
                        class="size-8 shrink-0 text-preto-300 hover:text-ouro-200"
                        :aria-label="`Atribuir jogadores a ${p.nome}`"
                        :title="`Atribuir jogadores a ${p.nome}`"
                        @click="$emit('atribuir', p.id)"
                        ><Users class="size-4"
                    /></Button>
                </li>
            </ul>
            <p v-if="!personagens.length" class="mt-4 text-center text-xs text-preto-400">
                {{
                    mestre
                        ? 'Nenhum personagem nesta mesa. Crie o primeiro com o botão acima.'
                        : 'Nenhum personagem nesta mesa. O mestre cria os personagens.'
                }}
            </p>
        </section>

        <section>
            <h3 class="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-preto-400">Jogadores</h3>
            <ul class="grid gap-1">
                <li v-for="j in jogadores" :key="j.id" class="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs">
                    <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: j.cor }" />
                    <span class="truncate" :style="{ color: j.cor }">{{ j.nome }}</span>
                    <Crown v-if="j.papel === 'mestre'" class="size-3 shrink-0 text-ouro-400" aria-label="Mestre" />
                    <span v-if="j.id === meuId" class="shrink-0 text-preto-400">(você)</span>
                    <span v-if="mestre && paginaDe[j.id]" class="ml-auto truncate text-preto-500">em {{ paginaDe[j.id]!.nome }}</span>
                </li>
            </ul>
        </section>
    </div>
</template>

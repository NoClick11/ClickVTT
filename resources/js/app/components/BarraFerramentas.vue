<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    AppWindow,
    BrickWall,
    Crosshair,
    Dices,
    DoorClosed,
    DoorOpen,
    Hand,
    Lightbulb,
    ListOrdered,
    MousePointer2,
    PackageOpen,
    Paintbrush,
    Ruler,
    Settings2,
    Type,
} from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue';
import type { Ferramenta } from '../engine/tipos';

const props = defineProps<{ ferramenta: Ferramenta; mestre: boolean; camadaIluminacao: boolean; dados: boolean; turnos: boolean }>();
defineEmits<{ ferramenta: [Ferramenta]; configurar: []; dados: []; turnos: [] }>();

interface Item {
    id: Ferramenta;
    rotulo: string;
    icone: Component;
    mestre?: boolean;
    iluminacao?: boolean;
    /** Só aparece fora da camada de iluminação (o loot não vive nela). */
    foraIluminacao?: boolean;
}
const ferramentas: Item[] = [
    { id: 'selecionar', rotulo: 'Selecionar e mover', icone: MousePointer2 },
    { id: 'mirar', rotulo: 'Mirar: trava um token como alvo (ou segure T e clique)', icone: Crosshair },
    { id: 'mover', rotulo: 'Mover a vista (ou segure Espaço)', icone: Hand },
    { id: 'regua', rotulo: 'Régua', icone: Ruler },
    { id: 'pintar', rotulo: 'Pintar', icone: Paintbrush },
    { id: 'texto', rotulo: 'Texto', icone: Type },
    { id: 'loot', rotulo: 'Loot: clique no mapa para criar um baú com itens e dinheiro', icone: PackageOpen, mestre: true, foraIluminacao: true },
    {
        id: 'viagem',
        rotulo: 'Ponto de Viagem: clique no mapa para criar uma passagem entre mapas',
        icone: DoorOpen,
        mestre: true,
        foraIluminacao: true,
    },
    { id: 'luz', rotulo: 'Luz', icone: Lightbulb, mestre: true, iluminacao: true },
    { id: 'parede', rotulo: 'Parede', icone: BrickWall, mestre: true, iluminacao: true },
    { id: 'porta', rotulo: 'Porta', icone: DoorClosed, mestre: true, iluminacao: true },
    { id: 'janela', rotulo: 'Janela', icone: AppWindow, mestre: true, iluminacao: true },
];
const visiveis = (f: Item) =>
    (!f.mestre || props.mestre) && (!f.iluminacao || props.camadaIluminacao) && (!f.foraIluminacao || !props.camadaIluminacao);
/**
 * Sem altura para tudo, as ferramentas passam para outra coluna. Grade em vez de flex-wrap: assim o fundo do painel cresce junto com as colunas.
 * (O espaço de baixo fica livre para o seletor de camadas.)
 */
const altura = ref(window.innerHeight);
const medir = () => (altura.value = window.innerHeight);
onMounted(() => window.addEventListener('resize', medir));
onBeforeUnmount(() => window.removeEventListener('resize', medir));
const linhas = computed(() => {
    const total = ferramentas.filter(visiveis).length + 3 + (props.mestre ? 3 : 0);
    const cabem = Math.max(4, Math.floor((altura.value - 64 - 208 - 12 + 4) / 44));

    return Math.min(total, cabem);
});
const colunas = computed(() => Math.ceil((ferramentas.filter(visiveis).length + 3 + (props.mestre ? 3 : 0)) / linhas.value));
/** Linha fina entre as colunas (só aparece quando as ferramentas quebram): cada coluna tem 40px e o vão, 9px. */
const divisorDeColunas = computed(() =>
    colunas.value > 1
        ? {
              backgroundImage: 'linear-gradient(to right, transparent 44px, rgb(212 168 67 / 0.25) 44px 45px, transparent 45px)',
              backgroundSize: '49px 100%',
              backgroundRepeat: 'repeat-x',
              backgroundOrigin: 'content-box',
              backgroundClip: 'content-box',
          }
        : {},
);
const botao =
    'flex size-10 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400';
</script>

<template>
    <TooltipProvider :delay-duration="200">
        <nav
            class="pointer-events-auto absolute left-3 top-16 z-10 grid grid-flow-col gap-x-[9px] gap-y-1 rounded-lg border border-ouro-500/20 bg-preto-950/90 p-1.5 backdrop-blur"
            aria-label="Ferramentas"
            :style="{ gridTemplateRows: `repeat(${linhas}, auto)`, ...divisorDeColunas }"
        >
            <template v-for="f in ferramentas" :key="f.id">
                <Tooltip v-if="visiveis(f)">
                    <TooltipTrigger as-child>
                        <button
                            type="button"
                            :class="[botao, ferramenta === f.id ? 'bg-ouro-500 text-preto-950' : 'text-preto-200 hover:bg-preto-800']"
                            :aria-label="f.rotulo"
                            :aria-pressed="ferramenta === f.id"
                            @click="$emit('ferramenta', f.id)"
                        >
                            <component :is="f.icone" class="size-5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{{ f.rotulo }}</TooltipContent>
                </Tooltip>
            </template>
            <div class="my-1 h-px bg-ouro-500/20" />
            <Tooltip>
                <TooltipTrigger as-child>
                    <button
                        type="button"
                        :class="[botao, dados ? 'bg-ouro-500 text-preto-950' : 'text-preto-200 hover:bg-preto-800']"
                        aria-label="Rolar dados"
                        :aria-pressed="dados"
                        @click="$emit('dados')"
                    >
                        <Dices class="size-5" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right">Rolar dados</TooltipContent>
            </Tooltip>
            <Tooltip v-if="mestre">
                <TooltipTrigger as-child>
                    <button
                        type="button"
                        :class="[botao, turnos ? 'bg-ouro-500 text-preto-950' : 'text-preto-200 hover:bg-preto-800']"
                        aria-label="Turnos"
                        :aria-pressed="turnos"
                        @click="$emit('turnos')"
                    >
                        <ListOrdered class="size-5" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right">Turnos</TooltipContent>
            </Tooltip>
            <template v-if="mestre">
                <div class="my-1 h-px bg-ouro-500/20" />
                <Tooltip>
                    <TooltipTrigger as-child>
                        <button
                            type="button"
                            :class="[botao, 'text-preto-200 hover:bg-preto-800']"
                            aria-label="Configurações da página"
                            @click="$emit('configurar')"
                        >
                            <Settings2 class="size-5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Configurações da página</TooltipContent>
                </Tooltip>
            </template>
        </nav>
    </TooltipProvider>
</template>

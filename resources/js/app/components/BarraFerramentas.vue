<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AppWindow, BrickWall, Dices, DoorClosed, Hand, ImagePlus, Lightbulb, ListOrdered, MousePointer2, Paintbrush, Ruler, Settings2, Type, UserPlus } from 'lucide-vue-next';
import type { Component } from 'vue';
import type { Ferramenta } from '../engine/tipos';

defineProps<{ ferramenta: Ferramenta; mestre: boolean; camadaIluminacao: boolean; dados: boolean; turnos: boolean }>();
defineEmits<{ ferramenta: [Ferramenta]; enviarMapa: []; novoToken: []; configurar: []; dados: []; turnos: [] }>();

interface Item {
    id: Ferramenta;
    rotulo: string;
    icone: Component;
    mestre?: boolean;
    iluminacao?: boolean;
}
const ferramentas: Item[] = [
    { id: 'selecionar', rotulo: 'Selecionar e mover', icone: MousePointer2 },
    { id: 'mover', rotulo: 'Mover a vista (ou segure Espaço)', icone: Hand },
    { id: 'regua', rotulo: 'Régua', icone: Ruler },
    { id: 'pintar', rotulo: 'Pintar', icone: Paintbrush },
    { id: 'texto', rotulo: 'Texto', icone: Type },
    { id: 'luz', rotulo: 'Luz', icone: Lightbulb, mestre: true, iluminacao: true },
    { id: 'parede', rotulo: 'Parede', icone: BrickWall, mestre: true, iluminacao: true },
    { id: 'porta', rotulo: 'Porta', icone: DoorClosed, mestre: true, iluminacao: true },
    { id: 'janela', rotulo: 'Janela', icone: AppWindow, mestre: true, iluminacao: true },
];
const botao = 'flex size-10 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400';
</script>

<template>
    <TooltipProvider :delay-duration="200">
        <nav class="pointer-events-auto absolute left-3 top-16 z-10 flex flex-col gap-1 rounded-lg border border-ouro-500/20 bg-preto-950/90 p-1.5 backdrop-blur" aria-label="Ferramentas">
            <template v-for="f in ferramentas" :key="f.id">
                <Tooltip v-if="(!f.mestre || mestre) && (!f.iluminacao || camadaIluminacao)">
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
                    <button type="button" :class="[botao, dados ? 'bg-ouro-500 text-preto-950' : 'text-preto-200 hover:bg-preto-800']" aria-label="Rolar dados" :aria-pressed="dados" @click="$emit('dados')"><Dices class="size-5" /></button>
                </TooltipTrigger>
                <TooltipContent side="right">Rolar dados</TooltipContent>
            </Tooltip>
            <Tooltip v-if="mestre">
                <TooltipTrigger as-child>
                    <button type="button" :class="[botao, turnos ? 'bg-ouro-500 text-preto-950' : 'text-preto-200 hover:bg-preto-800']" aria-label="Turnos" :aria-pressed="turnos" @click="$emit('turnos')"><ListOrdered class="size-5" /></button>
                </TooltipTrigger>
                <TooltipContent side="right">Turnos</TooltipContent>
            </Tooltip>
            <template v-if="mestre">
                <div class="my-1 h-px bg-ouro-500/20" />
                <Tooltip>
                    <TooltipTrigger as-child>
                        <button type="button" :class="[botao, 'text-preto-200 hover:bg-preto-800']" aria-label="Enviar mapa" @click="$emit('enviarMapa')"><ImagePlus class="size-5" /></button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Enviar mapa (imagem, GIF ou vídeo)</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger as-child>
                        <button type="button" :class="[botao, 'text-preto-200 hover:bg-preto-800']" aria-label="Novo token" @click="$emit('novoToken')"><UserPlus class="size-5" /></button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Novo token</TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger as-child>
                        <button type="button" :class="[botao, 'text-preto-200 hover:bg-preto-800']" aria-label="Configurações da página" @click="$emit('configurar')"><Settings2 class="size-5" /></button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Configurações da página</TooltipContent>
                </Tooltip>
            </template>
        </nav>
    </TooltipProvider>
</template>

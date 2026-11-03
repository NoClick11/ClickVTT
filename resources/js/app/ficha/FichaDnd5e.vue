<script setup lang="ts">
import { Backpack, BookOpen, Feather, ListChecks, Settings, Zap } from 'lucide-vue-next';
import { computed, provide, ref, type Component } from 'vue';
import AbaBiografia from './abas/AbaBiografia.vue';
import AbaCaracteristicas from './abas/AbaCaracteristicas.vue';
import AbaDetalhes from './abas/AbaDetalhes.vue';
import AbaEfeitos from './abas/AbaEfeitos.vue';
import AbaInventario from './abas/AbaInventario.vue';
import AbaMagias from './abas/AbaMagias.vue';
import { fichaExemplo } from './dados-exemplo';
import { CHAVE_EDITAR } from './dnd5e';
import FichaAtributos from './FichaAtributos.vue';
import FichaCabecalho from './FichaCabecalho.vue';
import FichaLateral from './FichaLateral.vue';

/**
 * Ficha de D&D 5e — SÓ LAYOUT (Foundry dnd5e + blocos do Roll20).
 * Os dados são de exemplo; persistência, cálculos e rolagens vêm na fase das funcionalidades.
 */
const props = defineProps<{ personagem: { id: number; nome: string; cor: string } }>();

const ficha = computed(() => fichaExemplo(props.personagem.nome));
const editar = ref(false);
provide(CHAVE_EDITAR, editar);

type AbaId = 'detalhes' | 'inventario' | 'caracteristicas' | 'magias' | 'efeitos' | 'biografia';
const abas: { id: AbaId; rotulo: string; icone: Component }[] = [
    { id: 'detalhes', rotulo: 'Detalhes', icone: Settings },
    { id: 'inventario', rotulo: 'Inventário', icone: Backpack },
    { id: 'caracteristicas', rotulo: 'Características', icone: ListChecks },
    { id: 'magias', rotulo: 'Magias', icone: BookOpen },
    { id: 'efeitos', rotulo: 'Efeitos', icone: Zap },
    { id: 'biografia', rotulo: 'Biografia', icone: Feather },
];
const aba = ref<AbaId>('detalhes');
const conteudo: Record<AbaId, Component> = { detalhes: AbaDetalhes, inventario: AbaInventario, caracteristicas: AbaCaracteristicas, magias: AbaMagias, efeitos: AbaEfeitos, biografia: AbaBiografia };
</script>

<template>
    <div class="flex h-full min-h-0 flex-col text-preto-100">
        <FichaCabecalho :ficha="ficha" :cor="personagem.cor" @update:editar="editar = $event" />
        <div class="flex min-h-0 flex-1">
            <FichaLateral :ficha="ficha" :cor="personagem.cor" />
            <div class="flex min-w-0 flex-1 flex-col">
                <FichaAtributos :ficha="ficha" />
                <nav class="flex shrink-0 gap-0.5 overflow-x-auto border-b border-ouro-500/20 px-2 pt-1.5" role="tablist" aria-label="Seções da ficha">
                    <button
                        v-for="a in abas"
                        :key="a.id"
                        type="button"
                        role="tab"
                        :aria-selected="aba === a.id"
                        :id="`ficha-aba-${a.id}`"
                        class="flex shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                        :class="aba === a.id ? 'border-ouro-500/40 bg-preto-900 font-semibold text-ouro-200' : 'border-transparent text-preto-300 hover:text-ouro-200'"
                        @click="aba = a.id"
                    >
                        <component :is="a.icone" class="size-4" /> {{ a.rotulo }}
                    </button>
                </nav>
                <div class="min-h-0 flex-1 overflow-y-auto" role="tabpanel" :aria-labelledby="`ficha-aba-${aba}`">
                    <component :is="conteudo[aba]" :ficha="ficha" />
                </div>
            </div>
        </div>
    </div>
</template>

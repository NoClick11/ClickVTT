<script setup lang="ts">
import { Apple, Backpack, Flame, ListChecks, Settings, Skull } from 'lucide-vue-next';
import { computed, provide, ref, type Component } from 'vue';
import type { AbrirEditorItem, PersonagemFicha } from '../../../nucleo/sistemas/tipos';
import type { ItemDto } from '../../../tipos-mesa';
import { CHAVE_FICHA } from '../contexto';
import { analisar, armasAtivas, modoDaRolagem, type FichaOnePiece } from '../regras';
import AbaAkuma from './abas/AbaAkuma.vue';
import AbaCaracteristicas from './abas/AbaCaracteristicas.vue';
import AbaDetalhes from './abas/AbaDetalhes.vue';
import AbaInventario from './abas/AbaInventario.vue';
import AbaRecompensa from './abas/AbaRecompensa.vue';
import AbaTecnicas from './abas/AbaTecnicas.vue';
import FichaAtributos from './FichaAtributos.vue';
import FichaCabecalho from './FichaCabecalho.vue';
import FichaLateral from './FichaLateral.vue';

/**
 * Ficha de One Piece (mesmo layout da ficha de D&D 5e, com técnicas e pontos de poder no lugar das magias). Só mostra e emite: `salvar(campos)` e
 * `rolar(expressao, rotulo)`. Os valores derivados (CA, bônus, CD...) são calculados aqui (`calcular`) e
 * os ajustes manuais ficam em `ficha.ajustes`.
 */
const props = defineProps<{ personagem: PersonagemFicha; ficha: FichaOnePiece; itens: ItemDto[]; mestre: boolean }>();
const emit = defineEmits<{
    salvar: [campos: Record<string, unknown>];
    rolar: [expressao: string, rotulo: string, aoRolar?: (total: number) => void];
    editorItem: Parameters<AbrirEditorItem>;
}>();

const editar = ref(false);
const itensPorId = computed(() => Object.fromEntries(props.itens.map((i) => [i.id, i])) as Record<number, ItemDto>);
const analise = computed(() => analisar(props.ficha, itensPorId.value));
const calc = computed(() => analise.value.valores);
const armas = computed(() => armasAtivas(props.ficha, itensPorId.value, calc.value));
const modoDe = (variavel: string) => modoDaRolagem(analise.value.efeitos, variavel);

provide(CHAVE_FICHA, {
    editar,
    calc,
    origens: computed(() => analise.value.origens),
    efeitos: computed(() => analise.value.efeitos),
    modoDe,
    armas,
    itens: itensPorId,
    mestre: props.mestre,
    abrirEditorItem: (itemId, aoSalvar) => emit('editorItem', itemId, aoSalvar),
    salvar: (campos) => emit('salvar', campos),
    rolar: (expressao, rotulo, aoRolar) => emit('rolar', expressao, rotulo, aoRolar),
    // Shift = vantagem, Ctrl/Alt = desvantagem (manual vence); sem tecla, valem os efeitos dos itens.
    d20: (evento, variavel, rotulo) => {
        const manual = evento.shiftKey ? 'vantagem' : evento.ctrlKey || evento.altKey ? 'desvantagem' : null;
        const modo = manual ?? modoDe(variavel);
        const dados = modo === 'vantagem' ? '2d20kh1' : modo === 'desvantagem' ? '2d20kl1' : '1d20';
        emit('rolar', `${dados}+@${variavel}`, modo ? `${rotulo} (${modo})` : rotulo);
    },
});

type AbaId = 'detalhes' | 'inventario' | 'caracteristicas' | 'tecnicas' | 'akuma' | 'recompensa';
const abas: { id: AbaId; rotulo: string; icone: Component }[] = [
    { id: 'detalhes', rotulo: 'Detalhes', icone: Settings },
    { id: 'inventario', rotulo: 'Inventário', icone: Backpack },
    { id: 'caracteristicas', rotulo: 'Características', icone: ListChecks },
    { id: 'tecnicas', rotulo: 'Técnicas', icone: Flame },
    { id: 'akuma', rotulo: 'Akuma no Mi', icone: Apple },
    { id: 'recompensa', rotulo: 'Recompensa', icone: Skull },
];
const aba = ref<AbaId>('detalhes');
const conteudo: Record<AbaId, Component> = {
    detalhes: AbaDetalhes,
    inventario: AbaInventario,
    caracteristicas: AbaCaracteristicas,
    tecnicas: AbaTecnicas,
    akuma: AbaAkuma,
    recompensa: AbaRecompensa,
};
</script>

<template>
    <div class="flex h-full min-h-0 flex-col text-preto-100">
        <FichaCabecalho :ficha="ficha" :personagem="personagem" @update:editar="editar = $event" />
        <div class="flex min-h-0 flex-1">
            <FichaLateral :ficha="ficha" :personagem="personagem" />
            <div class="flex min-w-0 flex-1 flex-col">
                <FichaAtributos :ficha="ficha" />
                <nav
                    class="flex shrink-0 gap-0.5 overflow-x-auto border-b border-ouro-500/20 px-2 pt-1.5"
                    role="tablist"
                    aria-label="Seções da ficha"
                >
                    <button
                        v-for="a in abas"
                        :key="a.id"
                        type="button"
                        role="tab"
                        :aria-selected="aba === a.id"
                        :id="`ficha-aba-${a.id}`"
                        class="flex shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                        :class="
                            aba === a.id
                                ? 'border-ouro-500/40 bg-preto-900 font-semibold text-ouro-200'
                                : 'border-transparent text-preto-300 hover:text-ouro-200'
                        "
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

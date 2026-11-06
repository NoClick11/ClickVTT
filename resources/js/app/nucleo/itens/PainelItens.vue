<script setup lang="ts">
import { Plus } from 'lucide-vue-next';
import type { ItemDto } from '../../tipos-mesa';
import { resumoEfeito, type FormatoResumo } from '../efeitos/resumo';
import { MIME_ITEM } from './arrastar';

/** Catálogo de itens da mesa (só o mestre): lista, cria e abre o editor. */
defineProps<{ itens: ItemDto[]; formato?: FormatoResumo }>();
const emit = defineEmits<{ editar: [itemId: number | null] }>();
/** Arrastar o item para a janela de uma ficha o entrega ao personagem. */
function arrastar(e: DragEvent, itemId: number) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData(MIME_ITEM, String(itemId));
    e.dataTransfer.setData('text/plain', ''); // alguns navegadores só iniciam o arrastar com algum dado
    e.dataTransfer.effectAllowed = 'copy';
}
const peso = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
</script>

<template>
    <div class="flex min-h-0 flex-1 flex-col text-sm text-preto-100">
        <div class="flex shrink-0 items-center justify-between gap-2 border-b border-preto-800 px-3 py-2">
            <p class="text-xs text-preto-400">{{ itens.length }} {{ itens.length === 1 ? 'item' : 'itens' }} na mesa · arraste para uma ficha</p>
            <button
                type="button"
                class="flex items-center gap-1 rounded-md bg-ouro-500 px-2.5 py-1 text-xs font-semibold text-preto-950 hover:bg-ouro-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-300"
                @click="emit('editar', null)"
            >
                <Plus class="size-3.5" /> Novo item
            </button>
        </div>
        <ul class="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-2">
            <li v-if="!itens.length" class="m-auto max-w-52 text-center text-xs text-preto-400">
                Nenhum item ainda. Crie armas, armaduras e equipamentos mágicos e entregue-os pelo inventário do personagem.
            </li>
            <li v-for="i in itens" :key="i.id">
                <button
                    type="button"
                    draggable="true"
                    class="w-full cursor-grab rounded-md border border-preto-800 bg-preto-900/70 px-2.5 py-1.5 text-left transition hover:border-ouro-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400 active:cursor-grabbing"
                    :title="`Clique para editar. Arraste para a ficha de um personagem para entregar ${i.nome}.`"
                    @click="emit('editar', i.id)"
                    @dragstart="arrastar($event, i.id)"
                >
                    <span class="flex items-baseline justify-between gap-2"
                        ><span class="truncate font-semibold">{{ i.nome }}</span
                        ><span class="shrink-0 text-[10px] tabular-nums text-preto-500">{{ peso(i.peso) }} kg</span></span
                    >
                    <span v-if="i.descricao" class="block truncate text-xs text-preto-400">{{ i.descricao }}</span>
                    <span v-if="i.efeitos.length || i.requer_sintonia" class="mt-1 flex flex-wrap gap-1">
                        <span v-for="(e, n) in i.efeitos.slice(0, 4)" :key="n" class="rounded bg-preto-800 px-1.5 text-[10px] text-ouro-200">{{
                            resumoEfeito(e, formato)
                        }}</span>
                        <span v-if="i.efeitos.length > 4" class="text-[10px] text-preto-500">+{{ i.efeitos.length - 4 }}</span>
                        <span v-if="i.requer_sintonia" class="rounded border border-ouro-500/40 px-1.5 text-[10px] uppercase text-ouro-300"
                            >sintonia</span
                        >
                    </span>
                </button>
            </li>
        </ul>
    </div>
</template>

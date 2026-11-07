<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Jogador } from '@/site/types';
import { ChevronDown, ChevronRight, Crown, FilePlus, Folder, FolderPlus, Settings2, Trash2, Users } from 'lucide-vue-next';
import { computed, nextTick, ref } from 'vue';
import type { PaginaDto } from '../engine/tipos';
import PaginaLinha from './PaginaLinha.vue';

interface Pasta {
    id: number;
    nome: string;
    ordem: number;
}

const props = defineProps<{ open: boolean; paginas: PaginaDto[]; pastas: Pasta[]; jogadores: Jogador[]; paginaAtualId: number | null }>();
const emit = defineEmits<{
    'update:open': [boolean];
    abrir: [id: number];
    configurar: [id: number];
    novaPagina: [pastaId: number | null];
    novaPasta: [];
    renomearPagina: [id: number, nome: string];
    excluirPagina: [id: number];
    moverParaPasta: [id: number, pastaId: number | null];
    reordenar: [id: number, direcao: -1 | 1];
    moverJogador: [paginaId: number, jogadorId: number];
    trazerTodos: [paginaId: number];
    renomearPasta: [id: number, nome: string];
    excluirPasta: [id: number];
}>();

const primeiraId = computed(() => props.paginas[0]?.id ?? null);
const paginaDe = (p: Jogador) => p.pagina_id ?? primeiraId.value;
const jogadoresNa = (paginaId: number) => props.jogadores.filter((p) => paginaDe(p) === paginaId);
const paginasDaPasta = (pastaId: number | null) => props.paginas.filter((p) => p.pasta_id === pastaId);

const editando = ref<{ tipo: 'pagina' | 'pasta'; id: number; valor: string } | null>(null);
const confirmando = ref<string | null>(null);
const fechadas = ref<Set<number>>(new Set());

async function editar(tipo: 'pagina' | 'pasta', id: number, valor: string) {
    editando.value = { tipo, id, valor };
    await nextTick();
    (document.getElementById('menu-edicao') as HTMLInputElement | null)?.select();
}
function confirmarEdicao() {
    const e = editando.value;
    editando.value = null;
    if (!e || !e.valor.trim()) return;
    if (e.tipo === 'pagina') emit('renomearPagina', e.id, e.valor.trim());
    else emit('renomearPasta', e.id, e.valor.trim());
}
function alternarPasta(id: number) {
    const s = new Set(fechadas.value);
    s.has(id) ? s.delete(id) : s.add(id);
    fechadas.value = s;
}
function excluir(chave: string, acao: () => void) {
    if (confirmando.value === chave) {
        confirmando.value = null;
        acao();
    } else {
        confirmando.value = chave;
        setTimeout(() => confirmando.value === chave && (confirmando.value = null), 3000);
    }
}

// Arrastar e soltar: o jogador (ou o mestre) vai para a página onde for solto.
function iniciarArraste(e: DragEvent, p: Jogador) {
    e.dataTransfer?.setData('text/x-jogador', String(p.id));
    e.dataTransfer!.effectAllowed = 'move';
}
</script>

<template>
    <Sheet :open="open" @update:open="emit('update:open', $event)">
        <SheetContent side="left" class="flex w-full flex-col gap-0 overflow-hidden border-ouro-500/20 bg-preto-950 p-0 text-preto-100 sm:max-w-md">
            <SheetHeader class="border-b border-ouro-500/20 p-4 text-left">
                <SheetTitle class="font-serif text-xl text-ouro-100">Páginas</SheetTitle>
                <SheetDescription class="text-preto-300">Arraste um jogador para uma página para levá-lo até lá.</SheetDescription>
                <div class="flex gap-2 pt-1">
                    <Button size="sm" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" @click="emit('novaPagina', null)"
                        ><FilePlus class="size-4" /> Nova página</Button
                    >
                    <Button size="sm" variant="outline" class="border-ouro-500/40" @click="emit('novaPasta')"
                        ><FolderPlus class="size-4" /> Nova pasta</Button
                    >
                </div>
            </SheetHeader>

            <div class="flex-1 overflow-y-auto p-3">
                <!-- Jogadores (arrastáveis) -->
                <section class="mb-4">
                    <h3 class="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-ouro-400">
                        <Users class="size-3.5" /> Jogadores
                    </h3>
                    <ul class="flex flex-wrap gap-1.5">
                        <li
                            v-for="p in jogadores"
                            :key="p.id"
                            draggable="true"
                            class="flex cursor-grab items-center gap-1.5 rounded-full border border-preto-700 bg-preto-900 py-1 pl-1.5 pr-2.5 text-xs active:cursor-grabbing"
                            :title="`${p.nome} está em ${paginas.find((x) => x.id === paginaDe(p))?.nome ?? '—'}`"
                            @dragstart="iniciarArraste($event, p)"
                        >
                            <span class="size-3 rounded-full" :style="{ backgroundColor: p.cor }" />
                            {{ p.nome }}
                            <Crown v-if="p.papel === 'mestre'" class="size-3 text-ouro-400" />
                        </li>
                    </ul>
                </section>

                <!-- Pastas -->
                <section v-for="pasta in pastas" :key="pasta.id" class="mb-3">
                    <Collapsible :open="!fechadas.has(pasta.id)">
                        <div class="flex items-center gap-1 rounded-md px-1 py-1 hover:bg-preto-900">
                            <CollapsibleTrigger as-child>
                                <button
                                    type="button"
                                    class="flex size-6 items-center justify-center text-preto-300"
                                    :aria-label="fechadas.has(pasta.id) ? 'Expandir pasta' : 'Recolher pasta'"
                                    @click="alternarPasta(pasta.id)"
                                >
                                    <ChevronRight v-if="fechadas.has(pasta.id)" class="size-4" /><ChevronDown v-else class="size-4" />
                                </button>
                            </CollapsibleTrigger>
                            <Folder class="size-4 text-ouro-400" />
                            <Input
                                v-if="editando?.tipo === 'pasta' && editando.id === pasta.id"
                                id="menu-edicao"
                                v-model="editando.valor"
                                class="h-7 flex-1 px-2 text-sm"
                                @keydown.enter="confirmarEdicao"
                                @keydown.esc="editando = null"
                                @blur="confirmarEdicao"
                            />
                            <button
                                v-else
                                type="button"
                                class="flex-1 truncate text-left text-sm font-medium"
                                @dblclick="editar('pasta', pasta.id, pasta.nome)"
                            >
                                {{ pasta.nome }}
                            </button>
                            <span class="text-xs text-preto-400">{{ paginasDaPasta(pasta.id).length }}</span>
                            <Button
                                size="icon"
                                variant="ghost"
                                class="size-7"
                                aria-label="Nova página nesta pasta"
                                @click="emit('novaPagina', pasta.id)"
                                ><FilePlus class="size-3.5"
                            /></Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                class="size-7"
                                aria-label="Renomear pasta"
                                @click="editar('pasta', pasta.id, pasta.nome)"
                                ><Settings2 class="size-3.5"
                            /></Button>
                            <Button
                                v-if="confirmando !== `pasta-${pasta.id}`"
                                size="icon"
                                variant="ghost"
                                class="size-7 text-red-400"
                                aria-label="Excluir pasta"
                                @click="excluir(`pasta-${pasta.id}`, () => emit('excluirPasta', pasta.id))"
                                ><Trash2 class="size-3.5"
                            /></Button>
                            <Button
                                v-else
                                size="sm"
                                variant="destructive"
                                class="h-7 px-2 text-xs"
                                @click="excluir(`pasta-${pasta.id}`, () => emit('excluirPasta', pasta.id))"
                                >Excluir</Button
                            >
                        </div>
                        <CollapsibleContent class="ml-4 border-l border-preto-800 pl-2">
                            <p v-if="!paginasDaPasta(pasta.id).length" class="px-2 py-2 text-xs text-preto-400">
                                Pasta vazia. Mova páginas pelo menu “⋮”.
                            </p>
                            <ul class="grid gap-1.5 pt-1">
                                <PaginaLinha
                                    v-for="pg in paginasDaPasta(pasta.id)"
                                    :key="pg.id"
                                    :pagina="pg"
                                    :atual="pg.id === paginaAtualId"
                                    :jogadores="jogadoresNa(pg.id)"
                                    :pastas="pastas"
                                    :ultima="paginas.length <= 1"
                                    @abrir="emit('abrir', pg.id)"
                                    @configurar="emit('configurar', pg.id)"
                                    @renomear="(n) => emit('renomearPagina', pg.id, n)"
                                    @excluir="emit('excluirPagina', pg.id)"
                                    @mover-para-pasta="(f) => emit('moverParaPasta', pg.id, f)"
                                    @reordenar="(d) => emit('reordenar', pg.id, d)"
                                    @soltar="(j) => emit('moverJogador', pg.id, j)"
                                    @trazer-todos="emit('trazerTodos', pg.id)"
                                />
                            </ul>
                        </CollapsibleContent>
                    </Collapsible>
                </section>

                <!-- Páginas fora de pastas -->
                <ul class="grid gap-1.5">
                    <PaginaLinha
                        v-for="pg in paginasDaPasta(null)"
                        :key="pg.id"
                        :pagina="pg"
                        :atual="pg.id === paginaAtualId"
                        :jogadores="jogadoresNa(pg.id)"
                        :pastas="pastas"
                        :ultima="paginas.length <= 1"
                        @abrir="emit('abrir', pg.id)"
                        @configurar="emit('configurar', pg.id)"
                        @renomear="(n) => emit('renomearPagina', pg.id, n)"
                        @excluir="emit('excluirPagina', pg.id)"
                        @mover-para-pasta="(f) => emit('moverParaPasta', pg.id, f)"
                        @reordenar="(d) => emit('reordenar', pg.id, d)"
                        @soltar="(j) => emit('moverJogador', pg.id, j)"
                        @trazer-todos="emit('trazerTodos', pg.id)"
                    />
                </ul>
            </div>
        </SheetContent>
    </Sheet>
</template>

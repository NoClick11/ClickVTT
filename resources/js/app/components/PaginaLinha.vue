<script setup lang="ts">
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { Jogador } from '@/site/types';
import { ChevronDown, ChevronUp, Eye, Grid, MoreVertical, Pencil, Settings2, Trash2, Users } from 'lucide-vue-next';
import { nextTick, ref } from 'vue';
import type { PaginaDto } from '../engine/tipos';

const props = defineProps<{
    pagina: PaginaDto;
    atual: boolean;
    jogadores: Jogador[];
    pastas: { id: number; nome: string }[];
    ultima: boolean;
}>();
const emit = defineEmits<{
    abrir: [];
    configurar: [];
    renomear: [nome: string];
    excluir: [];
    moverParaPasta: [pastaId: number | null];
    reordenar: [direcao: -1 | 1];
    soltar: [jogadorId: number];
    trazerTodos: [];
}>();

const sobre = ref(false);
const editando = ref<string | null>(null);
const confirmando = ref(false);
let ignorarBlur = false;

async function iniciarEdicao() {
    ignorarBlur = true;
    editando.value = props.pagina.nome;
    setTimeout(async () => {
        await nextTick();
        const input = document.getElementById(`pg-edicao-${props.pagina.id}`) as HTMLInputElement | null;
        input?.focus();
        input?.select();
        setTimeout(() => {
            ignorarBlur = false;
        }, 200);
    }, 50);
}

function confirmarEdicao() {
    if (ignorarBlur) return;
    const nome = editando.value?.trim();
    editando.value = null;
    if (nome && nome !== props.pagina.nome) emit('renomear', nome);
}

function cancelarEdicao() {
    ignorarBlur = false;
    editando.value = null;
}

function pedirExclusao() {
    if (confirmando.value) {
        confirmando.value = false;
        emit('excluir');
        return;
    }
    confirmando.value = true;
    setTimeout(() => (confirmando.value = false), 3000);
}

function aoSoltar(e: DragEvent) {
    sobre.value = false;
    const id = Number(e.dataTransfer?.getData('text/x-jogador'));
    if (id) emit('soltar', id);
}

function aoArrastarJogador(e: DragEvent, p: Jogador) {
    e.dataTransfer?.setData('text/x-jogador', String(p.id));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}
</script>

<template>
    <li
        class="group relative flex flex-col overflow-hidden rounded-xl border bg-preto-900/90 shadow-md transition-all duration-200"
        :class="[
            sobre
                ? 'border-ouro-400 bg-ouro-500/10 ring-2 ring-ouro-400/30'
                : atual
                  ? 'border-ouro-500/80 shadow-ouro-500/10 ring-1 ring-ouro-500/30'
                  : 'border-preto-800 hover:border-preto-700 hover:bg-preto-900',
        ]"
        @dragover.prevent="sobre = true"
        @dragleave="sobre = false"
        @drop.prevent="aoSoltar"
    >
        <!-- Miniatura / Preview da Página (como no Roll20) -->
        <div
            class="relative h-28 w-full cursor-pointer overflow-hidden border-b border-preto-800/80 bg-preto-950"
            :title="`Abrir ${pagina.nome}`"
            @click="emit('abrir')"
        >
            <!-- Imagem de fundo/mapa se houver -->
            <img
                v-if="pagina.miniatura"
                :src="pagina.miniatura"
                :alt="pagina.nome"
                class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
            />

            <!-- Grade de batalha ilustrativa se não houver mapa cadastrado -->
            <div
                v-else
                class="relative flex size-full items-center justify-center bg-[#101012] transition-colors group-hover:bg-[#15151a]"
                style="
                    background-image:
                        linear-gradient(to right, rgba(212, 168, 67, 0.08) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(212, 168, 67, 0.08) 1px, transparent 1px);
                    background-size: 16px 16px;
                "
            >
                <div class="flex flex-col items-center gap-1 text-preto-500 transition-colors group-hover:text-preto-400">
                    <Grid class="size-6 text-ouro-500/30" />
                    <span class="font-mono text-[11px] tracking-wider">{{ pagina.colunas }}×{{ pagina.linhas }}</span>
                </div>
            </div>

            <!-- Badge de Página Ativa (topo esquerdo) -->
            <div
                v-if="atual"
                class="absolute left-2 top-2 flex items-center gap-1 rounded bg-ouro-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-preto-950 shadow-md backdrop-blur-sm"
            >
                <Eye class="size-3" /> Ativa
            </div>

            <!-- Fita de Jogadores (estilo Roll20) no topo direito se houver jogadores nesta página -->
            <div
                v-if="jogadores.length"
                class="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-ouro-500/40 bg-preto-950/90 px-2 py-0.5 text-[10px] font-semibold text-ouro-200 shadow-md backdrop-blur-md"
                :title="`${jogadores.length} jogador(es) nesta página`"
            >
                <Users class="size-3 text-ouro-400" />
                <span>{{ jogadores.length }}</span>
            </div>

            <!-- Overlay com ação rápida ao passar o mouse -->
            <div
                class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            >
                <span
                    class="flex items-center gap-1.5 rounded-full border border-ouro-400/60 bg-preto-950/90 px-3 py-1 text-xs font-medium text-ouro-100 shadow-lg backdrop-blur-sm"
                >
                    <Eye class="size-3.5 text-ouro-400" /> Entrar na página
                </span>
            </div>
        </div>

        <!-- Título e Controles -->
        <div class="flex items-center gap-1.5 px-2.5 py-2">
            <!-- Edição do nome da página -->
            <Input
                v-if="editando !== null"
                :id="`pg-edicao-${pagina.id}`"
                v-model="editando"
                class="h-7 flex-1 border-ouro-500/60 bg-preto-950 px-2 text-sm text-ouro-100 focus-visible:ring-1 focus-visible:ring-ouro-400"
                @keydown.enter="confirmarEdicao"
                @keydown.esc="cancelarEdicao"
                @blur="confirmarEdicao"
            />
            <div v-else class="flex min-w-0 flex-1 items-center gap-1.5">
                <button
                    type="button"
                    class="truncate text-left text-sm font-medium transition-colors hover:text-ouro-300"
                    :class="atual ? 'font-bold text-ouro-300' : 'text-preto-100'"
                    :title="`${pagina.nome} (${pagina.colunas}×${pagina.linhas}) — Duplo clique para renomear`"
                    @click="emit('abrir')"
                    @dblclick="iniciarEdicao"
                >
                    {{ pagina.nome }}
                </button>
                <span class="rounded bg-preto-800/80 px-1.5 py-0.5 font-mono text-[10px] text-preto-400">
                    {{ pagina.colunas }}×{{ pagina.linhas }}
                </span>
            </div>

            <!-- Botão Renomear direto (além do duplo-clique e do menu) -->
            <Button
                size="icon"
                variant="ghost"
                class="size-7 text-preto-400 hover:text-ouro-300"
                aria-label="Renomear página"
                title="Renomear"
                @click="iniciarEdicao"
            >
                <Pencil class="size-3.5" />
            </Button>
            <Button
                size="icon"
                variant="ghost"
                class="size-7 text-preto-400 hover:text-ouro-300"
                aria-label="Configurar página"
                title="Configurações da página"
                @click="emit('configurar')"
            >
                <Settings2 class="size-3.5" />
            </Button>

            <!-- Menu de Mais Opções -->
            <DropdownMenu>
                <DropdownMenuTrigger as-child>
                    <Button size="icon" variant="ghost" class="size-7 text-preto-400 hover:text-preto-100" aria-label="Mais ações da página">
                        <MoreVertical class="size-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-52">
                    <DropdownMenuItem @select.prevent="iniciarEdicao"><Pencil class="mr-2 size-4" /> Renomear</DropdownMenuItem>
                    <DropdownMenuItem @click="emit('trazerTodos')"><Users class="mr-2 size-4" /> Levar todos os jogadores</DropdownMenuItem>
                    <DropdownMenuItem @click="emit('reordenar', -1)"><ChevronUp class="mr-2 size-4" /> Subir</DropdownMenuItem>
                    <DropdownMenuItem @click="emit('reordenar', 1)"><ChevronDown class="mr-2 size-4" /> Descer</DropdownMenuItem>
                    <template v-if="pastas.length || pagina.pasta_id">
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel class="text-xs">Mover para pasta</DropdownMenuLabel>
                        <DropdownMenuItem v-if="pagina.pasta_id" @click="emit('moverParaPasta', null)">Fora de pastas</DropdownMenuItem>
                        <DropdownMenuItem
                            v-for="p in pastas.filter((x) => x.id !== pagina.pasta_id)"
                            :key="p.id"
                            @click="emit('moverParaPasta', p.id)"
                            >{{ p.nome }}</DropdownMenuItem
                        >
                    </template>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem class="text-red-400 focus:text-red-300" :disabled="ultima" @click="pedirExclusao">
                        <Trash2 class="mr-2 size-4" /> {{ confirmando ? 'Clique de novo para excluir' : 'Excluir' }}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>

        <!-- Área de Jogadores (onde arrasta e solta para posicionar na página) -->
        <div class="flex min-h-8 flex-wrap items-center gap-1 border-t border-preto-800/80 bg-preto-950/60 px-2.5 py-1.5">
            <span v-if="!jogadores.length" class="text-[11px] text-preto-500">Solte jogadores aqui para trazê-los</span>
            <span
                v-for="j in jogadores"
                :key="j.id"
                draggable="true"
                class="flex cursor-grab items-center gap-1.5 rounded-full border border-preto-700 bg-preto-900 py-0.5 pl-1.5 pr-2.5 text-[11px] shadow-sm transition-colors hover:border-preto-600 active:cursor-grabbing"
                @dragstart="aoArrastarJogador($event, j)"
            >
                <span class="size-2 rounded-full shadow-sm" :style="{ backgroundColor: j.cor }" />
                {{ j.nome }}
            </span>
        </div>
    </li>
</template>

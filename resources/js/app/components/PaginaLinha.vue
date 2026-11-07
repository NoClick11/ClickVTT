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
import { ChevronDown, ChevronUp, Eye, MoreVertical, Pencil, Settings2, Trash2, Users } from 'lucide-vue-next';
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

async function iniciarEdicao() {
    editando.value = props.pagina.nome;
    await nextTick();
    (document.getElementById(`pg-edicao-${props.pagina.id}`) as HTMLInputElement | null)?.select();
}
function confirmarEdicao() {
    const nome = editando.value?.trim();
    editando.value = null;
    if (nome && nome !== props.pagina.nome) emit('renomear', nome);
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
        class="rounded-lg border bg-preto-900/70 transition"
        :class="[sobre ? 'border-ouro-400 bg-ouro-500/10' : atual ? 'border-ouro-500/60' : 'border-preto-800']"
        @dragover.prevent="sobre = true"
        @dragleave="sobre = false"
        @drop.prevent="aoSoltar"
    >
        <div class="flex items-center gap-1 px-2 py-1.5">
            <Input
                v-if="editando !== null"
                :id="`pg-edicao-${pagina.id}`"
                v-model="editando"
                class="h-7 flex-1 px-2 text-sm"
                @keydown.enter="confirmarEdicao"
                @keydown.esc="editando = null"
                @blur="confirmarEdicao"
            />
            <button
                v-else
                type="button"
                class="flex-1 truncate text-left text-sm"
                :class="atual ? 'font-semibold text-ouro-200' : ''"
                @click="emit('abrir')"
                @dblclick="iniciarEdicao"
            >
                {{ pagina.nome }}
                <span class="ml-1 text-xs text-preto-400">{{ pagina.colunas }}×{{ pagina.linhas }}</span>
            </button>
            <Button size="icon" variant="ghost" class="size-7" aria-label="Abrir página" title="Abrir (ver como mestre)" @click="emit('abrir')"
                ><Eye class="size-3.5"
            /></Button>
            <Button size="icon" variant="ghost" class="size-7" aria-label="Configurar página" title="Configurar" @click="emit('configurar')"
                ><Settings2 class="size-3.5"
            /></Button>
            <DropdownMenu>
                <DropdownMenuTrigger as-child
                    ><Button size="icon" variant="ghost" class="size-7" aria-label="Mais ações da página"><MoreVertical class="size-3.5" /></Button
                ></DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-52">
                    <DropdownMenuItem @click="iniciarEdicao"><Pencil class="mr-2 size-4" /> Renomear</DropdownMenuItem>
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
                    <DropdownMenuItem class="text-red-400 focus:text-red-300" :disabled="ultima" @click="pedirExclusao"
                        ><Trash2 class="mr-2 size-4" /> {{ confirmando ? 'Clique de novo para excluir' : 'Excluir' }}</DropdownMenuItem
                    >
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        <div class="flex min-h-8 flex-wrap items-center gap-1 border-t border-preto-800 px-2 py-1.5">
            <span v-if="!jogadores.length" class="text-xs text-preto-500">Solte jogadores aqui</span>
            <span
                v-for="j in jogadores"
                :key="j.id"
                draggable="true"
                class="flex cursor-grab items-center gap-1 rounded-full border border-preto-700 bg-preto-950 py-0.5 pl-1 pr-2 text-[11px] active:cursor-grabbing"
                @dragstart="aoArrastarJogador($event, j)"
            >
                <span class="size-2.5 rounded-full" :style="{ backgroundColor: j.cor }" />{{ j.nome }}
            </span>
        </div>
    </li>
</template>

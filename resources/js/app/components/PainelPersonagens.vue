<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Jogador, Personagem } from '@/site/types';
import {
    ChevronDown,
    ChevronRight,
    Crosshair,
    Crown,
    Eye,
    EyeOff,
    FileImage,
    Folder,
    FolderOpen,
    FolderPlus,
    Pencil,
    Plus,
    Presentation,
    Skull,
    Trash2,
    Users,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { PaginaDto } from '../engine/tipos';
import { MIME_PERSONAGEM } from '../nucleo/itens/arrastar';
import type { DiarioDto } from '../tipos-mesa';

/** O que está sendo arrastado dentro do painel (para guardar em uma pasta). */
type Arrastado = { tipo: 'personagem' | 'folheto' | 'pasta'; id: number };
const arrastando = ref<Arrastado | null>(null);
const sobre = ref<number | 'raiz' | null>(null);

const arrastar = (e: DragEvent, tipo: Arrastado['tipo'], id: number) => {
    arrastando.value = { tipo, id };
    if (!e.dataTransfer) return;
    // O personagem também pode ser solto no mapa (cria o token): o tipo de dado dele continua o mesmo.
    if (tipo === 'personagem') e.dataTransfer.setData(MIME_PERSONAGEM, String(id));
    e.dataTransfer.setData('text/plain', '');
    e.dataTransfer.effectAllowed = tipo === 'personagem' ? 'copyMove' : 'move';
};
const soltar = (pastaId: number | null) => {
    const a = arrastando.value;
    arrastando.value = null;
    sobre.value = null;
    if (!a) return;
    if (a.tipo === 'personagem') emit('moverPersonagem', a.id, pastaId);
    else if (a.tipo === 'folheto') emit('moverFolheto', a.id, pastaId);
    else if (a.id !== pastaId) emit('moverPasta', a.id, pastaId);
};
const sobrePasta = (e: DragEvent, alvo: number | 'raiz') => {
    if (!arrastando.value) return;
    e.preventDefault();
    sobre.value = alvo;
};

const props = defineProps<{
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
    /** Pastas e folhetos do diário (o jogador só recebe o que o mestre liberou). */
    diario: DiarioDto;
}>();
/** Cópias de token de NPC no mapa (possuem `instancia_de`) não aparecem na lista lateral — apenas o modelo do catálogo fica visível. */
const ehCopiaDeNpc = (p: Personagem) => !!(p.ficha?.npc && (p.ficha.npc as { instancia_de?: number }).instancia_de);

const fotoDoPersonagem = (p: Personagem): string | null => {
    return (
        p.foto_token ||
        p.foto ||
        ((p.ficha as Record<string, unknown> | null)?.foto_token as string | null) ||
        ((p.ficha as Record<string, unknown> | null)?.foto as string | null) ||
        null
    );
};

const ehNpc = (p: Personagem): boolean => {
    return !p.jogadores?.length || !!(p.ficha as Record<string, unknown> | null)?.npc;
};

/** O jogador só vê a lista com os personagens dele; o mestre vê todos (exceto as cópias de token dos NPCs). */
const visiveis = computed(() => {
    const lista = props.personagens.filter((p) => !ehCopiaDeNpc(p));
    return props.mestre ? lista : lista.filter((p) => props.meusPersonagens.includes(p.id));
});

const emit = defineEmits<{
    abrir: [personagemId: number];
    focar: [personagemId: number];
    atribuir: [personagemId: number];
    criar: [];
    novaPasta: [];
    novoFolheto: [];
    /** Reservado: o NPC ainda não tem função. */
    novoNpc: [];
    moverPersonagem: [id: number, pastaId: number | null];
    moverFolheto: [id: number, pastaId: number | null];
    moverPasta: [id: number, paiId: number | null];
    renomearPasta: [id: number];
    excluirPasta: [id: number];
    abrirFolheto: [id: number];
    alternarFolheto: [id: number, visivel: boolean];
    mostrarFolheto: [id: number];
    /** Botão direito (só o mestre): o menu de opções do personagem. */
    menu: [personagemId: number, tela: { x: number; y: number }];
}>();

// --- árvore: pastas (aninháveis), depois personagens e folhetos de cada nível, numa lista só com recuo ---
const fechadas = ref<Set<number>>(new Set());
const alternarPasta = (id: number) => {
    const n = new Set(fechadas.value);
    if (!n.delete(id)) n.add(id);
    fechadas.value = n;
};

type Linha =
    | { chave: string; tipo: 'pasta'; nivel: number; pasta: DiarioDto['pastas'][number]; aberta: boolean; itens: number }
    | { chave: string; tipo: 'personagem'; nivel: number; personagem: Personagem }
    | { chave: string; tipo: 'folheto'; nivel: number; folheto: DiarioDto['folhetos'][number] };

const linhas = computed<Linha[]>(() => {
    const ids = new Set(props.diario.pastas.map((p) => p.id));
    // pasta que não existe (ou que o jogador não recebeu) conta como a raiz
    const donde = (id: number | null | undefined) => (id != null && ids.has(id) ? id : null);
    const pastas = props.diario.pastas;
    const folhetos = props.diario.folhetos;
    const contar = (id: number): number =>
        visiveis.value.filter((p) => donde(p.pasta_id) === id).length +
        folhetos.filter((f) => donde(f.pasta_id) === id).length +
        pastas.filter((q) => donde(q.pai_id) === id).reduce((n, q) => n + contar(q.id), 0);

    const saida: Linha[] = [];
    const visitadas = new Set<number>(); // proteção contra ciclo
    const descer = (pai: number | null, nivel: number) => {
        for (const pasta of pastas.filter((p) => donde(p.pai_id) === pai)) {
            if (visitadas.has(pasta.id)) continue;
            visitadas.add(pasta.id);
            const aberta = !fechadas.value.has(pasta.id);
            saida.push({ chave: `pasta-${pasta.id}`, tipo: 'pasta', nivel, pasta, aberta, itens: contar(pasta.id) });
            if (aberta) descer(pasta.id, nivel + 1);
        }
        for (const personagem of visiveis.value.filter((p) => donde(p.pasta_id) === pai)) {
            saida.push({ chave: `personagem-${personagem.id}`, tipo: 'personagem', nivel, personagem });
        }
        for (const folheto of folhetos.filter((f) => donde(f.pasta_id) === pai)) {
            saida.push({ chave: `folheto-${folheto.id}`, tipo: 'folheto', nivel, folheto });
        }
    };
    descer(null, 0);

    return saida;
});
const vazio = computed(() => !visiveis.value.length && !props.diario.folhetos.length && !props.diario.pastas.length);
</script>

<template>
    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-sm text-preto-100">
        <section class="mb-4">
            <div class="mb-1.5 flex items-center justify-between gap-2 px-0.5">
                <h3 class="text-[11px] font-semibold uppercase tracking-wider text-preto-400">Personagens</h3>
                <DropdownMenu v-if="mestre" :modal="false">
                    <DropdownMenuTrigger as-child>
                        <Button
                            type="button"
                            size="sm"
                            class="h-7 gap-1 bg-ouro-500 px-2.5 text-xs font-semibold text-preto-950 hover:bg-ouro-400 focus-visible:ring-2 focus-visible:ring-ouro-300"
                        >
                            <Plus class="size-3.5" /> Novo <ChevronDown class="size-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-48">
                        <DropdownMenuItem @select="$emit('novaPasta')"><FolderPlus class="size-4" /> Nova pasta</DropdownMenuItem>
                        <DropdownMenuItem @select="$emit('novoFolheto')"><FileImage class="size-4" /> Novo folheto</DropdownMenuItem>
                        <DropdownMenuItem @select="$emit('novoNpc')"><Skull class="size-4" /> Novo NPC</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem @select="$emit('criar')"><Users class="size-4" /> Novo personagem</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <ul
                class="grid gap-1.5 rounded-md transition"
                :class="sobre === 'raiz' ? 'ring-1 ring-ouro-400/60' : ''"
                @dragover="mestre && sobrePasta($event, 'raiz')"
                @dragleave.self="sobre === 'raiz' && (sobre = null)"
                @drop.prevent="mestre && soltar(null)"
                @dragend="((arrastando = null), (sobre = null))"
            >
                <li v-for="l in linhas" :key="l.chave" class="min-w-0" :style="{ marginLeft: l.nivel * 14 + 'px' }">
                    <!-- Pasta -->
                    <div
                        v-if="l.tipo === 'pasta'"
                        class="group flex items-center gap-1 rounded-md border bg-preto-900/40 pr-1 transition"
                        :class="sobre === l.pasta.id ? 'border-ouro-400 bg-ouro-500/10' : 'border-transparent hover:border-preto-700'"
                        :draggable="mestre"
                        @dragstart.stop="mestre && arrastar($event, 'pasta', l.pasta.id)"
                        @dragover.stop="mestre && sobrePasta($event, l.pasta.id)"
                        @dragleave.self="sobre === l.pasta.id && (sobre = null)"
                        @drop.prevent.stop="mestre && soltar(l.pasta.id)"
                    >
                        <button
                            type="button"
                            class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :aria-expanded="l.aberta"
                            :aria-label="`Pasta ${l.pasta.nome}`"
                            @click="alternarPasta(l.pasta.id)"
                        >
                            <component :is="l.aberta ? ChevronDown : ChevronRight" class="size-3.5 shrink-0 text-preto-400" aria-hidden="true" />
                            <component :is="l.aberta ? FolderOpen : Folder" class="size-4 shrink-0 text-ouro-400" aria-hidden="true" />
                            <span class="truncate">{{ l.pasta.nome }}</span>
                            <span class="ml-auto shrink-0 text-xs font-normal text-preto-500">{{ l.itens }}</span>
                        </button>
                        <template v-if="mestre">
                            <Button
                                size="icon"
                                variant="ghost"
                                class="size-7 shrink-0 text-preto-400 hover:text-ouro-200"
                                :aria-label="`Renomear a pasta ${l.pasta.nome}`"
                                title="Renomear"
                                @click="$emit('renomearPasta', l.pasta.id)"
                                ><Pencil class="size-3.5"
                            /></Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                class="size-7 shrink-0 text-preto-400 hover:text-red-300"
                                :aria-label="`Excluir a pasta ${l.pasta.nome}`"
                                title="Excluir a pasta (o conteúdo sobe um nível)"
                                @click="$emit('excluirPasta', l.pasta.id)"
                                ><Trash2 class="size-3.5"
                            /></Button>
                        </template>
                    </div>

                    <!-- Folheto -->
                    <div
                        v-else-if="l.tipo === 'folheto'"
                        class="flex items-center gap-1 rounded-md border border-transparent bg-preto-900/70 pr-1.5 transition hover:border-preto-700"
                        :draggable="mestre"
                        @dragstart.stop="mestre && arrastar($event, 'folheto', l.folheto.id)"
                    >
                        <button
                            type="button"
                            class="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :aria-label="`Abrir o folheto ${l.folheto.nome}`"
                            @click="$emit('abrirFolheto', l.folheto.id)"
                        >
                            <img :src="l.folheto.imagem" alt="" class="size-9 shrink-0 rounded object-cover" loading="lazy" />
                            <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ l.folheto.nome }}</span>
                        </button>
                        <template v-if="mestre">
                            <Button
                                size="icon"
                                variant="ghost"
                                class="size-8 shrink-0"
                                :class="l.folheto.visivel ? 'text-ouro-300' : 'text-preto-500 hover:text-ouro-200'"
                                :aria-label="
                                    l.folheto.visivel ? `Esconder ${l.folheto.nome} dos jogadores` : `Liberar ${l.folheto.nome} aos jogadores`
                                "
                                :title="l.folheto.visivel ? 'Visível aos jogadores (clique para esconder)' : 'Escondido (clique para liberar)'"
                                @click="$emit('alternarFolheto', l.folheto.id, !l.folheto.visivel)"
                            >
                                <component :is="l.folheto.visivel ? Eye : EyeOff" class="size-4" />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                class="size-8 shrink-0 text-preto-300 hover:text-ouro-200"
                                :aria-label="`Mostrar ${l.folheto.nome} aos jogadores agora`"
                                title="Mostrar aos jogadores agora"
                                @click="$emit('mostrarFolheto', l.folheto.id)"
                                ><Presentation class="size-4"
                            /></Button>
                        </template>
                    </div>

                    <!-- Personagem -->
                    <div
                        v-else
                        class="flex items-center gap-1 rounded-md border bg-preto-900/70 pr-1.5 transition"
                        :draggable="mestre || meusPersonagens.includes(l.personagem.id)"
                        :title="
                            mestre || meusPersonagens.includes(l.personagem.id)
                                ? 'Arraste para o mapa para posicionar seu token; clique para abrir a ficha'
                                : undefined
                        "
                        @dragstart.stop="(mestre || meusPersonagens.includes(l.personagem.id)) && arrastar($event, 'personagem', l.personagem.id)"
                        @contextmenu="mestre && ($event.preventDefault(), $emit('menu', l.personagem.id, { x: $event.clientX, y: $event.clientY }))"
                        :class="ativoId === l.personagem.id ? 'border-ouro-400' : 'border-transparent hover:border-preto-700'"
                    >
                        <!-- Clicar no personagem abre a ficha e, se for seu, o torna o personagem ativo -->
                        <button
                            type="button"
                            class="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :aria-label="`Abrir a ficha de ${l.personagem.nome}`"
                            @click="$emit('abrir', l.personagem.id)"
                        >
                            <span
                                class="relative flex size-9 shrink-0 items-center justify-center rounded-full font-serif text-base font-semibold text-preto-950 shadow-sm"
                                :class="ehNpc(l.personagem) ? 'ring-2 ring-ouro-400' : 'ring-2 ring-preto-950'"
                                :style="{ backgroundColor: l.personagem.cor }"
                                aria-hidden="true"
                            >
                                <span class="flex size-full items-center justify-center overflow-hidden rounded-full">
                                    <img
                                        v-if="fotoDoPersonagem(l.personagem)"
                                        :src="fotoDoPersonagem(l.personagem)!"
                                        :alt="l.personagem.nome"
                                        class="size-full object-cover"
                                        loading="lazy"
                                    />
                                    <template v-else>
                                        {{ l.personagem.nome.slice(0, 1).toUpperCase() }}
                                    </template>
                                </span>
                                <span
                                    v-if="ativoId === l.personagem.id"
                                    class="absolute -bottom-0.5 -right-0.5 z-10 size-3 rounded-full bg-ouro-400 ring-2 ring-preto-900"
                                    title="Personagem ativo"
                                />
                            </span>
                            <span class="min-w-0 flex-1">
                                <span class="flex items-center gap-1.5 truncate font-medium" :style="{ color: l.personagem.cor }">
                                    <span class="truncate">{{ l.personagem.nome }}</span>
                                    <span
                                        v-if="ativoId === l.personagem.id"
                                        class="shrink-0 rounded bg-ouro-500/20 px-1 text-[10px] font-normal uppercase text-ouro-300"
                                        >ativo</span
                                    >
                                </span>
                                <span class="flex flex-wrap items-center gap-1 text-xs text-preto-400">
                                    <template v-if="l.personagem.jogadores.length"
                                        ><span v-for="j in l.personagem.jogadores" :key="j.id" :style="{ color: j.cor }">{{ j.nome }}</span></template
                                    >
                                    <span v-else>sem jogador (NPC)</span>
                                </span>
                            </span>
                        </button>
                        <Button
                            v-if="comToken.includes(l.personagem.id)"
                            size="icon"
                            variant="ghost"
                            class="size-8 shrink-0 text-preto-300 hover:text-ouro-200"
                            :aria-label="`Ir ao token de ${l.personagem.nome}`"
                            :title="`Ir ao token de ${l.personagem.nome}`"
                            @click="$emit('focar', l.personagem.id)"
                            ><Crosshair class="size-4"
                        /></Button>
                        <Button
                            v-if="mestre"
                            size="icon"
                            variant="ghost"
                            class="size-8 shrink-0 text-preto-300 hover:text-ouro-200"
                            :aria-label="`Atribuir jogadores a ${l.personagem.nome}`"
                            :title="`Atribuir jogadores a ${l.personagem.nome}`"
                            @click="$emit('atribuir', l.personagem.id)"
                            ><Users class="size-4"
                        /></Button>
                    </div>
                </li>
            </ul>
            <p v-if="vazio" class="mt-4 text-center text-xs text-preto-400">
                {{
                    mestre
                        ? 'Nada por aqui ainda. Use o botão Novo para criar pastas, folhetos e personagens.'
                        : 'Você ainda não tem um personagem nesta mesa. O mestre atribui os personagens.'
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

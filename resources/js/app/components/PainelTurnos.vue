<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Personagem } from '@/site/types';
import { ChevronDown, ChevronUp, Dices, Play, Plus, SkipBack, SkipForward, Square, Swords, Trash2, Users } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import { ordemAoMover, type Combate, type Disposicao } from '../nucleo/combate/estado';

/**
 * Painel do mestre para o combate (só ele abre): inicia o encontro, acompanha a iniciativa, passa/volta/escolhe o turno,
 * reordena, adiciona e remove participantes e ajusta a disposição (jogadores, aliado, inimigo). Só mostra e emite
 * comandos (`comando`); quem decide é o servidor.
 */
const props = defineProps<{ combate: Combate; personagens: Personagem[]; paginaId: number | null }>();
const emit = defineEmits<{ comando: [comando: string, dados?: Record<string, unknown>]; fechar: [] }>();

const nome = ref('');
const iniciativa = ref('');
const marcados = ref<number[]>([]);
const campo = 'h-8 border-ouro-500/20 bg-preto-900 px-2 text-sm';
const disponiveis = computed(() => props.personagens.filter((p) => !props.combate.itens.some((i) => i.personagem_id === p.id)));
/** Os personagens com jogador (para "Todos os jogadores"). */
const jogadoresDisponiveis = computed(() => disponiveis.value.filter((p) => p.jogadores.length > 0));
const faltam = computed(() => props.combate.itens.filter((i) => i.iniciativa === null).length);
const numero = (v: string) => (v.trim() === '' || Number.isNaN(Number(v.replace(',', '.'))) ? null : Number(v.replace(',', '.')));

const DISPOSICOES: { id: Disposicao; rotulo: string; classe: string }[] = [
    { id: 'jogadores', rotulo: 'Jogadores', classe: 'border-sky-400/60 text-sky-200' },
    { id: 'aliado', rotulo: 'Aliado', classe: 'border-green-400/60 text-green-200' },
    { id: 'inimigo', rotulo: 'Inimigo', classe: 'border-red-400/60 text-red-200' },
];
const disposicao = (id: Disposicao) => DISPOSICOES.find((d) => d.id === id)!;
const proximaDisposicao = (id: Disposicao): Disposicao => DISPOSICOES[(DISPOSICOES.findIndex((d) => d.id === id) + 1) % DISPOSICOES.length].id;

function adicionar() {
    if (!nome.value.trim()) return;
    emit('comando', 'adicionar', { nome: nome.value.trim(), disposicao: 'inimigo', iniciativa: numero(iniciativa.value) });
    nome.value = '';
    iniciativa.value = '';
}
/** Adiciona vários personagens de uma vez (a mesa liga cada um ao token dele). */
function adicionarVarios(ids: number[]) {
    if (!ids.length) return;
    emit('comando', 'adicionar_varios', { personagem_ids: ids, pagina_id: props.paginaId });
    marcados.value = [];
}
</script>

<template>
    <section
        class="pointer-events-auto absolute left-16 top-16 z-20 flex max-h-[calc(100vh-6rem)] w-96 flex-col overflow-y-auto rounded-lg border border-ouro-500/30 bg-preto-950/95 p-3 text-sm text-preto-100 shadow-xl backdrop-blur"
        aria-label="Combate"
    >
        <div class="mb-2 flex items-center justify-between">
            <h2 class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400">
                <Swords class="size-3.5" /> Combate
                <span v-if="combate.fase === 'em_curso'" class="text-preto-300">· rodada {{ combate.rodada }}</span>
                <span v-else-if="combate.fase === 'iniciativa'" class="text-preto-300">· iniciativa</span>
            </h2>
            <button type="button" class="rounded px-1.5 text-preto-300 hover:text-ouro-200" aria-label="Fechar" @click="emit('fechar')">✕</button>
        </div>

        <div class="mb-3 flex flex-wrap gap-1.5">
            <Button
                v-if="combate.fase === 'inativo'"
                size="sm"
                class="bg-ouro-500 text-preto-950 hover:bg-ouro-400"
                :disabled="paginaId === null"
                title="Inclui os tokens de personagem desta página"
                @click="emit('comando', 'iniciar', { pagina_id: paginaId })"
            >
                <Play class="size-4" /> Iniciar combate
            </Button>
            <template v-else-if="combate.fase === 'iniciativa'">
                <Button
                    size="sm"
                    variant="outline"
                    class="border-ouro-500/30"
                    title="Rola a iniciativa de quem não tem jogador (NPCs)"
                    @click="emit('comando', 'rolar_npcs')"
                    ><Dices class="size-4" /> Rolar NPCs</Button
                >
                <Button
                    size="sm"
                    class="bg-ouro-500 text-preto-950 hover:bg-ouro-400"
                    :disabled="!combate.itens.length"
                    :title="faltam ? `${faltam} sem iniciativa ficam por último` : 'Começar os turnos'"
                    @click="emit('comando', 'comecar')"
                >
                    <Play class="size-4" /> Começar<span v-if="faltam" class="text-[10px]">({{ faltam }} faltam)</span>
                </Button>
            </template>
            <template v-else>
                <Button
                    size="icon"
                    variant="outline"
                    class="size-8 border-ouro-500/30"
                    aria-label="Turno anterior"
                    @click="emit('comando', 'turno', { sentido: 'anterior' })"
                    ><SkipBack class="size-4"
                /></Button>
                <Button size="sm" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" @click="emit('comando', 'turno', { sentido: 'proximo' })"
                    ><SkipForward class="size-4" /> Próximo turno</Button
                >
            </template>
            <Button v-if="combate.fase !== 'inativo'" size="sm" variant="ghost" class="ml-auto text-red-400" @click="emit('comando', 'encerrar')"
                ><Square class="size-4" /> Encerrar</Button
            >
        </div>

        <ol class="mb-3 grid gap-1" aria-label="Participantes na ordem dos turnos">
            <li v-if="!combate.itens.length" class="rounded-md border border-dashed border-preto-700 p-3 text-center text-xs text-preto-400">
                {{
                    combate.fase === 'inativo'
                        ? 'Inicie o combate para incluir os tokens da página, ou adicione participantes depois.'
                        : 'Adicione os participantes.'
                }}
            </li>
            <li
                v-for="i in combate.itens"
                :key="i.id"
                class="flex items-center gap-1.5 rounded-md border px-2 py-1"
                :class="combate.atual === i.id ? 'border-ouro-400 bg-ouro-500/10' : 'border-preto-800'"
            >
                <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: i.cor ?? '#ecc96c' }" />
                <button
                    type="button"
                    class="min-w-0 flex-1 truncate text-left disabled:cursor-default"
                    :disabled="combate.fase !== 'em_curso'"
                    :title="'Passar o turno para ' + i.nome"
                    @click="emit('comando', 'turno', { sentido: 'escolher', item_id: i.id })"
                >
                    {{ i.nome }}
                </button>
                <button
                    type="button"
                    class="rounded-full border px-1.5 text-[10px] font-semibold"
                    :class="disposicao(i.disposicao).classe"
                    :title="'Disposição: ' + disposicao(i.disposicao).rotulo + ' (clique para mudar)'"
                    @click="emit('comando', 'definir_disposicao', { item_id: i.id, disposicao: proximaDisposicao(i.disposicao) })"
                >
                    {{ disposicao(i.disposicao).rotulo.slice(0, 3) }}
                </button>
                <Input
                    :class="[campo, 'w-14 text-center']"
                    inputmode="decimal"
                    placeholder="Ini."
                    :model-value="i.iniciativa ?? ''"
                    :aria-label="`Iniciativa de ${i.nome}`"
                    @change="
                        (e: Event) =>
                            emit('comando', 'definir_iniciativa', { item_id: i.id, iniciativa: numero((e.target as HTMLInputElement).value) })
                    "
                />
                <span class="flex flex-col">
                    <button
                        type="button"
                        class="rounded text-preto-400 hover:text-ouro-200"
                        :aria-label="`Subir ${i.nome}`"
                        @click="emit('comando', 'ordem', { ids: ordemAoMover(combate, i.id, -1) })"
                    >
                        <ChevronUp class="size-3.5" />
                    </button>
                    <button
                        type="button"
                        class="rounded text-preto-400 hover:text-ouro-200"
                        :aria-label="`Descer ${i.nome}`"
                        @click="emit('comando', 'ordem', { ids: ordemAoMover(combate, i.id, 1) })"
                    >
                        <ChevronDown class="size-3.5" />
                    </button>
                </span>
                <Button
                    size="icon"
                    variant="ghost"
                    class="size-7 text-red-400"
                    :aria-label="`Remover ${i.nome}`"
                    @click="emit('comando', 'remover', { item_id: i.id })"
                    ><Trash2 class="size-3.5"
                /></Button>
            </li>
        </ol>

        <div v-if="combate.fase !== 'inativo'" class="grid gap-2 border-t border-preto-800 pt-3">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-ouro-400">Adicionar ao combate</p>
            <template v-if="disponiveis.length">
                <div class="flex flex-wrap gap-1.5">
                    <Button
                        v-if="jogadoresDisponiveis.length"
                        size="sm"
                        class="bg-ouro-500 text-preto-950 hover:bg-ouro-400"
                        @click="adicionarVarios(jogadoresDisponiveis.map((p) => p.id))"
                    >
                        <Users class="size-4" /> Todos os jogadores ({{ jogadoresDisponiveis.length }})
                    </Button>
                    <Button size="sm" variant="outline" class="border-ouro-500/30" @click="adicionarVarios(disponiveis.map((p) => p.id))"
                        >Todos ({{ disponiveis.length }})</Button
                    >
                </div>
                <ul class="grid max-h-40 gap-0.5 overflow-y-auto rounded-md border border-preto-800 p-1" aria-label="Personagens fora do combate">
                    <li v-for="p in disponiveis" :key="p.id">
                        <label class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-preto-900">
                            <input v-model="marcados" type="checkbox" :value="p.id" class="size-3.5 accent-ouro-500" />
                            <span class="size-2.5 rounded-full" :style="{ backgroundColor: p.cor }" aria-hidden="true" />
                            <span class="min-w-0 flex-1 truncate">{{ p.nome }}</span>
                            <span class="text-[10px] text-preto-500">{{
                                p.jogadores.length ? p.jogadores.map((j) => j.nome).join(', ') : 'NPC'
                            }}</span>
                        </label>
                    </li>
                </ul>
                <Button size="sm" variant="outline" class="border-ouro-500/30" :disabled="!marcados.length" @click="adicionarVarios(marcados)"
                    ><Plus class="size-4" /> Adicionar selecionados ({{ marcados.length }})</Button
                >
            </template>
            <p v-else class="text-xs text-preto-400">Todos os personagens já estão no combate.</p>

            <form class="flex gap-2" aria-label="Adicionar um monstro avulso" @submit.prevent="adicionar">
                <Input v-model="nome" :class="[campo, 'flex-1']" placeholder="Monstro ou NPC avulso" aria-label="Nome" />
                <Input v-model="iniciativa" :class="[campo, 'w-20']" inputmode="decimal" placeholder="Ini." aria-label="Iniciativa" />
                <Button type="submit" size="icon" class="size-8 shrink-0 bg-ouro-500 text-preto-950 hover:bg-ouro-400" aria-label="Adicionar"
                    ><Plus class="size-4"
                /></Button>
            </form>
        </div>
    </section>
</template>

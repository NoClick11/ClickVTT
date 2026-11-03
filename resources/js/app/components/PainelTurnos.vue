<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Personagem } from '@/site/types';
import { Play, Plus, RotateCcw, SkipForward, Square, Trash2 } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { Combate, ItemTurno } from '../tipos-mesa';

const props = defineProps<{ combate: Combate; personagens: Personagem[] }>();
const emit = defineEmits<{ atualizar: [Combate]; fechar: [] }>();

const nome = ref('');
const iniciativa = ref<string>('');
const personagemId = ref<number | null>(null);
const campo = 'h-8 border-ouro-500/20 bg-preto-900 px-2 text-sm';

const ordenados = computed(() => [...props.combate.itens].sort((a, b) => (b.iniciativa ?? -Infinity) - (a.iniciativa ?? -Infinity)));
const disponiveis = computed(() => props.personagens.filter((p) => !props.combate.itens.some((i) => i.personagem_id === p.id)));

const novoId = () => Math.random().toString(36).slice(2, 10);
const salvar = (parcial: Partial<Combate>) => emit('atualizar', { ...props.combate, ...parcial });
const numero = (v: string) => (v.trim() === '' || Number.isNaN(Number(v.replace(',', '.'))) ? null : Number(v.replace(',', '.')));

function adicionar() {
    const p = props.personagens.find((x) => x.id === personagemId.value);
    const rotulo = p?.nome ?? nome.value.trim();
    if (!rotulo) return;
    const item: ItemTurno = { id: novoId(), nome: rotulo, iniciativa: numero(iniciativa.value), cor: p?.cor ?? '#ecc96c', personagem_id: p?.id ?? null };
    salvar({ itens: [...props.combate.itens, item] });
    nome.value = '';
    iniciativa.value = '';
    personagemId.value = null;
}
const remover = (id: string) => salvar({ itens: props.combate.itens.filter((i) => i.id !== id), atual: props.combate.atual === id ? null : props.combate.atual });
const mudarIniciativa = (id: string, v: string) => salvar({ itens: props.combate.itens.map((i) => (i.id === id ? { ...i, iniciativa: numero(v) } : i)) });

function iniciar() {
    salvar({ ativo: true, rodada: 1, atual: ordenados.value[0]?.id ?? null });
}
function encerrar() {
    salvar({ ativo: false, atual: null });
}
function proximo(delta: 1 | -1 = 1) {
    const o = ordenados.value;
    if (!o.length) return;
    const i = o.findIndex((x) => x.id === props.combate.atual);
    const prox = i === -1 ? 0 : i + delta;
    const rodada = prox >= o.length ? props.combate.rodada + 1 : prox < 0 ? Math.max(1, props.combate.rodada - 1) : props.combate.rodada;
    salvar({ atual: o[(prox + o.length) % o.length].id, rodada });
}
defineExpose({ proximo });
</script>

<template>
    <section class="pointer-events-auto absolute left-16 top-16 z-20 flex max-h-[calc(100vh-6rem)] w-80 flex-col rounded-lg border border-ouro-500/30 bg-preto-950/95 p-3 text-sm text-preto-100 shadow-xl backdrop-blur" aria-label="Turnos">
        <div class="mb-2 flex items-center justify-between">
            <h2 class="text-[11px] font-semibold uppercase tracking-wider text-ouro-400">Turnos {{ combate.ativo ? `· rodada ${combate.rodada}` : '' }}</h2>
            <button type="button" class="rounded px-1.5 text-preto-300 hover:text-ouro-200" aria-label="Fechar" @click="emit('fechar')">✕</button>
        </div>

        <div class="mb-3 flex flex-wrap gap-1.5">
            <Button v-if="!combate.ativo" size="sm" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" :disabled="!combate.itens.length" @click="iniciar"><Play class="size-4" /> Iniciar combate</Button>
            <template v-else>
                <Button size="sm" class="bg-ouro-500 text-preto-950 hover:bg-ouro-400" @click="proximo(1)"><SkipForward class="size-4" /> Próximo turno</Button>
                <Button size="sm" variant="outline" class="border-ouro-500/30" @click="salvar({ rodada: 1, atual: ordenados[0]?.id ?? null })"><RotateCcw class="size-4" /> Reiniciar</Button>
                <Button size="sm" variant="ghost" class="text-red-400" @click="encerrar"><Square class="size-4" /> Encerrar</Button>
            </template>
        </div>

        <ol class="mb-3 grid max-h-56 gap-1 overflow-y-auto">
            <li v-if="!combate.itens.length" class="rounded-md border border-dashed border-preto-700 p-3 text-center text-xs text-preto-400">Adicione os participantes e a iniciativa de cada um.</li>
            <li v-for="i in ordenados" :key="i.id" class="flex items-center gap-2 rounded-md border px-2 py-1" :class="combate.atual === i.id ? 'border-ouro-400 bg-ouro-500/10' : 'border-preto-800'">
                <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: i.cor ?? '#ecc96c' }" />
                <button type="button" class="min-w-0 flex-1 truncate text-left" :title="'Tornar o turno de ' + i.nome" @click="salvar({ atual: i.id })">{{ i.nome }}</button>
                <Input :class="[campo, 'w-16 text-center']" inputmode="decimal" placeholder="Ini." :model-value="i.iniciativa ?? ''" :aria-label="`Iniciativa de ${i.nome}`" @change="(e: Event) => mudarIniciativa(i.id, (e.target as HTMLInputElement).value)" />
                <Button size="icon" variant="ghost" class="size-7 text-red-400" :aria-label="`Remover ${i.nome}`" @click="remover(i.id)"><Trash2 class="size-3.5" /></Button>
            </li>
        </ol>

        <form class="grid gap-2 border-t border-preto-800 pt-3" @submit.prevent="adicionar">
            <select v-model="personagemId" :class="[campo, 'rounded-md border']" aria-label="Personagem">
                <option :value="null">Outro (monstro, NPC…)</option>
                <option v-for="p in disponiveis" :key="p.id" :value="p.id">{{ p.nome }}</option>
            </select>
            <div class="flex gap-2">
                <Input v-if="personagemId === null" v-model="nome" :class="[campo, 'flex-1']" placeholder="Nome" aria-label="Nome" />
                <Input v-model="iniciativa" :class="[campo, personagemId === null ? 'w-20' : 'flex-1']" inputmode="decimal" placeholder="Iniciativa" aria-label="Iniciativa" />
                <Button type="submit" size="icon" class="size-8 shrink-0 bg-ouro-500 text-preto-950 hover:bg-ouro-400" aria-label="Adicionar"><Plus class="size-4" /></Button>
            </div>
        </form>
    </section>
</template>

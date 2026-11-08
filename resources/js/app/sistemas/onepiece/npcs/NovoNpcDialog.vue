<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { CATALOGO_NPCS } from './catalogo';
import { camposDeNpcNovo, npcDoModelo, npcEmBranco, type NpcDados } from './ficha';
import { ATRIBUTOS_NPC, comSinal, modificador, ROTULO_ATRIBUTO_NPC, type NpcModelo } from './tipos';

/** "Novo NPC": escolhe um do catálogo (só leitura: o que vai para a mesa é uma cópia editável) ou começa em branco. */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
    'update:open': [boolean] /** O NPC já montado: nome e os campos da ficha (a mesa só os envia ao servidor). */;
    escolher: [nome: string, campos: Record<string, unknown>];
}>();
const entregar = (npc: NpcDados) => emit('escolher', npc.nome, camposDeNpcNovo(npc));

const busca = ref('');
const faccao = ref<'Todos' | NpcModelo['faccao']>('Todos');
const escolhido = ref<NpcModelo | null>(null);
watch(
    () => props.open,
    (aberto) => {
        if (!aberto) return;
        busca.value = '';
        faccao.value = 'Todos';
        escolhido.value = null;
    },
);

const norma = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const lista = computed(() =>
    CATALOGO_NPCS.filter((n) => (faccao.value === 'Todos' || n.faccao === faccao.value) && norma(n.nome).includes(norma(busca.value.trim()))),
);
const adicionar = () => {
    if (!escolhido.value) return;
    entregar(npcDoModelo(escolhido.value));
    emit('update:open', false);
};
const emBranco = () => {
    entregar(npcEmBranco());
    emit('update:open', false);
};
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="max-h-[90vh] sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">Novo NPC</DialogTitle>
                <DialogDescription
                    >Escolha um NPC do catálogo ou comece um em branco. O que vai para a mesa é uma cópia: editá-la não muda o
                    catálogo.</DialogDescription
                >
            </DialogHeader>
            <div class="grid min-h-0 gap-3 sm:grid-cols-[1fr_1.1fr]">
                <div class="flex min-h-0 flex-col gap-2">
                    <div class="flex items-center gap-1.5 rounded-md border border-preto-700 bg-preto-950 px-2">
                        <Search class="size-4 text-preto-400" aria-hidden="true" />
                        <input
                            v-model="busca"
                            type="search"
                            placeholder="Buscar NPC"
                            aria-label="Buscar NPC"
                            class="w-full bg-transparent py-1.5 text-sm focus-visible:outline-none"
                        />
                    </div>
                    <div class="flex gap-1" role="tablist" aria-label="Facção">
                        <button
                            v-for="f in ['Todos', 'Pirata', 'Marinha'] as const"
                            :key="f"
                            type="button"
                            role="tab"
                            :aria-selected="faccao === f"
                            class="rounded-md px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :class="faccao === f ? 'bg-ouro-500 text-preto-950' : 'bg-preto-900 text-preto-300 hover:text-ouro-200'"
                            @click="faccao = f"
                        >
                            {{ f }}
                        </button>
                    </div>
                    <ul class="grid max-h-[46vh] gap-1 overflow-y-auto pr-1">
                        <li v-for="n in lista" :key="n.id">
                            <button
                                type="button"
                                class="flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                                :class="
                                    escolhido?.id === n.id
                                        ? 'border-ouro-400 bg-ouro-500/10'
                                        : 'border-preto-800 bg-preto-900/60 hover:border-preto-600'
                                "
                                @click="escolhido = n"
                                @dblclick="((escolhido = n), adicionar())"
                            >
                                <span class="min-w-0 flex-1 truncate font-medium">{{ n.nome }}</span>
                                <span class="shrink-0 text-xs text-preto-400">ND {{ n.nd }}</span>
                            </button>
                        </li>
                        <li v-if="!lista.length" class="px-1 py-3 text-center text-xs text-preto-500">Nenhum NPC encontrado.</li>
                    </ul>
                    <Button type="button" variant="outline" class="gap-1" @click="emBranco"><Plus class="size-4" /> NPC em branco</Button>
                </div>

                <div class="min-h-0 overflow-y-auto rounded-md border border-preto-800 bg-preto-900/40 p-3 text-sm">
                    <template v-if="escolhido">
                        <h3 class="font-serif text-lg font-semibold text-ouro-300">{{ escolhido.nome }}</h3>
                        <p class="mb-2 text-xs text-preto-400">
                            {{ escolhido.faccao }} · ND {{ escolhido.nd }} · {{ escolhido.xp.toLocaleString('pt-BR') }} XP<template
                                v-if="escolhido.pp"
                            >
                                · {{ escolhido.pp }} PP</template
                            >
                        </p>
                        <p class="mb-1 text-xs">
                            CR <b>{{ escolhido.cr }}</b> · CD <b>{{ escolhido.cd }}</b> · PV <b>{{ escolhido.pv.medio }}</b> ({{
                                escolhido.pv.dados
                            }}) · Prof. <b>{{ comSinal(escolhido.bp) }}</b>
                        </p>
                        <p class="mb-2 text-xs text-preto-300">
                            <template v-for="a in ATRIBUTOS_NPC" :key="a"
                                >{{ ROTULO_ATRIBUTO_NPC[a] }} {{ escolhido.atributos[a] }} ({{ comSinal(modificador(escolhido.atributos[a])) }}) ·
                            </template>
                        </p>
                        <ul class="mb-2 grid gap-0.5 text-xs">
                            <li v-for="a in escolhido.ataques" :key="a.nome">{{ a.nome }}: {{ comSinal(a.bonus) }}, {{ a.dano }} {{ a.tipoDano }}</li>
                        </ul>
                        <p v-if="escolhido.tecnicas.length" class="text-xs text-preto-300">
                            <b>Técnicas:</b> {{ escolhido.tecnicas.map((t) => t.nome).join(', ') }}
                        </p>
                        <p v-if="escolhido.aspectos.length" class="mt-1 text-xs text-preto-300">
                            <b>Aspectos:</b> {{ escolhido.aspectos.map((t) => t.nome).join(', ') }}
                        </p>
                        <Button type="button" class="mt-3 w-full bg-ouro-500 text-preto-950 hover:bg-ouro-400" @click="adicionar"
                            >Adicionar à mesa</Button
                        >
                    </template>
                    <p v-else class="py-8 text-center text-xs text-preto-500">Escolha um NPC da lista para ver o resumo.</p>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>

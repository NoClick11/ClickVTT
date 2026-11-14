<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Coins, Dices, Lock, LockOpen, Package, Trash2 } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import type { LootDto } from '../engine/tipos';

/**
 * O conteúdo de um loot. O jogador vê o que há e pega para um personagem SEU (o servidor decide: se alguém levou antes, a janela se
 * corrige com o conteúdo de agora). O mestre, além disso, monta o loot: itens do catálogo, da aba Itens ou novos, e o dinheiro.
 */
const props = defineProps<{
    open: boolean;
    loot: LootDto | null;
    mestre: boolean;
    /** Personagens que quem abriu pode usar para receber (o mestre vê todos). */
    personagens: { id: number; nome: string }[];
    simbolo: string;
    /** Itens da aba Itens do mestre. */
    itensProprios: { id: number; nome: string }[];
    pegar: (dados: { personagem_id: number; loot_item_id?: number; dinheiro?: boolean; qtd?: number; tudo?: boolean }) => Promise<unknown>;
    adicionar: (dados: {
        origem: 'catalogo' | 'item' | 'novo';
        ref?: string;
        item_id?: number;
        nome?: string;
        descricao?: string;
        peso?: number;
        qtd?: number;
    }) => Promise<unknown>;
    definirQtd: (linha: number, qtd: number) => Promise<unknown>;
    definirDinheiro: (valor: number) => Promise<unknown>;
    /** Jogadores (sem o mestre) para travar o baú do tesouro. */
    jogadores: { id: number; nome: string }[];
    sortear: () => Promise<unknown>;
    configurarBau: (campos: { tesouro?: boolean; jogador_id?: number | null; aberto?: boolean }) => Promise<unknown>;
    carregarCatalogo: () => Promise<{ ref: string; nome: string; categoria: string; raridade: string | null }[]>;
}>();
const emit = defineEmits<{ 'update:open': [boolean] }>();

const personagemId = ref<number | null>(null);
const ocupado = ref(false);
const qtds = ref<Record<number, number>>({});
const qtdDinheiro = ref(1);
const edicaoQtd = ref<Record<number, number>>({});
const novoDinheiro = ref(0);

// Mestre: o que adicionar
const origem = ref<'catalogo' | 'item' | 'novo'>('catalogo');
const catalogo = ref<{ ref: string; nome: string; categoria: string; raridade: string | null }[]>([]);
const filtro = ref('');
const refEscolhida = ref('');
const itemEscolhido = ref<number | null>(null);
const nova = ref({ nome: '', descricao: '', peso: 0 });
const qtdAdicionar = ref(1);

watch(
    () => props.open,
    async (aberto) => {
        if (!aberto) return;
        personagemId.value = props.personagens.find((p) => p.id === personagemId.value)?.id ?? props.personagens[0]?.id ?? null;
        if (props.mestre && !catalogo.value.length) {
            try {
                catalogo.value = await props.carregarCatalogo();
            } catch {
                /* sem catálogo: o mestre ainda pode usar a aba Itens e criar itens novos */
            }
        }
    },
);
watch(
    () => props.loot,
    (l) => {
        if (!l) return;
        novoDinheiro.value = l.dinheiro;
        for (const linha of l.itens) edicaoQtd.value[linha.id] = linha.qtd;
    },
    { immediate: true },
);

const filtrados = computed(() => {
    const f = filtro.value.trim().toLowerCase();

    return catalogo.value.filter((i) => !f || i.nome.toLowerCase().includes(f)).slice(0, 60);
});
const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR');
const podePegar = computed(() => personagemId.value !== null && !ocupado.value);

/** Uma ação por vez: clicar duas vezes seguidas não manda dois pedidos. */
async function executar(fn: () => Promise<unknown>) {
    if (ocupado.value) return;
    ocupado.value = true;
    try {
        await fn();
    } finally {
        ocupado.value = false;
    }
}
const limite = (v: number | undefined, max: number) => Math.max(1, Math.min(max, Math.floor(Number(v) || 1)));

const pegarItem = (linhaId: number, qtd: number, tudo = false) =>
    executar(() => props.pegar({ personagem_id: personagemId.value!, loot_item_id: linhaId, qtd, tudo }));
const pegarDinheiro = (tudo = false) =>
    executar(() =>
        props.pegar({ personagem_id: personagemId.value!, dinheiro: true, qtd: Math.max(1, Math.floor(Number(qtdDinheiro.value) || 1)), tudo }),
    );

function adicionar() {
    const qtd = limite(qtdAdicionar.value, 100000);
    if (origem.value === 'catalogo' && refEscolhida.value)
        return executar(() => props.adicionar({ origem: 'catalogo', ref: refEscolhida.value, qtd }));
    if (origem.value === 'item' && itemEscolhido.value)
        return executar(() => props.adicionar({ origem: 'item', item_id: itemEscolhido.value!, qtd }));
    if (origem.value === 'novo' && nova.value.nome.trim()) {
        const n = nova.value;
        return executar(async () => {
            await props.adicionar({
                origem: 'novo',
                nome: n.nome.trim(),
                descricao: n.descricao.trim() || undefined,
                peso: Number(n.peso) || 0,
                qtd,
            });
            nova.value = { nome: '', descricao: '', peso: 0 };
        });
    }
}
const campo =
    'flex h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="max-h-[88vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
                <DialogTitle class="font-serif text-xl">{{ loot?.nome || 'Loot' }}</DialogTitle>
                <DialogDescription>
                    {{ mestre ? 'Monte o que há aqui. Os jogadores pegam o que quiserem.' : 'Escolha o que levar para o seu personagem.' }}
                </DialogDescription>
            </DialogHeader>

            <p v-if="!loot" class="py-6 text-center text-sm text-preto-400">Abrindo…</p>
            <template v-else>
                <label v-if="personagens.length > 1" class="flex items-center gap-2 text-sm">
                    <span class="text-preto-300">Pegar para</span>
                    <select v-model="personagemId" :class="campo" aria-label="Personagem que recebe">
                        <option v-for="p in personagens" :key="p.id" :value="p.id">{{ p.nome }}</option>
                    </select>
                </label>
                <p v-else-if="!personagens.length" class="rounded-md border border-ouro-500/30 bg-ouro-500/10 px-3 py-2 text-sm text-ouro-100">
                    Você não tem personagem para receber.
                </p>

                <section
                    v-if="mestre"
                    class="flex items-center gap-3 rounded-md border px-3 py-2"
                    :class="loot.aberto ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-ouro-500/30 bg-ouro-500/10'"
                    aria-label="Estado do loot"
                >
                    <component
                        :is="loot.aberto ? LockOpen : Lock"
                        class="size-4 shrink-0"
                        :class="loot.aberto ? 'text-emerald-300' : 'text-ouro-400'"
                        aria-hidden="true"
                    />
                    <span class="flex-1 text-sm">
                        <b>{{ loot.aberto ? 'Aberto' : 'Fechado' }}</b>
                        <span class="text-preto-300">
                            {{
                                loot.aberto
                                    ? ': os jogadores podem abrir e pegar.'
                                    : ': os jogadores não conseguem abrir. Monte em paz e abra quando quiser.'
                            }}
                        </span>
                    </span>
                    <Button
                        size="sm"
                        :variant="loot.aberto ? 'secondary' : 'default'"
                        :disabled="ocupado"
                        @click="executar(() => configurarBau({ aberto: !loot!.aberto }))"
                    >
                        {{ loot.aberto ? 'Fechar' : 'Abrir para os jogadores' }}
                    </Button>
                </section>

                <section v-if="loot.tesouro" class="space-y-2 rounded-md border border-ouro-500/30 bg-ouro-500/5 px-3 py-2" aria-label="Tesouro">
                    <div class="flex items-center gap-2">
                        <Dices class="size-4 text-ouro-400" aria-hidden="true" />
                        <span class="flex-1 text-sm">
                            <template v-if="loot.sorteio">
                                Tirou <b>{{ loot.sorteio.d100 }}</b> no d100: {{ loot.sorteio.texto }}
                            </template>
                            <template v-else>Baú do tesouro: role o d100 para descobrir o que há dentro.</template>
                        </span>
                        <Button v-if="!loot.sorteio || mestre" size="sm" :disabled="ocupado" @click="executar(sortear)">
                            {{ loot.sorteio ? 'Sortear de novo' : 'Sortear tesouro' }}
                        </Button>
                    </div>
                    <p v-if="loot.sorteio?.manual" class="text-xs text-ouro-100">Este prêmio o mestre entrega depois.</p>
                </section>

                <section class="space-y-2" aria-label="Dinheiro">
                    <div class="flex items-center gap-2 rounded-md border border-preto-800 bg-preto-900/60 px-3 py-2">
                        <Coins class="size-4 text-ouro-400" aria-hidden="true" />
                        <span class="flex-1 text-sm"
                            >{{ simbolo }} <b>{{ fmt(loot.dinheiro) }}</b></span
                        >
                        <template v-if="loot.dinheiro > 0">
                            <Input
                                v-model.number="qtdDinheiro"
                                type="number"
                                min="1"
                                :max="loot.dinheiro"
                                class="h-8 w-24"
                                aria-label="Quanto pegar"
                            />
                            <Button size="sm" variant="secondary" :disabled="!podePegar" @click="pegarDinheiro(false)">Pegar</Button>
                            <Button size="sm" :disabled="!podePegar" @click="pegarDinheiro(true)">Tudo</Button>
                        </template>
                        <span v-else class="text-xs text-preto-500">nada</span>
                    </div>
                </section>

                <section class="space-y-1.5" aria-label="Itens">
                    <p
                        v-if="!loot.itens.length"
                        class="rounded-md border border-dashed border-preto-800 px-3 py-4 text-center text-sm text-preto-500"
                    >
                        Nenhum item aqui.
                    </p>
                    <div v-for="l in loot.itens" :key="l.id" class="rounded-md border border-preto-800 bg-preto-900/60 px-3 py-2">
                        <div class="flex items-center gap-2">
                            <Package class="size-4 shrink-0 text-preto-400" aria-hidden="true" />
                            <span class="min-w-0 flex-1 truncate text-sm font-medium" :title="l.item.nome">{{ l.item.nome }}</span>
                            <span class="text-xs text-preto-400">× {{ fmt(l.qtd) }}</span>
                            <template v-if="!mestre || personagens.length">
                                <Input
                                    v-if="l.qtd > 1"
                                    v-model.number="qtds[l.id]"
                                    type="number"
                                    min="1"
                                    :max="l.qtd"
                                    class="h-8 w-16"
                                    :aria-label="`Quantos ${l.item.nome} pegar`"
                                />
                                <Button size="sm" variant="secondary" :disabled="!podePegar" @click="pegarItem(l.id, limite(qtds[l.id], l.qtd))"
                                    >Pegar</Button
                                >
                                <Button v-if="l.qtd > 1" size="sm" :disabled="!podePegar" @click="pegarItem(l.id, l.qtd, true)">Tudo</Button>
                            </template>
                        </div>
                        <p v-if="l.item.descricao" class="mt-1 line-clamp-2 pl-6 text-xs text-preto-400">{{ l.item.descricao }}</p>
                        <div v-if="mestre" class="mt-1.5 flex items-center gap-2 pl-6">
                            <Input
                                v-model.number="edicaoQtd[l.id]"
                                type="number"
                                min="0"
                                class="h-7 w-20"
                                :aria-label="`Quantidade de ${l.item.nome} no loot`"
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                class="h-7"
                                :disabled="ocupado"
                                @click="executar(() => definirQtd(l.id, Math.max(0, Math.floor(Number(edicaoQtd[l.id]) || 0))))"
                                >Definir</Button
                            >
                            <Button
                                size="sm"
                                variant="ghost"
                                class="h-7 text-red-300"
                                :disabled="ocupado"
                                :aria-label="`Remover ${l.item.nome}`"
                                @click="executar(() => definirQtd(l.id, 0))"
                            >
                                <Trash2 class="size-3.5" />
                            </Button>
                        </div>
                    </div>
                </section>

                <section v-if="mestre" class="space-y-3 border-t border-preto-800 pt-3" aria-label="Montar o loot">
                    <p class="text-[11px] font-semibold uppercase tracking-wider text-ouro-400">Montar</p>
                    <div class="flex items-center gap-2">
                        <span class="text-sm text-preto-300">Dinheiro no loot</span>
                        <Input v-model.number="novoDinheiro" type="number" min="0" class="h-8 w-32" aria-label="Dinheiro no loot" />
                        <Button
                            size="sm"
                            variant="outline"
                            :disabled="ocupado"
                            @click="executar(() => definirDinheiro(Math.max(0, Math.floor(Number(novoDinheiro) || 0))))"
                            >Definir</Button
                        >
                    </div>

                    <div class="flex flex-wrap items-center gap-3">
                        <label class="flex items-center gap-2 text-sm text-preto-300">
                            <input
                                type="checkbox"
                                :checked="loot.tesouro"
                                :disabled="ocupado"
                                @change="executar(() => configurarBau({ tesouro: ($event.target as HTMLInputElement).checked }))"
                            />
                            Baú do tesouro (d100)
                        </label>
                        <label v-if="loot.tesouro" class="flex items-center gap-2 text-sm text-preto-300">
                            Travar para
                            <select
                                :value="loot.jogador_id ?? ''"
                                :class="campo"
                                aria-label="Jogador que pode abrir o baú"
                                @change="
                                    executar(() =>
                                        configurarBau({
                                            jogador_id: ($event.target as HTMLSelectElement).value
                                                ? Number(($event.target as HTMLSelectElement).value)
                                                : null,
                                        }),
                                    )
                                "
                            >
                                <option value="">Qualquer jogador</option>
                                <option v-for="j in jogadores" :key="j.id" :value="j.id">{{ j.nome }}</option>
                            </select>
                        </label>
                    </div>

                    <div class="flex gap-1" role="tablist" aria-label="De onde vem o item">
                        <button
                            v-for="o in [
                                { id: 'catalogo', t: 'Catálogo' },
                                { id: 'item', t: 'Meus itens' },
                                { id: 'novo', t: 'Novo item' },
                            ] as const"
                            :key="o.id"
                            type="button"
                            role="tab"
                            :aria-selected="origem === o.id"
                            class="rounded-md px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :class="origem === o.id ? 'bg-ouro-500 text-preto-950' : 'bg-preto-800 text-preto-200 hover:bg-preto-700'"
                            @click="origem = o.id"
                        >
                            {{ o.t }}
                        </button>
                    </div>

                    <div v-if="origem === 'catalogo'" class="space-y-1.5">
                        <Input v-model="filtro" placeholder="Buscar no catálogo…" class="h-8" aria-label="Buscar no catálogo" />
                        <select v-model="refEscolhida" size="6" :class="[campo, 'h-auto w-full py-1']" aria-label="Item do catálogo">
                            <option v-for="i in filtrados" :key="i.ref" :value="i.ref">{{ i.nome }}{{ i.raridade ? ` · ${i.raridade}` : '' }}</option>
                        </select>
                    </div>
                    <div v-else-if="origem === 'item'">
                        <select v-model="itemEscolhido" size="6" :class="[campo, 'h-auto w-full py-1']" aria-label="Item da aba Itens">
                            <option v-for="i in itensProprios" :key="i.id" :value="i.id">{{ i.nome }}</option>
                        </select>
                        <p v-if="!itensProprios.length" class="mt-1 text-xs text-preto-500">Você ainda não criou itens na aba Itens.</p>
                    </div>
                    <div v-else class="space-y-1.5">
                        <Input v-model="nova.nome" placeholder="Nome do item" maxlength="120" class="h-8" aria-label="Nome do novo item" />
                        <textarea
                            v-model="nova.descricao"
                            rows="2"
                            maxlength="2000"
                            placeholder="Descrição (opcional)"
                            :class="[campo, 'h-auto w-full py-1.5']"
                            aria-label="Descrição do novo item"
                        />
                        <label class="flex items-center gap-2 text-xs text-preto-300"
                            >Peso (kg)
                            <Input v-model.number="nova.peso" type="number" min="0" step="0.1" class="h-8 w-24" />
                        </label>
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="flex items-center gap-2 text-sm text-preto-300"
                            >Quantidade
                            <Input v-model.number="qtdAdicionar" type="number" min="1" class="h-8 w-20" />
                        </label>
                        <Button size="sm" :disabled="ocupado" @click="adicionar">Adicionar ao loot</Button>
                    </div>
                </section>
            </template>
        </DialogContent>
    </Dialog>
</template>

<script setup lang="ts">
import { Store, X } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { MIME_LOJA } from '../../../nucleo/itens/arrastar';
import type { ItemDeCatalogoDto, LojaDoJogadorDto } from '../../../tipos-mesa';
import { CATALOGO_DE_ITENS, CATEGORIAS, type CategoriaId, type ItemDoCatalogo, type Raridade } from './index';
import { buscarNoCatalogo, categoriaPorId, pesoFormatado, raridadePorId } from './regras';

/**
 * Loja aberta pelo mestre para este jogador (painel flutuante, sem bloquear a tela). Compra por botão ou arrastando o item para
 * a janela da ficha. O preço é o do livro vezes o ajuste do mestre; sem Belly suficiente, avisa e não compra. Quem confere de
 * verdade é o servidor.
 */
const props = defineProps<{
    loja: LojaDoJogadorDto;
    /** Personagens que este jogador controla. */
    personagens: { id: number; nome: string }[];
    fichas: Record<number, Record<string, unknown>>;
    comprar: (dados: { personagem_id: number; item: string; qtd: number }) => Promise<{ total: number; saldo: number }>;
}>();
const emit = defineEmits<{ fechar: [] }>();

const personagemId = ref<number>(props.personagens[0]?.id ?? 0);
watch(
    () => props.personagens,
    (l) => {
        if (!l.some((p) => p.id === personagemId.value)) personagemId.value = l[0]?.id ?? 0;
    },
);
const saldo = computed(() => Number((props.fichas[personagemId.value] as { belly?: number } | undefined)?.belly ?? 0));
const dinheiro = (n: number) => `฿ ${Math.round(n).toLocaleString('pt-BR')}`;

const texto = ref('');
const categoria = ref<CategoriaId | ''>('');
const quantidades = ref<Record<string, number>>({});
const aviso = ref<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
const comprando = ref<string | null>(null);

/** Os itens do mestre desta loja, no formato do catálogo. */
const doMestre = computed<ItemDoCatalogo[]>(() =>
    props.loja.itens.map((i: ItemDeCatalogoDto) => ({
        id: `c:${i.id}`,
        nome: i.nome,
        categoria: i.categoria as CategoriaId,
        tipo: 'item',
        raridade: i.raridade as Raridade,
        preco: i.preco,
        peso: i.peso,
        descricao: i.descricao ?? '',
        equipavel: i.equipavel,
        loja: true,
    })),
);
const categoriasDaLoja = computed(() => CATEGORIAS.filter((c) => props.loja.categorias.includes(c.id)));
const lista = computed(() =>
    buscarNoCatalogo({ texto: texto.value, categoria: categoria.value, soItens: true, soLoja: true }, [
        ...doMestre.value,
        ...CATALOGO_DE_ITENS,
    ]).filter((i) => props.loja.categorias.includes(i.categoria) && i.preco !== null),
);
const qtd = (id: string) => Math.max(1, Math.min(99, Math.floor(quantidades.value[id] ?? 1)));
/** Preço de venda ao jogador: o do catálogo vezes o ajuste da loja (%), para cima, como o servidor. */
const precoUnitario = (i: ItemDoCatalogo) => Math.ceil(((i.preco ?? 0) * props.loja.fator) / 100);
const total = (i: ItemDoCatalogo) => Math.ceil(((i.preco ?? 0) * qtd(i.id) * props.loja.fator) / 100);

async function comprarItem(i: ItemDoCatalogo) {
    aviso.value = null;
    if (!personagemId.value) return (aviso.value = { tipo: 'erro', texto: 'Você não tem um personagem para comprar.' });
    const custo = total(i);
    if (saldo.value < custo) {
        return (aviso.value = { tipo: 'erro', texto: `Sem dinheiro: ${i.nome} custa ${dinheiro(custo)} e você tem ${dinheiro(saldo.value)}.` });
    }
    comprando.value = i.id;
    try {
        const r = await props.comprar({ personagem_id: personagemId.value, item: i.id, qtd: qtd(i.id) });
        aviso.value = { tipo: 'ok', texto: `Comprou ${qtd(i.id)}× ${i.nome} por ${dinheiro(r.total)}. Saldo: ${dinheiro(r.saldo)}.` };
    } catch (e) {
        aviso.value = { tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível comprar.' };
    } finally {
        comprando.value = null;
    }
}

function arrastar(e: DragEvent, i: ItemDoCatalogo) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData(MIME_LOJA, i.id);
    e.dataTransfer.setData('text/plain', i.nome);
    e.dataTransfer.effectAllowed = 'copy';
}

const COR: Record<Raridade, string> = {
    comum: 'border-preto-500 text-preto-200',
    incomum: 'border-green-400/60 text-green-200',
    raro: 'border-sky-400/60 text-sky-200',
    'mercado-negro': 'border-red-400/60 text-red-200',
};
const campo = 'rounded border border-preto-700 bg-preto-950 px-2 py-1 text-xs focus-visible:border-ouro-400 focus-visible:outline-none';
</script>

<template>
    <aside
        class="fixed bottom-3 right-3 top-16 z-40 flex w-[27rem] max-w-[calc(100vw-1.5rem)] flex-col gap-2 rounded-xl border border-ouro-500/40 bg-preto-900/95 p-3 text-preto-100 shadow-2xl backdrop-blur"
        aria-label="Loja"
    >
        <header class="flex items-center gap-2">
            <Store class="size-5 text-ouro-300" aria-hidden="true" />
            <h2 class="flex-1 font-serif text-lg font-semibold text-ouro-200">Loja</h2>
            <button type="button" class="rounded p-1 text-preto-400 hover:text-preto-100" aria-label="Esconder a loja" @click="emit('fechar')">
                <X class="size-4" />
            </button>
        </header>
        <div class="flex flex-wrap items-center gap-2 text-xs">
            <label v-if="personagens.length > 1" class="flex items-center gap-1 text-preto-300"
                >Comprar para
                <select v-model.number="personagemId" :class="campo" aria-label="Personagem que compra">
                    <option v-for="p in personagens" :key="p.id" :value="p.id">{{ p.nome }}</option>
                </select>
            </label>
            <span v-else-if="personagens[0]" class="text-preto-300">{{ personagens[0].nome }}</span>
            <span class="ml-auto font-semibold tabular-nums text-ouro-200" aria-label="Seu dinheiro">{{ dinheiro(saldo) }}</span>
        </div>
        <p v-if="loja.fator !== 100" class="text-[11px] text-ouro-300">Preços ajustados pelo mestre: {{ loja.fator }}% do valor do livro.</p>
        <div class="flex flex-wrap gap-1.5">
            <input v-model="texto" type="search" placeholder="Buscar" :class="campo" class="min-w-24 flex-1" aria-label="Buscar na loja" />
            <select v-model="categoria" :class="campo" aria-label="Categoria">
                <option value="">Todas</option>
                <option v-for="c in categoriasDaLoja" :key="c.id" :value="c.id">{{ c.nome }}</option>
            </select>
        </div>
        <p
            v-if="aviso"
            class="rounded border px-2 py-1 text-xs"
            :class="aviso.tipo === 'ok' ? 'border-green-400/50 bg-green-500/10 text-green-200' : 'border-red-400/50 bg-red-500/10 text-red-200'"
            role="status"
        >
            {{ aviso.texto }}
        </p>
        <p class="text-[11px] text-preto-500">Clique em Comprar ou arraste o item para a janela da ficha.</p>
        <ul class="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            <li v-if="!lista.length" class="py-6 text-center text-xs text-preto-400">Nada à venda por aqui.</li>
            <li
                v-for="i in lista"
                :key="i.id"
                draggable="true"
                class="cursor-grab rounded-md border border-preto-800 bg-preto-950/70 p-2 active:cursor-grabbing"
                @dragstart="arrastar($event, i)"
            >
                <div class="flex items-start gap-2">
                    <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-semibold text-ouro-100" :title="i.descricao">{{ i.nome }}</p>
                        <p class="text-[11px] text-preto-400">
                            {{ categoriaPorId(i.categoria)?.nome }} · {{ pesoFormatado(i) }}
                            <span class="ml-1 rounded-full border px-1.5" :class="COR[i.raridade]">{{ raridadePorId(i.raridade)?.nome }}</span>
                        </p>
                    </div>
                    <span class="text-sm font-semibold tabular-nums" :class="saldo < total(i) ? 'text-red-300' : 'text-ouro-200'">{{
                        dinheiro(precoUnitario(i))
                    }}</span>
                </div>
                <div class="mt-1.5 flex items-center gap-2">
                    <input
                        v-model.number="quantidades[i.id]"
                        type="number"
                        min="1"
                        max="99"
                        :class="campo"
                        class="w-14"
                        :placeholder="'1'"
                        :aria-label="`Quantidade de ${i.nome}`"
                    />
                    <span v-if="qtd(i.id) > 1" class="text-[11px] text-preto-400">total {{ dinheiro(total(i)) }}</span>
                    <button
                        type="button"
                        class="ml-auto rounded-md border border-ouro-500/60 px-3 py-1 text-xs font-semibold text-ouro-100 hover:bg-ouro-500/20 disabled:opacity-50"
                        :disabled="comprando === i.id"
                        @click="comprarItem(i)"
                    >
                        Comprar
                    </button>
                </div>
            </li>
        </ul>
    </aside>
</template>

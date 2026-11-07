<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pencil, Plus, Store } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { ItemDeCatalogoDto, LojaAbertaDto } from '../../../tipos-mesa';
import { CATALOGO_DE_ITENS, CATEGORIAS, RARIDADES, type CategoriaId, type ItemDoCatalogo, type Raridade } from './index';
import { buscarNoCatalogo, categoriaPorId, pesoFormatado, precoDeVenda, precoFormatado, raridadePorId } from './regras';

/**
 * Catálogo e loja do One Piece (só o mestre). Aba Catálogo: consulta os itens do livro e cria/edita os seus próprios (que também
 * entram na loja). Aba Loja: abre a loja para jogadores específicos ou todos, escolhendo as categorias à venda. Os itens
 * comprados NÃO entram na aba Itens da mesa: ela fica para os itens específicos que o mestre cria.
 */
const props = defineProps<{
    open: boolean;
    jogadores: { id: number; nome: string }[];
    lojas: LojaAbertaDto[];
    proprios: ItemDeCatalogoDto[];
    abrirLoja: (dados: { jogadores: 'todos' | number[]; categorias: string[]; raridades: string[]; fator: number }) => Promise<void>;
    fecharLoja: (jogadores: 'todos' | number[]) => Promise<void>;
}>();
const emit = defineEmits<{ 'update:open': [boolean]; editar: [id: number | null] }>();

const aba = ref<'catalogo' | 'loja'>('catalogo');

// --- catálogo ---------------------------------------------------------------------------------------------------------
const texto = ref('');
const categoria = ref<CategoriaId | ''>('');
const raridade = ref<Raridade | ''>('');
const aberto = ref<string | null>(null);
const grupos = [...new Set(CATEGORIAS.map((c) => c.grupo))];

/** Os itens do mestre no mesmo formato do catálogo do livro. */
const doMestre = computed<ItemDoCatalogo[]>(() =>
    props.proprios.map((i) => ({
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
const lista = computed(() =>
    buscarNoCatalogo({ texto: texto.value, categoria: categoria.value, raridade: raridade.value }, [...doMestre.value, ...CATALOGO_DE_ITENS]),
);
const meu = (id: string) => id.startsWith('c:');

// --- loja -------------------------------------------------------------------------------------------------------------
/** Hospedagem e estilo de vida são despesas, não itens: não entram na loja. */
const CATEGORIAS_DA_LOJA = CATEGORIAS.filter((c) => !['hospedagem', 'estilo-de-vida'].includes(c.id));
const quem = ref<number[]>([]);
const categoriasEscolhidas = ref<string[]>([]);
/** Raridades à venda: por padrão, todas. */
const raridadesEscolhidas = ref<string[]>(RARIDADES.map((r) => r.id));
const alternarRaridade = (id: string) =>
    (raridadesEscolhidas.value = raridadesEscolhidas.value.includes(id)
        ? raridadesEscolhidas.value.filter((x) => x !== id)
        : [...raridadesEscolhidas.value, id]);
const todasAsCategorias = () =>
    (categoriasEscolhidas.value = categoriasEscolhidas.value.length === CATEGORIAS_DA_LOJA.length ? [] : CATEGORIAS_DA_LOJA.map((c) => c.id));
const fator = ref(100);
const mensagem = ref('');
const ocupado = ref(false);

const todosMarcados = computed(() => props.jogadores.length > 0 && quem.value.length === props.jogadores.length);
const alternarTodos = () => (quem.value = todosMarcados.value ? [] : props.jogadores.map((j) => j.id));
const alternarJogador = (id: number) => (quem.value = quem.value.includes(id) ? quem.value.filter((x) => x !== id) : [...quem.value, id]);
const marcarGrupo = (g: string) => {
    const ids = CATEGORIAS_DA_LOJA.filter((c) => c.grupo === g).map((c) => c.id as string);
    const todos = ids.every((id) => categoriasEscolhidas.value.includes(id));
    categoriasEscolhidas.value = todos
        ? categoriasEscolhidas.value.filter((id) => !ids.includes(id))
        : [...new Set([...categoriasEscolhidas.value, ...ids])];
};
const nomeDe = (id: number) => props.jogadores.find((j) => j.id === id)?.nome ?? `#${id}`;
const nomeDaCategoria = (id: string) => categoriaPorId(id as CategoriaId)?.nome ?? id;

async function abrirAgora() {
    mensagem.value = '';
    if (!quem.value.length) return (mensagem.value = 'Escolha para quem a loja abre.');
    if (!categoriasEscolhidas.value.length) return (mensagem.value = 'Escolha ao menos uma categoria.');
    if (!raridadesEscolhidas.value.length) return (mensagem.value = 'Escolha ao menos uma raridade.');
    ocupado.value = true;
    try {
        await props.abrirLoja({
            jogadores: todosMarcados.value ? 'todos' : quem.value,
            categorias: categoriasEscolhidas.value,
            raridades: raridadesEscolhidas.value.length === RARIDADES.length ? [] : raridadesEscolhidas.value,
            fator: Math.max(1, Math.floor(Number(fator.value) || 100)),
        });
        mensagem.value = 'Loja aberta.';
    } catch (e) {
        mensagem.value = e instanceof Error ? e.message : 'Não foi possível abrir a loja.';
    } finally {
        ocupado.value = false;
    }
}
async function fechar(jogadores: 'todos' | number[]) {
    ocupado.value = true;
    try {
        await props.fecharLoja(jogadores);
    } catch (e) {
        mensagem.value = e instanceof Error ? e.message : 'Não foi possível fechar a loja.';
    } finally {
        ocupado.value = false;
    }
}

const COR: Record<Raridade, string> = {
    comum: 'border-preto-500 text-preto-200',
    incomum: 'border-green-400/60 text-green-200',
    raro: 'border-sky-400/60 text-sky-200',
    'mercado-negro': 'border-red-400/60 text-red-200',
};
const campo = 'rounded border border-preto-700 bg-preto-950 px-2 py-1.5 text-sm focus-visible:border-ouro-400 focus-visible:outline-none';
const aba_ = (ativa: boolean) =>
    [
        'rounded-md border px-3 py-1 text-sm font-semibold',
        ativa ? 'border-ouro-400 bg-ouro-500/20 text-ouro-100' : 'border-preto-600 text-preto-300 hover:bg-preto-800',
    ].join(' ');
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="flex h-[90vh] max-w-4xl flex-col gap-2 overflow-hidden border-ouro-500/30 bg-preto-900 p-4 text-preto-100">
            <DialogHeader class="space-y-0">
                <DialogTitle class="font-serif text-ouro-200">Catálogo e loja</DialogTitle>
                <DialogDescription class="text-xs text-preto-400">
                    O catálogo do livro (Cap. 8) mais os itens que você criar. Os itens comprados vão direto para o inventário do jogador e não
                    aparecem na aba Itens.
                </DialogDescription>
            </DialogHeader>
            <div class="flex gap-2" role="tablist">
                <button type="button" role="tab" :aria-selected="aba === 'catalogo'" :class="aba_(aba === 'catalogo')" @click="aba = 'catalogo'">
                    Catálogo
                </button>
                <button type="button" role="tab" :aria-selected="aba === 'loja'" :class="aba_(aba === 'loja')" @click="aba = 'loja'">
                    <Store class="mr-1 inline size-3.5" aria-hidden="true" /> Abrir loja
                    <span v-if="lojas.length" class="ml-1 rounded-full bg-green-500/30 px-1.5 text-[11px] text-green-200"
                        >{{ lojas.length }} aberta(s)</span
                    >
                </button>
            </div>

            <!-- Catálogo -->
            <template v-if="aba === 'catalogo'">
                <div class="flex flex-wrap gap-2">
                    <input
                        v-model="texto"
                        type="search"
                        placeholder="Buscar por nome, apelido ou texto"
                        :class="campo"
                        class="min-w-48 flex-1"
                        aria-label="Buscar no catálogo"
                    />
                    <select v-model="categoria" :class="campo" aria-label="Categoria">
                        <option value="">Todas as categorias</option>
                        <optgroup v-for="g in grupos" :key="g" :label="g">
                            <option v-for="c in CATEGORIAS.filter((x) => x.grupo === g)" :key="c.id" :value="c.id">{{ c.nome }}</option>
                        </optgroup>
                    </select>
                    <select v-model="raridade" :class="campo" aria-label="Raridade">
                        <option value="">Qualquer raridade</option>
                        <option v-for="r in RARIDADES" :key="r.id" :value="r.id" :title="r.descricao">{{ r.nome }}</option>
                    </select>
                    <button
                        type="button"
                        class="flex items-center gap-1 rounded-md bg-ouro-500 px-3 py-1.5 text-sm font-semibold text-preto-950 hover:bg-ouro-400"
                        @click="emit('editar', null)"
                    >
                        <Plus class="size-4" aria-hidden="true" /> Criar item
                    </button>
                </div>
                <p class="text-xs text-preto-400">{{ lista.length }} entradas · {{ proprios.length }} criada(s) por você</p>
                <ul class="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                    <li v-if="!lista.length" class="py-8 text-center text-sm text-preto-400">Nada encontrado.</li>
                    <li v-for="i in lista" :key="i.id" class="rounded-md border border-preto-800 bg-preto-950/60 p-2">
                        <div class="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                class="min-w-0 flex-1 text-left"
                                :aria-expanded="aberto === i.id"
                                @click="aberto = aberto === i.id ? null : i.id"
                            >
                                <span class="font-semibold text-ouro-100">{{ i.nome }}</span>
                                <span v-if="i.apelidos?.length" class="text-xs text-preto-400"> / {{ i.apelidos.join(' / ') }}</span>
                                <span v-if="meu(i.id)" class="ml-1 rounded bg-ouro-500/20 px-1 text-[10px] text-ouro-200">seu</span>
                                <span class="block text-xs text-preto-400">{{ categoriaPorId(i.categoria)?.nome }}</span>
                            </button>
                            <span
                                class="rounded-full border px-2 py-0.5 text-[11px]"
                                :class="COR[i.raridade]"
                                :title="raridadePorId(i.raridade)?.descricao"
                                >{{ raridadePorId(i.raridade)?.nome }}</span
                            >
                            <span class="text-xs tabular-nums text-ouro-200">{{ precoFormatado(i) }}</span>
                            <span class="w-16 text-right text-xs tabular-nums text-preto-400">{{ pesoFormatado(i) }}</span>
                            <span v-if="i.tipo === 'servico'" class="text-[11px] text-preto-500">serviço</span>
                            <button
                                v-if="meu(i.id)"
                                type="button"
                                class="rounded border border-preto-600 p-1 text-preto-300 hover:text-ouro-200"
                                aria-label="Editar item"
                                @click="emit('editar', Number(i.id.slice(2)))"
                            >
                                <Pencil class="size-3.5" aria-hidden="true" />
                            </button>
                        </div>
                        <div v-if="aberto === i.id" class="mt-2 grid gap-1 text-xs text-preto-300">
                            <p class="whitespace-pre-wrap">{{ i.descricao }}</p>
                            <template v-if="i.arma">
                                <p>
                                    <strong class="text-preto-100">Dano:</strong>
                                    {{
                                        i.arma.dano
                                            ? `${i.arma.dano} ${i.arma.tipoDano}`
                                            : i.arma.marcial
                                              ? `dano desarmado +1 passo (${i.arma.tipoDano})`
                                              : i.arma.tipoDano
                                    }}
                                    <template v-if="i.arma.tiposAlternativos?.length"> (ou {{ i.arma.tiposAlternativos.join(' / ') }})</template>
                                </p>
                                <p v-if="i.arma.propriedades.length">
                                    <strong class="text-preto-100">Propriedades:</strong> {{ i.arma.propriedades.join(', ') }}
                                </p>
                                <p v-if="i.arma.expertise"><strong class="text-preto-100">Expertise:</strong> {{ i.arma.expertise }}</p>
                            </template>
                            <p v-if="precoDeVenda(i) !== null" class="text-preto-400">
                                Venda em bom estado: ฿ {{ precoDeVenda(i)!.toLocaleString('pt-BR') }}.
                            </p>
                        </div>
                    </li>
                </ul>
            </template>

            <!-- Loja -->
            <div v-else class="grid min-h-0 flex-1 gap-3 overflow-y-auto pr-1">
                <section class="grid gap-2 rounded-lg border border-preto-700 bg-preto-950/60 p-3" aria-label="Quem vê a loja">
                    <h3 class="text-xs font-semibold uppercase tracking-wide text-ouro-300">Para quem</h3>
                    <div class="flex flex-wrap gap-1.5">
                        <button type="button" :class="aba_(todosMarcados)" class="!py-0.5 !text-xs" @click="alternarTodos">Todos os jogadores</button>
                        <button
                            v-for="j in jogadores"
                            :key="j.id"
                            type="button"
                            :aria-pressed="quem.includes(j.id)"
                            :class="aba_(quem.includes(j.id))"
                            class="!py-0.5 !text-xs"
                            @click="alternarJogador(j.id)"
                        >
                            {{ j.nome }}
                        </button>
                        <span v-if="!jogadores.length" class="text-xs text-preto-400">Nenhum jogador na mesa.</span>
                    </div>
                </section>
                <section class="grid gap-2 rounded-lg border border-preto-700 bg-preto-950/60 p-3" aria-label="Categorias da loja">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xs font-semibold uppercase tracking-wide text-ouro-300">Categorias à venda</h3>
                        <button type="button" class="text-xs text-preto-300 hover:text-ouro-200" @click="todasAsCategorias">
                            Marcar/desmarcar todas
                        </button>
                    </div>
                    <div v-for="g in grupos.filter((x) => x !== 'Serviços')" :key="g" class="grid gap-1">
                        <button
                            type="button"
                            class="w-fit text-left text-[11px] font-semibold uppercase tracking-wide text-preto-400 hover:text-ouro-200"
                            @click="marcarGrupo(g)"
                        >
                            {{ g }} (marcar/desmarcar tudo)
                        </button>
                        <div class="flex flex-wrap gap-1.5">
                            <button
                                v-for="c in CATEGORIAS_DA_LOJA.filter((x) => x.grupo === g)"
                                :key="c.id"
                                type="button"
                                :aria-pressed="categoriasEscolhidas.includes(c.id)"
                                :class="aba_(categoriasEscolhidas.includes(c.id))"
                                class="!py-0.5 !text-xs"
                                @click="
                                    categoriasEscolhidas = categoriasEscolhidas.includes(c.id)
                                        ? categoriasEscolhidas.filter((x) => x !== c.id)
                                        : [...categoriasEscolhidas, c.id]
                                "
                            >
                                {{ c.nome }}
                            </button>
                        </div>
                    </div>
                    <p class="text-xs text-preto-400">Os itens que você criou entram na loja pela categoria que escolheu para eles.</p>
                </section>
                <section class="grid gap-2 rounded-lg border border-preto-700 bg-preto-950/60 p-3" aria-label="Raridades da loja">
                    <h3 class="text-xs font-semibold uppercase tracking-wide text-ouro-300">Raridades à venda</h3>
                    <div class="flex flex-wrap gap-1.5">
                        <button
                            v-for="r in RARIDADES"
                            :key="r.id"
                            type="button"
                            :aria-pressed="raridadesEscolhidas.includes(r.id)"
                            :title="r.descricao"
                            :class="aba_(raridadesEscolhidas.includes(r.id))"
                            class="!py-0.5 !text-xs"
                            @click="alternarRaridade(r.id)"
                        >
                            {{ r.nome }}
                        </button>
                    </div>
                    <p class="text-xs text-preto-400">
                        Só entram na loja os itens das categorias marcadas que sejam destas raridades (ex.: tire o Mercado Negro e o Raro para uma
                        vila pequena).
                    </p>
                </section>
                <section class="flex flex-wrap items-end gap-3 rounded-lg border border-preto-700 bg-preto-950/60 p-3">
                    <label class="grid gap-1 text-xs text-preto-300"
                        >Ajuste de preço (%)
                        <input
                            v-model.number="fator"
                            type="number"
                            min="1"
                            max="10000"
                            :class="campo"
                            class="w-28"
                            aria-label="Ajuste de preço em porcentagem"
                        />
                        <span class="text-[11px] text-preto-500">100 = preço do livro; 150 = 50% mais caro; 50 = metade.</span>
                    </label>
                    <button
                        type="button"
                        class="rounded-md bg-ouro-500 px-4 py-2 text-sm font-semibold text-preto-950 hover:bg-ouro-400 disabled:opacity-50"
                        :disabled="ocupado"
                        @click="abrirAgora"
                    >
                        Abrir loja
                    </button>
                    <span v-if="mensagem" class="text-xs text-ouro-200" role="status">{{ mensagem }}</span>
                </section>
                <section v-if="lojas.length" class="grid gap-1.5 rounded-lg border border-green-400/40 bg-green-500/5 p-3" aria-label="Lojas abertas">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xs font-semibold uppercase tracking-wide text-green-300">Lojas abertas</h3>
                        <button
                            type="button"
                            class="rounded border border-red-400/60 px-2 py-0.5 text-xs text-red-200 hover:bg-red-500/20"
                            :disabled="ocupado"
                            @click="fechar('todos')"
                        >
                            Fechar todas
                        </button>
                    </div>
                    <ul class="grid gap-1">
                        <li v-for="l in lojas" :key="l.jogador_id" class="flex flex-wrap items-center gap-2 text-sm">
                            <strong class="text-preto-100">{{ nomeDe(l.jogador_id) }}</strong>
                            <span class="text-xs text-preto-400"
                                >{{ l.categorias.map(nomeDaCategoria).join(', ')
                                }}<template v-if="l.raridades?.length">
                                    · {{ l.raridades.map((r) => raridadePorId(r as Raridade)?.nome).join(', ') }}</template
                                ></span
                            >
                            <span v-if="l.fator !== 100" class="text-xs text-ouro-300">preço {{ l.fator }}%</span>
                            <button
                                type="button"
                                class="ml-auto rounded border border-preto-600 px-2 py-0.5 text-xs text-preto-200 hover:bg-preto-800"
                                :disabled="ocupado"
                                @click="fechar([l.jogador_id])"
                            >
                                Fechar
                            </button>
                        </li>
                    </ul>
                </section>
            </div>
        </DialogContent>
    </Dialog>
</template>

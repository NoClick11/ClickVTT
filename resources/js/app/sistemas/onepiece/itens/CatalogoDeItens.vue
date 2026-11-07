<script setup lang="ts">
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import type { ItemDto, NovoItem } from '../../../tipos-mesa';
import { CATALOGO_DE_ITENS, CATEGORIAS, RARIDADES, type CategoriaId, type ItemDoCatalogo, type Raridade } from './index';
import { buscarNoCatalogo, categoriaPorId, itemParaAMesa, pesoFormatado, precoDeVenda, precoFormatado, raridadePorId } from './regras';

/**
 * Catálogo de itens do One Piece (cap. 8): equipamentos, armas, veículos e serviços com preço, peso e raridade. O mestre
 * adiciona qualquer item à mesa (com a arma ou o escudo já calculados pela ficha) e depois o entrega ao personagem. A loja
 * usará este mesmo catálogo.
 */
const props = defineProps<{ open: boolean; itens: ItemDto[]; adicionar: (item: NovoItem) => Promise<ItemDto> }>();
const emit = defineEmits<{ 'update:open': [boolean] }>();

const CATALOGO_TOTAL = CATALOGO_DE_ITENS.length;
const texto = ref('');
const categoria = ref<CategoriaId | ''>('');
const raridade = ref<Raridade | ''>('');
const aberto = ref<string | null>(null);
const enviando = ref<string | null>(null);
const erro = ref('');
const feitos = ref(new Set<string>());

const lista = computed(() => buscarNoCatalogo({ texto: texto.value, categoria: categoria.value, raridade: raridade.value }));
/** Já existe na mesa (o item guarda de qual entrada do catálogo veio). */
const naMesa = (id: string) =>
    feitos.value.has(id) || props.itens.some((i) => (i.dados as { catalogo?: { id?: string } } | null)?.catalogo?.id === id);
const grupos = computed(() => [...new Set(CATEGORIAS.map((c) => c.grupo))]);

async function adicionarItem(i: ItemDoCatalogo) {
    erro.value = '';
    enviando.value = i.id;
    try {
        await props.adicionar(itemParaAMesa(i));
        feitos.value = new Set([...feitos.value, i.id]);
    } catch {
        erro.value = `Não foi possível adicionar "${i.nome}".`;
    } finally {
        enviando.value = null;
    }
}

const COR: Record<Raridade, string> = {
    comum: 'border-preto-500 text-preto-200',
    incomum: 'border-green-400/60 text-green-200',
    raro: 'border-sky-400/60 text-sky-200',
    'mercado-negro': 'border-red-400/60 text-red-200',
};
const campo = 'rounded border border-preto-700 bg-preto-950 px-2 py-1.5 text-sm focus-visible:border-ouro-400 focus-visible:outline-none';
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="flex h-[90vh] max-w-4xl flex-col gap-2 overflow-hidden border-ouro-500/30 bg-preto-900 p-4 text-preto-100">
            <DialogHeader class="space-y-0">
                <DialogTitle class="font-serif text-ouro-200">Catálogo de itens</DialogTitle>
                <DialogDescription class="text-xs text-preto-400">
                    {{ lista.length }} de {{ CATALOGO_TOTAL }} entradas. Adicione à mesa e depois entregue pelo inventário do personagem. Em bom
                    estado, itens valem metade do preço quando vendidos.
                </DialogDescription>
            </DialogHeader>
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
            </div>
            <p v-if="erro" class="text-xs text-red-300" role="alert">{{ erro }}</p>
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
                        <span v-else-if="naMesa(i.id)" class="text-[11px] text-green-300">na mesa</span>
                        <button
                            v-if="i.tipo === 'item'"
                            type="button"
                            class="flex items-center gap-1 rounded-md border border-ouro-500/60 px-2 py-1 text-xs font-semibold text-ouro-100 hover:bg-ouro-500/20 disabled:opacity-40"
                            :disabled="enviando === i.id"
                            :title="naMesa(i.id) ? 'Adicionar outra cópia' : 'Adicionar à mesa'"
                            @click="adicionarItem(i)"
                        >
                            <Plus class="size-3.5" aria-hidden="true" /> {{ naMesa(i.id) ? 'Outra' : 'Adicionar' }}
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
        </DialogContent>
    </Dialog>
</template>

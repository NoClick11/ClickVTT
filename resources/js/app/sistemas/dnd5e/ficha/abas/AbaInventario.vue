<script setup lang="ts">
import { computed, ref } from 'vue';
import { resumoEfeito } from '../../../../nucleo/efeitos/resumo';
import { clonar } from '../../../../nucleo/ficha/caminho';
import CampoNumero from '../../../../nucleo/ui/CampoNumero.vue';
import { formatoDeResumo } from '../../alvos';
import { estilos, useFicha } from '../../contexto';
import { MAX_SINTONIA, MOEDAS, type FichaDnd5e } from '../../regras';

const props = defineProps<{ ficha: FichaDnd5e }>();
const { editar, calc, salvar, itens, mestre, abrirEditorItem } = useFicha();

const pct = computed(() => (calc.value['carga.max'] > 0 ? Math.min(100, (calc.value['carga.atual'] / calc.value['carga.max']) * 100) : 0));
const peso = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** O inventário é salvo por inteiro: edita-se uma cópia e envia. */
function mudar(fn: (inventario: FichaDnd5e['inventario']) => void) {
    const inventario = clonar(props.ficha.inventario);
    fn(inventario);
    salvar({ inventario });
}

// Itens da mesa que ainda não estão neste inventário (o mestre os entrega).
const sintonizados = computed(() => props.ficha.inventario.reduce((n, s) => n + s.itens.filter((r) => r.sintonizado).length, 0));
const jaTem = computed(() => new Set(props.ficha.inventario.flatMap((s) => s.itens.map((r) => r.item_id))));
const disponiveis = computed(() =>
    Object.values(itens.value)
        .filter((i) => !jaTem.value.has(i.id))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
);
const escolhido = ref<number | ''>('');
const secaoDestino = ref(0);
const SECAO_PADRAO = 'Equipamento';

function colocar(itemId: number) {
    mudar((inv) => {
        if (!inv.length) inv.push({ secao: SECAO_PADRAO, itens: [] });
        inv[Math.min(secaoDestino.value, inv.length - 1)].itens.push({ item_id: itemId, qtd: 1, equipado: false, sintonizado: false });
    });
}
function entregar() {
    if (escolhido.value === '') return;
    colocar(escolhido.value);
    escolhido.value = '';
}

/** O mestre abre o editor completo (efeitos, armadura, arma...) e o item criado já vai para este inventário. */
const criarEEntregar = () => abrirEditorItem(null, (item) => colocar(item.id));

const novaSecao = ref('');
function adicionarSecao() {
    const secao = novaSecao.value.trim();
    if (!secao) return;
    mudar((inv) => inv.push({ secao, itens: [] }));
    novaSecao.value = '';
}
const campo = 'rounded border border-preto-700 bg-preto-950 px-2 py-1 text-xs focus-visible:border-ouro-400 focus-visible:outline-none';
</script>

<template>
    <div class="grid gap-3 p-3">
        <div class="grid gap-3 sm:grid-cols-2">
            <section :class="estilos.cartao" class="p-3" aria-label="Carga">
                <p class="mb-1.5 flex justify-between text-[11px] font-semibold uppercase tracking-wider text-ouro-400">
                    <span>Carga</span
                    ><span class="tabular-nums text-preto-300" title="Capacidade: 15 × Força + ajuste"
                        >{{ peso(calc['carga.atual']) }} / {{ calc['carga.max'] }} kg</span
                    >
                </p>
                <div
                    class="h-2 overflow-hidden rounded-full bg-preto-800"
                    role="progressbar"
                    :aria-valuenow="calc['carga.atual']"
                    aria-valuemin="0"
                    :aria-valuemax="calc['carga.max']"
                    aria-label="Carga"
                >
                    <div
                        class="h-full rounded-full"
                        :class="calc['carga.atual'] > calc['carga.max'] ? 'bg-red-500' : 'bg-ouro-500'"
                        :style="{ width: pct + '%' }"
                    />
                </div>
                <label v-if="editar" class="mt-2 flex items-center justify-between text-xs text-preto-300"
                    >Ajuste da capacidade (kg)
                    <CampoNumero
                        :model-value="ficha.ajustes?.cargaMax ?? 0"
                        :min="-999"
                        :max="999"
                        aria-label="Ajuste da capacidade de carga"
                        :class="estilos.ajuste"
                        @salvar="salvar({ 'ajustes.cargaMax': $event })"
                /></label>
            </section>
            <section :class="estilos.cartao" class="p-3" aria-label="Moedas">
                <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400">Moedas</p>
                <div class="flex justify-between gap-1">
                    <label v-for="m in MOEDAS" :key="m.id" class="flex flex-col items-center gap-0.5 text-center">
                        <span class="text-[10px] font-semibold" :style="{ color: m.cor }" :title="m.nome">{{ m.sigla }}</span>
                        <CampoNumero
                            :model-value="ficha.moedas[m.id]"
                            :min="0"
                            :max="1000000000"
                            :aria-label="m.nome"
                            class="w-11 rounded border border-preto-700 bg-preto-950 py-0.5 text-center text-sm tabular-nums focus-visible:border-ouro-400 focus-visible:outline-none"
                            @salvar="salvar({ [`moedas.${m.id}`]: $event })"
                        />
                    </label>
                </div>
            </section>
        </div>

        <section v-for="(s, si) in ficha.inventario" :key="si" :class="estilos.cartao" :aria-label="s.secao">
            <h3
                class="flex items-center justify-between border-b border-preto-800 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400"
            >
                <span>{{ s.secao }}</span
                ><span class="flex items-center gap-2 text-preto-500"
                    >Qtd · Peso
                    <button
                        v-if="editar && !s.itens.length"
                        type="button"
                        class="normal-case text-preto-500 hover:text-red-300"
                        :aria-label="`Remover seção ${s.secao}`"
                        @click="mudar((inv) => inv.splice(si, 1))"
                    >
                        ✕ seção
                    </button></span
                >
            </h3>
            <ul class="divide-y divide-preto-800/70 text-sm">
                <li v-for="(ref, ri) in s.itens" :key="ri" class="flex items-center gap-3 px-3 py-1.5">
                    <template v-if="itens[ref.item_id]">
                        <button
                            v-if="itens[ref.item_id].equipavel"
                            type="button"
                            class="flex size-4 shrink-0 items-center justify-center rounded border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                            :class="ref.equipado ? 'border-ouro-400 bg-ouro-500/70 text-preto-950' : 'border-preto-600'"
                            :title="ref.equipado ? 'Equipado' : 'Não equipado'"
                            :aria-label="`${itens[ref.item_id].nome}: ${ref.equipado ? 'equipado' : 'não equipado'}`"
                            :aria-pressed="ref.equipado"
                            @click="
                                mudar((inv) => {
                                    const r = inv[si].itens[ri];
                                    r.equipado = !r.equipado;
                                    if (!r.equipado) r.sintonizado = false;
                                })
                            "
                        >
                            <span v-if="ref.equipado" class="text-[10px] font-bold leading-none">✓</span>
                        </button>
                        <span v-else class="size-4 shrink-0" aria-hidden="true" />
                        <span class="min-w-0 flex-1">
                            <span class="flex items-center gap-1.5"
                                ><span class="truncate">{{ itens[ref.item_id].nome }}</span
                                ><button
                                    v-if="editar && mestre"
                                    type="button"
                                    class="shrink-0 text-xs text-preto-500 hover:text-ouro-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                                    :aria-label="`Editar o item ${itens[ref.item_id].nome}`"
                                    title="Editar o item (vale para todos que o têm)"
                                    @click="abrirEditorItem(ref.item_id)"
                                >
                                    ✎
                                </button></span
                            >
                            <span v-if="itens[ref.item_id].descricao" class="block truncate text-xs text-preto-400">{{
                                itens[ref.item_id].descricao
                            }}</span>
                            <span v-if="itens[ref.item_id].efeitos.length" class="mt-0.5 flex flex-wrap gap-1"
                                ><span
                                    v-for="(e, ei) in itens[ref.item_id].efeitos"
                                    :key="ei"
                                    class="rounded bg-preto-800 px-1.5 text-[10px] text-ouro-200"
                                    :class="ref.equipado || !itens[ref.item_id].equipavel ? '' : 'opacity-50'"
                                    >{{ resumoEfeito(e, formatoDeResumo) }}</span
                                ></span
                            >
                        </span>
                        <label
                            v-if="itens[ref.item_id].requer_sintonia && (ref.equipado || !itens[ref.item_id].equipavel)"
                            class="flex shrink-0 items-center gap-1 text-[10px] uppercase text-preto-400"
                            ><input
                                type="checkbox"
                                class="size-3.5 accent-ouro-500"
                                :checked="ref.sintonizado"
                                :disabled="!ref.sintonizado && sintonizados >= MAX_SINTONIA"
                                :title="!ref.sintonizado && sintonizados >= MAX_SINTONIA ? `No máximo ${MAX_SINTONIA} itens sintonizados` : undefined"
                                @change="mudar((inv) => (inv[si].itens[ri].sintonizado = ($event.target as HTMLInputElement).checked))"
                            />
                            sintonia</label
                        >
                    </template>
                    <span v-else class="min-w-0 flex-1 truncate text-preto-500" title="Este item foi excluído da mesa"
                        >Item removido (#{{ ref.item_id }})</span
                    >
                    <CampoNumero
                        :model-value="ref.qtd"
                        :min="0"
                        :max="100000"
                        :aria-label="`Quantidade de ${itens[ref.item_id]?.nome ?? 'item'}`"
                        class="w-10 shrink-0 rounded border border-transparent bg-transparent text-right tabular-nums text-preto-300 focus-visible:border-ouro-400 focus-visible:outline-none"
                        @salvar="mudar((inv) => (inv[si].itens[ri].qtd = $event))"
                    />
                    <span class="w-12 shrink-0 text-right tabular-nums text-preto-400" title="Peso total (quantidade × peso de 1 unidade)">{{
                        peso(ref.qtd * (itens[ref.item_id]?.peso ?? 0))
                    }}</span>
                    <button
                        v-if="editar"
                        type="button"
                        class="shrink-0 text-xs text-preto-500 hover:text-red-300"
                        :aria-label="`Tirar ${itens[ref.item_id]?.nome ?? 'item'} do inventário`"
                        @click="mudar((inv) => inv[si].itens.splice(ri, 1))"
                    >
                        ✕
                    </button>
                </li>
                <li v-if="!s.itens.length" class="px-3 py-2 text-xs text-preto-500">Seção vazia.</li>
            </ul>
        </section>

        <!-- o mestre entrega itens da mesa ou cria um novo no editor -->
        <section v-if="editar && mestre" :class="estilos.cartao" class="grid gap-2 p-3" aria-label="Entregar item">
            <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ouro-400">Entregar item (mestre)</h3>
            <form class="flex flex-wrap gap-1.5" @submit.prevent="entregar">
                <select v-model="escolhido" aria-label="Item da mesa" :class="campo" class="min-w-40 flex-1">
                    <option value="" disabled>{{ disponiveis.length ? 'Escolha um item da mesa…' : 'Nenhum item disponível' }}</option>
                    <option v-for="i in disponiveis" :key="i.id" :value="i.id">{{ i.nome }}</option>
                </select>
                <select v-if="ficha.inventario.length > 1" v-model.number="secaoDestino" aria-label="Seção de destino" :class="campo">
                    <option v-for="(s, si) in ficha.inventario" :key="si" :value="si">{{ s.secao }}</option>
                </select>
                <button
                    type="submit"
                    class="rounded bg-ouro-500 px-3 text-xs font-semibold text-preto-950 hover:bg-ouro-400 disabled:opacity-50"
                    :disabled="escolhido === ''"
                >
                    Entregar
                </button>
            </form>
            <div class="flex items-center justify-between gap-2 border-t border-preto-800 pt-2">
                <span class="text-xs text-preto-400">Precisa de um item que não existe?</span>
                <button
                    type="button"
                    class="rounded border border-ouro-500/50 px-3 py-1 text-xs text-ouro-200 hover:bg-ouro-500/10"
                    @click="criarEEntregar"
                >
                    Criar item e entregar…
                </button>
            </div>
        </section>

        <form v-if="editar" class="flex gap-1.5" @submit.prevent="adicionarSecao">
            <input
                v-model="novaSecao"
                type="text"
                maxlength="80"
                placeholder="Nova seção (ex.: Armas)"
                aria-label="Nome da nova seção"
                :class="campo"
                class="min-w-0 flex-1"
            />
            <button type="submit" class="rounded border border-ouro-500/50 px-3 text-xs text-ouro-200 hover:bg-ouro-500/10">Adicionar seção</button>
        </form>
        <p v-if="!ficha.inventario.length && !editar" class="py-6 text-center text-xs text-preto-500">
            Inventário vazio. O mestre entrega os itens; no modo Editar você organiza as seções.
        </p>
    </div>
</template>

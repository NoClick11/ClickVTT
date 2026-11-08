<script setup lang="ts">
import { computed, ref } from 'vue';
import { resumoEfeito } from '../../../../nucleo/efeitos/resumo';
import { clonar } from '../../../../nucleo/ficha/caminho';
import CampoNumero from '../../../../nucleo/ui/CampoNumero.vue';
import { formatoDeResumo } from '../../alvos';
import { estilos, useFicha } from '../../contexto';
import { itemDoCatalogo } from '../../itens';
import {
    ATRIBUTOS,
    itensComAjustes,
    MAX_SINTONIA,
    type AjusteDeArma,
    type DadosItemOnePiece,
    type FichaOnePiece,
    type ItemInventario,
} from '../../regras';

const props = defineProps<{ ficha: FichaOnePiece }>();
const { editar, calc, salvar, itens, mestre, abrirEditorItem } = useFicha();

const pct = computed(() => (calc.value['carga.max'] > 0 ? Math.min(100, (calc.value['carga.atual'] / calc.value['carga.max']) * 100) : 0));
const peso = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** O inventário é salvo por inteiro: edita-se uma cópia e envia. */
function mudar(fn: (inventario: FichaOnePiece['inventario']) => void) {
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
const secaoDestino = ref(-1); // -1: a seção do tipo do item

/** Separação por tipo: o que cada item é, para agrupar a lista (armas, armaduras, munição e o resto). */
const GRUPOS = ['Armas', 'Armaduras e escudos', 'Munição', 'Ferramentas e equipamento', 'Outros'] as const;
type Grupo = (typeof GRUPOS)[number];
const CATEGORIAS_DE_FERRAMENTA = new Set([
    'ferramentas',
    'kits',
    'exploracao',
    'armazenamento',
    'restricao',
    'construcao',
    'navegacao',
    'energia',
    'quimicos',
    'gases',
    'den-den-mushi',
    'roupas',
]);
function grupoDe(itemId: number): Grupo {
    const item = itens.value[itemId];
    if (!item) return 'Outros';
    const dados = (item.dados ?? {}) as DadosItemOnePiece & { catalogo?: { id?: string } };
    const categoria = dados.catalogo?.id ? itemDoCatalogo(dados.catalogo.id)?.categoria : undefined;
    if (dados.municao || categoria === 'municao') return 'Munição';
    if (dados.arma) return 'Armas';
    if (dados.armadura) return 'Armaduras e escudos';
    if (categoria && CATEGORIAS_DE_FERRAMENTA.has(categoria)) return 'Ferramentas e equipamento';

    return item.equipavel ? 'Ferramentas e equipamento' : 'Outros';
}
/** Os itens de uma seção separados por tipo (a ordem dos grupos é fixa); `ri` é o índice real na seção, para editar. */
function grupos(refs: ItemInventario[]): { nome: Grupo; refs: { ref: ItemInventario; ri: number }[] }[] {
    return GRUPOS.map((nome) => ({ nome, refs: refs.map((ref, ri) => ({ ref, ri })).filter((x) => grupoDe(x.ref.item_id) === nome) })).filter(
        (g) => g.refs.length,
    );
}
const secoesDeGrupo = (inv: FichaOnePiece['inventario'], nome: string) => inv.find((x) => x.secao === nome);

function colocar(itemId: number) {
    mudar((inv) => {
        // sem escolha de seção, o item vai para a seção do tipo dele (criada se faltar)
        if (secaoDestino.value === -1 || !inv.length) {
            const nome = grupoDe(itemId);
            let alvo = secoesDeGrupo(inv, nome);
            if (!alvo) inv.push((alvo = { secao: nome, itens: [] }));
            alvo.itens.push({ item_id: itemId, qtd: 1, equipado: false, sintonizado: false });

            return;
        }
        inv[Math.min(secaoDestino.value, inv.length - 1)].itens.push({ item_id: itemId, qtd: 1, equipado: false, sintonizado: false });
    });
}
/** Reparte todos os itens em seções por tipo (Armas, Armaduras e escudos...), mantendo quantidades, equipado e ajustes. */
function organizarPorTipo() {
    mudar((inv) => {
        const todos = inv.flatMap((x) => x.itens);
        const novas = GRUPOS.map((nome) => ({ secao: nome as string, itens: todos.filter((r) => grupoDe(r.item_id) === nome) })).filter(
            (x) => x.itens.length,
        );
        inv.splice(0, inv.length, ...novas);
    });
}

// --- Ajuste da arma só nesta ficha (o item da mesa não muda) ---
const ARMA_DADOS_RE = /^(?:[1-9]|[1-4]\d|50)d(?:[2-9]|[1-9]\d{1,2})$/;
const comAjustes = computed(() => itensComAjustes(props.ficha, itens.value));
const armaOriginal = (id: number) => (itens.value[id]?.dados as DadosItemOnePiece | null | undefined)?.arma;
const armaEfetiva = (id: number) => (comAjustes.value[id]?.dados as DadosItemOnePiece | null | undefined)?.arma;
const ajustada = (ref: ItemInventario) => !!ref.arma && Object.values(ref.arma).some((v) => v !== null && v !== undefined);
const resumoDaArma = (ref: ItemInventario): string | null => {
    const a = armaEfetiva(ref.item_id);
    if (!a) return null;
    const dado = a.municao ? 'dado da munição' : (a.dano ?? '—');
    const extra = (a.danoExtra ?? []).map((e) => `+${e.dados}${e.tipo ? ' ' + e.tipo : ''}`).join(' ');
    const bonus = a.bonusDano ?? a.bonusMagico ?? 0;
    const margem = a.margemCritica && a.margemCritica < 20 ? ` · crítico ${a.margemCritica}-20` : '';

    return `${dado}${bonus ? (bonus > 0 ? ` +${bonus}` : ` ${bonus}`) : ''}${extra ? ' ' + extra : ''}${a.tipoDano ? ' ' + a.tipoDano : ''}${margem}`;
};

const editando = ref<number | null>(null);
interface Rascunho {
    dano: string;
    tipoDano: string;
    atributo: string;
    atributoDano: string;
    bonusAtaque: number;
    bonusDano: number;
    margemCritica: number;
    danoExtra: { dados: string; tipo: string }[];
}
const rascunho = ref<Rascunho | null>(null);
function abrirAjuste(id: number) {
    const a = armaEfetiva(id);
    if (!a) return;
    editando.value = id;
    rascunho.value = {
        dano: a.dano ?? '',
        tipoDano: a.tipoDano ?? '',
        atributo: a.atributo,
        atributoDano: a.atributoDano ?? '',
        bonusAtaque: a.bonusAtaque ?? a.bonusMagico ?? 0,
        bonusDano: a.bonusDano ?? a.bonusMagico ?? 0,
        margemCritica: a.margemCritica ?? 20,
        danoExtra: (a.danoExtra ?? []).map((e) => ({ dados: e.dados, tipo: e.tipo ?? '' })),
    };
}
const fecharAjuste = () => {
    editando.value = null;
    rascunho.value = null;
};
const rascunhoValido = computed(() => {
    const r = rascunho.value;
    if (!r) return false;
    const orig = editando.value !== null ? armaOriginal(editando.value) : undefined;

    return (
        (orig?.municao || ARMA_DADOS_RE.test(r.dano.trim())) &&
        r.danoExtra.every((e) => ARMA_DADOS_RE.test(e.dados.trim())) &&
        Number.isInteger(r.bonusAtaque) &&
        Number.isInteger(r.bonusDano) &&
        r.margemCritica >= 2 &&
        r.margemCritica <= 20
    );
});
/** Guarda só o que difere do item original (o resto continua valendo o original). */
function salvarAjuste(si: number, ri: number) {
    const r = rascunho.value;
    const id = editando.value;
    const orig = id !== null ? armaOriginal(id) : undefined;
    if (!r || !orig || !rascunhoValido.value) return;
    const aj: AjusteDeArma = {};
    if (!orig.municao && r.dano.trim() !== orig.dano) aj.dano = r.dano.trim();
    if (r.tipoDano.trim() && r.tipoDano.trim() !== (orig.tipoDano ?? '')) aj.tipoDano = r.tipoDano.trim();
    if (r.atributo !== orig.atributo) aj.atributo = r.atributo as AjusteDeArma['atributo'];
    if (r.atributoDano && r.atributoDano !== (orig.atributoDano ?? '')) aj.atributoDano = r.atributoDano as AjusteDeArma['atributoDano'];
    if (r.bonusAtaque !== (orig.bonusAtaque ?? orig.bonusMagico ?? 0)) aj.bonusAtaque = r.bonusAtaque;
    if (r.bonusDano !== (orig.bonusDano ?? orig.bonusMagico ?? 0)) aj.bonusDano = r.bonusDano;
    if (r.margemCritica !== (orig.margemCritica ?? 20)) aj.margemCritica = r.margemCritica;
    const extras = r.danoExtra.map((e) => ({ dados: e.dados.trim(), ...(e.tipo.trim() ? { tipo: e.tipo.trim() } : {}) }));
    if (JSON.stringify(extras) !== JSON.stringify((orig.danoExtra ?? []).map((e) => ({ dados: e.dados, ...(e.tipo ? { tipo: e.tipo } : {}) }))))
        aj.danoExtra = extras;
    mudar((inv) => {
        const alvo = inv[si].itens[ri];
        if (Object.keys(aj).length) alvo.arma = aj;
        else delete alvo.arma;
    });
    fecharAjuste();
}
function restaurarArma(si: number, ri: number) {
    mudar((inv) => delete inv[si].itens[ri].arma);
    fecharAjuste();
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
    <div class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 p-3">
        <div class="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
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
            <section :class="estilos.cartao" class="p-3" aria-label="Belly">
                <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400">Belly</p>
                <label class="flex items-center gap-2 text-ouro-100"
                    ><span class="font-serif text-xl" aria-hidden="true">฿</span>
                    <CampoNumero
                        :model-value="ficha.belly"
                        :min="0"
                        :max="1000000000000"
                        aria-label="Belly"
                        class="w-full rounded border border-preto-700 bg-preto-950 py-0.5 text-right text-lg tabular-nums focus-visible:border-ouro-400 focus-visible:outline-none"
                        @salvar="salvar({ belly: $event })"
                /></label>
            </section>
        </div>

        <section v-for="(s, si) in ficha.inventario" :key="si" :class="estilos.cartao" :aria-label="s.secao">
            <h3
                class="flex flex-wrap items-center justify-between gap-x-3 border-b border-preto-800 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ouro-400"
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
                <template v-for="g in grupos(s.itens)" :key="g.nome">
                    <li
                        v-if="grupos(s.itens).length > 1 || g.nome !== s.secao"
                        class="bg-preto-900/60 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-preto-400"
                        :aria-label="`Tipo: ${g.nome}`"
                    >
                        {{ g.nome }}
                    </li>
                    <template v-for="{ ref, ri } in g.refs" :key="ri">
                        <li class="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
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
                                <span class="min-w-[9rem] flex-1 basis-40">
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
                                            ✎</button
                                        ><button
                                            v-if="editar && armaOriginal(ref.item_id)"
                                            type="button"
                                            class="shrink-0 text-xs text-preto-500 hover:text-ouro-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ouro-400"
                                            :aria-label="`Ajustar a arma ${itens[ref.item_id].nome} só nesta ficha`"
                                            title="Ajustar dano e bônus da arma só nesta ficha"
                                            @click="editando === ref.item_id ? fecharAjuste() : abrirAjuste(ref.item_id)"
                                        >
                                            ⚙
                                        </button></span
                                    >
                                    <span v-if="resumoDaArma(ref)" class="block truncate text-xs text-ouro-200/90"
                                        >⚔ {{ resumoDaArma(ref)
                                        }}<span
                                            v-if="ajustada(ref)"
                                            class="ml-1.5 rounded bg-ouro-500/20 px-1 text-[10px] uppercase text-ouro-300"
                                            title="Esta arma tem ajustes só nesta ficha"
                                            >ajustada</span
                                        ></span
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
                                        :title="
                                            !ref.sintonizado && sintonizados >= MAX_SINTONIA
                                                ? `No máximo ${MAX_SINTONIA} itens sintonizados`
                                                : undefined
                                        "
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
                        <li
                            v-if="editando === ref.item_id && rascunho"
                            class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 bg-preto-900/50 px-3 py-2.5 text-xs"
                            :aria-label="`Ajustar ${itens[ref.item_id]?.nome}`"
                        >
                            <p class="text-preto-400">Vale só nesta ficha; o item da mesa e as fichas dos outros não mudam.</p>
                            <div class="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
                                <label v-if="!armaOriginal(ref.item_id)?.municao" class="grid gap-0.5 text-preto-300"
                                    >Dado de dano<input
                                        v-model="rascunho.dano"
                                        type="text"
                                        maxlength="8"
                                        placeholder="1d8"
                                        :class="campo"
                                        class="w-full min-w-0"
                                /></label>
                                <label class="grid gap-0.5 text-preto-300"
                                    >Tipo de dano<input v-model="rascunho.tipoDano" type="text" maxlength="40" :class="campo" class="w-full min-w-0"
                                /></label>
                                <label class="grid gap-0.5 text-preto-300"
                                    >Bônus de ataque<input
                                        v-model.number="rascunho.bonusAtaque"
                                        type="number"
                                        min="-20"
                                        max="20"
                                        step="1"
                                        :class="campo"
                                        class="w-full min-w-0"
                                /></label>
                                <label class="grid gap-0.5 text-preto-300"
                                    >Bônus de dano<input
                                        v-model.number="rascunho.bonusDano"
                                        type="number"
                                        min="-50"
                                        max="50"
                                        step="1"
                                        :class="campo"
                                        class="w-full min-w-0"
                                /></label>
                                <label class="grid gap-0.5 text-preto-300"
                                    >Crítico a partir de (d20)<input
                                        v-model.number="rascunho.margemCritica"
                                        type="number"
                                        min="2"
                                        max="20"
                                        step="1"
                                        :class="campo"
                                        class="w-full min-w-0"
                                /></label>
                                <label class="grid gap-0.5 text-preto-300"
                                    >Atributo do ataque
                                    <select v-model="rascunho.atributo" :class="campo" class="w-full min-w-0">
                                        <option v-for="a in ATRIBUTOS" :key="a.id" :value="a.id">{{ a.nome }}</option>
                                        <option value="acuidade">Acuidade (Força ou Destreza)</option>
                                    </select></label
                                >
                                <label class="grid gap-0.5 text-preto-300"
                                    >Atributo do dano
                                    <select v-model="rascunho.atributoDano" :class="campo" class="w-full min-w-0">
                                        <option value="">O mesmo do ataque</option>
                                        <option v-for="a in ATRIBUTOS" :key="a.id" :value="a.id">{{ a.nome }}</option>
                                        <option value="acuidade">Acuidade (Força ou Destreza)</option>
                                        <option value="nenhum">Nenhum</option>
                                    </select></label
                                >
                            </div>
                            <fieldset class="grid min-w-0 gap-1">
                                <legend class="text-preto-300">Dados extras de dano (até 3; dobram no crítico)</legend>
                                <div v-for="(e, ei) in rascunho.danoExtra" :key="ei" class="flex gap-1.5">
                                    <input
                                        v-model="e.dados"
                                        type="text"
                                        maxlength="8"
                                        placeholder="2d6"
                                        :aria-label="`Dados extras ${ei + 1}`"
                                        :class="campo"
                                        class="w-20"
                                    />
                                    <input
                                        v-model="e.tipo"
                                        type="text"
                                        maxlength="40"
                                        placeholder="Tipo (ex.: Fogo)"
                                        :aria-label="`Tipo dos dados extras ${ei + 1}`"
                                        :class="campo"
                                        class="min-w-0 flex-1"
                                    />
                                    <button
                                        type="button"
                                        class="text-preto-500 hover:text-red-300"
                                        :aria-label="`Remover dados extras ${ei + 1}`"
                                        @click="rascunho.danoExtra.splice(ei, 1)"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <button
                                    v-if="rascunho.danoExtra.length < 3"
                                    type="button"
                                    class="w-fit text-ouro-300 hover:text-ouro-200"
                                    @click="rascunho.danoExtra.push({ dados: '1d6', tipo: '' })"
                                >
                                    + Adicionar dados extras
                                </button>
                            </fieldset>
                            <p v-if="!rascunhoValido" class="text-red-300">Confira o dado (ex.: 1d8, 2d6), os bônus e o crítico (2 a 20).</p>
                            <div class="flex flex-wrap justify-end gap-1.5">
                                <button
                                    type="button"
                                    class="rounded border border-preto-700 px-3 py-1 text-preto-300 hover:text-red-300"
                                    :disabled="!ajustada(ref)"
                                    @click="restaurarArma(si, ri)"
                                >
                                    Restaurar original
                                </button>
                                <button type="button" class="rounded border border-preto-700 px-3 py-1 text-preto-300" @click="fecharAjuste">
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    class="rounded bg-ouro-500 px-3 py-1 font-semibold text-preto-950 hover:bg-ouro-400 disabled:opacity-50"
                                    :disabled="!rascunhoValido"
                                    @click="salvarAjuste(si, ri)"
                                >
                                    Salvar ajuste
                                </button>
                            </div>
                        </li>
                    </template>
                </template>
                <li v-if="!s.itens.length" class="px-3 py-2 text-xs text-preto-500">Seção vazia.</li>
            </ul>
        </section>

        <!-- o mestre entrega itens da mesa ou cria um novo no editor -->
        <section v-if="editar && mestre" :class="estilos.cartao" class="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 p-3" aria-label="Entregar item">
            <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ouro-400">Entregar item (mestre)</h3>
            <form class="flex flex-wrap gap-1.5" @submit.prevent="entregar">
                <select v-model="escolhido" aria-label="Item da mesa" :class="campo" class="min-w-40 flex-1">
                    <option value="" disabled>{{ disponiveis.length ? 'Escolha um item da mesa…' : 'Nenhum item disponível' }}</option>
                    <option v-for="i in disponiveis" :key="i.id" :value="i.id">{{ i.nome }}</option>
                </select>
                <select v-model.number="secaoDestino" aria-label="Seção de destino" :class="campo">
                    <option :value="-1">Seção do tipo do item</option>
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

        <form v-if="editar" class="flex flex-wrap gap-1.5" @submit.prevent="adicionarSecao">
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
            <button
                type="button"
                class="rounded border border-preto-700 px-3 text-xs text-preto-300 hover:text-ouro-200"
                title="Reparte os itens em Armas, Armaduras e escudos, Munição, Ferramentas e Outros"
                @click="organizarPorTipo"
            >
                Organizar por tipo
            </button>
        </form>
        <p v-if="!ficha.inventario.length && !editar" class="py-6 text-center text-xs text-preto-500">
            Inventário vazio. O mestre entrega os itens; no modo Editar você organiza as seções.
        </p>
    </div>
</template>

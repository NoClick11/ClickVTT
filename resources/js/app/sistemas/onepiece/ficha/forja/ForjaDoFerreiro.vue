<script setup lang="ts">
import { Hammer } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import type { ArmaParaForja, MunicaoParaForja } from '../../../../tipos-mesa';
import { estilos, useFicha } from '../../contexto';
import {
    EXPERTISES,
    MAX_FIO,
    MEITO,
    TIPOS_DE_DANO_FISICO,
    YOTO,
    custoEmPF,
    etiquetasDaForja,
    expertisePorId,
    meitoPorId,
    pontosDeForja,
    type ForjaDaArma,
} from '../../itens/forja';
import { buscarNoCatalogo, precoFormatado } from '../../itens/regras';
import { CATEGORIAS } from '../../itens/tipos';
import type { FichaOnePiece } from '../../regras';

/**
 * Forja do Ferreiro (cap. 4): os Pontos de Forja (1 por 10 anos de vida, 1 por 10 lâminas, 2 por graduação, mais os do mestre), criar
 * armas e equipamentos do catálogo gastando 1 lingote de metal do inventário e Belly (com Teste de Força, Destreza ou Sabedoria) e
 * aprimorar a arma de qualquer personagem (a própria ou a de outro) com Meito, Yoto, Expertise, Supremacia, Densidade, Dureza, Balanço
 * e Fio. O servidor rola o Teste e confere PF, materiais e dinheiro.
 */
const props = defineProps<{ ficha: FichaOnePiece }>();
const { salvar, mestre, servicos, personagemId } = useFicha();

const pf = computed(() => pontosDeForja(props.ficha));
const dinheiro = (n: number) => `฿ ${Math.round(n).toLocaleString('pt-BR')}`;
const aviso = ref<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
const ocupado = ref(false);

// --- criar do catálogo
const texto = ref('');
const categoria = ref('');
const atributo = ref<'for' | 'des' | 'sab'>('for');
const forjaveis = computed(() =>
    buscarNoCatalogo({ texto: texto.value, categoria: categoria.value as never, soItens: true })
        .filter((i) => i.preco !== null)
        .slice(0, 40),
);
const custoDe = (preco: number | null) => Math.max(20000, Math.ceil((preco ?? 0) * 0.2));
async function forjar(id: string) {
    if (!servicos) return;
    aviso.value = null;
    ocupado.value = true;
    try {
        const r = await servicos.forjar({ ferreiro_id: personagemId, item: id, atributo: atributo.value });
        aviso.value = { tipo: r.sucesso ? 'ok' : 'erro', texto: r.texto };
    } catch (e) {
        aviso.value = { tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível forjar.' };
    } finally {
        ocupado.value = false;
    }
}

// --- aprimorar a arma de alguém
const alvoId = ref<number>(personagemId);
const armas = ref<ArmaParaForja[]>([]);
const armaId = ref<number | null>(null);
const arma = computed(() => armas.value.find((a) => a.item_id === armaId.value) ?? null);
const atual = computed<ForjaDaArma>(() => (arma.value?.forja ?? {}) as ForjaDaArma);
const novo = ref({ meito: '', yoto: '', expertise1: '', expertise2: '', densidade: '', dureza: false, balanco: false, fio: 0 });

async function carregarArmas() {
    armas.value = [];
    armaId.value = null;
    if (!servicos || !alvoId.value) return;
    try {
        armas.value = (await servicos.armasParaForja(alvoId.value)).armas;
        armaId.value = armas.value[0]?.item_id ?? null;
    } catch (e) {
        aviso.value = { tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível listar as armas.' };
    }
}
watch(alvoId, carregarArmas);
watch(arma, (a) => {
    const f = (a?.forja ?? {}) as ForjaDaArma;
    novo.value = {
        meito: f.meito ?? '',
        yoto: f.yoto ?? '',
        expertise1: f.expertise?.[0] ?? '',
        expertise2: f.expertise?.[1] ?? '',
        densidade: f.densidade ?? '',
        dureza: f.dureza ?? false,
        balanco: f.balanco ?? false,
        fio: f.fio ?? 0,
    };
});

/** A forja pedida (o que ficou marcado) para calcular o custo; a atual segue valendo no que não mudou. */
const pedido = computed<ForjaDaArma>(() => {
    const n = novo.value;
    const expertise = [n.expertise1, n.expertise2].filter((e, i, l) => e && l.indexOf(e) === i);

    return {
        ...(n.meito ? { meito: n.meito as ForjaDaArma['meito'] } : {}),
        ...(atual.value.kokuto ? { kokuto: true } : {}),
        ...(n.yoto ? { yoto: n.yoto as ForjaDaArma['yoto'] } : {}),
        ...(expertise.length ? { expertise } : {}),
        ...(n.densidade ? { densidade: n.densidade } : {}),
        ...(n.dureza ? { dureza: true } : {}),
        ...(n.densidade && n.balanco ? { balanco: true } : {}),
        ...(Number(n.fio) > 0 ? { fio: Math.min(MAX_FIO, Math.floor(Number(n.fio))) } : {}),
    };
});
const custo = computed(() => (arma.value ? custoEmPF(atual.value, pedido.value) : null));
const problema = computed(() => {
    if (!arma.value) return 'Escolha uma arma.';
    if (!custo.value) return 'Não dá para tirar ou reduzir melhorias já feitas.';
    if (custo.value.total < 1) return 'Escolha ao menos uma melhoria.';
    if (pedido.value.meito && !arma.value.cortante) return 'Meito são espadas e outras armas cortantes.';
    if (pedido.value.meito && !pedido.value.yoto) return 'Escolha a maldição (Yoto): toda lâmina Meito recebe uma.';
    if (custo.value.total > pf.value.disponiveis) return `Faltam PF: custa ${custo.value.total} e restam ${pf.value.disponiveis}.`;

    return '';
});
async function aprimorar() {
    if (!servicos || !arma.value || problema.value) return;
    aviso.value = null;
    ocupado.value = true;
    try {
        const n = novo.value;
        const r = await servicos.aprimorar({
            ferreiro_id: personagemId,
            alvo_id: alvoId.value,
            item_id: arma.value.item_id,
            melhorias: {
                meito: n.meito || null,
                yoto: n.yoto || null,
                expertise: [n.expertise1, n.expertise2].filter((e, i, l) => e && l.indexOf(e) === i),
                densidade: n.densidade || null,
                dureza: n.dureza,
                balanco: !!n.densidade && n.balanco,
                fio: Math.floor(Number(n.fio) || 0),
            },
        });
        aviso.value = { tipo: 'ok', texto: r.texto };
        await carregarArmas();
    } catch (e) {
        aviso.value = { tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível aprimorar.' };
    } finally {
        ocupado.value = false;
    }
}
carregarArmas();

// --- Aprimorar/Consertar Equipamento (um aprimoramento por arma sem modificação; Teste, sem Pontos de Forja)
type TipoDeMelhoria = 'kairoseki-arma' | 'kairoseki-municao' | 'municoes' | 'alcance';
const donoM = ref<number>(personagemId);
const armasM = ref<ArmaParaForja[]>([]);
const municoesM = ref<MunicaoParaForja[]>([]);
const tipoM = ref<TipoDeMelhoria>('kairoseki-arma');
const itemM = ref<number | null>(null);
const danoM = ref<'Contundente' | 'Perfurante'>('Perfurante');
const atributoM = ref<'for' | 'des' | 'sab'>('for');
const OPCOES_M: { id: TipoDeMelhoria; rotulo: string }[] = [
    { id: 'kairoseki-arma', rotulo: 'Revestir 1 arma com Kairoseki' },
    { id: 'kairoseki-municao', rotulo: 'Revestir 10 munições com Kairoseki' },
    { id: 'municoes', rotulo: 'Criar 20 munições de 1d12' },
    { id: 'alcance', rotulo: 'Ampliar as distâncias da arma em 6 m' },
];
/** O que dá para escolher no tipo: armas sem modificação (à distância, para o alcance) ou munições. */
const alvosM = computed(() =>
    tipoM.value === 'kairoseki-municao'
        ? municoesM.value.filter((m) => m.qtd >= 10).map((m) => ({ id: m.item_id, nome: `${m.nome} (×${m.qtd})` }))
        : tipoM.value === 'municoes'
          ? []
          : armasM.value
                .filter(
                    (a) => !a.melhoria && Object.keys(a.forja ?? {}).every((k) => k === 'expertise') && (tipoM.value !== 'alcance' || a.distancia),
                )
                .map((a) => ({ id: a.item_id, nome: a.nome })),
);
async function carregarM() {
    armasM.value = [];
    municoesM.value = [];
    if (!servicos || !donoM.value) return;
    try {
        const r = await servicos.armasParaForja(donoM.value);
        armasM.value = r.armas;
        municoesM.value = r.municoes;
    } catch (e) {
        aviso.value = { tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível listar o inventário.' };
    }
}
watch(donoM, carregarM);
watch([alvosM, tipoM], () => (itemM.value = alvosM.value.some((a) => a.id === itemM.value) ? itemM.value : (alvosM.value[0]?.id ?? null)), {
    immediate: true,
});
const problemaM = computed(() =>
    tipoM.value === 'municoes'
        ? ''
        : itemM.value === null
          ? tipoM.value === 'kairoseki-municao'
              ? 'Nenhuma pilha com 10 munições.'
              : 'Nenhuma arma sem modificação.'
          : '',
);
async function melhorar() {
    if (!servicos || problemaM.value) return;
    aviso.value = null;
    ocupado.value = true;
    try {
        const r = await servicos.melhorar({
            ferreiro_id: personagemId,
            alvo_id: donoM.value,
            atributo: atributoM.value,
            tipo: tipoM.value,
            ...(tipoM.value === 'municoes' ? { tipo_dano: danoM.value } : { item_id: itemM.value }),
        });
        aviso.value = { tipo: r.resultado === 'sucesso' ? 'ok' : 'erro', texto: r.texto };
        await carregarM();
    } catch (e) {
        aviso.value = { tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível aprimorar.' };
    } finally {
        ocupado.value = false;
    }
}
carregarM();

const campo = 'rounded border border-preto-700 bg-preto-950 px-2 py-1 text-xs focus-visible:border-ouro-400 focus-visible:outline-none';
const botao = 'rounded-md border border-ouro-500/60 px-3 py-1 text-xs font-semibold text-ouro-100 hover:bg-ouro-500/20 disabled:opacity-40';
</script>

<template>
    <section v-if="pf.ehFerreiro" :class="estilos.cartao" class="grid gap-3 p-3" aria-label="Forja do Ferreiro">
        <h3 class="flex items-center gap-1.5 text-sm font-semibold text-ouro-200"><Hammer class="size-4" aria-hidden="true" /> Forja</h3>

        <!-- Pontos de Forja -->
        <div class="grid gap-1 rounded-lg border border-preto-700 bg-preto-950/60 p-2.5 text-sm">
            <p>
                Pontos de Forja: <strong class="text-ouro-200">{{ pf.disponiveis }}</strong> disponíveis
                <span class="text-xs text-preto-400">({{ pf.ganhos }} ganhos − {{ pf.gastos }} gastos)</span>
            </p>
            <p class="text-xs text-preto-400">
                {{ pf.porIdade }} por idade ({{ ficha.forja?.idade ?? 0 }} anos) · {{ pf.porLaminas }} por lâminas ({{
                    ficha.forja?.laminas ?? 0
                }}
                comuns forjadas) · {{ pf.porGraduacao }} por graduação · {{ pf.extras }} dados pelo mestre. CD do Teste de forja: {{ pf.cd }}.
            </p>
            <div v-if="mestre" class="mt-1 flex flex-wrap items-end gap-3 rounded border border-ouro-500/30 bg-ouro-500/5 p-2 text-xs">
                <span :class="estilos.rotulo">Mestre</span>
                <label class="grid gap-0.5"
                    >Idade (anos)
                    <input
                        type="number"
                        min="0"
                        :class="campo"
                        class="w-20"
                        :value="ficha.forja?.idade ?? 0"
                        @change="salvar({ 'forja.idade': Math.max(0, Math.floor(Number(($event.target as HTMLInputElement).value) || 0)) })"
                    />
                </label>
                <label class="grid gap-0.5"
                    >Lâminas comuns
                    <input
                        type="number"
                        min="0"
                        :class="campo"
                        class="w-20"
                        :value="ficha.forja?.laminas ?? 0"
                        @change="salvar({ 'forja.laminas': Math.max(0, Math.floor(Number(($event.target as HTMLInputElement).value) || 0)) })"
                    />
                </label>
                <label class="grid gap-0.5" title="Pontos de Forja dados pelo mestre (negativo tira)"
                    >PF dados
                    <input
                        type="number"
                        :class="campo"
                        class="w-20"
                        :value="ficha.forja?.extras ?? 0"
                        @change="salvar({ 'forja.extras': Math.floor(Number(($event.target as HTMLInputElement).value) || 0) })"
                    />
                </label>
                <label class="grid gap-0.5" title="Pontos já gastos (a forja soma sozinha; ajuste só para corrigir)"
                    >PF gastos
                    <input
                        type="number"
                        min="0"
                        :class="campo"
                        class="w-20"
                        :value="ficha.forja?.gastos ?? 0"
                        @change="salvar({ 'forja.gastos': Math.max(0, Math.floor(Number(($event.target as HTMLInputElement).value) || 0)) })"
                    />
                </label>
            </div>
        </div>

        <p
            v-if="aviso"
            class="rounded border px-2 py-1 text-xs"
            :class="aviso.tipo === 'ok' ? 'border-green-400/50 bg-green-500/10 text-green-200' : 'border-red-400/50 bg-red-500/10 text-red-200'"
            role="status"
        >
            {{ aviso.texto }}
        </p>
        <p v-if="!servicos" class="text-xs text-preto-400">A forja só funciona dentro da mesa.</p>

        <template v-else>
            <!-- Forjar do catálogo -->
            <div class="grid gap-2 rounded-lg border border-preto-700 bg-preto-950/60 p-2.5">
                <h4 :class="estilos.rotulo">Forjar equipamento (Teste de Força, Destreza ou Sabedoria CD {{ pf.cd }})</h4>
                <p class="text-xs text-preto-400">
                    Gasta 1 lingote de metal do inventário e ฿ 20.000 ou 20% do valor (o maior), só se o Teste passar. A arma forjada entra no seu
                    inventário.
                </p>
                <div class="flex flex-wrap gap-1.5">
                    <input
                        v-model="texto"
                        type="search"
                        placeholder="Buscar item"
                        :class="campo"
                        class="min-w-32 flex-1"
                        aria-label="Buscar item para forjar"
                    />
                    <select v-model="categoria" :class="campo" aria-label="Categoria">
                        <option value="">Todas</option>
                        <option v-for="c in CATEGORIAS.filter((x) => x.grupo !== 'Serviços')" :key="c.id" :value="c.id">{{ c.nome }}</option>
                    </select>
                    <select v-model="atributo" :class="campo" aria-label="Atributo do Teste">
                        <option value="for">Teste de Força</option>
                        <option value="des">Teste de Destreza</option>
                        <option value="sab">Teste de Sabedoria</option>
                    </select>
                </div>
                <ul class="max-h-48 space-y-1 overflow-y-auto pr-1">
                    <li v-for="i in forjaveis" :key="i.id" class="flex items-center gap-2 rounded border border-preto-800 px-2 py-1 text-xs">
                        <span class="min-w-0 flex-1 truncate text-preto-100">{{ i.nome }}</span>
                        <span class="text-preto-400">valor {{ precoFormatado(i) }}</span>
                        <span class="text-ouro-200">custo {{ dinheiro(custoDe(i.preco)) }}</span>
                        <button type="button" :class="botao" :disabled="ocupado" @click="forjar(i.id)">Forjar</button>
                    </li>
                </ul>
            </div>

            <!-- Aprimorar -->
            <div class="grid gap-2 rounded-lg border border-preto-700 bg-preto-950/60 p-2.5">
                <h4 :class="estilos.rotulo">Aprimorar uma arma com Pontos de Forja</h4>
                <p class="text-xs text-preto-400">
                    A arma pode ser sua ou de outro personagem: ela vira uma cópia forjada. Os PF, 1 lingote e o dinheiro (฿ 20.000 ou 20% do valor)
                    saem de você.
                </p>
                <div class="flex flex-wrap gap-2">
                    <label class="grid gap-0.5 text-xs"
                        >Dono da arma
                        <select v-model.number="alvoId" :class="campo" aria-label="Dono da arma">
                            <option v-for="p in servicos.personagens" :key="p.id" :value="p.id">
                                {{ p.nome }}{{ p.id === personagemId ? ' (eu)' : '' }}
                            </option>
                        </select>
                    </label>
                    <label class="grid gap-0.5 text-xs"
                        >Arma
                        <select v-model.number="armaId" :class="campo" aria-label="Arma a aprimorar">
                            <option v-if="!armas.length" :value="null">Nenhuma arma no inventário</option>
                            <option v-for="a in armas" :key="a.item_id" :value="a.item_id">{{ a.nome }} ({{ a.dano }} {{ a.tipoDano }})</option>
                        </select>
                    </label>
                </div>
                <template v-if="arma">
                    <p v-if="etiquetasDaForja(atual).length || atual.expertise?.length" class="text-xs text-preto-300">
                        Hoje:
                        {{
                            [...etiquetasDaForja(atual), ...(atual.expertise ?? []).map((e) => `Expertise: ${expertisePorId(e)?.texto}`)].join(' · ')
                        }}
                    </p>
                    <div class="grid gap-2 sm:grid-cols-3">
                        <label class="grid gap-0.5 text-xs"
                            >Meito
                            <select v-model="novo.meito" :disabled="!arma.cortante" :class="campo" aria-label="Qualidade Meito">
                                <option value="">{{ atual.meito ? meitoPorId(atual.meito)?.nome : 'Arma comum' }}</option>
                                <option v-for="m in MEITO.filter((x) => x.pf > (meitoPorId(atual.meito)?.pf ?? 0))" :key="m.id" :value="m.id">
                                    {{ m.nome }} (até {{ m.pf }} PF)
                                </option>
                            </select>
                        </label>
                        <label class="grid gap-0.5 text-xs"
                            >Maldição Yoto
                            <select
                                v-model="novo.yoto"
                                :disabled="!novo.meito && !atual.meito"
                                :class="campo"
                                aria-label="Maldição Yoto (obrigatória na Meito)"
                            >
                                <option value="">{{ novo.meito || atual.meito ? 'Escolha a maldição' : 'Nenhuma' }}</option>
                                <option v-for="y in YOTO" :key="y.id" :value="y.id">{{ y.nome }}</option>
                            </select>
                        </label>
                        <label class="grid gap-0.5 text-xs"
                            >Fio (+passos, 2 PF cada)
                            <input v-model.number="novo.fio" type="number" :min="atual.fio ?? 0" :max="MAX_FIO" :class="campo" aria-label="Fio" />
                        </label>
                        <label class="grid gap-0.5 text-xs"
                            >Expertise (1 PF a troca)
                            <select v-model="novo.expertise1" :class="campo" aria-label="Expertise">
                                <option value="">Nenhuma</option>
                                <option v-for="e in EXPERTISES" :key="e.id" :value="e.id">{{ e.texto }}</option>
                            </select>
                        </label>
                        <label class="grid gap-0.5 text-xs"
                            >Supremacia: 2ª Expertise (2 PF)
                            <select v-model="novo.expertise2" :disabled="!novo.expertise1" :class="campo" aria-label="Segunda Expertise">
                                <option value="">Nenhuma</option>
                                <option v-for="e in EXPERTISES" :key="e.id" :value="e.id">{{ e.texto }}</option>
                            </select>
                        </label>
                        <label class="grid gap-0.5 text-xs"
                            >Densidade (1 PF)
                            <select v-model="novo.densidade" :class="campo" aria-label="Densidade">
                                <option value="">Nenhuma</option>
                                <option v-for="t in TIPOS_DE_DANO_FISICO" :key="t" :value="t">{{ t }}</option>
                            </select>
                        </label>
                        <label class="flex items-end gap-1.5 pb-1 text-xs"
                            ><input v-model="novo.dureza" type="checkbox" class="accent-ouro-500" /> Dureza (1 PF)</label
                        >
                        <label class="flex items-end gap-1.5 pb-1 text-xs"
                            ><input v-model="novo.balanco" :disabled="!novo.densidade" type="checkbox" class="accent-ouro-500" /> Balanço (2
                            PF)</label
                        >
                    </div>
                    <div class="flex flex-wrap items-center gap-3 text-xs">
                        <span v-if="custo" class="text-preto-200"
                            >Custo: <strong class="text-ouro-200">{{ custo.total }} PF</strong> ({{ custo.itens.join(', ') || '—' }}), 1 lingote e
                            {{ dinheiro(20000) }} ou 20% do valor</span
                        >
                        <button type="button" :class="botao" :disabled="ocupado || !!problema" @click="aprimorar">Aprimorar</button>
                        <span v-if="problema" class="text-amber-300">{{ problema }}</span>
                    </div>
                </template>
            </div>

            <!-- Aprimorar/Consertar Equipamento -->
            <div class="grid gap-2 rounded-lg border border-preto-700 bg-preto-950/60 p-2.5" aria-label="Aprimorar ou consertar equipamento">
                <h4 :class="estilos.rotulo">Aprimorar/Consertar Equipamento (Teste CD {{ pf.cd }})</h4>
                <p class="text-xs text-preto-400">
                    Um aprimoramento por arma sem modificação, sem Pontos de Forja: 1 lingote e ฿ 20.000 ou 20% do valor (o maior), só se o Teste
                    passar. Um 1 natural quebra o equipamento sem conserto. A arma ou as munições podem ser de outro personagem.
                </p>
                <div class="flex flex-wrap gap-2">
                    <label class="grid gap-0.5 text-xs"
                        >Dono
                        <select v-model.number="donoM" :class="campo" aria-label="Dono do equipamento">
                            <option v-for="p in servicos.personagens" :key="p.id" :value="p.id">
                                {{ p.nome }}{{ p.id === personagemId ? ' (eu)' : '' }}
                            </option>
                        </select>
                    </label>
                    <label class="grid gap-0.5 text-xs"
                        >Aprimoramento
                        <select v-model="tipoM" :class="campo" aria-label="Aprimoramento">
                            <option v-for="o in OPCOES_M" :key="o.id" :value="o.id">{{ o.rotulo }}</option>
                        </select>
                    </label>
                    <label v-if="tipoM !== 'municoes'" class="grid gap-0.5 text-xs"
                        >{{ tipoM === 'kairoseki-municao' ? 'Munição' : 'Arma' }}
                        <select v-model.number="itemM" :class="campo" aria-label="Equipamento a aprimorar">
                            <option v-if="!alvosM.length" :value="null">Nenhuma disponível</option>
                            <option v-for="a in alvosM" :key="a.id" :value="a.id">{{ a.nome }}</option>
                        </select>
                    </label>
                    <label v-else class="grid gap-0.5 text-xs"
                        >Tipo de dano
                        <select v-model="danoM" :class="campo" aria-label="Tipo de dano das munições">
                            <option value="Perfurante">Perfurante</option>
                            <option value="Contundente">Contundente</option>
                        </select>
                    </label>
                    <label class="grid gap-0.5 text-xs"
                        >Teste
                        <select v-model="atributoM" :class="campo" aria-label="Atributo do Teste de aprimorar">
                            <option value="for">Força</option>
                            <option value="des">Destreza</option>
                            <option value="sab">Sabedoria</option>
                        </select>
                    </label>
                </div>
                <div class="flex flex-wrap items-center gap-3 text-xs">
                    <button type="button" :class="botao" :disabled="ocupado || !!problemaM" @click="melhorar">Aprimorar</button>
                    <span v-if="problemaM" class="text-amber-300">{{ problemaM }}</span>
                </div>
            </div>
        </template>
    </section>
</template>

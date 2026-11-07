<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { computed, reactive, ref, watch } from 'vue';
import { clonar } from '../../../../nucleo/ficha/caminho';
import { CRIACAO_DE_POINTS } from '../../akuma/zoan';
import { useFicha } from '../../contexto';
import {
    AUXILIAR,
    CONDICOES_DE_TECNICA,
    EFEITOS,
    GRAUS,
    MAX_CONDICOES,
    PONTOS_VIRTUAIS,
    type EfeitoDeTecnica,
    type TipoDeTecnica,
} from '../../criador/dados';
import {
    custoDaTecnica,
    dadoDoDano,
    escolhasPadrao,
    espacosPorNivel,
    pontosVirtuais,
    problemasDaTecnica,
    rotuloDoTipo,
    tecnicaDoCriador,
    type ContextoDeValidacao,
    type EscolhaDeEfeito,
    type EscolhasDaTecnica,
    type OrigemDoCriador,
} from '../../criador/regras';
import type { FichaOnePiece, Tecnica } from '../../regras';

/**
 * Criador de Técnicas (cap. 6): monta uma Técnica de Combate, Auxiliar ou Manifestação de Poder pelos efeitos do livro,
 * calcula o custo em PP e só deixa criar o que o nível (e o tipo de usuário) permite. Serve à Akuma no Mi (`akuma.lista`)
 * e, só pela Genialidade Inusitada, aos estilos de luta (`tecnicas.lista`). O servidor refaz a conta ao salvar.
 */
const props = defineProps<{
    open: boolean;
    ficha: FichaOnePiece;
    destino: 'akuma' | 'estilo';
    genialidade?: number;
    /** Origem e tipo já definidos pela tela que abriu (Point da Zoan, Corpo Elemental da Logia...). */
    origemInicial?: OrigemDoCriador;
    tipoInicial?: TipoDeTecnica;
}>();
const emit = defineEmits<{ 'update:open': [boolean] }>();
const { salvar } = useFicha();

const caminho = computed(() => (props.destino === 'akuma' ? 'akuma.lista' : 'tecnicas.lista'));
const lista = computed<Tecnica[]>(() => (props.destino === 'akuma' ? props.ficha.akuma.lista : props.ficha.tecnicas.lista));

const GRUPOS: { id: EfeitoDeTecnica['grupo']; nome: string }[] = [
    { id: 'controle', nome: 'Controle' },
    { id: 'ofensivo', nome: 'Ofensivo' },
    { id: 'suporte', nome: 'Suporte' },
    { id: 'reducao', nome: 'Redução no custo' },
];

const nome = ref('');
const esc = reactive<EscolhasDaTecnica>(escolhasPadrao('combate', props.genialidade ?? 1));
const regraDoTipoDeDano = ref(false);

const genialidadesAprendidas = computed(() => (props.ficha.treinamento?.aprendidos ?? []).filter((t) => t.id === 'genialidade-inusitada').length);
/** Genialidades que ainda não geraram técnica (nº do treinamento = grau da técnica). */
const genialidadesLivres = computed(() => {
    const usadas = new Set(
        [...props.ficha.tecnicas.lista, ...props.ficha.akuma.lista]
            .map((t) => t.criador?.origem)
            .filter((o): o is { tipo: 'genialidade'; indice: number } => o?.tipo === 'genialidade')
            .map((o) => o.indice),
    );
    return Array.from({ length: genialidadesAprendidas.value }, (_, i) => i + 1).filter((i) => !usadas.has(i));
});

const ctx = computed<ContextoDeValidacao>(() => ({
    nivel: props.ficha.nivel,
    usuario: props.ficha.akuma.usuario ?? 'simples',
    despertado: !!props.ficha.akuma.despertada,
    genialidades: genialidadesAprendidas.value,
    opcoes: { regraDoTipoDeDano: regraDoTipoDeDano.value },
    akuma: props.destino === 'akuma' ? props.ficha.akuma.tipo : '',
    zoan: props.ficha.akuma.zoan ?? '',
    points: props.ficha.akuma.points ?? [],
    destino: props.destino,
}));

const espacos = computed(() => espacosPorNivel(ctx.value));
const custo = computed(() => custoDaTecnica(esc, ctx.value.opcoes));
const problemas = computed(() => {
    const p = problemasDaTecnica(esc, ctx.value);
    if (!nome.value.trim()) {
        p.unshift('Dê um nome à Técnica.');
    }
    if (lista.value.some((t) => t.nome.trim().toLowerCase() === nome.value.trim().toLowerCase())) {
        p.push('Já existe uma técnica com esse nome.');
    }
    return p;
});
const pv = computed(() => (esc.tipo === 'mp' ? pontosVirtuais(esc, custo.value.reducao) : null));
const limites = computed(() => {
    if (esc.tipo === 'combate') {
        return GRAUS.find((g) => g.grau === esc.grau);
    }
    return undefined;
});

/** O Point/Aspecto fixa a origem (e o grau da Técnica do Point); a Genialidade fixa o grau. */
const origemFixa = computed(() => props.origemInicial && props.origemInicial.tipo !== 'nivel');
function reiniciar() {
    const origem: OrigemDoCriador =
        props.origemInicial ?? (props.genialidade ? { tipo: 'genialidade', indice: props.genialidade } : { tipo: 'nivel' });
    const tipo = props.tipoInicial ?? 'combate';
    const grau = origem.tipo === 'point' ? origem.ponto : (props.genialidade ?? 1);
    Object.assign(esc, escolhasPadrao(tipo, grau, origem));
    if (origem.tipo === 'point' && tipo === 'mp') esc.ativacao = 'passiva';
    nome.value = '';
    regraDoTipoDeDano.value = false;
}
watch(
    () => props.open,
    (aberto) => {
        if (aberto) reiniciar();
    },
    { immediate: true },
);

function trocarTipo(tipo: TipoDeTecnica) {
    const base = escolhasPadrao(tipo, esc.grau || 1, esc.origem);
    Object.assign(esc, { ...base, tipoDano: esc.tipoDano, efeitos: [] });
    if (tipo !== 'combate' && !origemFixa.value) {
        esc.origem = { tipo: 'nivel' };
    }
    if (esc.origem.tipo === 'point' && tipo === 'combate') {
        esc.grau = esc.origem.ponto;
    }
}
function trocarOrigem(valor: string) {
    if (valor === 'nivel') {
        esc.origem = { tipo: 'nivel' };
        return;
    }
    const indice = Number(valor);
    esc.origem = { tipo: 'genialidade', indice };
    esc.tipo = 'combate';
    esc.forma = 'base';
    esc.grau = indice;
}

const efeitoEscolhido = (id: string) => esc.efeitos.find((e) => e.id === id);
function alternarEfeito(def: EfeitoDeTecnica) {
    const i = esc.efeitos.findIndex((e) => e.id === def.id);
    if (i >= 0) {
        esc.efeitos.splice(i, 1);
        return;
    }
    const params: Record<string, number | string | boolean> = {};
    for (const p of def.params ?? []) {
        if (p.tipo === 'num') params[p.id] = p.min ?? 0;
        else if (p.tipo === 'opcao') params[p.id] = p.opcoes?.[0]?.id ?? '';
        else params[p.id] = false;
    }
    const novo: EscolhaDeEfeito = { id: def.id, params };
    if (def.id === 'condicao') novo.condicoes = [];
    esc.efeitos.push(novo);
}
function alternarCondicao(ef: EscolhaDeEfeito, id: string) {
    const c = ef.condicoes ?? (ef.condicoes = []);
    const i = c.indexOf(id);
    if (i >= 0) c.splice(i, 1);
    else if (c.length < MAX_CONDICOES) c.push(id);
    if (ef.condicaoProlongada && !c.includes(ef.condicaoProlongada)) ef.condicaoProlongada = undefined;
}

/** Aparece no catálogo só o que o tipo da Técnica admite (o resto continua listado, mas desabilitado). */
function motivoDeBloqueio(def: EfeitoDeTecnica): string {
    if (def.apenas === 'combate' && esc.tipo !== 'combate') return 'Só em Técnicas de Combate';
    if (def.apenas === 'auxiliar' && esc.tipo !== 'auxiliar') return 'Só em Técnicas Auxiliares';
    if (esc.tipo === 'mp' && !def.mp) return 'Não vale em Manifestações de Poder';
    return '';
}

function criar() {
    if (problemas.value.length) return;
    const t = tecnicaDoCriador(nome.value, clonar(esc), ctx.value.opcoes);
    salvar({ [caminho.value]: [...clonar(lista.value), t] });
    emit('update:open', false);
}

const campo = 'rounded border border-preto-700 bg-preto-950 px-2 py-1 text-xs focus-visible:border-ouro-400 focus-visible:outline-none';
const rotulo = 'text-xs font-semibold uppercase tracking-wide text-preto-400';
const sinal = (n: number) => (n > 0 ? `+${n}` : String(n));
const nivelDoGrau = (g: number) => GRAUS.find((x) => x.grau === g)?.nivel ?? 0;
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="max-h-[92vh] max-w-3xl overflow-y-auto border-ouro-500/30 bg-preto-900 text-preto-100">
            <DialogHeader>
                <DialogTitle class="font-serif text-ouro-200">Criar Técnica</DialogTitle>
                <DialogDescription class="text-preto-400">
                    {{ destino === 'akuma' ? 'Akuma no Mi' : 'Estilo de luta (Genialidade Inusitada)' }} · nível {{ ficha.nivel }}
                    <template v-if="destino === 'akuma'"
                        >· usuário {{ ficha.akuma.usuario === 'avancado' ? 'avançado' : 'simples'
                        }}{{ ficha.akuma.despertada ? ' desperto' : '' }}</template
                    >
                </DialogDescription>
            </DialogHeader>

            <p v-if="destino === 'akuma' && !ficha.akuma.tipo" class="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
                Escolha o tipo da Akuma no Mi (Logia, Paramecia ou Zoan) na aba antes de criar Técnicas.
            </p>
            <p
                v-else-if="destino === 'akuma' && ficha.akuma.tipo === 'zoan' && !ficha.akuma.zoan"
                class="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200"
            >
                Escolha se a Zoan é Comum, Ancestral ou Mítica no Perfil do fruto antes de criar Técnicas.
            </p>
            <p
                v-else-if="destino === 'akuma' && ficha.akuma.tipo === 'zoan' && ficha.akuma.zoan !== 'mitica' && esc.origem.tipo !== 'point'"
                class="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200"
            >
                Usuários de Zoan Comum e Ancestral recebem Técnicas apenas pelos Points: crie o Point (modelo próprio) na seção Points do Perfil e use
                os botões "Técnica" e "Traço Realçado" dele.
            </p>
            <div v-else class="grid gap-4">
                <p v-if="destino === 'akuma'" class="text-xs text-preto-400">
                    Espaços pelo nível: Técnicas de Combate dos graus {{ Object.keys(espacos.combate).join(', ') || '—' }},
                    {{ espacos.auxiliares + espacos.auxiliaresDespertas }} Auxiliar(es) e {{ espacos.manifestacoes }} Manifestação(ões) de Poder.
                </p>

                <div class="grid gap-3 sm:grid-cols-2">
                    <label class="grid gap-1"
                        ><span :class="rotulo">Nome</span>
                        <input v-model="nome" type="text" maxlength="120" :class="campo" placeholder="Nome da Técnica" />
                    </label>
                    <label v-if="destino === 'akuma' && !genialidade && !origemFixa" class="grid gap-1"
                        ><span :class="rotulo">Origem</span>
                        <select
                            :class="campo"
                            :value="esc.origem.tipo === 'genialidade' ? String(esc.origem.indice) : 'nivel'"
                            @change="trocarOrigem(($event.target as HTMLSelectElement).value)"
                        >
                            <option value="nivel">Pelo nível (tabela do tipo de usuário)</option>
                            <option v-for="g in genialidadesLivres" :key="g" :value="g">Genialidade Inusitada nº {{ g }} ({{ g }}º grau)</option>
                        </select>
                    </label>
                    <p v-else-if="esc.origem.tipo === 'point'" class="self-end text-xs text-ouro-200">
                        {{ esc.origem.ponto }}º Point: {{ esc.tipo === 'mp' ? 'Traço Realçado (até' : 'Técnica (até' }}
                        {{ CRIACAO_DE_POINTS[esc.origem.ponto - 1]?.[esc.tipo === 'mp' ? 'tracos' : 'tecnica'] }}
                        {{ esc.tipo === 'mp' ? 'Pontos Virtuais' : 'PP, menos os pontos do Traço Realçado' }}).
                    </p>
                    <p v-else-if="esc.origem.tipo === 'aspecto'" class="self-end text-xs text-ouro-200">
                        Corpo Elemental: Técnica Auxiliar só com o efeito Power Up.
                    </p>
                    <p v-else-if="esc.origem.tipo === 'genialidade'" class="self-end text-xs text-ouro-200">
                        Genialidade Inusitada nº {{ esc.origem.indice }}: Técnica de Combate de {{ esc.origem.indice }}º grau.
                    </p>
                </div>

                <div class="grid gap-3 sm:grid-cols-3">
                    <label class="grid gap-1"
                        ><span :class="rotulo">Tipo</span>
                        <select
                            :class="campo"
                            :value="esc.tipo"
                            :disabled="esc.origem.tipo === 'genialidade' || esc.origem.tipo === 'point'"
                            @change="trocarTipo(($event.target as HTMLSelectElement).value as TipoDeTecnica)"
                        >
                            <option value="combate">Técnica de Combate</option>
                            <option v-if="destino === 'akuma'" value="auxiliar">Técnica Auxiliar</option>
                            <option v-if="destino === 'akuma'" value="mp">Manifestação de Poder</option>
                        </select>
                    </label>
                    <template v-if="esc.tipo === 'combate'">
                        <label class="grid gap-1"
                            ><span :class="rotulo">Grau</span>
                            <select
                                v-model.number="esc.grau"
                                :class="campo"
                                :disabled="esc.origem.tipo === 'genialidade' || esc.origem.tipo === 'point'"
                            >
                                <option v-for="g in GRAUS" :key="g.grau" :value="g.grau">{{ g.grau }}º grau (nível {{ g.nivel }})</option>
                            </select>
                        </label>
                        <label class="grid gap-1"
                            ><span :class="rotulo">Forma</span>
                            <select v-model="esc.forma" :class="campo" :disabled="esc.origem.tipo === 'genialidade' || esc.origem.tipo === 'point'">
                                <option value="base">Técnica nova</option>
                                <option value="aperfeicoada">Forma Aperfeiçoada</option>
                                <option value="alternativa">Forma Alternativa</option>
                            </select>
                        </label>
                        <label v-if="esc.forma === 'aperfeicoada'" class="grid gap-1"
                            ><span :class="rotulo">Grau da Técnica original</span>
                            <select v-model.number="esc.grauOriginal" :class="campo">
                                <option :value="undefined" disabled>Escolha</option>
                                <option v-for="g in GRAUS.slice(0, 4)" :key="g.grau" :value="g.grau">{{ g.grau }}º grau</option>
                            </select>
                        </label>
                    </template>
                    <label v-if="esc.tipo === 'mp'" class="grid gap-1 sm:col-span-2"
                        ><span :class="rotulo">Requisito de ativação</span>
                        <select v-model="esc.ativacao" :class="campo">
                            <option v-for="a in PONTOS_VIRTUAIS.ativacao" :key="a.id" :value="a.id">
                                {{ a.nome }} ({{ sinal(a.ajuste) }} Pontos Virtuais)
                            </option>
                        </select>
                    </label>
                </div>

                <section
                    v-if="esc.tipo !== 'mp'"
                    class="grid gap-3 rounded-lg border border-preto-700 bg-preto-950/60 p-3"
                    aria-label="Ataque e alcance"
                >
                    <div class="grid gap-3 sm:grid-cols-4">
                        <label class="grid gap-1"
                            ><span :class="rotulo">Ação</span>
                            <select v-model="esc.acao" :class="campo">
                                <option v-if="esc.tipo === 'combate'" value="poderosa">Ação Poderosa</option>
                                <option value="bonus">Ação Bônus</option>
                                <option value="reacao">Reação</option>
                                <option v-if="esc.tipo === 'auxiliar'" value="poderosa">Ação Poderosa (Técnica Demorada)</option>
                            </select>
                        </label>
                        <label class="grid gap-1"
                            ><span :class="rotulo">Alcance</span>
                            <select v-model="esc.formaDeAlcance" :class="campo">
                                <option value="pessoal">Pessoal</option>
                                <option value="toque">Toque</option>
                                <option value="linha">Linha / à distância</option>
                                <option value="esfera">Esfera, Cilindro ou Emanação</option>
                                <option value="cone">Cone</option>
                            </select>
                        </label>
                        <label v-if="['linha', 'esfera', 'cone'].includes(esc.formaDeAlcance)" class="grid gap-1"
                            ><span :class="rotulo">Metros</span>
                            <input v-model.number="esc.alcance" type="number" min="0" max="100" step="1.5" :class="campo" />
                        </label>
                        <label class="grid gap-1"
                            ><span :class="rotulo">Alvos</span>
                            <select v-model="esc.alvo" :class="campo">
                                <option value="unico">Alvo único</option>
                                <option value="area">Área (vários alvos)</option>
                            </select>
                        </label>
                    </div>
                    <div class="flex flex-wrap items-center gap-4 text-xs text-preto-300">
                        <label class="flex items-center gap-1.5"
                            ><input v-model="esc.ataque" type="checkbox" class="accent-ouro-500" /> Jogada de ataque (Técnicas)</label
                        >
                        <label class="flex items-center gap-1.5"
                            ><input v-model="esc.salvaguarda" type="checkbox" class="accent-ouro-500" /> Exige Salvaguarda</label
                        >
                        <label v-if="esc.alvo === 'area'" class="flex items-center gap-1.5"
                            ><input v-model="esc.intensificado" type="checkbox" class="accent-ouro-500" /> Dano intensificado (d8, área
                            limitada)</label
                        >
                        <label v-if="esc.alvo === 'unico' && esc.salvaguarda" class="flex items-center gap-1.5">
                            Salvaguarda:
                            <select v-model="esc.modoDoDano" :class="campo">
                                <option value="salvaguarda_metade">metade do dano se passar (d8)</option>
                                <option value="salvaguarda_nada">nenhum dano se passar (d10)</option>
                            </select>
                        </label>
                    </div>
                    <div v-if="esc.tipo === 'combate'" class="grid gap-3 sm:grid-cols-3">
                        <label class="grid gap-1"
                            ><span :class="rotulo">Dados de dano (1 PP cada){{ limites ? ` · máx. ${limites.dados}` : '' }}</span>
                            <input v-model.number="esc.dados" type="number" min="0" :max="limites?.dados ?? 14" :class="campo" />
                        </label>
                        <p class="self-end text-xs text-preto-400">Dado: d{{ dadoDoDano(esc) }}</p>
                        <label class="grid gap-1"
                            ><span :class="rotulo">Tipo do dano</span>
                            <input v-model="esc.tipoDano" type="text" maxlength="30" :class="campo" placeholder="Fogo, Contundente..." />
                        </label>
                    </div>
                    <label class="flex items-center gap-1.5 text-xs text-preto-400">
                        <input v-model="regraDoTipoDeDano" type="checkbox" class="accent-ouro-500" /> Regra opcional: alterar o tipo de dano custa PP
                        (o Narrador escolhe)
                    </label>
                </section>

                <section class="grid gap-2" aria-label="Efeitos">
                    <h3 :class="rotulo">Efeitos</h3>
                    <div v-for="g in GRUPOS" :key="g.id" class="grid gap-1.5">
                        <h4 class="text-[11px] font-semibold uppercase tracking-wide text-ouro-300">{{ g.nome }}</h4>
                        <div
                            v-for="def in EFEITOS.filter((e) => e.grupo === g.id)"
                            :key="def.id"
                            class="rounded border border-preto-700 bg-preto-950/50 p-2"
                        >
                            <label class="flex items-start gap-2 text-sm" :class="motivoDeBloqueio(def) ? 'opacity-50' : ''">
                                <input
                                    type="checkbox"
                                    class="mt-1 accent-ouro-500"
                                    :checked="!!efeitoEscolhido(def.id)"
                                    :disabled="!!motivoDeBloqueio(def)"
                                    @change="alternarEfeito(def)"
                                />
                                <span class="min-w-0 flex-1">
                                    <span class="font-semibold text-preto-100">{{ def.nome }}</span>
                                    <span v-if="efeitoEscolhido(def.id)" class="ml-2 text-xs text-ouro-200">
                                        {{ sinal(custo.efeitos.find((e) => e.id === def.id)?.custo ?? 0) }} PP
                                    </span>
                                    <span class="block text-xs text-preto-400">{{ def.texto }}</span>
                                    <span class="block text-[11px] text-preto-500">Exigência: {{ def.exigencia }}</span>
                                    <span v-if="motivoDeBloqueio(def)" class="block text-[11px] text-red-300">{{ motivoDeBloqueio(def) }}</span>
                                </span>
                            </label>

                            <div v-if="efeitoEscolhido(def.id)" class="mt-2 grid gap-2 pl-6">
                                <template v-if="def.id === 'condicao'">
                                    <div class="flex flex-wrap gap-1.5">
                                        <button
                                            v-for="c in CONDICOES_DE_TECNICA"
                                            :key="c.id"
                                            type="button"
                                            class="rounded-full border px-2 py-0.5 text-xs"
                                            :class="
                                                efeitoEscolhido('condicao')?.condicoes?.includes(c.id)
                                                    ? 'border-ouro-400 bg-ouro-500/20 text-ouro-100'
                                                    : 'border-preto-600 text-preto-300 hover:bg-preto-800'
                                            "
                                            @click="alternarCondicao(efeitoEscolhido('condicao')!, c.id)"
                                        >
                                            {{ c.nome }} ({{ c.custo }})
                                        </button>
                                    </div>
                                    <label
                                        v-if="efeitoEscolhido('condicao')?.condicoes?.length"
                                        class="flex items-center gap-2 text-xs text-preto-300"
                                    >
                                        Duração prolongada (até 1 minuto) em:
                                        <select v-model="efeitoEscolhido('condicao')!.condicaoProlongada" :class="campo">
                                            <option :value="undefined">nenhuma</option>
                                            <option v-for="id in efeitoEscolhido('condicao')?.condicoes" :key="id" :value="id">
                                                {{ CONDICOES_DE_TECNICA.find((c) => c.id === id)?.nome }}
                                            </option>
                                        </select>
                                    </label>
                                </template>
                                <div v-for="p in def.params" :key="p.id" class="flex flex-wrap items-center gap-2 text-xs text-preto-300">
                                    <template v-if="p.tipo === 'num'">
                                        <label class="flex items-center gap-2"
                                            >{{ p.rotulo }}
                                            <input
                                                v-model.number="efeitoEscolhido(def.id)!.params![p.id]"
                                                type="number"
                                                :min="p.min ?? 0"
                                                :max="p.max"
                                                :class="campo"
                                                class="w-20"
                                            />
                                        </label>
                                    </template>
                                    <template v-else-if="p.tipo === 'opcao'">
                                        <label class="flex items-center gap-2"
                                            >{{ p.rotulo }}
                                            <select v-model="efeitoEscolhido(def.id)!.params![p.id]" :class="campo">
                                                <option v-for="o in p.opcoes" :key="o.id" :value="o.id">
                                                    {{ o.rotulo }} ({{ sinal(o.custo) }} PP)
                                                </option>
                                            </select>
                                        </label>
                                    </template>
                                    <template v-else>
                                        <label class="flex items-center gap-2">
                                            <input v-model="efeitoEscolhido(def.id)!.params![p.id]" type="checkbox" class="accent-ouro-500" />
                                            {{ p.rotulo }}
                                        </label>
                                    </template>
                                </div>
                                <div
                                    v-if="def.prolongada !== null && def.id !== 'condicao'"
                                    class="flex flex-wrap items-center gap-3 text-xs text-preto-300"
                                >
                                    <label class="flex items-center gap-1.5">
                                        <input v-model="efeitoEscolhido(def.id)!.prolongada" type="checkbox" class="accent-ouro-500" />
                                        Em Duração Prolongada (+{{ def.id === 'condicao-area' ? 'custo da condição + 1' : def.prolongada }} PP no 1º
                                        minuto)
                                    </label>
                                    <label v-if="efeitoEscolhido(def.id)!.prolongada" class="flex items-center gap-1.5">
                                        minutos
                                        <input
                                            v-model.number="efeitoEscolhido(def.id)!.minutos"
                                            type="number"
                                            min="1"
                                            max="10"
                                            :class="campo"
                                            class="w-16"
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="grid gap-1 rounded-lg border border-ouro-500/30 bg-preto-950 p-3 text-sm" aria-label="Resumo do custo">
                    <template v-if="esc.tipo === 'mp'">
                        <p>
                            Pontos Virtuais: <strong class="text-ouro-200">{{ custo.total }}</strong> de {{ pv?.disponivel }} disponíveis (limite dos
                            efeitos: {{ pv?.limite }}).
                        </p>
                    </template>
                    <template v-else>
                        <p>
                            Custo: <strong class="text-ouro-200">{{ custo.total }} PP</strong>
                            <span class="text-xs text-preto-400">
                                (dano {{ custo.dano }}<template v-if="custo.modificacao"> + forma {{ custo.modificacao }}</template
                                ><template v-if="custo.tipoDeDano"> + tipo {{ custo.tipoDeDano }}</template> + efeitos
                                {{ custo.bruto - custo.dano - custo.modificacao - custo.tipoDeDano }} − redução {{ custo.reducao }})
                            </span>
                            <span v-if="esc.tipo === 'combate'" class="text-xs text-preto-400">
                                · máximo {{ limites?.pp }} PP, redução até {{ 2 * esc.grau }}</span
                            >
                            <span v-else class="text-xs text-preto-400">
                                · máximo {{ AUXILIAR.pp }} PP (desperta {{ AUXILIAR.ppDesperta }}), redução até {{ AUXILIAR.reducaoMax }}</span
                            >
                        </p>
                    </template>
                    <ul v-if="problemas.length" class="list-disc pl-5 text-xs text-red-300">
                        <li v-for="p in problemas" :key="p">{{ p }}</li>
                    </ul>
                    <p v-else class="text-xs text-green-300">
                        Tudo certo: {{ rotuloDoTipo(esc.tipo, esc.grau) }} dentro dos limites do
                        {{ nivelDoGrau(esc.grau) ? `${esc.grau}º grau (nível ${nivelDoGrau(esc.grau)})` : 'tipo escolhido' }}.
                    </p>
                </section>

                <div class="flex justify-end gap-2">
                    <Button variant="outline" type="button" @click="emit('update:open', false)">Cancelar</Button>
                    <Button type="button" :disabled="problemas.length > 0" @click="criar">Criar Técnica</Button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
</template>

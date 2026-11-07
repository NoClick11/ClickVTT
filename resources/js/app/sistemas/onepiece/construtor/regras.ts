/**
 * Lógica do assistente de criação do One Piece: das ESCOLHAS do jogador (espécie, variante, ajuste de atributo...) saem
 * os CAMPOS da ficha, que a tela salva em lote. Arquivo PURO (sem Vue): o Node o executa direto nos testes.
 *
 * Etapas: espécie (única ou mestiça) → escolhas → variação rara → estilo de luta → atributos → resumo.
 */
import type { EfeitoBruto } from '../../../nucleo/efeitos/efeitos.ts';
import { avaliar } from '../../../nucleo/efeitos/formula.ts';
import { profissaoPorId } from '../profissoes/dados.ts';
import {
    camposDaProfissaoInicial,
    caracteristicasDasProfissoes,
    problemasDaProfissao,
    refazerFerramentas,
    type ProfissoesFicha,
} from '../profissoes/regras.ts';
import {
    ativaNoNivel,
    ATRIBUTOS,
    modificador,
    PERICIAS,
    PERICIAS_ESCOLHIVEIS,
    textoDeMovimento,
    type AtributoId,
    type Caracteristica,
    type Proficiencia,
    type Tecnica,
} from '../regras.ts';
import { antecedentePorId, comAumentoDeAntecedente } from './dados/antecedentes.ts';
import { ESPECIES, TRACO_CULTURAL } from './dados/especies.ts';
import { atributoPrimarioDe, estiloPorId, tecnicaDoEstilo, tecnicasDoEstiloNoNivel, tracosDoEstiloNoNivel } from './dados/estilos.ts';
import { hbPorId, OPCOES_QUEBRADOR } from './dados/habilidades-basicas.ts';
import { maestriaPorId } from './dados/maestrias.ts';
import { NIVEIS_PRECONCEITO, type EspecieDados, type Movimento, type TracoDados, type VarianteDados } from './dados/tipos.ts';
import { VARIACOES_RARAS } from './dados/variacoes.ts';

export const DADOS_DE_VIDA = ['d4', 'd6', 'd8', 'd10', 'd12'] as const;
export type DadoDeVida = (typeof DADOS_DE_VIDA)[number];

/** Ancestralidade (Minks e Povo do Mar): traços dos Zoan, ainda em texto livre até o Capítulo 6 existir. */
export const ANCESTRALIDADE: TracoDados = {
    id: 'ancestralidade',
    nome: 'Ancestralidade',
    pedeAncestralidade: true,
    descricao:
        'De acordo com o animal do qual descende, você recebe características únicas dessa espécie. Escolha até 2 Traços Comuns e até 1 Traço Específico das Akuma no Mi Zoan (ignorando o requisito de forma original, híbrida ou animal; Capítulo 6), coerentes com o animal, ou crie os seus com aprovação do Narrador. Se o animal for um carnívoro caçador, pode não receber nenhum Traço Comum e Específico e receber o Traço Especial "Predador". Escreva os traços no campo de Ancestralidade.',
};

export const TREINAMENTOS_MESTICO: TracoDados = {
    id: 'treinamentos-mestico',
    nome: 'Treinamentos de Espécie dos Mestiços',
    descricao:
        'Mestiços cujas espécies não têm a mesma lista de "Treinamentos de Espécie" podem aprender apenas 1 treinamento de cada uma das listas disponíveis (ex.: um mestiço de Lunariano com Mink escolhe 1 dos treinamentos de Mink e 1 dos de Lunariano). Os treinamentos entram quando o Capítulo 5 for adicionado.',
};

export type MetodoAtributos = 'compra' | 'padrao' | 'rolagem';
export const VALORES_PADRAO = [15, 14, 13, 12, 10, 8];
export const PONTOS_DE_COMPRA = 27;
/** Custo de cada valor na compra de pontos (8 a 15). Confira com o livro; é a tabela do D&D. */
export const CUSTO_DE_COMPRA: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export interface Escolhas {
    modo: 'unica' | 'mestico';
    /** 1 id (única) ou 2 (mestiço; pode repetir a espécie com variantes diferentes). */
    especies: string[];
    /** Variante escolhida de cada espécie (índice igual a `especies`; null = sem variante). */
    variantes: (string | null)[];
    ajuste: { tipo: 'dois' | 'um'; atributos: AtributoId[] };
    /** Perícias escolhidas por traço (id do traço → ids das perícias). */
    pericias: Record<string, string[]>;
    /** Traços em que o jogador trocou uma perícia pelo traço alternativo (ex.: Haki da Observação Inato). */
    trocas: Record<string, boolean>;
    /** Falhas de caráter de Aspectos Humanos (ids). */
    falhas: string[];
    /** Humano: 1 perícia em Adaptação e sem Aspectos Humanos. */
    adaptacaoOpcional: boolean;
    /** Mestiço: o benefício de cada espécie (id do benefício da espécie ou da variante dela). */
    beneficiosMestico: (string | null)[];
    /** Mestiço: de qual espécie (índice) vem a dificuldade. */
    dificuldadeMestico: number | null;
    /** Mestiço: Dois Mundos. */
    doisMundos: 'ancestralidade' | 'cultural' | null;
    /** Mestiço com benefício restrito: dificuldade adicional (índice da espécie). */
    dificuldadeExtra: number | null;
    variacaoRara: string | null;
    /** Benefício da espécie que a Variação Rara substitui (id). */
    beneficioSubstituido: string | null;
    ancestralidade: string;
    /**
     * Estilo de luta. `id` de um estilo do catálogo (`dados/estilos.ts`) preenche o resto sozinho; sem `id` é o estilo
     * provisório (só nome e dado). Os campos opcionais podem faltar em criações salvas antes do catálogo.
     */
    estilo: {
        nome: string;
        dado: DadoDeVida;
        id?: string;
        /** Atributo primário escolhido (quando o estilo oferece dois). */
        primario?: AtributoId | null;
        caminho?: string | null;
        armaFavorita?: string | null;
        /** Habilidade Básica Inata escolhida (id). */
        hbInata?: string | null;
        /** Perícias livres do estilo (ids). */
        pericias?: string[];
    };
    /** Habilidade Básica escolhida no 1º nível (id; a Inata vem do estilo) e as opções que ela pede (Prodígio, Quebrador). */
    hb?: string | null;
    hbOpcoes?: Record<string, string[]>;
    /** Aptidão para Haki: o tipo com mais afinidade (+2 PA ao despertar). */
    hakiAfinidade?: 'armamento' | 'observacao' | null;
    /**
     * Antecedente (cap. 4): a perícia (uma da lista, ou qualquer uma se `personalizado`), o atributo que sobe +2 (teto 20) e,
     * personalizado, a característica especial de outro antecedente (`caracteristicaDe`).
     */
    antecedente?: { id: string; pericia: string; atributo: AtributoId | null; personalizado: boolean; caracteristicaDe: string | null };
    /** Profissão do 1º nível (cap. 4): o id (ou `nenhuma`) e as 2 perícias (da lista, ou 2 livres sem profissão). */
    profissao?: { id: string; pericias: string[] };
    atributos: { metodo: MetodoAtributos; base: Record<AtributoId, number> };
    /** Os 6 valores rolados no servidor (4d6 descartando o menor); só o servidor os define. */
    rolados: number[] | null;
}

export { textoDeMovimento };

export const escolhasIniciais = (): Escolhas => ({
    modo: 'unica',
    especies: [],
    variantes: [],
    ajuste: { tipo: 'dois', atributos: [] },
    pericias: {},
    trocas: {},
    falhas: [],
    adaptacaoOpcional: false,
    beneficiosMestico: [],
    dificuldadeMestico: null,
    doisMundos: null,
    dificuldadeExtra: null,
    variacaoRara: null,
    beneficioSubstituido: null,
    ancestralidade: '',
    estilo: { nome: '', dado: 'd8', id: '', primario: null, caminho: null, armaFavorita: null, hbInata: null, pericias: [] },
    atributos: { metodo: 'padrao', base: { for: 10, des: 10, con: 10, sab: 10, pre: 10, von: 10 } },
    rolados: null,
    hb: null,
    hbOpcoes: {},
    hakiAfinidade: null,
    antecedente: { id: '', pericia: '', atributo: null, personalizado: false, caracteristicaDe: null },
    profissao: { id: '', pericias: [] },
});

export const especiePorId = (id: string): EspecieDados | undefined => ESPECIES.find((e) => e.id === id);
const variantePorId = (e: EspecieDados, id: string | null): VarianteDados | undefined => (id ? e.variantes?.find((v) => v.id === id) : undefined);

// --- tamanho, peso e movimento ---------------------------------------------------------------------------------------

/** Categoria de tamanho pela medida em cm: Miúdo < 30 cm, Pequeno < 1,5 m, Médio < 3 m, Grande < 10 m, Enorme < 30 m. */
export function categoriaDeTamanho(cm: number): string {
    if (cm < 30) return 'Miúdo';
    if (cm < 150) return 'Pequeno';
    if (cm < 300) return 'Médio';
    if (cm < 1000) return 'Grande';
    if (cm < 3000) return 'Enorme';

    return 'Imenso';
}

/** Maior de cada deslocamento (os traços só aumentam: "prevalece o maior"). */
export function maiorMovimento(...lista: Partial<Movimento>[]): Movimento {
    const m: Movimento = { normal: 0, nado: 0, escalada: 0, voo: 0 };
    for (const mov of lista) for (const k of Object.keys(m) as (keyof Movimento)[]) m[k] = Math.max(m[k], mov[k] ?? 0);

    return m;
}

/** Nome da espécie no singular, como aparece na ficha. */
const SINGULAR: Record<string, string> = {
    humano: 'Humano',
    anao: 'Anão',
    celestial: 'Celestial',
    gigante: 'Gigante',
    lunariano: 'Lunariano',
    mink: 'Mink',
    'povo-do-mar': 'Povo do Mar',
};
const singular = (e: EspecieDados) => SINGULAR[e.id] ?? e.nome;

const maiorPreconceito = (a: string, b: string) => (NIVEIS_PRECONCEITO.indexOf(a as never) >= NIVEIS_PRECONCEITO.indexOf(b as never) ? a : b);

export interface Fisico {
    nome: string;
    pv: number;
    preconceito: string;
    tamanhoCm: number;
    pesoKg: number;
    categoria: string;
    movimento: Movimento;
}

/** Os números da espécie, ou a média dos dois no mestiço: PV (média, para baixo), tamanho (média dos menores), peso (média dos maiores). */
export function fisicoDe(escolhas: Escolhas): Fisico | null {
    const especies = escolhas.especies.map(especiePorId);
    if (!especies.length || especies.some((e) => !e)) return null;
    const [a, b] = especies as EspecieDados[];
    const variantes = especies.map((e, i) => variantePorId(e!, escolhas.variantes[i] ?? null));
    const tracosMov = variantes.flatMap((v) => [v?.beneficio.movimento ?? {}, ...(v?.tracos ?? []).map((t) => t.movimento ?? {})]);
    const beneficiosMov = todosOsTracos(escolhas).map((t) => t.traco.movimento ?? {});

    if (escolhas.modo === 'mestico' && b) {
        const tamanhoCm = Math.floor((a.tamanhoCm[0] + b.tamanhoCm[0]) / 2);

        return {
            nome: a.id === b.id ? `${singular(a)} (mestiço)` : `${singular(a)} × ${singular(b)}`,
            pv: Math.floor((a.pv + b.pv) / 2),
            preconceito: maiorPreconceito(a.preconceito, b.preconceito),
            tamanhoCm,
            pesoKg: Math.floor((a.pesoKg[1] + b.pesoKg[1]) / 2),
            categoria: categoriaDeTamanho(tamanhoCm),
            movimento: maiorMovimento(a.movimento, b.movimento, ...beneficiosMov),
        };
    }
    void tracosMov;
    const categoria = todosOsTracos(escolhas).find((t) => t.traco.tamanho)?.traco.tamanho ?? a.categoria;

    return {
        nome: singular(a),
        pv: a.pv,
        preconceito: a.preconceito,
        tamanhoCm: a.tamanhoCm[0],
        pesoKg: a.pesoKg[1],
        categoria,
        movimento: maiorMovimento(a.movimento, ...beneficiosMov),
    };
}

// --- traços (benefícios e dificuldades) ------------------------------------------------------------------------------

export interface TracoEscolhido {
    traco: TracoDados;
    origem: string;
    builder: 'especie' | 'variacao' | 'estilo' | 'maestria' | 'haki' | 'treinamento' | 'antecedente' | 'profissao' | 'akuma' | 'individualidade';
}

/** Benefícios que o jogador pode escolher na Miscigenação (os da espécie e o da variante dela). */
export function beneficiosDisponiveis(especieId: string, varianteId: string | null): TracoDados[] {
    const e = especiePorId(especieId);
    if (!e) return [];

    return [...e.beneficios, ...(variantePorId(e, varianteId)?.beneficio ? [variantePorId(e, varianteId)!.beneficio] : [])];
}

/** O mestiço é de duas variantes da mesma espécie (só vale o benefício das variantes). */
export const mesticoDaMesmaEspecie = (e: Escolhas) => e.modo === 'mestico' && e.especies.length === 2 && e.especies[0] === e.especies[1];

/** A dificuldade fica por conta da escolha (humano: falhas; mestiço: de uma das espécies). */
function dificuldadesEscolhidas(e: Escolhas): { traco: TracoDados; origem: string }[] {
    const lista = e.especies.map(especiePorId);
    if (!lista.length || lista.some((x) => !x)) return [];
    const saida: { traco: TracoDados; origem: string }[] = [];
    const escolhidas: number[] = e.modo === 'mestico' ? [e.dificuldadeMestico, e.dificuldadeExtra].filter((i): i is number => i !== null) : [0];
    for (const i of [...new Set(escolhidas)]) {
        const esp = lista[i];
        if (esp) saida.push({ traco: esp.dificuldade, origem: esp.nome });
    }

    return saida;
}

/** Todos os traços que viram características na ficha, com a origem. A Variação Rara substitui um benefício. */
export function todosOsTracos(e: Escolhas): TracoEscolhido[] {
    const lista = e.especies.map(especiePorId);
    if (!lista.length || lista.some((x) => !x)) return [];
    const saida: TracoEscolhido[] = [];
    const add = (traco: TracoDados, origem: string, builder: 'especie' | 'variacao' = 'especie') => saida.push({ traco, origem, builder });

    if (e.modo === 'mestico' && lista.length === 2) {
        lista.forEach((esp, i) => {
            const variante = variantePorId(esp!, e.variantes[i] ?? null);
            if (mesticoDaMesmaEspecie(e)) {
                if (variante) add(variante.beneficio, `${esp!.nome}: ${variante.nome}`);
            } else {
                const escolhido = beneficiosDisponiveis(esp!.id, variante?.id ?? null).find((t) => t.id === e.beneficiosMestico[i]);
                if (escolhido) add(escolhido, variante && variante.beneficio.id === escolhido.id ? `${esp!.nome}: ${variante.nome}` : esp!.nome);
            }
            for (const t of variante?.tracos ?? []) add(t, `${esp!.nome}: ${variante!.nome}`);
            for (const t of esp!.extras ?? []) add(t, esp!.nome);
        });
        if (!mesticoDaMesmaEspecie(e)) {
            if (e.doisMundos === 'ancestralidade' || (lista[0]!.ancestralidade && lista[1]!.ancestralidade)) add(ANCESTRALIDADE, 'Dois Mundos');
            else if (e.doisMundos === 'cultural' || (lista[0]!.tracoCultural && lista[1]!.tracoCultural)) add(TRACO_CULTURAL, 'Dois Mundos');
        }
        for (const d of dificuldadesEscolhidas(e)) add(d.traco, d.origem);
        add(TREINAMENTOS_MESTICO, 'Mestiço');
    } else {
        const esp = lista[0]!;
        const variante = variantePorId(esp, e.variantes[0] ?? null);
        const rara = VARIACOES_RARAS.find((v) => v.id === e.variacaoRara);
        const beneficios = [...esp.beneficios, ...(variante ? [variante.beneficio] : [])].filter((b) => !(rara && b.id === e.beneficioSubstituido));
        for (const b of beneficios) add(b, variante && b.id === variante.beneficio.id ? `${esp.nome}: ${variante.nome}` : esp.nome);
        if (rara) add(rara.traco, `Variação Rara: ${rara.nome}`, 'variacao');
        for (const t of variante?.tracos ?? []) add(t, `${esp.nome}: ${variante!.nome}`);
        for (const t of esp.extras ?? []) add(t, esp.nome);
        if (esp.ancestralidade) add(ANCESTRALIDADE, esp.nome);
        if (esp.tracoCultural) add(TRACO_CULTURAL, esp.nome);
        if (!(esp.id === 'humano' && e.adaptacaoOpcional)) add(esp.dificuldade, esp.nome);
    }
    // Aspectos Humanos: a dificuldade vira as falhas escolhidas
    return saida.flatMap((t) => {
        if (!t.traco.falhas) return [t];

        return e.falhas
            .map((id) => t.traco.falhas!.find((f) => f.id === id))
            .filter((f): f is TracoDados => !!f)
            .map((f) => ({ traco: { ...f, nome: `${t.traco.nome}: ${f.nome}` }, origem: t.origem, builder: t.builder }));
    });
}

/** Perícias que algum traço escolhido pede ao jogador (Adaptação, Herança Cultural, Aptidão Natural). */
export function pedidosDePericia(e: Escolhas): { traco: TracoDados; quantidade: number }[] {
    return todosOsTracos(e)
        .filter((t) => t.traco.escolhaPericias)
        .map((t) => {
            const esc = t.traco.escolhaPericias!;
            const opcional = t.traco.id === 'adaptacao' && e.adaptacaoOpcional;

            return { traco: t.traco, quantidade: opcional ? 1 : esc.quantidade };
        });
}

/** Os pedidos de perícia que o jogador escolhe já na etapa "Escolhas" (os de `soProficientes` ficam para a etapa do estilo). */
export const pedidosDaEtapaEscolhas = (e: Escolhas) => pedidosDePericia(e).filter((p) => !p.traco.escolhaPericias?.soProficientes);

/**
 * As perícias em que o personagem já é proficiente por OUTRA fonte: as escolhidas em Adaptação e afins (menos as de
 * `soProficientes`) e as perícias livres do estilo do catálogo. É de onde a Aptidão Natural pode escolher.
 */
export function periciasJaProficientes(e: Escolhas): string[] {
    const dosTracos = pedidosDaEtapaEscolhas(e).flatMap((p) => e.pericias[p.traco.id] ?? []);
    const doEstilo = estiloPorId(e.estilo.id) ? (e.estilo.pericias ?? []) : [];
    const doAntecedente = antecedentePorId(e.antecedente?.id) && e.antecedente?.pericia ? [e.antecedente.pericia] : [];
    const daProfissao = e.profissao?.id ? e.profissao.pericias : [];

    return [...new Set([...dosTracos, ...doEstilo, ...doAntecedente, ...daProfissao])];
}

/** Antecedente: escolher um, a perícia (da lista, ou qualquer uma se personalizado), o atributo +2 e a característica. */
export function problemasDoAntecedente(e: Escolhas): string[] {
    const a = antecedentePorId(e.antecedente?.id);
    if (!a) return ['Escolha um antecedente.'];
    const p: string[] = [];
    const ant = e.antecedente!;
    const livre = ant.personalizado;
    if (!ant.pericia || !PERICIAS_ESCOLHIVEIS.some((x) => x.id === ant.pericia) || (!livre && !a.pericias.includes(ant.pericia)))
        p.push('Escolha a perícia do antecedente.');
    if (!ant.atributo || !ATRIBUTOS.some((x) => x.id === ant.atributo)) p.push('Escolha o atributo que recebe +2.');
    if (livre && ant.caracteristicaDe && !antecedentePorId(ant.caracteristicaDe)) p.push('Característica especial inválida.');

    return p;
}

/** Aptidão Natural (e afins): a perícia escolhida precisa ser uma em que já há proficiência. */
export function problemasDeAptidao(e: Escolhas): string[] {
    const p: string[] = [];
    const proficientes = periciasJaProficientes(e);
    for (const pedido of pedidosDePericia(e).filter((x) => x.traco.escolhaPericias?.soProficientes)) {
        const chosen = e.pericias[pedido.traco.id] ?? [];
        if (chosen.length !== pedido.quantidade)
            p.push(
                `${pedido.traco.nome}: escolha ${pedido.quantidade} perícia${pedido.quantidade === 1 ? '' : 's'} em que você já seja proficiente.`,
            );
        else if (chosen.some((id) => !proficientes.includes(id)))
            p.push(`${pedido.traco.nome}: só vale para perícia em que você já tem proficiência (Adaptação ou estilo); refaça a escolha.`);
    }

    return p;
}

/** Quantas falhas de caráter (Aspectos Humanos) o personagem escolhe. */
export function quantidadeDeFalhas(e: Escolhas): number {
    const esp = e.especies.map(especiePorId);
    if (!esp.some((x) => x?.id === 'humano') || e.adaptacaoOpcional) return 0;
    if (e.modo === 'mestico' && e.dificuldadeMestico !== null && esp[e.dificuldadeMestico]?.id !== 'humano') return 0;
    const variante = e.especies.map((id, i) => variantePorId(especiePorId(id)!, e.variantes[i] ?? null)).find((v) => v?.falhasObrigatorias);

    return variante?.falhasObrigatorias ?? 1;
}

// --- atributos ------------------------------------------------------------------------------------------------------

export const custoDaCompra = (base: Record<AtributoId, number>): number =>
    ATRIBUTOS.reduce((soma, a) => soma + (CUSTO_DE_COMPRA[base[a.id]] ?? Infinity), 0);

/** Atributos finais: base escolhida + ajuste da espécie (+1 em dois diferentes ou +2 em um). */
export function atributosFinais(e: Escolhas): Record<AtributoId, number> {
    const f = { ...e.atributos.base };
    const bonus = e.ajuste.tipo === 'um' ? 2 : 1;
    for (const a of e.ajuste.atributos) f[a] += bonus;
    // Antecedente: +2 em um atributo à escolha, sem passar de 20 por ele
    const ant = e.antecedente;
    if (antecedentePorId(ant?.id) && ant?.atributo) f[ant.atributo] = comAumentoDeAntecedente(f[ant.atributo]);

    return f;
}

/** PV máximo no nível 1: dado de vida do estilo no máximo + mod. CON + PV base da espécie. */
export function pvInicial(e: Escolhas): number {
    const dado = Number(dadoDeVidaFinal(estiloPorId(e.estilo.id)?.dado ?? e.estilo.dado, hbsDoAssistente(e), 1).slice(1));
    const fisico = fisicoDe(e);

    return Math.max(1, dado + modificador(atributosFinais(e).con) + (fisico?.pv ?? 0));
}

// --- validação por etapa -------------------------------------------------------------------------------------------

export type EtapaId = 'especie' | 'escolhas' | 'variacao' | 'antecedente' | 'profissao' | 'estilo' | 'habilidades' | 'haki' | 'atributos' | 'resumo';
export const ETAPAS: { id: EtapaId; rotulo: string }[] = [
    { id: 'especie', rotulo: 'Espécie' },
    { id: 'escolhas', rotulo: 'Escolhas' },
    { id: 'variacao', rotulo: 'Variação rara' },
    { id: 'antecedente', rotulo: 'Antecedente' },
    { id: 'profissao', rotulo: 'Profissão' },
    { id: 'estilo', rotulo: 'Estilo de luta' },
    { id: 'habilidades', rotulo: 'Habilidade Básica' },
    { id: 'haki', rotulo: 'Aptidão para Haki' },
    { id: 'atributos', rotulo: 'Atributos' },
    { id: 'resumo', rotulo: 'Resumo' },
];

/** Problemas que impedem de avançar a etapa (lista vazia = pode avançar). */
export function problemasDaEtapa(e: Escolhas, etapa: EtapaId): string[] {
    const p: string[] = [];
    if (etapa === 'especie') {
        const n = e.modo === 'mestico' ? 2 : 1;
        if (e.especies.length !== n || e.especies.some((id) => !especiePorId(id)))
            p.push(n === 2 ? 'Escolha as duas espécies do mestiço.' : 'Escolha uma espécie.');
    }
    if (etapa === 'escolhas') {
        const esp = e.especies.map(especiePorId);
        if (esp.some((x) => !x)) return ['Escolha a espécie primeiro.'];
        esp.forEach((x, i) => {
            if (x!.variantes?.length && !e.variantes[i]) p.push(`Escolha a variante de ${x!.nome}.`);
        });
        if (e.modo === 'mestico' && esp[0]!.id === esp[1]!.id) {
            if (!esp[0]!.variantes?.length) p.push('Mestiço da mesma espécie só existe entre variantes diferentes.');
            else if (e.variantes[0] === e.variantes[1]) p.push('Escolha duas variantes diferentes.');
        }
        const dois = e.ajuste.tipo === 'um' ? 1 : 2;
        if (e.ajuste.atributos.length !== dois || new Set(e.ajuste.atributos).size !== dois)
            p.push(dois === 1 ? 'Escolha o atributo do +2.' : 'Escolha dois atributos diferentes para o +1.');
        if (e.modo === 'mestico' && !mesticoDaMesmaEspecie(e)) {
            if (e.beneficiosMestico.length !== 2 || e.beneficiosMestico.some((b) => !b))
                p.push('Escolha um benefício de cada espécie (Miscigenação).');
            else {
                const restritos = todosOsTracos(e).filter((t) => t.traco.restrito).length;
                if (restritos > 1)
                    p.push(
                        'Só é possível escolher um benefício restrito (Heat, Electro, Corpo Pequeno, Hóspede Feérico, Força Colossal, Corpo Marinho).',
                    );
                if (restritos === 1 && e.dificuldadeExtra === null)
                    p.push('Um benefício restrito exige 1 dificuldade adicional de uma das espécies.');
            }
            if (e.dificuldadeMestico === null) p.push('Escolha de qual espécie vem a dificuldade.');
            const a = esp[0]!;
            const b = esp[1]!;
            if (
                !(a.ancestralidade && b.ancestralidade) &&
                !(a.tracoCultural && b.tracoCultural) &&
                (a.ancestralidade || b.ancestralidade || a.tracoCultural || b.tracoCultural) &&
                !e.doisMundos
            )
                p.push('Escolha Dois Mundos: Ancestralidade ou Traço Cultural.');
        }
        for (const pedido of pedidosDaEtapaEscolhas(e)) {
            const chosen = e.pericias[pedido.traco.id] ?? [];
            const troca = !!pedido.traco.escolhaPericias?.troca && e.trocas[pedido.traco.id];
            const falta = pedido.quantidade - (troca ? 1 : 0);
            if (chosen.length !== falta) p.push(`${pedido.traco.nome}: escolha ${falta} perícia${falta === 1 ? '' : 's'}.`);
            if (chosen.some((id) => pedido.traco.escolhaPericias!.excluir.includes(id))) p.push(`${pedido.traco.nome}: perícia não permitida.`);
        }
        const falhas = quantidadeDeFalhas(e);
        if (falhas && e.falhas.length !== falhas) p.push(`Aspectos Humanos: escolha ${falhas} falha${falhas === 1 ? '' : 's'} de caráter.`);
    }
    if (etapa === 'variacao' && e.variacaoRara) {
        if (e.modo === 'mestico') p.push('Variação Rara não vale para mestiços.');
        else if (!e.beneficioSubstituido) p.push('Escolha qual Benefício da Espécie a Variação Rara substitui.');
    }
    if (etapa === 'antecedente' || etapa === 'resumo') p.push(...problemasDoAntecedente(e));
    if (etapa === 'profissao' || etapa === 'resumo') p.push(...problemasDaProfissao(e.profissao));
    if (etapa === 'estilo' || etapa === 'resumo') p.push(...problemasDeAptidao(e));
    if (etapa === 'estilo') {
        const est = estiloPorId(e.estilo.id);
        if (!est) {
            if (!e.estilo.nome.trim()) p.push('Escolha um estilo de luta ou dê um nome ao estilo.');
        } else {
            if (!atributoPrimarioDe(est, e.estilo.primario)) p.push('Escolha o atributo primário do estilo.');
            if (est.caminhos?.length && !est.caminhos.some((c) => c.id === e.estilo.caminho)) p.push('Escolha o caminho do estilo.');
            if (!est.armasFavoritas.includes(e.estilo.armaFavorita ?? '')) p.push('Escolha a arma favorita.');
            if (!est.habilidadesInatas.some((h) => h.id === e.estilo.hbInata)) p.push('Escolha a Habilidade Básica Inata.');
            const pericias = e.estilo.pericias ?? [];
            if (pericias.length !== est.pericias || new Set(pericias).size !== pericias.length)
                p.push(`Escolha ${est.pericias} perícias diferentes do estilo.`);
        }
    }
    if (etapa === 'habilidades') {
        const est = estiloPorId(e.estilo.id);
        const hb = hbPorId(e.hb);
        if (!est) return p; // estilo provisório: sem Habilidades Básicas
        if (!hb) p.push('Escolha a Habilidade Básica do 1º nível.');
        else {
            if (e.hb === e.estilo.hbInata && est) p.push('Essa já é a sua Habilidade Básica Inata: escolha outra (não se repetem).');
            const op = e.hbOpcoes?.[hb.id] ?? [];
            if (hb.escolha === 'prodigio' && !['corpo', 'distancia'].includes(op[0] ?? ''))
                p.push('Prodígio do Combate: escolha corpo a corpo ou à distância no Crítico Marcial.');
            if (hb.escolha === 'quebrador' && !OPCOES_QUEBRADOR.some((o) => o.id === op[0]))
                p.push('Quebrador de Regras: escolha uma característica.');
        }
    }
    if (etapa === 'haki' && !['armamento', 'observacao'].includes(e.hakiAfinidade ?? ''))
        p.push('Escolha o Haki com mais afinidade: Armamento ou Observação.');
    if (etapa === 'atributos') {
        const { metodo, base } = e.atributos;
        const valores = ATRIBUTOS.map((a) => base[a.id]);
        if (metodo === 'compra' && custoDaCompra(base) > PONTOS_DE_COMPRA) p.push(`Você gastou mais de ${PONTOS_DE_COMPRA} pontos.`);
        if (metodo === 'compra' && valores.some((v) => v < 8 || v > 15)) p.push('Na compra de pontos os valores vão de 8 a 15.');
        if (metodo === 'padrao' && [...valores].sort((x, y) => y - x).join() !== [...VALORES_PADRAO].join())
            p.push('Distribua os valores 15, 14, 13, 12, 10 e 8, um para cada atributo.');
        if (metodo === 'rolagem') {
            const rolados = e.rolados;
            if (!rolados) p.push('Role os atributos primeiro.');
            else if ([...valores].sort().join() !== [...rolados].sort().join())
                p.push('Distribua exatamente os valores rolados, um para cada atributo.');
        }
    }

    return p;
}

// --- campos da ficha --------------------------------------------------------------------------------------------------

/** Uma Habilidade Básica que o personagem tem: o `nivel` é aquele em que foi escolhida; `opcao` guarda a escolha dela. */
export interface HBDaFicha {
    id: string;
    nivel: number;
    opcao?: string;
}

/** Aplica `passos` degraus ao dado de vida (d8 → d10 → d12); no d12 devolve `extra` = passos que sobraram (PV por nível). */
export function dadoComPassos(base: DadoDeVida, passos: number): { dado: DadoDeVida; extra: number } {
    const i = DADOS_DE_VIDA.indexOf(base);
    const alvo = Math.min(i + passos, DADOS_DE_VIDA.indexOf('d12'));

    return { dado: DADOS_DE_VIDA[Math.max(alvo, i)], extra: Math.max(0, i + passos - Math.max(alvo, i)) };
}

/** O dado de vida do personagem depois da Vitalidade Exuberante (quantas vezes foi escolhida, até o nível dado). */
export function dadoDeVidaFinal(base: DadoDeVida, hbs: HBDaFicha[], nivel: number): DadoDeVida {
    const n = hbs.filter((h) => h.opcao === 'vitalidade' && h.nivel <= nivel).length;

    return dadoComPassos(base, n).dado;
}

/** As Habilidades Básicas que o assistente define no 1º nível: a Inata do estilo e a escolhida. */
export function hbsDoAssistente(e: Escolhas): HBDaFicha[] {
    const lista: HBDaFicha[] = [];
    if (e.estilo.hbInata) lista.push({ id: e.estilo.hbInata, nivel: 1, opcao: 'inata' });
    if (e.hb) {
        const op = e.hbOpcoes?.[e.hb]?.[0];
        lista.push({ id: e.hb, nivel: 1, ...(op ? { opcao: op } : {}) });
    }

    return lista;
}
/**
 * As características das Habilidades Básicas da ficha, prontas para `caracteristicas` (todas marcadas `hb`). Refaz tudo a
 * cada chamada: quem chama troca as características com `hb` por estas. `opcao: 'inata'` não carrega escolha.
 */
export function caracteristicasDasHB(hbs: HBDaFicha[], primario: AtributoId, nivel: number, dadoBase: DadoDeVida = 'd8'): Caracteristica[] {
    const ids = [...new Set(hbs.map((h) => h.id))];

    return ids.flatMap((id) => {
        const hb = hbPorId(id);
        if (!hb) return [];
        const opcoes = hbs.filter((h) => h.id === id && h.opcao && h.opcao !== 'inata').map((h) => h.opcao!);
        let vitalidade = 0;

        return hb
            .tracos({ primario, opcoes })
            .filter((traco) => ativaNoNivel(traco, nivel))
            .map((traco) => {
                const c = caracteristicaDe({ traco, origem: `Habilidade Básica: ${hb.nome}`, builder: 'estilo' }, nivel);
                // Vitalidade Exuberante com o d12 já no máximo: +1 PV por nível
                if (traco.id === 'quebrador-vitalidade') {
                    if (dadoComPassos(dadoBase, vitalidade).dado === 'd12') c.efeitos = [{ alvo: 'pv.max', modo: 'soma', valor: '@nivel' }];
                    vitalidade += 1;
                }

                return c;
            });
    });
}

/** Aprimoramento Inato (Quebrador de Regras): +1 permanente no atributo, direto no valor e nunca acima de 20 por ele. */
export function atributosComAprimoramentoInato(atributos: Record<AtributoId, number>, hbs: HBDaFicha[]): Record<AtributoId, number> {
    const r = { ...atributos };
    for (const h of hbs) {
        const id = h.opcao?.startsWith('inato-') ? (h.opcao.slice(6) as AtributoId) : null;
        if (id && id in r) r[id] = Math.max(r[id], Math.min(20, r[id] + 1));
    }

    return r;
}

/** As características dos Traços de Maestria já escolhidos (marcadas `builder: 'maestria'`). */
export function caracteristicasDaMaestria(maestriaId: string, tracos: { id: string; nivel: number }[], nivel: number): Caracteristica[] {
    const m = maestriaPorId(maestriaId);
    if (!m) return [];

    return tracos.flatMap((escolhido) => {
        const traco = m.tracos.find((x) => x.id === escolhido.id);

        return traco ? [caracteristicaDe({ traco, origem: `Maestria: ${m.nome}`, builder: 'maestria' }, nivel)] : [];
    });
}

/** As técnicas que os Traços de Maestria escolhidos dão (Imaculado: Noryoku Hunter). */
export function tecnicasDaMaestria(maestriaId: string, tracos: { id: string }[]): Tecnica[] {
    const m = maestriaPorId(maestriaId);

    return (m?.tracos ?? [])
        .filter((x) => tracos.some((t) => t.id === x.id))
        .flatMap((x) => x.tecnicas ?? [])
        .map((t): Tecnica => ({ ...t, builder: 'maestria' }));
}

/** Uma característica da ficha a partir de um traço. */
export function caracteristicaDe(t: TracoEscolhido, nivel: number): Caracteristica {
    const { traco } = t;
    const c: Caracteristica = {
        nome: traco.nome,
        origem: t.origem,
        tipo: traco.tipo ?? 'passiva',
        descricao: traco.descricao,
        builder: t.builder,
    };
    if (traco.usos) {
        const prof = 2 + Math.floor((nivel - 1) / 4);
        const max = traco.usos.formula
            ? Math.floor(avaliar(traco.usos.formula, { nivel, prof }))
            : traco.usos.porNivel
              ? nivel
              : traco.usos.porProf
                ? prof
                : (traco.usos.max ?? 0);
        c.usos = {
            atual: max,
            max,
            ...(traco.usos.porNivel ? { porNivel: true } : {}),
            ...(traco.usos.porProf ? { porProf: true } : {}),
            ...(traco.usos.formula ? { formula: traco.usos.formula } : {}),
        };
        c.descanso = traco.usos.descanso ?? 'longo';
    }
    if (traco.efeitos?.length) c.efeitos = traco.efeitos as EfeitoBruto[];
    if (traco.acao) c.acao = traco.acao;
    if (traco.etiquetas?.length) c.etiquetas = traco.etiquetas;
    if (traco.grupoRodada) c.grupoRodada = traco.grupoRodada;
    if (traco.alternativo && c.usos) c.alternativo = { atual: traco.alternativo, max: traco.alternativo };
    if (traco.acoes?.length) c.acoes = traco.acoes;
    if (traco.reacao) c.reacao = traco.reacao;
    if (c.tipo === 'ativa' && c.efeitos) c.ativa = false;
    if (traco.nivelMin && traco.nivelMin > 1) c.nivelMin = traco.nivelMin;
    if (traco.nivelMax) c.nivelMax = traco.nivelMax;
    if (traco.hb) c.hb = traco.hb;

    return c;
}

export interface Resultado {
    campos: Record<string, unknown>;
    /** Avisos para mostrar no resumo (ex.: limites que o jogador precisa lembrar). */
    avisos: string[];
}

/**
 * Os campos da ficha a salvar ao concluir (ou ao refazer) a criação. As características que o assistente criou antes
 * (`builder`) são substituídas; as que o jogador criou à mão ficam.
 */
export function camposDaCriacao(
    e: Escolhas,
    atual: {
        caracteristicas?: Caracteristica[];
        tecnicas?: Tecnica[];
        nivel?: number;
        proficienciasArmas?: string[];
        habilidadesBasicas?: { id: string; nivel: number; opcao?: string }[];
        profissoes?: Partial<ProfissoesFicha>;
        ferramentas?: { nome: string; prof: 0 | 1 | 2; atributo: AtributoId }[];
    } = {},
): Resultado {
    const nivel = atual.nivel ?? 1;
    const fisico = fisicoDe(e);
    const tracos = todosOsTracos(e);
    const avisos: string[] = [];
    if (!fisico) return { campos: {}, avisos: ['Escolha a espécie.'] };

    const finais = atributosFinais(e);
    const pericias: Record<string, Proficiencia> = Object.fromEntries(PERICIAS.map((p) => [p.id, 0 as Proficiencia]));
    for (const pedido of pedidosDaEtapaEscolhas(e)) {
        const nivelProf = pedido.traco.escolhaPericias!.nivel;
        for (const id of e.pericias[pedido.traco.id] ?? []) pericias[id] = Math.max(pericias[id] ?? 0, nivelProf) as Proficiencia;
        if (pedido.traco.escolhaPericias!.troca && e.trocas[pedido.traco.id])
            tracos.push({ traco: pedido.traco.escolhaPericias!.troca.traco, origem: 'Herança Cultural', builder: 'especie' });
    }
    const estilo = estiloPorId(e.estilo.id);
    // Perícias livres do estilo (proficiência)
    for (const id of estilo ? (e.estilo.pericias ?? []) : []) pericias[id] = Math.max(pericias[id] ?? 0, 1) as Proficiencia;
    // Antecedente: proficiência na perícia escolhida
    const antecedente = antecedentePorId(e.antecedente?.id);
    if (antecedente && e.antecedente?.pericia) pericias[e.antecedente.pericia] = Math.max(pericias[e.antecedente.pericia] ?? 0, 1) as Proficiencia;
    // Profissão: proficiência nas 2 perícias escolhidas e a perícia Ofício (treinada)
    const profissaoInicial = e.profissao?.id && problemasDaProfissao(e.profissao).length === 0 ? camposDaProfissaoInicial(e.profissao, atual) : null;
    if (profissaoInicial) {
        for (const id of profissaoInicial.pericias) pericias[id] = Math.max(pericias[id] ?? 0, 1) as Proficiencia;
        pericias.oficio = Math.max(pericias.oficio ?? 0, profissaoInicial.oficio) as Proficiencia;
    }
    // Aptidão Natural: dobra a proficiência de uma perícia que o personagem já tem (do estilo ou de Adaptação)
    for (const pedido of pedidosDePericia(e).filter((x) => x.traco.escolhaPericias?.soProficientes))
        for (const id of e.pericias[pedido.traco.id] ?? [])
            if ((pericias[id] ?? 0) >= 1) pericias[id] = Math.max(pericias[id], pedido.traco.escolhaPericias!.nivel) as Proficiencia;
    const salvaguardas = [...new Set([...tracos.flatMap((t) => t.traco.salvaguardas ?? []), ...(estilo?.salvaguardas ?? [])])];
    const resistencias = [...new Set(tracos.flatMap((t) => t.traco.resistencias ?? []))];
    const imunidades = [...new Set(tracos.flatMap((t) => t.traco.imunidades ?? []))];

    // as da Maestria vêm do "Subir de nível" (Traço de Maestria no 9º, 13º e 17º): refazer a criação as mantém
    const manuais = (atual.caracteristicas ?? []).filter(
        (c) => !c.builder || ['maestria', 'haki', 'treinamento', 'akuma', 'individualidade'].includes(c.builder),
    );
    // Traço com `partes` (Corpo Pequeno) vira uma característica por parte
    const caracteristicaDoAntecedente = antecedente
        ? (e.antecedente?.personalizado && e.antecedente.caracteristicaDe
              ? (antecedentePorId(e.antecedente.caracteristicaDe) ?? antecedente)
              : antecedente
          ).caracteristica
        : null;
    const geradas = tracos
        .flatMap((t) => (t.traco.partes ? t.traco.partes.map((parte) => ({ ...t, traco: parte, origem: `${t.origem}: ${t.traco.nome}` })) : [t]))
        .map((t) => caracteristicaDe(t, nivel));
    if (antecedente && caracteristicaDoAntecedente)
        geradas.push(
            caracteristicaDe({ traco: caracteristicaDoAntecedente, origem: `Antecedente: ${antecedente.nome}`, builder: 'antecedente' }, nivel),
        );
    if (profissaoInicial) geradas.push(...caracteristicasDasProfissoes(profissaoInicial.profissoes, nivel));
    const hbsAntigas = (atual.habilidadesBasicas ?? []).filter((h) => h.nivel > 1);
    const hbs: HBDaFicha[] = [...hbsDoAssistente(e), ...hbsAntigas];
    const dadoBase = estilo?.dado ?? e.estilo.dado;
    const finaisComHB = atributosComAprimoramentoInato(finais, hbs);
    if (estilo)
        geradas.push(...caracteristicasDasHB(hbs, atributoPrimarioDe(estilo, e.estilo.primario) ?? estilo.atributosPrimarios[0], nivel, dadoBase));
    if (estilo)
        geradas.push(
            ...tracosDoEstiloNoNivel(estilo, e.estilo.caminho, nivel).map((traco) =>
                caracteristicaDe({ traco, origem: estilo.nome, builder: 'estilo' }, nivel),
            ),
        );
    const pv = pvInicial(e);
    const campos: Record<string, unknown> = {
        especie: fisico.nome,
        estilo: estilo ? estilo.nome : e.estilo.nome.trim(),
        ...(antecedente ? { antecedente: antecedente.nome } : {}),
        ...(profissaoInicial
            ? {
                  profissao: profissaoInicial.profissao,
                  profissoes: profissaoInicial.profissoes,
                  ferramentas: refazerFerramentas(atual.ferramentas ?? [], profissaoInicial.profissoes),
              }
            : {}),
        ...(estilo
            ? {
                  atributoPrimario: atributoPrimarioDe(estilo, e.estilo.primario) ?? estilo.atributosPrimarios[0],
                  estiloId: estilo.id,
                  estiloCaminho: e.estilo.caminho ?? '',
                  proficienciasArmas: [...new Set([...(atual.proficienciasArmas ?? []), ...estilo.proficiencias])],
                  habilidadesBasicas: hbs,
              }
            : {}),
        tamanho: fisico.categoria,
        'movimento.normal': fisico.movimento.normal,
        'movimento.nado': fisico.movimento.nado,
        'movimento.escalada': fisico.movimento.escalada,
        'movimento.voo': fisico.movimento.voo,
        deslocamento: textoDeMovimento(fisico.movimento),
        ...(e.hakiAfinidade ? { 'haki.afinidade': e.hakiAfinidade } : {}),
        ...Object.fromEntries(ATRIBUTOS.map((a) => [`atributos.${a.id}`, finaisComHB[a.id]])),
        ...Object.fromEntries(Object.entries(pericias).map(([id, n]) => [`pericias.${id}`, n])),
        salvaguardas,
        resistencias,
        imunidades,
        'dadosVida.tipo': dadoDeVidaFinal(dadoBase, hbs, nivel),
        'dadosVida.restantes': nivel,
        'pv.max': pv,
        'pv.atual': pv,
        'pp.atual': nivel * 4,
        ancestralidade: e.ancestralidade.trim(),
        caracteristicas: [...manuais, ...geradas],
        // Técnicas que os traços dão (esfera de fogo): as do assistente são refeitas, as criadas à mão ficam.
        'tecnicas.lista': [
            ...(atual.tecnicas ?? []).filter((t) => !t.builder || t.builder === 'maestria' || t.builder === 'treinamento' || t.builder === 'criador'),
            ...(estilo ? tecnicasDoEstiloNoNivel(estilo, e.estilo.caminho, nivel).map(tecnicaDoEstilo) : []),
            ...tracos
                .flatMap((t) => t.traco.partes ?? [t.traco])
                .flatMap((t) => t.tecnicas ?? [])
                .map((t): Tecnica => ({ ...t, builder: 'especie' })),
        ],
    };
    avisos.push(`Preconceito: ${fisico.preconceito}.`);
    if (estilo) {
        avisos.push(`Equipamento inicial (${estilo.nome}): ${estilo.equipamento}`);
        if (e.estilo.armaFavorita) avisos.push(`Arma favorita: ${e.estilo.armaFavorita}.`);
    }
    if (profissaoInicial && e.profissao?.id !== 'nenhuma') {
        const prof = profissaoPorId(e.profissao!.id);
        if (prof) avisos.push(`Itens iniciais de ${prof.nome} (o mestre entrega): ${prof.itens.join('; ')}.`);
    }
    if (e.variacaoRara) avisos.push('Variação Rara: exceção absoluta, depende da aprovação do Narrador.');
    if (tracos.some((t) => t.traco.id === 'tracos-culturais'))
        avisos.push(`Pontos de Treinamento: ${Math.max(0, modificador(finais.sab))} (mod. de Sabedoria). Os treinamentos entram com o Capítulo 5.`);
    if (tracos.some((t) => t.traco.pedeAncestralidade) && !e.ancestralidade.trim())
        avisos.push('Escreva os traços de Ancestralidade no campo da aba Detalhes.');

    return { campos, avisos };
}

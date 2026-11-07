/**
 * Lógica do assistente de criação do One Piece: das ESCOLHAS do jogador (espécie, variante, ajuste de atributo...) saem
 * os CAMPOS da ficha, que a tela salva em lote. Arquivo PURO (sem Vue): o Node o executa direto nos testes.
 *
 * Etapas: espécie (única ou mestiça) → escolhas → variação rara → estilo de luta → atributos → resumo.
 */
import type { EfeitoBruto } from '../../../nucleo/efeitos/efeitos.ts';
import {
    ATRIBUTOS,
    PERICIAS,
    modificador,
    textoDeMovimento,
    type AtributoId,
    type Caracteristica,
    type Proficiencia,
    type Tecnica,
} from '../regras.ts';
import { ESPECIES, TRACO_CULTURAL } from './dados/especies.ts';
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
    estilo: { nome: string; dado: DadoDeVida };
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
    estilo: { nome: '', dado: 'd8' },
    atributos: { metodo: 'padrao', base: { for: 10, des: 10, con: 10, sab: 10, pre: 10, von: 10 } },
    rolados: null,
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
    builder: 'especie' | 'variacao';
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

    return f;
}

/** PV máximo no nível 1: dado de vida do estilo no máximo + mod. CON + PV base da espécie. */
export function pvInicial(e: Escolhas): number {
    const dado = Number(e.estilo.dado.slice(1));
    const fisico = fisicoDe(e);

    return Math.max(1, dado + modificador(atributosFinais(e).con) + (fisico?.pv ?? 0));
}

// --- validação por etapa -------------------------------------------------------------------------------------------

export type EtapaId = 'especie' | 'escolhas' | 'variacao' | 'estilo' | 'atributos' | 'resumo';
export const ETAPAS: { id: EtapaId; rotulo: string }[] = [
    { id: 'especie', rotulo: 'Espécie' },
    { id: 'escolhas', rotulo: 'Escolhas' },
    { id: 'variacao', rotulo: 'Variação rara' },
    { id: 'estilo', rotulo: 'Estilo de luta' },
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
        for (const pedido of pedidosDePericia(e)) {
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
    if (etapa === 'estilo' && !e.estilo.nome.trim()) p.push('Dê um nome ao estilo de luta.');
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
        const max = traco.usos.porNivel ? nivel : (traco.usos.max ?? 0);
        c.usos = { atual: max, max, ...(traco.usos.porNivel ? { porNivel: true } : {}) };
        c.descanso = traco.usos.descanso ?? 'longo';
    }
    if (traco.efeitos?.length) c.efeitos = traco.efeitos as EfeitoBruto[];
    if (traco.acao) c.acao = traco.acao;
    if (traco.etiquetas?.length) c.etiquetas = traco.etiquetas;
    if (traco.grupoRodada) c.grupoRodada = traco.grupoRodada;
    if (traco.alternativo && c.usos) c.alternativo = { atual: traco.alternativo, max: traco.alternativo };
    if (traco.acoes?.length) c.acoes = traco.acoes;
    if (c.tipo === 'ativa' && c.efeitos) c.ativa = false;

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
export function camposDaCriacao(e: Escolhas, atual: { caracteristicas?: Caracteristica[]; tecnicas?: Tecnica[]; nivel?: number } = {}): Resultado {
    const nivel = atual.nivel ?? 1;
    const fisico = fisicoDe(e);
    const tracos = todosOsTracos(e);
    const avisos: string[] = [];
    if (!fisico) return { campos: {}, avisos: ['Escolha a espécie.'] };

    const finais = atributosFinais(e);
    const pericias: Record<string, Proficiencia> = Object.fromEntries(PERICIAS.map((p) => [p.id, 0 as Proficiencia]));
    for (const pedido of pedidosDePericia(e)) {
        const nivelProf = pedido.traco.escolhaPericias!.nivel;
        for (const id of e.pericias[pedido.traco.id] ?? []) pericias[id] = Math.max(pericias[id] ?? 0, nivelProf) as Proficiencia;
        if (pedido.traco.escolhaPericias!.troca && e.trocas[pedido.traco.id])
            tracos.push({ traco: pedido.traco.escolhaPericias!.troca.traco, origem: 'Herança Cultural', builder: 'especie' });
    }
    const salvaguardas = [...new Set(tracos.flatMap((t) => t.traco.salvaguardas ?? []))];
    const resistencias = [...new Set(tracos.flatMap((t) => t.traco.resistencias ?? []))];
    const imunidades = [...new Set(tracos.flatMap((t) => t.traco.imunidades ?? []))];

    const manuais = (atual.caracteristicas ?? []).filter((c) => !c.builder);
    // Traço com `partes` (Corpo Pequeno) vira uma característica por parte
    const geradas = tracos
        .flatMap((t) => (t.traco.partes ? t.traco.partes.map((parte) => ({ ...t, traco: parte, origem: `${t.origem}: ${t.traco.nome}` })) : [t]))
        .map((t) => caracteristicaDe(t, nivel));
    const pv = pvInicial(e);
    const campos: Record<string, unknown> = {
        especie: fisico.nome,
        estilo: e.estilo.nome.trim(),
        tamanho: fisico.categoria,
        'movimento.normal': fisico.movimento.normal,
        'movimento.nado': fisico.movimento.nado,
        'movimento.escalada': fisico.movimento.escalada,
        'movimento.voo': fisico.movimento.voo,
        deslocamento: textoDeMovimento(fisico.movimento),
        ...Object.fromEntries(ATRIBUTOS.map((a) => [`atributos.${a.id}`, finais[a.id]])),
        ...Object.fromEntries(Object.entries(pericias).map(([id, n]) => [`pericias.${id}`, n])),
        salvaguardas,
        resistencias,
        imunidades,
        'dadosVida.tipo': e.estilo.dado,
        'dadosVida.restantes': nivel,
        'pv.max': pv,
        'pv.atual': pv,
        'pp.atual': nivel * 4,
        ancestralidade: e.ancestralidade.trim(),
        caracteristicas: [...manuais, ...geradas],
        // Técnicas que os traços dão (esfera de fogo): as do assistente são refeitas, as criadas à mão ficam.
        'tecnicas.lista': [
            ...(atual.tecnicas ?? []).filter((t) => !t.builder),
            ...tracos
                .flatMap((t) => t.traco.partes ?? [t.traco])
                .flatMap((t) => t.tecnicas ?? [])
                .map((t): Tecnica => ({ ...t, builder: 'especie' })),
        ],
    };
    avisos.push(`Preconceito: ${fisico.preconceito}.`);
    if (e.variacaoRara) avisos.push('Variação Rara: exceção absoluta, depende da aprovação do Narrador.');
    if (tracos.some((t) => t.traco.id === 'tracos-culturais'))
        avisos.push(`Pontos de Treinamento: ${Math.max(0, modificador(finais.sab))} (mod. de Sabedoria). Os treinamentos entram com o Capítulo 5.`);
    if (tracos.some((t) => t.traco.pedeAncestralidade) && !e.ancestralidade.trim())
        avisos.push('Escreva os traços de Ancestralidade no campo da aba Detalhes.');

    return { campos, avisos };
}

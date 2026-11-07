/**
 * Regras do Haki (cap. 7), puras: PA ganhos, gasto, estágio, compra de talentos e as características geradas. Espelhadas
 * em `app/Sistemas/OnePiece/Haki.php` (conferidas por `tests/paridade/haki.json`). Arquivo PURO (sem Vue).
 *
 * O saldo é CALCULADO, nunca guardado: ganhos (nível, despertar prematuro, Ambição Crescente, afinidade, extras do mestre)
 * menos o que está gasto nos talentos comprados. Nada é perdido automaticamente; passar de 20 PA ociosos só gera aviso.
 */
import type { TracoDados } from '../construtor/dados/tipos.ts';
import { caracteristicaDe } from '../construtor/regras.ts';
import type { Caracteristica } from '../regras.ts';
import {
    MAX_PA_OCIOSOS,
    NIVEL_DO_HAKI,
    PA_DA_AFINIDADE,
    PA_NO_NIVEL_DO_HAKI,
    PA_POR_NIVEL,
    estagio,
    estagioDoGasto,
    gastoPorTipo,
    hakiPadrao,
    talentosEfetivos,
    tipoDesperto,
    totalGasto,
    type HakiFicha,
    type TalentoComprado,
} from './calculo.ts';
import { TALENTOS_HAKI, TIPOS_HAKI, formasDoTalento, talentoPorId, type ExtrasDaForma, type TalentoHaki, type TipoHaki } from './dados.ts';

export {
    MAX_PA_OCIOSOS,
    NIVEL_DO_HAKI,
    PA_DA_AFINIDADE,
    PA_NO_NIVEL_DO_HAKI,
    PA_POR_NIVEL,
    estagio,
    estagioDoGasto,
    gastoPorTipo,
    hakiPadrao,
    talentosEfetivos,
    tipoDesperto,
    totalGasto,
};
export type { HakiFicha, TalentoComprado };

const nivelDe = (n: number | string): number => Math.max(1, Math.floor(Number(n)) || 1);

/** O personagem despertou o Haki: no 8º nível, ou quando o mestre liberou. */
export const hakiDesperto = (h: HakiFicha, nivel: number): boolean => nivelDe(nivel) >= NIVEL_DO_HAKI || h.liberado;

/** A aba é do jogador? O mestre a vê sempre. */
export const abaDoHakiVisivel = (h: HakiFicha, nivel: number, mestre: boolean): boolean => mestre || hakiDesperto(h, nivel);

/** PA pelo nível: 5 no 8º e +12 por nível depois. */
export const paPorNivel = (nivel: number): number =>
    nivelDe(nivel) >= NIVEL_DO_HAKI ? PA_NO_NIVEL_DO_HAKI + PA_POR_NIVEL * (nivelDe(nivel) - NIVEL_DO_HAKI) : 0;

/** Despertar prematuro: 2 PA ao marcar e +2 por nível ganho depois, até o 8º. */
export function paDoDespertarPrematuro(nivel: number, prematuroNivel: number): number {
    if (prematuroNivel <= 0 || nivelDe(nivel) < prematuroNivel || prematuroNivel >= NIVEL_DO_HAKI) return 0;

    return 2 + 2 * (Math.min(nivelDe(nivel), NIVEL_DO_HAKI) - prematuroNivel);
}

/** "Ambição Crescente" (talento Rei): +2 PA no 10º nível e a cada nível depois, retroativo. */
export const paDaAmbicaoCrescente = (nivel: number, rei: boolean): number => (rei && nivelDe(nivel) >= 10 ? 2 * (nivelDe(nivel) - 9) : 0);

export interface ResumoDosPA {
    /** PA gerais ganhos (nível, prematuro, Ambição Crescente, afinidade e extras do mestre). */
    ganhosGerais: number;
    gastoGeral: number;
    /** Disponível no saldo geral. */
    disponiveis: number;
    /** O que sobra de cada pool restrito. */
    restritosRestantes: Record<TipoHaki, number>;
    gastoPorTipo: Record<TipoHaki, number>;
    /** Tudo o que ele ainda pode gastar (geral + restritos). */
    ociosos: number;
    /** Passou de 20 PA ociosos (só aviso). */
    excedeOciosos: boolean;
    estagio: 0 | 1 | 2 | 3;
}

/** `bonus`: PA de outras fontes (treinamento Iniciada em Haki). */
export function resumoDosPA(h: HakiFicha, nivel: number, bonus = 0): ResumoDosPA {
    const gasto = gastoPorTipo(h);
    const afinidade = h.afinidade && gasto[h.afinidade] >= 1 ? PA_DA_AFINIDADE : 0;
    const ganhos =
        paPorNivel(nivel) +
        paDoDespertarPrematuro(nivel, h.prematuroNivel) +
        paDaAmbicaoCrescente(nivel, h.rei) +
        afinidade +
        (h.extras || 0) +
        bonus;
    const restritosRestantes = { armamento: 0, observacao: 0, rei: 0 } as Record<TipoHaki, number>;
    let gastoGeral = 0;
    for (const { id } of TIPOS_HAKI) {
        const restrito = Math.max(0, h.restritos?.[id] ?? 0);
        restritosRestantes[id] = Math.max(0, restrito - gasto[id]);
        gastoGeral += Math.max(0, gasto[id] - restrito);
    }
    const disponiveis = ganhos - gastoGeral;
    const ociosos = Math.max(0, disponiveis) + Object.values(restritosRestantes).reduce((a, b) => a + b, 0);

    return {
        ganhosGerais: ganhos,
        gastoGeral,
        disponiveis,
        restritosRestantes,
        gastoPorTipo: gasto,
        ociosos,
        excedeOciosos: ociosos > MAX_PA_OCIOSOS,
        estagio: estagioDoGasto(Object.values(gasto).reduce((a, b) => a + b, 0)),
    };
}

export interface PodeComprar {
    ok: boolean;
    motivo?: string;
    /** A forma que seria comprada (1 base, 2 dominada, 3 avançada). */
    forma?: number;
    custo?: number;
}

const formaDe = (h: HakiFicha, id: string): number => h.talentos.find((t) => t.id === id)?.formas ?? 0;

/** Estágio mínimo para comprar a forma `n` do talento (o 1º talento é comprado ainda Latente: o estágio nasce do gasto). */
export const estagioDaForma = (t: TalentoHaki, forma: number): number =>
    forma >= 3 ? 3 : forma === 2 ? Math.max(2, t.estagio) : t.estagio === 1 ? 0 : t.estagio;

/** A próxima forma do talento pode ser comprada agora? Devolve o motivo quando não. */
export function podeComprar(h: HakiFicha, nivel: number, id: string, bonus = 0): PodeComprar {
    const t = talentoPorId(id);
    if (!t) return { ok: false, motivo: 'Talento desconhecido.' };
    if (t.id === 'rei') return { ok: false, motivo: 'O talento Rei vem de graça com o Haki do Rei.' };
    if (!hakiDesperto(h, nivel)) return { ok: false, motivo: 'O Haki ainda não foi despertado.' };
    if (t.tipo === 'rei' && !h.rei) return { ok: false, motivo: 'Você não tem o Haki do Rei.' };
    const forma = formaDe(h, id) + 1;
    if (forma > formasDoTalento(t)) return { ok: false, motivo: 'Todas as formas deste talento já foram compradas.' };
    for (const r of t.requisitos) {
        if (r === 'rei' ? !h.rei : formaDe(h, r) < 1) return { ok: false, motivo: `Requisito: ${talentoPorId(r)?.nome ?? r}.` };
    }
    const atual = estagio(h);
    const exigido = estagioDaForma(t, forma);
    if (atual < exigido)
        return {
            ok: false,
            motivo: `Exige o Estágio ${['', 'Inexperiente', 'Treinado', 'Perito'][exigido]} (você tem ${['Latente', 'Inexperiente', 'Treinado', 'Perito'][atual]}).`,
        };
    const r = resumoDosPA(h, nivel, bonus);
    const disponivel = r.disponiveis + r.restritosRestantes[t.tipo];
    if (disponivel < t.custo)
        return { ok: false, motivo: `Faltam PA: custa ${t.custo} e você tem ${Math.max(0, disponivel)} para este tipo.`, forma, custo: t.custo };

    return { ok: true, forma, custo: t.custo };
}

/** Compra a próxima forma. Chame só depois de `podeComprar` ok. */
export function comprar(h: HakiFicha, id: string): HakiFicha {
    const talentos = h.talentos.some((t) => t.id === id)
        ? h.talentos.map((t) => (t.id === id ? { ...t, formas: t.formas + 1 } : t))
        : [...h.talentos, { id, formas: 1 }];

    return { ...h, talentos };
}

/** O mestre devolve a última forma comprada; não pode se outro talento comprado depende dele (ao zerar). */
export function podeDevolver(h: HakiFicha, id: string): PodeComprar {
    const atual = formaDe(h, id);
    if (atual < 1) return { ok: false, motivo: 'Este talento não foi comprado.' };
    if (atual === 1) {
        const dependente = h.talentos.find((t) => t.id !== id && talentoPorId(t.id)?.requisitos.includes(id));
        if (dependente) return { ok: false, motivo: `${talentoPorId(dependente.id)!.nome} depende dele.` };
    }

    return { ok: true };
}

export function devolver(h: HakiFicha, id: string): HakiFicha {
    const talentos = h.talentos.flatMap((t) => (t.id !== id ? [t] : t.formas > 1 ? [{ ...t, formas: t.formas - 1 }] : []));

    return { ...h, talentos };
}

/**
 * Confere uma ficha inteira (o servidor usa o espelho PHP): talentos e formas conhecidos, pré-requisitos, tipo do Rei e
 * orçamento. A ordem das compras decide o estágio, então compra-se em ordem crescente de estágio exigido (o melhor caso).
 */
export function problemasDoHaki(h: HakiFicha, nivel: number, bonus = 0): string[] {
    const p: string[] = [];
    const vistos = new Set<string>();
    for (const c of h.talentos) {
        const t = talentoPorId(c.id);
        if (!t || t.id === 'rei') p.push(`Talento inválido: ${c.id}.`);
        else if (vistos.has(c.id)) p.push(`Talento repetido: ${t.nome}.`);
        else if (!Number.isInteger(c.formas) || c.formas < 1 || c.formas > formasDoTalento(t)) p.push(`${t.nome}: forma inválida.`);
        vistos.add(c.id);
    }
    if (p.length) return p;
    if (h.talentos.length && !hakiDesperto(h, nivel)) p.push('O Haki ainda não foi despertado.');
    for (const c of h.talentos) {
        const t = talentoPorId(c.id)!;
        if (t.tipo === 'rei' && !h.rei) p.push(`${t.nome}: o personagem não tem o Haki do Rei.`);
        for (const r of t.requisitos) if (r !== 'rei' && formaDe(h, r) < 1) p.push(`${t.nome}: falta o requisito ${talentoPorId(r)?.nome ?? r}.`);
    }
    // estágio exigido por cada forma, em ordem crescente, contra o gasto acumulado antes dela
    const itens = h.talentos
        .flatMap((c) => {
            const t = talentoPorId(c.id)!;

            return Array.from({ length: c.formas }, (_, i) => ({ t, exigido: estagioDaForma(t, i + 1) }));
        })
        .sort((a, b) => a.exigido - b.exigido);
    let acumulado = 0;
    for (const { t, exigido } of itens) {
        if (estagioDoGasto(acumulado) < exigido)
            p.push(`${t.nome}: exige o Estágio ${['', 'Inexperiente', 'Treinado', 'Perito'][exigido]} antes da compra.`);
        acumulado += t.custo;
    }
    if (resumoDosPA(h, nivel, bonus).disponiveis < 0) p.push('Os talentos custam mais PA do que o personagem tem.');
    for (const { id } of TIPOS_HAKI)
        if (h.afinidade === 'rei' && !h.rei && id === 'rei') p.push('A afinidade com o Haki do Rei exige o Haki do Rei.');

    return p;
}

// --- características geradas ----------------------------------------------------------------------------------------------

/** A característica de um talento com `formas` formas compradas: texto de todas e extras da última que os define. */
export function tracoDoTalento(t: TalentoHaki, formas: number): TracoDados {
    const textos = [t.base.texto];
    let extras: ExtrasDaForma = { ...(t.base.extras ?? {}) };
    const lista = [t.dominada, t.avancada];
    const sinais = ['☆ Forma Dominada', '★ Forma Avançada'];
    lista.forEach((forma, i) => {
        if (!forma || formas < i + 2) return;
        textos.push(`${sinais[i]}: ${forma.texto}`);
        if (forma.extras) extras = { ...extras, ...forma.extras };
        // `usos: undefined` numa forma tira o limite de uso
        if (forma.extras && 'usos' in forma.extras && forma.extras.usos === undefined) delete extras.usos;
    });
    const nome = t.nome + (formas >= 3 ? ' ★' : formas === 2 ? ' ☆' : '');

    return {
        id: t.id,
        nome,
        descricao: textos.join('\n\n'),
        ...(extras as Partial<TracoDados>),
    };
}

/** Todas as características do Haki da ficha (`builder: 'haki'`). */
export function caracteristicasDoHaki(h: HakiFicha, nivel: number): Caracteristica[] {
    return talentosEfetivos(h).flatMap((c) => {
        const t = talentoPorId(c.id);
        if (!t) return [];
        const tipo = TIPOS_HAKI.find((x) => x.id === t.tipo)!;

        return [caracteristicaDe({ traco: tracoDoTalento(t, c.formas), origem: `Haki: ${tipo.nome}`, builder: 'haki' }, nivel)];
    });
}

/**
 * A lista de características da ficha com as do Haki refeitas. As que já existiam mantêm os usos gastos e o
 * interruptor (`ativa`); as manuais e as de outros assistentes ficam como estavam.
 */
export function refazerCaracteristicasDoHaki(atuais: Caracteristica[], h: HakiFicha, nivel: number): Caracteristica[] {
    const antigas = new Map(atuais.filter((c) => c.builder === 'haki').map((c) => [c.nome.replace(/ [☆★]$/, ''), c]));
    const novas = caracteristicasDoHaki(h, nivel).map((c) => {
        const antiga = antigas.get(c.nome.replace(/ [☆★]$/, ''));
        if (antiga?.usos && c.usos) c.usos = { ...c.usos, atual: Math.min(c.usos.max, antiga.usos.atual) };
        if (antiga?.ativa !== undefined && c.tipo === 'ativa' && c.efeitos) c.ativa = antiga.ativa;

        return c;
    });

    return [...atuais.filter((c) => c.builder !== 'haki'), ...novas];
}

/** Treinado: proficiência na perícia Haki (o motor lê isto em `analisar`). */
export const proficienteEmHaki = (h: HakiFicha): boolean => estagio(h) >= 2;

export { TALENTOS_HAKI };

/**
 * Núcleo do cálculo do Haki, sem dependência do resto da ficha (assim `regras.ts` o importa sem ciclo): a forma do campo
 * `haki`, o gasto por tipo e o estágio. As regras de compra, o saldo de PA e as características vêm em `haki/regras.ts`.
 */
import { LIMITES_ESTAGIO, formasDoTalento, talentoPorId, type EstagioHaki, type TipoHaki } from './dados.ts';

export interface TalentoComprado {
    id: string;
    /** 1 = forma base; 2 = + Dominada (☆); 3 = + Avançada (★). */
    formas: number;
}

export interface HakiFicha {
    /** O mestre liberou o Haki (despertar manual); no 8º nível ele desperta sozinho. */
    liberado: boolean;
    /** O jogador liga o Haki (interruptor): só então as características do Haki valem. */
    ativo: boolean;
    /** O mestre revelou o Haki do Rei. */
    rei: boolean;
    /** Nível em que o mestre marcou o despertar prematuro (0 = não). */
    prematuroNivel: number;
    /** PA gerais que o mestre deu (ou tirou, se negativo). */
    extras: number;
    /** PA que só podem ser gastos em um tipo (Maestrias como All Might e Profeta). */
    restritos: Record<TipoHaki, number>;
    principal: '' | 'armamento' | 'observacao';
    afinidade: '' | TipoHaki;
    talentos: TalentoComprado[];
}

export const MAX_PA_OCIOSOS = 20;
export const NIVEL_DO_HAKI = 8;
export const PA_NO_NIVEL_DO_HAKI = 5;
export const PA_POR_NIVEL = 12;
export const PA_DA_AFINIDADE = 2;

export const hakiPadrao = (): HakiFicha => ({
    ativo: false,
    liberado: false,
    rei: false,
    prematuroNivel: 0,
    extras: 0,
    restritos: { armamento: 0, observacao: 0, rei: 0 },
    principal: '',
    afinidade: '',
    talentos: [],
});

/** Os talentos que o personagem tem, contando o "Rei" que vem de graça com o Haki do Rei. */
export function talentosEfetivos(h: HakiFicha): TalentoComprado[] {
    const lista = h.talentos.filter((t) => talentoPorId(t.id));

    return h.rei && !lista.some((t) => t.id === 'rei') ? [{ id: 'rei', formas: 1 }, ...lista] : lista;
}

/** PA gastos em cada tipo (cada forma custa o mesmo que a base). */
export function gastoPorTipo(h: HakiFicha): Record<TipoHaki, number> {
    const r: Record<TipoHaki, number> = { armamento: 0, observacao: 0, rei: 0 };
    for (const c of h.talentos) {
        const t = talentoPorId(c.id);
        if (t) r[t.tipo] += t.custo * Math.min(c.formas, formasDoTalento(t));
    }

    return r;
}

export const totalGasto = (h: HakiFicha): number => Object.values(gastoPorTipo(h)).reduce((a, b) => a + b, 0);

/** Tipo desperto = ao menos 1 PA distribuído nele. */
export const tipoDesperto = (h: HakiFicha, tipo: TipoHaki): boolean => gastoPorTipo(h)[tipo] >= 1;

/** O estágio pela soma dos PA distribuídos nos três tipos: 1-20 Inexperiente, 21-70 Treinado, 71+ Perito. */
export function estagioDoGasto(gasto: number): EstagioHaki {
    let e: EstagioHaki = 0;
    for (const [minimo, estagio] of LIMITES_ESTAGIO) if (gasto >= minimo) e = estagio as EstagioHaki;

    return e;
}
export const estagio = (h: HakiFicha): EstagioHaki => estagioDoGasto(totalGasto(h));

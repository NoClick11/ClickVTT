/**
 * Alvos de efeito do One Piece (formulário do mestre). Os `id` ESPELHAM `OnePiece::alvosDeEfeito()` no servidor e são
 * conferidos contra `tests/paridade/alvos-onepiece.json`. Cada alvo diz os modos que fazem sentido nele: os numéricos
 * (soma, base, mínimo, máximo) só onde existe um valor calculado, e vantagem/desvantagem só onde há um botão d20.
 *
 * Arquivo PURO: o Node o executa direto nos testes de paridade.
 */
import type { ModoEfeito } from '../../nucleo/efeitos/efeitos.ts';
import type { FormatoResumo } from '../../nucleo/efeitos/resumo.ts';
import { ATRIBUTOS, PERICIAS } from './regras.ts';

export interface VariavelEfeitoOnePiece {
    id: string;
    rotulo: string;
    grupo?: string;
}

export interface AlvoEfeitoOnePiece {
    id: string;
    rotulo: string;
    modos: ModoEfeito[];
}

const NUMERICOS: ModoEfeito[] = ['soma', 'base', 'min', 'max'];
const ROLAGEM: ModoEfeito[] = ['vantagem', 'desvantagem'];
const AMBOS: ModoEfeito[] = [...NUMERICOS, ...ROLAGEM];

export const ALVOS_DE_EFEITO: AlvoEfeitoOnePiece[] = [
    { id: 'ca', rotulo: 'Classe de Armadura', modos: NUMERICOS },
    { id: 'iniciativa', rotulo: 'Iniciativa', modos: AMBOS },
    { id: 'pv.max', rotulo: 'Pontos de vida máximos', modos: NUMERICOS },
    { id: 'carga.max', rotulo: 'Capacidade de carga', modos: NUMERICOS },
    { id: 'pp.max', rotulo: 'Pontos de poder máximos', modos: NUMERICOS },
    { id: 'cd', rotulo: 'CD de técnica', modos: NUMERICOS },
    { id: 'ataque', rotulo: 'Ataque de técnica', modos: AMBOS },
    { id: 'ataque.arma', rotulo: 'Ataque com armas (todas)', modos: AMBOS },
    // `dados`: dano extra em dados (Ataque Furtivo 3d6), somado ao dano de cada arma e dobrado no crítico
    { id: 'dano.arma', rotulo: 'Dano com armas (todas)', modos: [...NUMERICOS, 'dados'] },
    { id: 'atributos.*', rotulo: 'Todos os atributos', modos: NUMERICOS },
    ...ATRIBUTOS.map((a) => ({ id: `atributos.${a.id}`, rotulo: `Atributo: ${a.nome}`, modos: NUMERICOS })),
    { id: 'teste.*', rotulo: 'Testes de atributo (todos)', modos: ROLAGEM },
    ...ATRIBUTOS.map((a) => ({ id: `teste.${a.id}`, rotulo: `Teste de ${a.nome}`, modos: ROLAGEM })),
    { id: 'salv.*', rotulo: 'Salvaguardas (todas)', modos: AMBOS },
    ...ATRIBUTOS.map((a) => ({ id: `salv.${a.id}`, rotulo: `Salvaguarda de ${a.nome}`, modos: AMBOS })),
    { id: 'pericia.*', rotulo: 'Perícias (todas)', modos: AMBOS },
    ...PERICIAS.map((p) => ({ id: `pericia.${p.id}`, rotulo: `Perícia: ${p.nome}`, modos: AMBOS })),
    { id: 'ferramenta.*', rotulo: 'Testes de ferramenta', modos: ROLAGEM },
];

/**
 * Variáveis que uma fórmula de efeito pode usar neste alvo. Os efeitos sobre atributos (`atributos.*`) rodam na
 * fase 1, antes de existir qualquer modificador: ali só o nível está disponível. Nos demais alvos valem o
 * modificador de cada atributo, o bônus de proficiência e o nível (ver `analisar` em `regras.ts`).
 */
export function variaveisParaAlvo(alvo: string): VariavelEfeitoOnePiece[] {
    const nivel = { id: 'nivel', rotulo: 'Nível do personagem' };
    if (alvo.startsWith('atributos.')) return [nivel];

    return [
        ...ATRIBUTOS.map((a) => ({ id: `mod.${a.id}`, rotulo: `Modificador de ${a.nome}`, grupo: 'Modificador de atributo' })),
        { id: 'prof', rotulo: 'Bônus de proficiência' },
        nivel,
    ];
}

/**
 * Como o D&D escreve os efeitos nas etiquetas: o alvo pelo nome (`pericia.atletismo` → "Perícia: Atletismo") e as
 * variáveis das fórmulas pela sigla (`@mod.con` → "mod. CON", `@prof` → "proficiência", `@nivel` → "nível").
 */
export const formatoDeResumo: FormatoResumo = {
    alvo: (id) => ALVOS_DE_EFEITO.find((a) => a.id === id)?.rotulo ?? id,
    valor: (formula) =>
        formula
            .replace(/@mod\.(for|des|con|sab|pre|von)\b/gi, (_, a: string) => `mod. ${a.toUpperCase()}`)
            .replace(/@prof\b/gi, 'proficiência')
            .replace(/@nivel\b/gi, 'nível'),
};

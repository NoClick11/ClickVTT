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
    { id: 'escudo.max', rotulo: 'Pontos de Escudo máximos', modos: NUMERICOS },
    { id: 'carga.max', rotulo: 'Capacidade de carga', modos: NUMERICOS },
    { id: 'pp.max', rotulo: 'Pontos de poder máximos', modos: NUMERICOS },
    { id: 'cd', rotulo: 'CD de técnica', modos: NUMERICOS },
    { id: 'ataque', rotulo: 'Ataque de técnica', modos: AMBOS },
    { id: 'ataque.arma', rotulo: 'Ataque com armas (todas)', modos: AMBOS },
    // `dados`: dano extra em dados (Ataque Furtivo 3d6), somado ao dano de cada arma e dobrado no crítico
    { id: 'dano.arma', rotulo: 'Dano com armas (todas)', modos: [...NUMERICOS, 'dados'] },
    // `dados`: dano extra em dados somado à rolagem de cada técnica (Heat, Electro)
    // alcance corpo a corpo e deslocamentos em decímetros (15 = 1,5 m) e a fração do dano das armas à distância (100 = inteiro)
    { id: 'alcance.corpo', rotulo: 'Alcance corpo a corpo (dm)', modos: NUMERICOS },
    { id: 'movimento.*', rotulo: 'Deslocamentos (dm)', modos: NUMERICOS },
    ...(['normal', 'nado', 'escalada', 'voo'] as const).map((t) => ({ id: `movimento.${t}`, rotulo: `Deslocamento: ${t} (dm)`, modos: NUMERICOS })),
    { id: 'dano.distancia.pct', rotulo: 'Dano de armas à distância (%)', modos: NUMERICOS },
    // passos de dado, margem de crítico por tipo de arma, ataque desarmado e teste de concentração
    ...(['corpo', 'distancia', 'desarmado', 'tecnica'] as const).map((t) => ({ id: `passo.${t}`, rotulo: `Passos de dado: ${t}`, modos: NUMERICOS })),
    // ataques da Ação "Atacar" (base 1): Ataque Extra soma 1; os extras à distância só valem para armas à distância
    { id: 'ataques.acao', rotulo: 'Ataques por Ação Atacar', modos: NUMERICOS },
    { id: 'ataques.distancia', rotulo: 'Ataques extras à distância (Ação Atacar)', modos: NUMERICOS },
    { id: 'margem.corpo', rotulo: 'Margem de crítico (corpo a corpo)', modos: NUMERICOS },
    { id: 'margem.distancia', rotulo: 'Margem de crítico (à distância)', modos: NUMERICOS },
    { id: 'ataque.desarmado', rotulo: 'Ataque desarmado', modos: AMBOS },
    { id: 'dano.desarmado', rotulo: 'Dano desarmado', modos: NUMERICOS },
    { id: 'concentracao', rotulo: 'Teste de concentração', modos: ROLAGEM },
    { id: 'dano.tecnica', rotulo: 'Dano das técnicas', modos: ['dados'] },
    { id: 'atributos.*', rotulo: 'Todos os atributos', modos: NUMERICOS },
    ...ATRIBUTOS.map((a) => ({ id: `atributos.${a.id}`, rotulo: `Atributo: ${a.nome}`, modos: NUMERICOS })),
    { id: 'teste.*', rotulo: 'Testes de atributo (todos)', modos: AMBOS },
    ...ATRIBUTOS.map((a) => ({ id: `teste.${a.id}`, rotulo: `Teste de ${a.nome}`, modos: AMBOS })),
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

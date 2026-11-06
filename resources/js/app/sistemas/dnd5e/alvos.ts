/**
 * Alvos de efeito do D&D 5e (formulário do mestre). Os `id` ESPELHAM `Dnd5e::alvosDeEfeito()` no servidor e são
 * conferidos contra `tests/paridade/alvos-dnd5e.json`. Cada alvo diz os modos que fazem sentido nele: os numéricos
 * (soma, base, mínimo, máximo) só onde existe um valor calculado, e vantagem/desvantagem só onde há um botão d20.
 *
 * Arquivo PURO: o Node o executa direto nos testes de paridade.
 */
import type { ModoEfeito } from '../../nucleo/efeitos/efeitos.ts';
import { ATRIBUTOS, PERICIAS } from './regras.ts';

export interface VariavelEfeitoDnd5e {
    id: string;
    rotulo: string;
    grupo?: string;
}

export interface AlvoEfeitoDnd5e {
    id: string;
    rotulo: string;
    modos: ModoEfeito[];
}

const NUMERICOS: ModoEfeito[] = ['soma', 'base', 'min', 'max'];
const ROLAGEM: ModoEfeito[] = ['vantagem', 'desvantagem'];
const AMBOS: ModoEfeito[] = [...NUMERICOS, ...ROLAGEM];

export const ALVOS_DE_EFEITO: AlvoEfeitoDnd5e[] = [
    { id: 'ca', rotulo: 'Classe de Armadura', modos: NUMERICOS },
    { id: 'iniciativa', rotulo: 'Iniciativa', modos: AMBOS },
    { id: 'pv.max', rotulo: 'Pontos de vida máximos', modos: NUMERICOS },
    { id: 'carga.max', rotulo: 'Capacidade de carga', modos: NUMERICOS },
    { id: 'cd', rotulo: 'CD de magia', modos: NUMERICOS },
    { id: 'ataque', rotulo: 'Ataque de magia', modos: AMBOS },
    { id: 'ataque.arma', rotulo: 'Ataque com armas (todas)', modos: AMBOS },
    { id: 'dano.arma', rotulo: 'Dano com armas (todas)', modos: NUMERICOS },
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
export function variaveisParaAlvo(alvo: string): VariavelEfeitoDnd5e[] {
    const nivel = { id: 'nivel', rotulo: 'Nível do personagem' };
    if (alvo.startsWith('atributos.')) return [nivel];

    return [
        ...ATRIBUTOS.map((a) => ({ id: `mod.${a.id}`, rotulo: `Modificador de ${a.nome}`, grupo: 'Modificador de atributo' })),
        { id: 'prof', rotulo: 'Bônus de proficiência' },
        nivel,
    ];
}

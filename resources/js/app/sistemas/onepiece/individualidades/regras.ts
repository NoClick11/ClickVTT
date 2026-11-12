// Individualidades (cap. 5.5, regra opcional; lógica pura, espelhada em app/Sistemas/OnePiece/Individualidades.php):
// espaços, Defeitos de mesmo nível (ou variáveis), validação e as características geradas na ficha.
import { caracteristicaDe } from '../construtor/regras.ts';
import { talentoPorId } from '../haki/dados.ts';
import { TALENTOS_DO_HAKI_INATO, hakiDesperto, tracoDoTalento } from '../haki/regras.ts';
import type { Caracteristica, FichaOnePiece } from '../regras.ts';
import {
    ESPACOS_INICIAIS,
    INDIVIDUALIDADES,
    NIVEIS_DE_INDIVIDUALIDADE,
    espacosDe,
    individualidadePorId,
    type Individualidade,
    type NivelDeIndividualidade,
    type TipoDeIndividualidade,
} from './dados.ts';

export interface IndividualidadeEscolhida {
    id: string;
    /** Resposta da escolha pedida (ambiente, perícia, item, texto livre). */
    escolha?: string;
}

export interface IndividualidadesFicha {
    /** Regra opcional do Narrador: os Defeitos contam espaços e só precisam somar o mesmo que as Singularidades. */
    variaveis: boolean;
    /** Espaços de Singularidade além dos 5 iniciais (o mestre concede). */
    extras: number;
    /** O mestre fechou as escolhas (depois da criação o jogador não troca mais). */
    travada: boolean;
    singularidades: IndividualidadeEscolhida[];
    defeitos: IndividualidadeEscolhida[];
}

export const individualidadesPadrao = (): IndividualidadesFicha => ({
    variaveis: false,
    extras: 0,
    travada: false,
    singularidades: [],
    defeitos: [],
});

export const normalizarIndividualidades = (f: { individualidades?: Partial<IndividualidadesFicha> }): IndividualidadesFicha => ({
    ...individualidadesPadrao(),
    ...(f.individualidades ?? {}),
    singularidades: f.individualidades?.singularidades ?? [],
    defeitos: f.individualidades?.defeitos ?? [],
});

export const espacosDaFicha = (i: IndividualidadesFicha): number => ESPACOS_INICIAIS + Math.max(0, i.extras || 0);

function somaDeEspacos(lista: IndividualidadeEscolhida[], tipo: TipoDeIndividualidade): number {
    return lista.reduce((s, x) => s + (individualidadePorId(tipo, x.id) ? espacosDe(individualidadePorId(tipo, x.id)!.nivel) : 0), 0);
}
export const espacosUsados = (i: IndividualidadesFicha): number => somaDeEspacos(i.singularidades, 'singularidade');
export const espacosDeDefeitos = (i: IndividualidadesFicha): number => somaDeEspacos(i.defeitos, 'defeito');

const quantos = (lista: IndividualidadeEscolhida[], tipo: TipoDeIndividualidade, nivel: NivelDeIndividualidade): number =>
    lista.filter((x) => individualidadePorId(tipo, x.id)?.nivel === nivel).length;

/** Quantos Defeitos de cada nível ainda faltam (positivo) ou sobram (negativo), no modo padrão (um Defeito por Singularidade). */
export function saldoDeDefeitos(i: IndividualidadesFicha): Record<NivelDeIndividualidade, number> {
    const r = {} as Record<NivelDeIndividualidade, number>;
    for (const n of NIVEIS_DE_INDIVIDUALIDADE) r[n.id] = quantos(i.singularidades, 'singularidade', n.id) - quantos(i.defeitos, 'defeito', n.id);

    return r;
}

/** Tudo que está fora das regras (o servidor confere o mesmo, sem as exigências de rascunho). */
export function problemasDasIndividualidades(f: Pick<FichaOnePiece, 'pericias'> & { individualidades?: Partial<IndividualidadesFicha> }): string[] {
    const i = normalizarIndividualidades(f);
    const p: string[] = [];
    for (const [tipo, lista] of [
        ['singularidade', i.singularidades],
        ['defeito', i.defeitos],
    ] as const) {
        const ids = lista.map((x) => x.id);
        if (new Set(ids).size !== ids.length)
            p.push(`${tipo === 'singularidade' ? 'Uma Singularidade' : 'Um Defeito'} só pode ser escolhido uma vez.`);
        for (const x of lista) {
            const d = individualidadePorId(tipo, x.id);
            if (!d) {
                p.push('Individualidade desconhecida.');
                continue;
            }
            p.push(...problemasDaEscolha(d, x, f));
        }
    }
    if (espacosUsados(i) > espacosDaFicha(i)) p.push(`As Singularidades ocupam ${espacosUsados(i)} espaços e você tem ${espacosDaFicha(i)}.`);
    if (i.variaveis) {
        if (espacosDeDefeitos(i) !== espacosUsados(i))
            p.push(
                `Defeitos Variáveis: os Defeitos somam ${espacosDeDefeitos(i)} espaços e as Singularidades ${espacosUsados(i)}; devem ser iguais.`,
            );
    } else {
        const s = saldoDeDefeitos(i);
        for (const n of NIVEIS_DE_INDIVIDUALIDADE) {
            if (s[n.id] > 0) p.push(`Falta ${s[n.id]} Defeito ${n.nome} (um Defeito de mesmo nível para cada Singularidade).`);
            if (s[n.id] < 0) p.push(`${-s[n.id]} Defeito(s) ${n.nome} sem Singularidade do mesmo nível.`);
        }
    }

    return p;
}

function problemasDaEscolha(d: Individualidade, x: IndividualidadeEscolhida, f: Pick<FichaOnePiece, 'pericias'>): string[] {
    const p: string[] = [];
    if (!d.escolha) {
        return x.escolha ? [`${d.traco.nome}: não pede escolha.`] : p;
    }
    const v = (x.escolha ?? '').trim();
    if (!v) return [`${d.traco.nome}: informe ${d.escolha.rotulo.toLowerCase()}.`];
    if (v.length > 80) p.push(`${d.traco.nome}: resposta longa demais.`);
    if (d.escolha.opcoes && !d.escolha.opcoes.some((o) => o.id === v)) p.push(`${d.traco.nome}: opção inválida.`);
    if (d.id === 'estudioso' && !((f.pericias as Record<string, number> | undefined)?.[v] >= 1))
        p.push('Estudioso: a perícia escolhida precisa já ser proficiente.');

    return p;
}

/** Texto curto da escolha (para o nome da característica). */
export function rotuloDaEscolha(d: Individualidade, x: IndividualidadeEscolhida): string {
    const v = (x.escolha ?? '').trim();

    return d.escolha?.opcoes ? (d.escolha.opcoes.find((o) => o.id === v)?.rotulo ?? v) : v;
}

/** Singularidades que o mestre concede e que mexem no Haki (a ressalva do livro: aprovação do Narrador). */
export const temSingularidade = (f: { individualidades?: Partial<IndividualidadesFicha> }, id: string): boolean =>
    (f.individualidades?.singularidades ?? []).some((x) => x.id === id);

/** Haki da Observação Inato: 5 PA ao adquirir controle do Haki da Observação (o despertar do Haki). */
export const paDeHakiDasIndividualidades = (f: {
    nivel: number;
    haki?: Parameters<typeof hakiDesperto>[0];
    individualidades?: Partial<IndividualidadesFicha>;
}): number => (temSingularidade(f, 'haki-observacao-inato') && f.haki && hakiDesperto(f.haki, Number(f.nivel)) ? 5 : 0);

export function caracteristicasDasIndividualidades(f: { individualidades?: Partial<IndividualidadesFicha>; nivel: number }): Caracteristica[] {
    const i = normalizarIndividualidades(f);
    const saida: Caracteristica[] = [];
    for (const [tipo, lista] of [
        ['singularidade', i.singularidades],
        ['defeito', i.defeitos],
    ] as const) {
        for (const x of lista) {
            const d = individualidadePorId(tipo, x.id);
            if (!d) continue;
            const nivel = NIVEIS_DE_INDIVIDUALIDADE.find((n) => n.id === d.nivel)!.nome;
            const escolha = rotuloDaEscolha(d, x);
            const traco = {
                ...d.traco,
                ...(d.id === 'estudioso' && x.escolha ? { efeitos: [{ alvo: `pericia.${x.escolha}`, modo: 'soma' as const, valor: '@prof' }] } : {}),
            };
            const c = caracteristicaDe(
                { traco, origem: `${tipo === 'singularidade' ? 'Singularidade' : 'Defeito'} ${nivel}`, builder: 'individualidade' },
                f.nivel,
            );
            if (escolha) {
                c.nome = `${d.traco.nome} (${escolha})`;
                c.descricao = `${c.descricao ?? ''}\nEscolha: ${escolha}.`.trim();
            }
            saida.push(c);
            // Haki da Observação Inato: as três percepções valem fora de batalha, mesmo sem comprar o talento.
            if (d.id === 'haki-observacao-inato') {
                for (const id of TALENTOS_DO_HAKI_INATO) {
                    const t = talentoPorId(id);
                    if (!t) continue;
                    saida.push({
                        nome: `${t.nome} (inato, fora de batalha)`,
                        origem: `Singularidade ${nivel}: ${d.traco.nome}`,
                        tipo: 'passiva',
                        builder: 'individualidade',
                        descricao: `Fora de batalha, pela Singularidade (sem comprar o talento no Haki):\n${tracoDoTalento(t, 1).descricao}`,
                    });
                }
            }
        }
    }

    return saida;
}

/** Campos a gravar: as individualidades e as características delas refeitas (mantém usos gastos). */
export function camposDasIndividualidades(f: FichaOnePiece, novo: IndividualidadesFicha): Record<string, unknown> {
    const antigas = new Map((f.caracteristicas ?? []).filter((c) => c.builder === 'individualidade').map((c) => [`${c.origem}|${c.nome}`, c]));
    const feitas = caracteristicasDasIndividualidades({ individualidades: novo, nivel: Number(f.nivel) }).map((c) => {
        const a = antigas.get(`${c.origem}|${c.nome}`);
        if (a?.usos && c.usos) c.usos = { ...c.usos, atual: Math.min(c.usos.max, a.usos.atual) };
        if (a?.ativa !== undefined && c.tipo === 'ativa' && c.efeitos) c.ativa = a.ativa;

        return c;
    });

    const campos: Record<string, unknown> = {
        individualidades: novo,
        caracteristicas: [...(f.caracteristicas ?? []).filter((c) => c.builder !== 'individualidade'), ...feitas],
    };
    // Só o mestre concede estas duas; ao conceder, o Haki já fica de acordo (só na hora em que a Singularidade entra).
    const novas = novo.singularidades.filter((x) => !temSingularidade(f, x.id));
    if (novas.some((x) => x.id === 'ambicao-do-rei')) {
        campos['haki.rei'] = true;
        campos['haki.liberado'] = true;
    }
    if (novas.some((x) => x.id === 'haki-observacao-inato')) campos['haki.principal'] = 'observacao';

    return campos;
}

export { INDIVIDUALIDADES };

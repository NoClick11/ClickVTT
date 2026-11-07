/**
 * Regras das Profissões (cap. 4), puras: graduação, modelos de texto, características geradas, Avanço Planejado, nova
 * profissão e a rolagem de Ofício. O servidor confere o que é do mestre em `app/Sistemas/OnePiece/Profissoes.php`.
 *
 * O Ofício vem treinado com a profissão e soma o Bônus de Proficiência em Testes de QUALQUER atributo ligados a ela.
 */
import type { TracoDados } from '../construtor/dados/tipos.ts';
import { caracteristicaDe } from '../construtor/regras.ts';
import type { AtributoId, Caracteristica, Ferramenta, FichaOnePiece } from '../regras.ts';
import {
    BENEFICIOS_DA_GRADUACAO,
    FOCO_EXCLUI,
    NIVEIS_DE_PROFISSAO,
    PROFISSOES,
    SEM_PROFISSAO,
    graduacaoPorId,
    profissaoPorId,
    type Profissao,
} from './dados.ts';

export interface ProfissaoDoPersonagem {
    id: string;
    /** 0 Profissional, 1 Especialista, 2 Mestre, 3 Grão-Mestre. */
    graduacao: 0 | 1 | 2 | 3;
    /** Nível em que foi aprendida. */
    nivel: number;
    /** Segunda profissão inicial (Pau-para-Toda-Obra): só os benefícios iniciais, sem proficiência em perícias nem ferramentas. */
    secundaria?: boolean;
}

export interface ProfissoesFicha {
    /** "Não ter profissão" (4.5). */
    semProfissao: boolean;
    /** O mestre confirmou que o personagem leu um Livro de Profissão ou teve um tutor: libera uma nova profissão. */
    livroLido: boolean;
    lista: ProfissaoDoPersonagem[];
    /** Níveis 5/10/15/20 já gastos (nova profissão ou Avanço Planejado). */
    usados: number[];
}

export const profissoesPadrao = (): ProfissoesFicha => ({ semProfissao: false, livroLido: false, lista: [], usados: [] });

const norm = (f: { profissoes?: Partial<ProfissoesFicha> }): ProfissoesFicha => ({ ...profissoesPadrao(), ...(f.profissoes ?? {}) });

// --- modelos de texto ---------------------------------------------------------------------------------------------------

/** Passo do dado pela graduação ("Aperfeiçoamento Profissional"): d6 → d8 → d10 → d12 (Mestre: d8 → d10; Grão-Mestre: d10 → d12). */
export function dadoDaGraduacao(base: number, graduacao: number): number {
    if (graduacao >= 3 && base <= 10) return 12;
    if (graduacao >= 2 && base <= 8) return 10;
    if (graduacao >= 1 && base <= 6) return 8;

    return base;
}

const formatarBellys = (n: number): string => n.toLocaleString('pt-BR').replace(/,/g, '.');

/** Resolve `{cd:16}`, `{bellys:250000}` e `{dado:6}` conforme a graduação. */
export function resolverModelos(texto: string, graduacao: number): string {
    const g = graduacaoPorId(graduacao);

    return texto
        .replace(/\{cd:(\d+)\}/g, (_, n: string) => String(Number(n) - g.reducaoCd))
        .replace(/\{bellys:(\d+)\}/g, (_, n: string) => formatarBellys(Math.floor((Number(n) * (100 - g.desconto)) / 100)))
        .replace(/\{dado:(\d+)\}/g, (_, n: string) => `d${dadoDaGraduacao(Number(n), graduacao)}`);
}

/** Um traço com os modelos resolvidos (descrição e rolagens das ações). */
export function tracoResolvido(traco: TracoDados, graduacao: number): TracoDados {
    return {
        ...traco,
        descricao: resolverModelos(traco.descricao, graduacao),
        ...(traco.acoes
            ? { acoes: traco.acoes.map((a) => ({ ...a, ...(a.rolagem ? { rolagem: resolverModelos(a.rolagem, graduacao) } : {}) })) }
            : {}),
    };
}

// --- características geradas ------------------------------------------------------------------------------------------

/** As características de uma profissão na graduação dada, mais os benefícios acumulados das graduações. */
export function tracosDaProfissao(p: Profissao, graduacao: number): TracoDados[] {
    const base = p.tracos.map((tr) => tracoResolvido({ ...tr, id: `${p.id}-${tr.id}` }, graduacao));
    const beneficios = ([1, 2, 3] as const)
        .filter((n) => graduacao >= n)
        .map((n) => {
            const b = BENEFICIOS_DA_GRADUACAO[n];

            return { ...b, id: `${p.id}-${b.id}`, nome: `${b.nome} (${p.nome})` };
        });

    return [...base, ...beneficios];
}

/** Todas as características das profissões do personagem (`builder: 'profissao'`). */
export function caracteristicasDasProfissoes(prof: ProfissoesFicha, nivel: number): Caracteristica[] {
    if (prof.semProfissao)
        return SEM_PROFISSAO.tracos.map((traco) => caracteristicaDe({ traco, origem: 'Profissão: nenhuma', builder: 'profissao' }, nivel));

    return prof.lista.flatMap((x) => {
        const p = profissaoPorId(x.id);
        if (!p) return [];

        return tracosDaProfissao(p, x.graduacao).map((traco) =>
            caracteristicaDe({ traco, origem: `Profissão: ${p.nome}`, builder: 'profissao' }, nivel),
        );
    });
}

/** A lista de características com as das profissões refeitas (mantém usos gastos e interruptores). */
export function refazerCaracteristicasDasProfissoes(atuais: Caracteristica[], prof: ProfissoesFicha, nivel: number): Caracteristica[] {
    const antigas = new Map(atuais.filter((c) => c.builder === 'profissao').map((c) => [`${c.origem}|${c.nome}`, c]));
    const novas = caracteristicasDasProfissoes(prof, nivel).map((c) => {
        const antiga = antigas.get(`${c.origem}|${c.nome}`);
        if (antiga?.usos && c.usos) c.usos = { ...c.usos, atual: Math.min(c.usos.max, antiga.usos.atual) };
        if (antiga?.ativa !== undefined && c.tipo === 'ativa' && c.efeitos) c.ativa = antiga.ativa;

        return c;
    });

    return [...atuais.filter((c) => c.builder !== 'profissao'), ...novas];
}

/** A proficiência nas ferramentas da profissão, como entradas da lista `ferramentas` (atributo-base: Sabedoria; Músico: Presença). */
export const ferramentaDaProfissao = (p: Profissao): Ferramenta => ({ nome: p.ferramenta, prof: 1, atributo: p.id === 'musico' ? 'pre' : 'sab' });

/** As ferramentas da ficha com as das profissões refeitas (as manuais ficam). */
export function refazerFerramentas(atuais: Ferramenta[], prof: ProfissoesFicha): Ferramenta[] {
    const nomes = new Set(PROFISSOES.map((p) => p.ferramenta));
    const manuais = atuais.filter((f) => !nomes.has(f.nome));
    const das = prof.lista.flatMap((x) => {
        const p = profissaoPorId(x.id);

        return p && !x.secundaria ? [ferramentaDaProfissao(p)] : [];
    });

    return [...manuais, ...das];
}

// --- Ofício -----------------------------------------------------------------------------------------------------------

/** O nome da perícia Ofício na ficha: "Ofício (Médico)", ou só "Ofício" com mais de uma profissão. */
export function nomeDoOficio(f: { profissoes?: Partial<ProfissoesFicha> }): string {
    const lista = norm(f).lista;
    if (lista.length === 1) return `Ofício (${profissaoPorId(lista[0].id)?.nome ?? ''})`;

    return 'Ofício';
}

/** O Ofício só existe com alguma profissão (e fora de "Não ter profissão"). */
export const temOficio = (f: { profissoes?: Partial<ProfissoesFicha> }): boolean => norm(f).lista.length > 0 && !norm(f).semProfissao;

/**
 * A expressão da rolagem de Ofício: 1d20 + o modificador do atributo escolhido + o Bônus de Proficiência (qualquer atributo,
 * como o livro). `modo`: vantagem/desvantagem.
 */
export function expressaoDoOficio(atributo: AtributoId, modo: 'vantagem' | 'desvantagem' | null = null): string {
    const d20 = modo === 'vantagem' ? '2d20kh1' : modo === 'desvantagem' ? '2d20kl1' : '1d20';

    return `${d20}+@mod.${atributo}+@prof`;
}

// --- criação ---------------------------------------------------------------------------------------------------------------

/** O que a escolha do 1º nível grava: a profissão (ou "nenhuma"), as perícias, as ferramentas e o Ofício. */
export function camposDaProfissaoInicial(
    escolha: { id: string; pericias: string[] },
    atual: { profissoes?: Partial<ProfissoesFicha> } = {},
): { profissoes: ProfissoesFicha; profissao: string; pericias: string[]; oficio: 0 | 1 } {
    const antes = norm(atual);
    if (escolha.id === 'nenhuma')
        return { profissoes: { ...antes, semProfissao: true, lista: [] }, profissao: SEM_PROFISSAO.nome, pericias: escolha.pericias, oficio: 0 };
    const p = profissaoPorId(escolha.id);
    // refazer a criação mantém a graduação que a profissão já tinha
    const graduacao = antes.lista.find((x) => x.id === escolha.id)?.graduacao ?? 0;
    const outras = antes.lista.filter((x) => (x.nivel > 1 || x.secundaria) && x.id !== escolha.id);

    return {
        profissoes: { ...antes, semProfissao: false, lista: [{ id: escolha.id, graduacao, nivel: 1 }, ...outras] },
        profissao: p?.nome ?? '',
        pericias: escolha.pericias,
        oficio: 1,
    };
}

/** Problemas da escolha do 1º nível. */
export function problemasDaProfissao(escolha: { id: string; pericias: string[] } | undefined): string[] {
    if (!escolha?.id) return ['Escolha uma profissão (ou "Não ter profissão").'];
    const p: string[] = [];
    if (escolha.id === 'nenhuma') {
        const ok = escolha.pericias.length === 2 && new Set(escolha.pericias).size === 2 && escolha.pericias.every((x) => !FOCO_EXCLUI.includes(x));
        if (!ok) p.push('Foco: escolha 2 perícias diferentes (exceto Haki, Sobrenatural e Sorte).');

        return p;
    }
    const prof = profissaoPorId(escolha.id);
    if (!prof) return ['Profissão desconhecida.'];
    if (escolha.pericias.length !== 2 || new Set(escolha.pericias).size !== 2 || escolha.pericias.some((x) => !prof.pericias.includes(x)))
        p.push(`Escolha 2 perícias da lista de ${prof.nome}.`);

    return p;
}

// --- Pau-para-Toda-Obra (Singularidade Forte) -----------------------------------------------------------------------------

/** A ficha tem a Singularidade "Pau-para-Toda-Obra": duas profissões iniciais em vez de uma. */
export const temPauParaTodaObra = (f: { individualidades?: { singularidades?: { id: string }[] } }): boolean =>
    (f.individualidades?.singularidades ?? []).some((x) => x.id === 'pau-para-toda-obra');

/** Pode escolher a segunda profissão inicial agora? */
export function problemasDaSegundaProfissao(f: FichaOnePiece, id: string): string[] {
    const prof = norm(f);
    const p: string[] = [];
    if (!temPauParaTodaObra(f)) p.push('Só quem tem a Singularidade Pau-para-Toda-Obra começa com duas profissões.');
    if (prof.semProfissao || prof.lista.length === 0) p.push('Escolha primeiro a profissão do 1º nível.');
    if (prof.lista.some((x) => x.secundaria)) p.push('A segunda profissão inicial já foi escolhida.');
    if (!profissaoPorId(id)) p.push('Profissão desconhecida.');
    if (prof.lista.some((x) => x.id === id)) p.push('Você já tem esta profissão.');

    return p;
}

/** Adiciona a segunda profissão inicial: características e itens, mas nenhuma proficiência em perícia ou ferramenta. */
export function camposDaSegundaProfissao(f: FichaOnePiece, id: string): Record<string, unknown> {
    const prof = norm(f);
    const novo: ProfissoesFicha = { ...prof, lista: [...prof.lista, { id, graduacao: 0, nivel: 1, secundaria: true }] };

    return {
        profissoes: novo,
        caracteristicas: refazerCaracteristicasDasProfissoes(f.caracteristicas ?? [], novo, Number(f.nivel)),
        ferramentas: refazerFerramentas(f.ferramentas ?? [], novo),
    };
}

// --- nível 5/10/15/20 ---------------------------------------------------------------------------------------------------

/** O próximo nível de Avanço (5, 10, 15 ou 20) já alcançado e ainda não gasto; null = nenhum agora. */
export function avancoDisponivel(f: Pick<FichaOnePiece, 'nivel'> & { profissoes?: Partial<ProfissoesFicha> }): number | null {
    const usados = norm(f).usados;

    return NIVEIS_DE_PROFISSAO.find((n) => n <= Number(f.nivel) && !usados.includes(n)) ?? null;
}

/** Pode aprender a profissão `id` agora (livro lido, avanço livre, não repetida, não é "sem profissão")? */
export function problemasDaNovaProfissao(f: FichaOnePiece, id: string): string[] {
    const prof = norm(f);
    const p: string[] = [];
    if (prof.semProfissao) p.push('Quem não tem profissão não pode aprender nenhuma.');
    if (!profissaoPorId(id)) p.push('Profissão desconhecida.');
    if (prof.lista.some((x) => x.id === id)) p.push('Você já tem esta profissão.');
    if (!prof.livroLido) p.push('Falta ler um Livro de Profissão ou ter um tutor (o mestre confirma).');
    if (avancoDisponivel(f) === null) p.push('Nenhum avanço livre: novas profissões só no 5º, 10º, 15º e 20º nível.');

    return p;
}

/** Aprende a profissão (sem perícias nem itens iniciais) e opcionalmente troca uma proficiência já existente por uma da nova lista. */
export function camposDaNovaProfissao(f: FichaOnePiece, id: string, troca?: { de: string; para: string }): Record<string, unknown> {
    const prof = norm(f);
    const p = profissaoPorId(id)!;
    const slot = avancoDisponivel(f)!;
    const novo: ProfissoesFicha = {
        ...prof,
        lista: [...prof.lista, { id, graduacao: 0, nivel: Number(f.nivel) }],
        usados: [...prof.usados, slot],
        livroLido: false,
    };
    const campos: Record<string, unknown> = {
        profissoes: novo,
        caracteristicas: refazerCaracteristicasDasProfissoes(f.caracteristicas ?? [], novo, Number(f.nivel)),
        ferramentas: refazerFerramentas(f.ferramentas ?? [], novo),
    };
    if (troca && f.pericias[troca.de] && p.pericias.includes(troca.para)) {
        campos[`pericias.${troca.de}`] = 0;
        campos[`pericias.${troca.para}`] = Math.max(1, f.pericias[troca.para] ?? 0);
    }

    return campos;
}

/** Sobe uma graduação (Grande Feito do mestre, ou Avanço Planejado do jogador, que gasta o avanço do nível). */
export function camposDaGraduacao(f: FichaOnePiece, indice: number, planejado: boolean): Record<string, unknown> {
    const prof = norm(f);
    const alvo = prof.lista[indice];
    if (!alvo || alvo.graduacao >= 3) return {};
    const slot = planejado ? avancoDisponivel(f) : null;
    if (planejado && slot === null) return {};
    const lista = prof.lista.map((x, i) => (i === indice ? { ...x, graduacao: (x.graduacao + 1) as 1 | 2 | 3 } : x));
    const novo: ProfissoesFicha = { ...prof, lista, usados: planejado ? [...prof.usados, slot!] : prof.usados };

    return { profissoes: novo, caracteristicas: refazerCaracteristicasDasProfissoes(f.caracteristicas ?? [], novo, Number(f.nivel)) };
}

/** O mestre remove uma profissão (e as características dela). */
export function camposDaRemocaoDeProfissao(f: FichaOnePiece, indice: number): Record<string, unknown> {
    const prof = norm(f);
    const novo: ProfissoesFicha = { ...prof, lista: prof.lista.filter((_, i) => i !== indice) };

    return {
        profissoes: novo,
        caracteristicas: refazerCaracteristicasDasProfissoes(f.caracteristicas ?? [], novo, Number(f.nivel)),
        ferramentas: refazerFerramentas(f.ferramentas ?? [], novo),
        ...(novo.lista.length === 0 ? { 'pericias.oficio': 0 } : {}),
    };
}

export { PROFISSOES, SEM_PROFISSAO };

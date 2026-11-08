/**
 * Dano extra das Técnicas e dos ataques desarmados que vem de características do estilo (Diable Jambe, Ifrit Jambe, Hell Memories), de bônus armados
 * por uma Técnica auxiliar (Fire Lash, Strike) e da maximização do Domínio Fatal. Arquivo PURO: o Node o executa direto nos testes. O servidor só
 * confere o que é seu (PP, dano aplicado); a expressão do dano é montada aqui, como a dos dados da Meito.
 */
import { ativaNoNivel, type BonusDeDano, type Caracteristica, type FichaOnePiece, type Tecnica } from './regras.ts';

/** Um dano extra de outro tipo (`2d6` de Fogo): rola à parte e se aplica com o próprio tipo. */
export interface ExtraDeDano {
    expressao: string;
    tipo: string | null;
}

const valendo = (c: Caracteristica, f: FichaOnePiece): boolean =>
    ativaNoNivel(c, Number(f.nivel)) && (c.builder !== 'haki' || !!f.haki?.ativo) && ((c.tipo ?? 'passiva') === 'passiva' || c.ativa === true);

/** A ficha tem uma característica (pelo nome, que pode vir com prefixo) valendo agora? */
export const temCaracteristica = (f: FichaOnePiece, nome: string): boolean =>
    (f.caracteristicas ?? []).some((c) => c.nome.includes(nome) && valendo(c, f));

/** O dado (faces) do primeiro termo de dados de uma expressão (`2d10+1` → 10), ou null. */
export const facesDaExpressao = (expressao: string): number | null => {
    const m = /\d*d(\d+)/i.exec(expressao);

    return m ? Number(m[1]) : null;
};

/** As entradas de `bonusDano` que valem agora para o alvo (nível, características exigidas e o grupo: vence a maior prioridade). */
export function bonusQueValem(f: FichaOnePiece, alvo: BonusDeDano['alvo']): BonusDeDano[] {
    const nivel = Number(f.nivel);
    const todos = (f.caracteristicas ?? []).filter((c) => valendo(c, f)).flatMap((c) => c.bonusDano ?? []);
    const aplicaveis = todos.filter(
        (b) =>
            b.alvo === alvo &&
            nivel >= (b.nivelMin ?? 1) &&
            nivel <= (b.nivelMax ?? 99) &&
            (b.requer ?? []).every((nome) => temCaracteristica(f, nome)),
    );
    const melhorDoGrupo = new Map<string, number>();
    for (const b of aplicaveis) if (b.grupo) melhorDoGrupo.set(b.grupo, Math.max(melhorDoGrupo.get(b.grupo) ?? -Infinity, b.prioridade ?? 0));

    return aplicaveis.filter((b) => !b.grupo || (b.prioridade ?? 0) === melhorDoGrupo.get(b.grupo));
}

/**
 * Os danos extras (cada um com seu tipo) do alvo: dados fixos, ou a fração do grau da Técnica (mín. 1 dado) com o dado da própria Técnica.
 * O bônus `fixo` vira um número solto.
 */
export function extrasDeDano(f: FichaOnePiece, alvo: BonusDeDano['alvo'], grau = 0, faces: number | null = null): ExtraDeDano[] {
    const saida: ExtraDeDano[] = [];
    for (const b of bonusQueValem(f, alvo)) {
        if (b.dados) saida.push({ expressao: b.dados, tipo: b.tipo ?? null });
        else if (b.porGrau !== undefined && faces)
            saida.push({ expressao: `${Math.max(1, Math.floor(grau * b.porGrau))}d${faces}`, tipo: b.tipo ?? null });
        if (b.fixo) saida.push({ expressao: String(b.fixo), tipo: b.tipo ?? null });
    }

    return saida;
}

/** Junta os danos extras do mesmo tipo numa rolagem só (`1d12` + `5` de Fogo → `1d12+5`). */
export function juntarPorTipo(extras: ExtraDeDano[]): ExtraDeDano[] {
    const porTipo = new Map<string, ExtraDeDano>();
    for (const e of extras) {
        const chave = e.tipo ?? '';
        const atual = porTipo.get(chave);
        porTipo.set(chave, atual ? { ...atual, expressao: `${atual.expressao}+${e.expressao}` } : { ...e });
    }

    return [...porTipo.values()];
}

/** Dano máximo: cada `NdM` vira `N*M` (Domínio Fatal). O bônus fixo continua. */
export const maximizar = (expressao: string): string =>
    expressao.replace(/(\d*)d(\d+)/gi, (_, n: string, m: string) => String((n === '' ? 1 : Number(n)) * Number(m)));

/** Domínio Fatal (Explorador Destemido, 19º): Técnica instantânea com chicote ou pistola como requisito tem o dano sempre no máximo. */
export const danoMaximoDaTecnica = (f: FichaOnePiece, t: Pick<Tecnica, 'descricao' | 'duracao'>): boolean =>
    temCaracteristica(f, 'Explorador Destemido') &&
    /Requisito:[^.]*\b(chicote|pistola)\b/i.test(t.descricao ?? '') &&
    !t.duracao &&
    !/Dura[çc][ãa]o:\s*at[ée]/i.test(t.descricao ?? '');

export interface DanoMontado {
    /** O dano principal (já com os dados somados do mesmo tipo e o máximo, se for o caso). */
    expressao: string;
    /** Danos extras de outro tipo, rolados à parte. */
    extras: ExtraDeDano[];
    /** O custo em PP (Fire Lash baixa 1 PP por dado que não coube no grau). */
    custo: number;
    /** O bônus armado foi usado: tem de ser limpo da ficha. */
    consumiuBonus: boolean;
}

/** O bônus armado vale para esta Técnica? (Combate com dano; instantânea e tipo, se a Técnica auxiliar exigir.) */
function serve(b: NonNullable<FichaOnePiece['bonusTecnica']>, t: Tecnica, grau: number): boolean {
    if (grau <= 0 || !t.rolagem.trim()) return false;
    if (b.instantanea && (t.duracao || /Dura[çc][ãa]o:\s*at[ée]/i.test(t.descricao ?? ''))) return false;
    if (b.soTipo && !(t.tipoDano ?? '').toLowerCase().includes(b.soTipo.toLowerCase())) return false;

    return true;
}

/**
 * Monta o dano de uma Técnica de Combate com tudo que vem por cima da expressão do livro: o bônus armado (Fire Lash, Strike), o dano extra das
 * características (Diable Jambe...) e o dano máximo. `grau` = o grau da Técnica (0 = auxiliar/sem grau: nada se soma).
 */
export function montarDanoDaTecnica(f: FichaOnePiece, t: Tecnica, grau: number, expressao: string): DanoMontado {
    let principal = expressao;
    const extras: ExtraDeDano[] = [];
    let custo = t.custo;
    let consumiuBonus = false;
    const faces = facesDaExpressao(expressao);
    const b = f.bonusTecnica;
    if (b && b.dados > 0 && faces && serve(b, t, grau)) {
        const n = b.limitarAoGrau ? Math.min(b.dados, grau) : b.dados;
        if (b.tipo && b.tipo.toLowerCase() !== (t.tipoDano ?? '').toLowerCase()) extras.push({ expressao: `${n}d${faces}`, tipo: b.tipo });
        else principal = `${principal}+${n}d${faces}`;
        if (b.reduzCusto) custo = Math.max(0, custo - (b.dados - n));
        consumiuBonus = true;
    }
    if (grau > 0 && faces) extras.push(...extrasDeDano(f, 'tecnica', grau, faces));
    if (danoMaximoDaTecnica(f, t))
        return { expressao: maximizar(principal), extras: extras.map((e) => ({ ...e, expressao: maximizar(e.expressao) })), custo, consumiuBonus };

    return { expressao: principal, extras, custo, consumiuBonus };
}

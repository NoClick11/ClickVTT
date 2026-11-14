// Ficha de NPC ⇄ ficha comum do personagem. O NPC é um personagem normal da mesa: PV, PP, atributos, CA e CD ficam nos campos
// da ficha (assim dano, combate, salvaguardas e alvo funcionam como sempre) e a tela de uma tela só guarda o resto em `ficha.npc`.
import type { UsoDeTecnica } from '../contexto';
import { ATRIBUTOS_NPC, modificador, type AtaqueNpc, type AtributoNpc, type NpcModelo, type TecnicaNpc } from './tipos';

/** O que o NPC guarda em `ficha.npc`: os dados do modelo (copiados) mais a origem e os contadores de uso. */
export interface NpcDados extends Omit<NpcModelo, 'id' | 'faccao'> {
    /** id do NPC do catálogo de que veio (só informativo) */
    catalogo_id?: string;
    faccao?: NpcModelo['faccao'];
    /** quando é a cópia de um token: o id do NPC (modelo) de que saiu */
    instancia_de?: number;
    /** vezes já usadas, por nome (técnicas e características com `N/dia`) */
    usos?: Record<string, number>;
    /** ações lendárias gastas neste turno */
    lendarias_usadas?: number;
}

export const COM_ACENTO: Record<string, AtributoNpc> = {
    forca: 'for',
    destreza: 'des',
    constituicao: 'con',
    sabedoria: 'sab',
    presenca: 'pre',
    vontade: 'von',
};
export const PERICIA_ATRIBUTO: Record<string, AtributoNpc> = {
    atletismo: 'for',
    acrobacia: 'des',
    furtividade: 'des',
    prestidigitacao: 'des',
    historia: 'sab',
    investigacao: 'sab',
    medicina: 'sab',
    natureza: 'sab',
    sobrevivencia: 'sab',
    oficio: 'sab',
    atuacao: 'pre',
    enganacao: 'pre',
    intimidacao: 'pre',
    persuasao: 'pre',
    provocacao: 'pre',
    haki: 'von',
    intuicao: 'von',
    percepcao: 'von',
    sobrenatural: 'von',
    sorte: 'von',
};
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** "Acrobacia +4, Atletismo +5" → { acrobacia: 4, atletismo: 5 } (nomes que não existem na ficha são ignorados). */
export function lerBonus(texto: string | null | undefined, validos: (id: string) => boolean): Record<string, number> {
    const saida: Record<string, number> = {};
    if (typeof texto !== 'string' || !texto) return saida;
    for (const parte of texto.split(',')) {
        const m = parte.trim().match(/^(.+?)\s*([+-]\d+)$/);
        if (!m) continue;
        const id = semAcento(m[1]);
        if (validos(id)) saida[id] = Number(m[2]);
    }

    return saida;
}

const limitar = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(n)));

/**
 * Os campos da ficha comum que decorrem dos dados do NPC. Mande sempre juntos (um lote atômico): PV/PP máximos, atributos,
 * CA, CD, proficiência, salvaguardas e perícias (como ajustes, para os totais baterem com os da ficha do livro).
 */
export function camposDoNpc(npc: NpcDados, pv?: { atual: number }): Record<string, unknown> {
    const mod = (a: AtributoNpc) => modificador(npc.atributos[a]);
    const campos: Record<string, unknown> = {
        npc,
        nivel: 1,
        'pv.max': limitar(npc.pv.medio, 0, 9999),
        'pp.porNivel': 5,
        'ajustes.proficiencia': limitar(npc.bp - 2, -20, 20),
        // CA = 10 + mod(DES) + ajuste ; CD = 8 + proficiência + mod(VON) + ajuste (a conjuração do NPC é sempre VON)
        'ajustes.ca': limitar(npc.cr - 10 - mod('des'), -20, 20),
        'tecnicas.atributo': 'von',
        'ajustes.cd': limitar(npc.cd - 8 - npc.bp - mod('von'), -20, 20),
        'movimento.normal': npc.deslocamento,
        'movimento.nado': npc.nado,
        deslocamento: `${npc.deslocamento} m · nado ${npc.nado} m`.replace('.', ','),
    };
    if (pv) campos['pv.atual'] = limitar(pv.atual, 0, 9999);
    for (const a of ATRIBUTOS_NPC) campos[`atributos.${a}`] = limitar(npc.atributos[a], 1, 30);

    const salvaguardas = lerBonus(npc.salvaguardas, (id) => id in COM_ACENTO);
    for (const [nome, a] of Object.entries(COM_ACENTO)) {
        campos[`ajustes.salvaguardas.${a}`] = limitar(nome in salvaguardas ? salvaguardas[nome] - mod(a) : 0, -20, 20);
    }
    const pericias = lerBonus(npc.pericias, (id) => id in PERICIA_ATRIBUTO);
    for (const [id, a] of Object.entries(PERICIA_ATRIBUTO)) {
        campos[`ajustes.pericias.${id}`] = limitar(id in pericias ? pericias[id] - mod(a) : 0, -20, 20);
    }

    return campos;
}

/** A ficha de um NPC novo do catálogo (ou em branco): PV e PP cheios. */
export function camposDeNpcNovo(npc: NpcDados): Record<string, unknown> {
    return { ...camposDoNpc(npc, { atual: npc.pv.medio }), 'pp.atual': npc.pp ?? 0 };
}

/** Cópia profunda (os objetos do Vue são reativos: `structuredClone` não os aceita). */
export const copiar = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function npcDoModelo(m: NpcModelo): NpcDados {
    const { id, faccao, ...resto } = copiar(m);

    return { ...resto, faccao, catalogo_id: id, usos: {}, lendarias_usadas: 0 };
}

export function npcEmBranco(): NpcDados {
    return {
        nome: 'Novo NPC',
        nd: '1',
        xp: 0,
        pp: null,
        cr: 12,
        pv: { medio: 10, dados: '' },
        bp: 2,
        cd: 10,
        deslocamento: 9,
        nado: 4.5,
        atributos: { for: 10, des: 10, con: 10, sab: 10, pre: 10, von: 10 },
        pericias: '',
        salvaguardas: '',
        sentidos: 'Percepção Passiva 10.',
        aspectos: [],
        ataques: [],
        acoesBonus: [],
        reacoes: [],
        tecnicas: [],
        usos: {},
        lendarias_usadas: 0,
    };
}

/** Os dados do NPC de uma ficha (`null` = personagem comum). Normaliza campos que o servidor pode devolver como `null` quando vazios. */
export function lerNpc(ficha: Record<string, unknown> | null | undefined): NpcDados | null {
    const n = ficha?.npc;
    if (!n || typeof n !== 'object') return null;
    const d = n as Partial<NpcDados>;
    const padrao = npcEmBranco();

    return {
        ...padrao,
        ...d,
        nome: d.nome ?? padrao.nome,
        nd: d.nd ?? padrao.nd,
        xp: d.xp ?? padrao.xp,
        pp: d.pp ?? null,
        cr: d.cr ?? padrao.cr,
        pv: {
            medio: d.pv?.medio ?? padrao.pv.medio,
            dados: d.pv?.dados ?? '',
        },
        bp: d.bp ?? padrao.bp,
        cd: d.cd ?? padrao.cd,
        deslocamento: d.deslocamento ?? padrao.deslocamento,
        nado: d.nado ?? padrao.nado,
        atributos: { ...padrao.atributos, ...(d.atributos ?? {}) },
        pericias: d.pericias ?? '',
        salvaguardas: d.salvaguardas ?? '',
        sentidos: d.sentidos ?? '',
        aspectos: Array.isArray(d.aspectos) ? d.aspectos.map((a) => ({ ...a, nome: a?.nome ?? '', texto: a?.texto ?? '' })) : [],
        ataques: Array.isArray(d.ataques) ? d.ataques : [],
        acoesBonus: Array.isArray(d.acoesBonus) ? d.acoesBonus.map((a) => ({ ...a, nome: a?.nome ?? '', texto: a?.texto ?? '' })) : [],
        reacoes: Array.isArray(d.reacoes) ? d.reacoes.map((a) => ({ ...a, nome: a?.nome ?? '', texto: a?.texto ?? '' })) : [],
        tecnicas: Array.isArray(d.tecnicas) ? d.tecnicas.map((t) => ({ ...t, tipoDano: Array.isArray(t?.tipoDano) ? t.tipoDano : [] })) : [],
        usos: d.usos && typeof d.usos === 'object' && !Array.isArray(d.usos) ? d.usos : {},
        lendarias_usadas: d.lendarias_usadas ?? 0,
    };
}

// --- rolagens ---------------------------------------------------------------------------------------------------------------

export const comSinalNpc = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** Rolagem de ataque (`1d20+4`) com vantagem/desvantagem. */
export const dadoDeAtaque = (bonus: number, modo: 'vantagem' | 'desvantagem' | null) =>
    `${modo === 'vantagem' ? '2d20kh1' : modo === 'desvantagem' ? '2d20kl1' : '1d20'}${bonus ? comSinalNpc(bonus) : ''}`;

/** "6 m" / "9/15 m" */
/** Até onde o ataque do NPC alcança (m): o alcance do corpo a corpo, ou o máximo do ataque à distância. */
export const alcanceMaximoDoAtaque = (a: AtaqueNpc): number => (Array.isArray(a.alcance) ? a.alcance[1] : a.alcance);

/** Até onde o ataque do NPC não sofre desvantagem (m): o próprio alcance no corpo a corpo, ou o alcance normal à distância. */
export const alcanceNormalDoAtaque = (a: AtaqueNpc): number => (Array.isArray(a.alcance) ? a.alcance[0] : a.alcance);

export const alcanceDoAtaque = (a: AtaqueNpc): string =>
    Array.isArray(a.alcance) ? `${a.alcance[0]}/${a.alcance[1]} m` : `${String(a.alcance).replace('.', ',')} m`;

/** A margem de crítico do NPC quando o texto de um aspecto a muda ("margem de acerto crítico de 19-20"). */
export function margemDeCritico(npc: NpcDados, ataque: AtaqueNpc | TecnicaNpc): number {
    let margem = 20;
    for (const a of npc.aspectos ?? []) {
        const texto = a?.texto ?? '';
        const m = texto.match(/margem de acerto crítico (?:passa a ser |de )(\d+)-20/i);
        if (!m) continue;
        const so = /corpo a corpo com arma cortante|arma cortante/i.test(texto);
        const cortante =
            'tipoDano' in ataque ? (Array.isArray(ataque.tipoDano) ? ataque.tipoDano.includes('Cortante') : ataque.tipoDano === 'Cortante') : false;
        if (!so || cortante) margem = Math.min(margem, Number(m[1]));
    }
    if ('critico' in ataque && ataque.critico) margem = Math.min(margem, ataque.critico);

    return margem;
}

/** Quantas vezes a técnica já foi usada e o limite (`N/dia`); recarga e ilimitada não têm contador. */
export const usosDa = (npc: NpcDados, nome: string) => npc.usos?.[nome] ?? 0;
export const limiteDeUsos = (u: TecnicaNpc['usos'] | undefined): number | null => (u && 'max' in u ? u.max : null);

/** A área da técnica no mapa (null = vale o alvo mirado). */
export function areaDaTecnica(t: TecnicaNpc): UsoDeTecnica['area'] {
    if (t.modo === 'ataque') return t.area ? { forma: t.area.forma, metros: t.alcance } : null;

    return t.area ? { forma: t.area.forma, metros: t.alcance } : null;
}

/** O `UsoDeTecnica` que a mesa já sabe executar (gabarito da área, salvaguarda coletiva, dano e gasto de PP). */
export function usoDaTecnica(npc: NpcDados, t: TecnicaNpc, ppAtual: number, tipoDano: string, extras: Record<string, unknown> = {}): UsoDeTecnica {
    const base = {
        nome: t.nome,
        desvantagem: false,
        modoAtaque: null,
        categoria: 'poderosa',
        camposDosPP: { 'pp.atual': Math.max(0, ppAtual - t.pp), ...extras },
        area: areaDaTecnica(t),
        dano: t.dano ? { expressao: t.dano, tipo: tipoDano } : null,
    } satisfies Partial<UsoDeTecnica>;
    if (t.modo === 'ataque')
        return { ...base, teste: { tipo: 'ataque' }, ataqueFixo: { bonus: t.ataque?.bonus ?? 0, margemCritica: margemDeCritico(npc, t) } };

    return { ...base, teste: { tipo: 'salvaguarda', atributo: t.salvaguarda?.atributo, aoPassar: t.salvaguarda?.metade ? 'metade' : 'nada' } };
}

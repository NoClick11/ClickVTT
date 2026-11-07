// Catálogo de itens (lógica pura): preço, peso, busca e a conversão para um item da mesa. Espelhado, no que o servidor usa
// (preço de compra e venda), em app/Sistemas/OnePiece/Itens.php.
import type { DadosItemOnePiece } from '../regras.ts';
import {
    CATALOGO_DE_ITENS,
    CATEGORIAS,
    RARIDADES,
    REGRAS_DE_COMERCIO,
    type CategoriaId,
    type GrupoDoCatalogo,
    type ItemDoCatalogo,
    type Raridade,
} from './index.ts';

const milhar = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const casas = (n: number): string => String(n).replace('.', ',');

/** "฿ 80.000" (ou o texto do livro quando o preço varia). */
export function precoFormatado(i: ItemDoCatalogo): string {
    if (i.preco === null) return i.precoTexto ?? 'Sob consulta';
    const base = `฿ ${milhar(i.preco)}`;
    const un = i.unidade && !['unidade'].includes(i.unidade) ? `/${i.unidade}` : i.unidade === 'unidade' ? '/unidade' : '';

    return i.precoTexto && i.preco !== null ? `${i.precoTexto}` : `${base}${un}`;
}

/** "4 kg", "2,5 kg/metro", "1,5 l"... */
export function pesoFormatado(i: ItemDoCatalogo): string {
    if (i.pesoTexto) return i.pesoTexto;
    if (i.volume && !i.peso) return i.volume;
    if (!i.peso) return '—';

    return `${casas(i.peso)} kg`;
}

export const categoriaPorId = (id: CategoriaId) => CATEGORIAS.find((c) => c.id === id);
export const raridadePorId = (id: Raridade) => RARIDADES.find((r) => r.id === id);

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export interface FiltroDoCatalogo {
    texto?: string;
    categoria?: CategoriaId | '';
    grupo?: GrupoDoCatalogo | '';
    raridade?: Raridade | '';
    /** Só o que a loja pode vender. */
    soLoja?: boolean;
    /** Só itens de inventário (sem serviços). */
    soItens?: boolean;
}

/** Busca por nome, apelido, categoria e descrição (sem acentos nem maiúsculas). */
export function buscarNoCatalogo(f: FiltroDoCatalogo = {}, catalogo: ItemDoCatalogo[] = CATALOGO_DE_ITENS): ItemDoCatalogo[] {
    const termo = norm(f.texto ?? '').trim();
    const grupos = f.grupo ? new Set(CATEGORIAS.filter((c) => c.grupo === f.grupo).map((c) => c.id)) : null;

    return catalogo.filter((i) => {
        if (f.categoria && i.categoria !== f.categoria) return false;
        if (grupos && !grupos.has(i.categoria)) return false;
        if (f.raridade && i.raridade !== f.raridade) return false;
        if (f.soLoja && !i.loja) return false;
        if (f.soItens && i.tipo !== 'item') return false;
        if (!termo) return true;

        return norm([i.nome, ...(i.apelidos ?? []), categoriaPorId(i.categoria)?.nome ?? '', i.descricao].join(' ')).includes(termo);
    });
}

/**
 * Preço de compra: o do livro vezes `fator` (o Mercado Negro pode custar até 100 vezes mais, a critério do Narrador).
 * `null` quando o preço não é fixo.
 */
export function precoDeCompra(i: ItemDoCatalogo, fator = 1): number | null {
    if (i.preco === null) return null;
    const max = i.raridade === 'mercado-negro' ? REGRAS_DE_COMERCIO.multiplicadorMaximoDoMercadoNegro : 1;

    return Math.round(i.preco * Math.min(Math.max(fator, 0), max));
}

/** Preço de venda: armas e equipamentos em bom estado valem metade; serviços não se vendem. */
export function precoDeVenda(i: ItemDoCatalogo, bomEstado = true): number | null {
    if (i.tipo !== 'item' || i.preco === null) return null;

    return Math.floor(i.preco * (bomEstado ? REGRAS_DE_COMERCIO.vendaDeEquipamentos : 0));
}

/** O que a ficha calcula no item: armadura/escudo e, se o dano da arma é fixo, a arma. */
/**
 * O alcance (m) que a arma do catálogo leva para o item da mesa: Distância/Arremesso trazem normal e máximo; as demais valem o alcance corpo a
 * corpo (1,5 m, ou 3 m com a propriedade Alcance). Espelha `Itens::alcanceDaArma`.
 */
export function alcanceDaArmaDoCatalogo(a: { distancia?: [number, number]; propriedades: string[] }): {
    alcanceNormal: number;
    alcanceMaximo: number;
} {
    if (a.distancia) return { alcanceNormal: a.distancia[0], alcanceMaximo: a.distancia[1] };
    const corpo = a.propriedades.includes('Alcance') ? 3 : 1.5;

    return { alcanceNormal: corpo, alcanceMaximo: corpo };
}

export function dadosDoSistema(i: ItemDoCatalogo): DadosItemOnePiece & { catalogo: { id: string } } {
    const dados: DadosItemOnePiece & { catalogo: { id: string } } = { ...(i.dados ?? {}), catalogo: { id: i.id } };
    const a = i.arma;
    if (a && a.dano && /^\d+d\d+$/.test(a.dano) && i.categoria !== 'municao') {
        const acuidade = a.propriedades.includes('Acuidade');
        const aDistancia = !!a.distancia && !a.propriedades.some((p) => p.startsWith('Arremesso'));
        dados.arma = {
            dano: a.dano,
            atributo: acuidade ? 'acuidade' : aDistancia ? 'des' : 'for',
            tipoDano: a.tipoDano,
            ...(aDistancia ? { distancia: true } : {}),
            ...alcanceDaArmaDoCatalogo(a),
            ...(a.expertiseId ? { forja: { expertise: [a.expertiseId] } } : {}),
        };
    }

    return dados;
}

/** Texto do item da mesa: descrição, propriedades, expertise, raridade e preço. */
export function descricaoParaAMesa(i: ItemDoCatalogo): string {
    const a = i.arma;
    const partes = [i.descricao];
    if (a) {
        const dano = a.dano
            ? `${a.dano} ${a.tipoDano}${a.tiposAlternativos?.length ? ` ou ${a.tiposAlternativos.join(' ou ')}` : ''}`
            : a.marcial
              ? `dano desarmado +1 passo (${a.tipoDano})`
              : a.tipoDano;
        partes.push(`Dano: ${dano}.`);
        if (a.propriedades.length) partes.push(`Propriedades: ${a.propriedades.join(', ')}.`);
        if (a.expertise) partes.push(`Expertise (acerto crítico natural, só com proficiência): ${a.expertise}`);
    }
    partes.push(`Raridade: ${raridadePorId(i.raridade)?.nome}. Preço: ${precoFormatado(i)}.`);

    return partes.join('\n').slice(0, 2000);
}

/** O corpo para criar o item na mesa (`POST itens`). */
export function itemParaAMesa(i: ItemDoCatalogo) {
    return {
        nome: i.nome,
        descricao: descricaoParaAMesa(i),
        peso: i.peso,
        equipavel: i.equipavel,
        requer_sintonia: false,
        efeitos: [] as { alvo: string; modo: string; valor?: number | string }[],
        dados: dadosDoSistema(i) as Record<string, unknown>,
    };
}

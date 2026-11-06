/**
 * Regras e tipos da ficha de D&D 5e. ESPELHA `app/Sistemas/Dnd5e/Regras.php` (o cliente mostra ao vivo, o servidor
 * decide as rolagens): qualquer mudança aqui tem de ser feita nos dois. Os casos de `tests/paridade/dnd5e.json`
 * rodam nas duas implementações (`npm run test:regras` e a suíte PHP).
 *
 * Arquivo PURO (sem Vue): o Node o executa direto nos testes de paridade; só importa o motor de efeitos do núcleo.
 */
import {
    aplicar,
    casa,
    dadosValidos,
    deFonte,
    rolagem,
    type Efeito,
    type EfeitoBruto,
    type Origem,
    type Rolagem,
} from '../../nucleo/efeitos/efeitos.ts';
import { condicaoPorId } from './condicoes.ts';

export type AtributoId = 'for' | 'des' | 'con' | 'int' | 'sab' | 'car';

export const ATRIBUTOS: { id: AtributoId; sigla: string; nome: string }[] = [
    { id: 'for', sigla: 'FOR', nome: 'Força' },
    { id: 'des', sigla: 'DES', nome: 'Destreza' },
    { id: 'con', sigla: 'CON', nome: 'Constituição' },
    { id: 'int', sigla: 'INT', nome: 'Inteligência' },
    { id: 'sab', sigla: 'SAB', nome: 'Sabedoria' },
    { id: 'car', sigla: 'CAR', nome: 'Carisma' },
];

export const PERICIAS: { id: string; nome: string; atributo: AtributoId }[] = [
    { id: 'acrobacia', nome: 'Acrobacia', atributo: 'des' },
    { id: 'adestrar', nome: 'Adestrar Animais', atributo: 'sab' },
    { id: 'arcanismo', nome: 'Arcanismo', atributo: 'int' },
    { id: 'atletismo', nome: 'Atletismo', atributo: 'for' },
    { id: 'atuacao', nome: 'Atuação', atributo: 'car' },
    { id: 'enganacao', nome: 'Enganação', atributo: 'car' },
    { id: 'furtividade', nome: 'Furtividade', atributo: 'des' },
    { id: 'historia', nome: 'História', atributo: 'int' },
    { id: 'intimidacao', nome: 'Intimidação', atributo: 'car' },
    { id: 'intuicao', nome: 'Intuição', atributo: 'sab' },
    { id: 'investigacao', nome: 'Investigação', atributo: 'int' },
    { id: 'medicina', nome: 'Medicina', atributo: 'sab' },
    { id: 'natureza', nome: 'Natureza', atributo: 'int' },
    { id: 'percepcao', nome: 'Percepção', atributo: 'sab' },
    { id: 'persuasao', nome: 'Persuasão', atributo: 'car' },
    { id: 'prestidigitacao', nome: 'Prestidigitação', atributo: 'des' },
    { id: 'religiao', nome: 'Religião', atributo: 'int' },
    { id: 'sobrevivencia', nome: 'Sobrevivência', atributo: 'sab' },
];

/** 0 = sem proficiência, 1 = proficiente, 2 = especialista. */
export type Proficiencia = 0 | 1 | 2;

export const MOEDAS = [
    { id: 'pl', sigla: 'PL', nome: 'Platina', cor: '#cbd5e1' },
    { id: 'po', sigla: 'PO', nome: 'Ouro', cor: '#ecc96c' },
    { id: 'pe', sigla: 'PE', nome: 'Electro', cor: '#a3e635' },
    { id: 'pp', sigla: 'PP', nome: 'Prata', cor: '#94a3b8' },
    { id: 'pc', sigla: 'PC', nome: 'Cobre', cor: '#c2763a' },
] as const;

export const DADOS_DE_VIDA = ['d4', 'd6', 'd8', 'd10', 'd12'] as const;

/** XP necessário para chegar ao nível seguinte, por nível atual (no 20 vale o último). */
const XP_PROXIMO: Record<number, number> = {
    1: 300,
    2: 900,
    3: 2700,
    4: 6500,
    5: 14000,
    6: 23000,
    7: 34000,
    8: 48000,
    9: 64000,
    10: 85000,
    11: 100000,
    12: 120000,
    13: 140000,
    14: 165000,
    15: 195000,
    16: 225000,
    17: 265000,
    18: 305000,
    19: 355000,
    20: 355000,
};

/** Entrada do inventário: só REFERENCIA o item da mesa (`item_id`); nome, peso e efeitos vêm do item. */
export interface ItemInventario {
    item_id: number;
    qtd: number;
    equipado: boolean;
    sintonizado: boolean;
}
/** Dados do sistema num item: armadura (CA base ou bônus de escudo) e/ou arma. */
export interface DadosItemDnd5e {
    armadura?: { tipo: 'leve' | 'media' | 'pesada' | 'escudo'; base: number };
    arma?: {
        dano: string;
        /** Atributo cujo modificador entra no ataque e no dano: qualquer um, ou `acuidade` (o maior entre Força e Destreza). */
        atributo: AtributoId | 'acuidade';
        /** Atributo do dano; sem ele (ou `null`), o dano usa o mesmo do ataque. `nenhum` = dano sem modificador. */
        atributoDano?: AtributoId | 'acuidade' | 'nenhum' | null;
        tipoDano?: string | null;
        proficiente?: boolean;
        /** Bônus simples somado ao acerto (inteiro: 1, 2, 3...). */
        bonusAtaque?: number | null;
        /** Bônus simples somado ao dano. */
        bonusDano?: number | null;
        /** Formato antigo: um só bônus para o acerto e o dano; vale quando os dois acima não existem. */
        bonusMagico?: number;
        /** Dados extras DA ARMA (ex.: +2d6 de fogo), até 3; entram no dano e dobram no crítico. */
        danoExtra?: { dados: string; tipo?: string | null }[];
        margemCritica?: number;
    };
}
/** O que o cálculo precisa de um item da mesa (campos ausentes valem: equipável, sem sintonia, sem efeitos). */
export interface ItemParaCalculo {
    nome?: string;
    /** Peso de 1 unidade, em kg. */
    peso: number;
    equipavel?: boolean;
    requer_sintonia?: boolean;
    dados?: DadosItemDnd5e | Record<string, unknown> | null;
    efeitos?: EfeitoBruto[];
}
export type ItensPorId = Record<number, ItemParaCalculo>;
export interface Caracteristica {
    nome: string;
    origem: string;
    tipo: 'ativa' | 'passiva';
    /** `porProf`: o máximo acompanha o bônus de proficiência (ver `usosMax`); `max` guarda o último valor calculado. */
    usos?: { atual: number; max: number; porProf?: boolean };
    /** Buffs da característica (os mesmos efeitos dos itens). A passiva sempre vale; a ativa, só com `ativa` ligada. */
    efeitos?: EfeitoBruto[];
    /** Interruptor das características ativas (ex.: Fúria ligada). A passiva ignora. */
    ativa?: boolean;
    /** Em que descanso os usos voltam (padrão: o longo). Qualquer descanso desliga os buffs ativos. */
    descanso?: 'curto' | 'longo';
}
export interface Ferramenta {
    nome: string;
    prof: Proficiencia;
    atributo: AtributoId;
}
export interface Magia {
    nome: string;
    escola: string;
    preparada: boolean;
}

/** Ajustes manuais, somados aos valores derivados (bônus de itens, magias, efeitos...). */
export interface Ajustes {
    proficiencia: number;
    ca: number;
    iniciativa: number;
    cd: number;
    ataque: number;
    cargaMax: number;
    salvaguardas: Partial<Record<AtributoId, number>>;
    pericias: Partial<Record<string, number>>;
}

/** Só o que é ESCOLHIDO/ANOTADO fica salvo; CA, iniciativa, bônus, CD, carga... são calculados (`calcular`). */
export interface FichaDnd5e {
    classe: string;
    subclasse: string;
    nivel: number;
    especie: string;
    antecedente: string;
    alinhamento: string;
    xp: { atual: number };
    inspiracao: boolean;
    atributos: Record<AtributoId, number>;
    salvaguardas: AtributoId[];
    pericias: Partial<Record<string, Proficiencia>>;
    deslocamento: string;
    pv: { atual: number; max: number; temp: number };
    dadosVida: { restantes: number; tipo: string };
    morte: { sucessos: number; falhas: number };
    exaustao: number;
    sentidos: string[];
    idiomas: string[];
    resistencias: string[];
    imunidades: string[];
    vulnerabilidades: string[];
    proficienciasArmas: string[];
    proficienciasArmaduras: string[];
    ferramentas: Ferramenta[];
    moedas: Record<(typeof MOEDAS)[number]['id'], number>;
    inventario: { secao: string; itens: ItemInventario[] }[];
    /** Ids das condições ativas (`CONDICOES`), ex.: `envenenado`. */
    condicoes?: string[];
    caracteristicas: Caracteristica[];
    magias: {
        atributo: AtributoId;
        preparadas: { max: number };
        espacos: { nivel: number; usados: number; total: number }[];
        lista: { nivel: number; magias: Magia[] }[];
    };
    biografia: { personalidade: string; ideais: string; vinculos: string; defeitos: string; aparencia: string; texto: string };
    ajustes: Ajustes;
}

export const modificador = (valor: number): number => Math.floor((valor - 10) / 2);
export const comSinal = (n: number): string => (n >= 0 ? `+${n}` : `${n}`);

export const MAX_SINTONIA = 3;

/** O item conta? Em inventário (qtd > 0), equipado se for equipável, sintonizado se exigir. */
export function ativo(ref: ItemInventario, item: ItemParaCalculo): boolean {
    return ref.qtd > 0 && ((item.equipavel ?? true) ? ref.equipado : true) && ((item.requer_sintonia ?? false) ? ref.sintonizado : true);
}

/** Efeitos que o item gera a partir dos `dados` do sistema (a armadura define a CA base). */
export function efeitosDoItem(item: ItemParaCalculo): EfeitoBruto[] {
    const a = (item.dados as DadosItemDnd5e | null | undefined)?.armadura;
    if (!a) return [];
    switch (a.tipo) {
        case 'leve':
            return [{ alvo: 'ca', modo: 'base', valor: `${a.base}+@mod.des` }];
        case 'media':
            return [{ alvo: 'ca', modo: 'base', valor: `${a.base}+min(@mod.des,2)` }];
        case 'pesada':
            return [{ alvo: 'ca', modo: 'base', valor: a.base }];
        case 'escudo':
            return [{ alvo: 'ca', modo: 'soma', valor: a.base }];
        default:
            return [];
    }
}

/**
 * Efeitos ativos da ficha: itens (na ordem do inventário), características (passivas e ativas ligadas, na ordem salva),
 * condições, depois os ajustes manuais (soma).
 */
export function efeitosAtivos(f: FichaDnd5e, itens: ItensPorId): Efeito[] {
    const efeitos: Efeito[] = [];
    for (const secao of f.inventario ?? []) {
        for (const ref of secao.itens ?? []) {
            const item = itens[ref.item_id]; // item excluído da mesa: ignorado
            if (!item || !ativo(ref, item)) continue;
            efeitos.push(...deFonte(item.nome ?? 'Item', [...(item.efeitos ?? []), ...efeitosDoItem(item)]));
        }
    }

    // Características com buffs: a passiva sempre vale; a ativa, só ligada (ex.: Fúria, Aura de Proteção)
    for (const c of f.caracteristicas ?? []) {
        const vale = (c.tipo ?? 'passiva') === 'passiva' || c.ativa === true;
        if (vale && c.efeitos?.length) efeitos.push(...deFonte(c.nome ?? 'Característica', c.efeitos));
    }

    // Condições ativas (ex.: Envenenado dá desvantagem em ataques e testes)
    for (const id of f.condicoes ?? []) {
        const c = condicaoPorId(id);
        if (c) efeitos.push(...deFonte(c.nome, c.efeitos));
    }

    const aj = f.ajustes ?? ({} as Partial<Ajustes>);
    const manuais: Record<string, number> = {
        ca: aj.ca ?? 0,
        iniciativa: aj.iniciativa ?? 0,
        cd: aj.cd ?? 0,
        ataque: aj.ataque ?? 0,
        'carga.max': aj.cargaMax ?? 0,
    };
    for (const { id } of ATRIBUTOS) manuais[`salv.${id}`] = aj.salvaguardas?.[id] ?? 0;
    for (const p of PERICIAS) manuais[`pericia.${p.id}`] = aj.pericias?.[p.id] ?? 0;
    for (const [alvo, valor] of Object.entries(manuais)) if (valor !== 0) efeitos.push({ fonte: 'Ajuste manual', alvo, modo: 'soma', valor });

    return efeitos;
}

export interface Analise {
    /** Valores derivados (também são as variáveis de rolagem). */
    valores: Record<string, number>;
    /** De onde vem cada bônus, por alvo (só alvos que receberam efeitos). */
    origens: Record<string, Origem[]>;
    /** Efeitos ativos (de itens e ajustes), para consultar vantagem/desvantagem. */
    efeitos: Efeito[];
}

/**
 * Valores derivados da ficha, em mapa plano (também são as variáveis de rolagem: `@mod.for`, `@pericia.percepcao`,
 * `@arma.7.ataque`...), junto das origens dos bônus. Fases: (1) atributos efetivos; (2) valores-base; (3) efeitos
 * sobre os valores-base (fórmulas veem a fase 2). Chaves: nivel, prof, atributos.<atr> (efetivo), mod.<atr>, salv.<atr>,
 * pericia.<id>, passiva.<id>, ferramenta.<i>, iniciativa, ca, cd, ataque, ataque.arma, dano.arma, pv.max, carga.atual,
 * carga.max, xp.proximo, dv.max, preparadas.atual e, por arma ativa, arma.<item_id>.ataque / .dano / .margem.
 * Tolerante a chaves ausentes (ficha salva antes de um campo existir): usa 0.
 */
export function analisar(f: FichaDnd5e, itens: ItensPorId = {}): Analise {
    const efeitos = efeitosAtivos(f, itens);
    const origens: Record<string, Origem[]> = {};
    const aplicarEm = (alvo: string, base: number, variaveis: Record<string, number>): number => {
        const r = aplicar(alvo, base, efeitos, variaveis);
        if (r.origens.length) origens[alvo] = r.origens;

        return r.valor;
    };

    const nivel = Number(f.nivel);
    const prof = bonusProficiencia(f);
    const r: Record<string, number> = { nivel, prof };

    // Fase 1: atributos efetivos
    const mod = {} as Record<AtributoId, number>;
    for (const { id } of ATRIBUTOS) {
        r[`atributos.${id}`] = aplicarEm(`atributos.${id}`, f.atributos[id], { nivel });
        mod[id] = modificador(r[`atributos.${id}`]);
        r[`mod.${id}`] = mod[id];
    }

    // Fase 2: valores-base
    const base: Record<string, number> = {};
    for (const { id } of ATRIBUTOS) base[`salv.${id}`] = mod[id] + (f.salvaguardas.includes(id) ? prof : 0);
    for (const p of PERICIAS) base[`pericia.${p.id}`] = mod[p.atributo] + (f.pericias[p.id] ?? 0) * prof;
    const conjuracao = mod[f.magias.atributo];
    base.iniciativa = mod.des;
    base.ca = 10 + mod.des;
    base.cd = 8 + prof + conjuracao;
    base.ataque = prof + conjuracao;
    base['ataque.arma'] = 0;
    base['dano.arma'] = 0;
    base['carga.max'] = 15 * r['atributos.for'];
    base['pv.max'] = f.pv?.max ?? 0;

    // Fase 3: efeitos sobre os valores-base
    const variaveis = { ...r, ...base };
    for (const [chave, valor] of Object.entries(base)) r[chave] = aplicarEm(chave, valor, variaveis);
    for (const p of PERICIAS) r[`passiva.${p.id}`] = 10 + r[`pericia.${p.id}`];
    f.ferramentas.forEach((t, i) => (r[`ferramenta.${i}`] = mod[t.atributo] + t.prof * prof));

    // Armas ativas
    for (const secao of f.inventario ?? []) {
        for (const ref of secao.itens ?? []) {
            const item = itens[ref.item_id];
            const arma = (item?.dados as DadosItemDnd5e | null | undefined)?.arma;
            if (!item || !arma || !ativo(ref, item)) continue;
            // Ataque e dano podem usar atributos diferentes; sem `atributoDano`, o dano usa o mesmo do ataque.
            const mAtaque = modificadorDaArma(arma.atributo, mod);
            const mDano = modificadorDaArma(arma.atributoDano ?? arma.atributo, mod);
            // Bônus simples de acerto e de dano, separados; armas antigas (só `bonusMagico`) usam o mesmo nos dois.
            const bonusAtaque = arma.bonusAtaque ?? arma.bonusMagico ?? 0;
            const bonusDano = arma.bonusDano ?? arma.bonusMagico ?? 0;
            r[`arma.${ref.item_id}.ataque`] = mAtaque + (arma.proficiente ? prof : 0) + bonusAtaque + r['ataque.arma'];
            r[`arma.${ref.item_id}.dano`] = mDano + bonusDano + r['dano.arma'];
            r[`arma.${ref.item_id}.margem`] = arma.margemCritica ?? 20; // d20 puro igual ou maior que isto é crítico
        }
    }

    let peso = 0;
    for (const secao of f.inventario) for (const ref of secao.itens) peso += ref.qtd * (itens[ref.item_id]?.peso ?? 0); // item removido da mesa não pesa
    let preparadas = 0;
    for (const grupo of f.magias.lista) for (const m of grupo.magias) if (grupo.nivel >= 1 && m.preparada) preparadas++;
    r['carga.atual'] = Math.round(peso * 100) / 100;
    r['xp.proximo'] = XP_PROXIMO[Math.min(Math.max(nivel, 1), 20)];
    r['dv.max'] = nivel;
    r['preparadas.atual'] = preparadas;

    return { valores: r, origens, efeitos };
}

/**
 * Modificador que a arma usa: qualquer atributo (Força, Destreza, Sabedoria...), `acuidade` (o maior entre Força e
 * Destreza) ou `nenhum` (zero: o dano da mão secundária, por exemplo). Valor desconhecido usa a Força.
 */
function modificadorDaArma(atributo: string, mod: Record<AtributoId, number>): number {
    if (atributo === 'acuidade') return Math.max(mod.for, mod.des);
    if (atributo === 'nenhum') return 0;

    return mod[atributo as AtributoId] ?? mod.for;
}

/** Só os valores derivados (as variáveis de rolagem). */
export function calcular(f: FichaDnd5e, itens: ItensPorId = {}): Record<string, number> {
    return analisar(f, itens).valores;
}

/**
 * Alvo de efeito (para vantagem/desvantagem) do botão que rola a variável: `mod.for` é um teste de atributo
 * (`teste.for`), `arma.7.ataque` é `ataque.arma`; o resto usa o próprio nome. Dano não tem vantagem.
 */
export function alvoDaRolagem(variavel: string): string | null {
    if (variavel.startsWith('mod.')) return `teste.${variavel.slice(4)}`;
    if (/^arma\.\d+\.ataque$/.test(variavel)) return 'ataque.arma';
    if (/^arma\.\d+\.dano$/.test(variavel)) return null;
    return variavel;
}

/** Vantagem/desvantagem que os efeitos ativos dão à rolagem desta variável (as duas se anulam). */
export function modoDaRolagem(efeitos: Efeito[], variavel: string): Rolagem {
    const alvo = alvoDaRolagem(variavel);

    return alvo ? rolagem(alvo, efeitos) : null;
}

/**
 * Todos os dados do dano de uma arma, em ordem: o da arma, os extras DA ARMA (`danoExtra`) e os extras dos buffs ativos
 * (efeitos de modo `dados` em `dano.arma`: Ataque Furtivo, itens, características). Espelha `Regras::dadosDeDano`.
 * Vazio se o item não é arma.
 */
export function dadosDeDano(f: FichaDnd5e, itens: ItensPorId, itemId: number): string[] {
    const arma = (itens[itemId]?.dados as DadosItemDnd5e | null | undefined)?.arma;
    if (!arma || typeof arma.dano !== 'string') return [];

    const dados = [arma.dano];
    for (const extra of arma.danoExtra ?? []) if (dadosValidos(extra.dados)) dados.push(extra.dados);
    for (const e of efeitosAtivos(f, itens)) if (e.modo === 'dados' && casa(e.alvo, 'dano.arma') && dadosValidos(e.valor)) dados.push(e.valor);

    return dados;
}

export interface ArmaAtiva {
    itemId: number;
    nome: string;
    /** Os dados do dano somados, com os extras (ex.: `1d8+2d6`); o bônus fixo vem em `danoBonus`. */
    dano: string;
    tipoDano: string | null;
    /** Bônus de ataque (já com proficiência, bônus mágico e efeitos). */
    ataque: number;
    /** Bônus fixo de dano (modificador, bônus mágico e efeitos). */
    danoBonus: number;
    /** d20 puro igual ou maior que isto é crítico (20 por padrão; armas específicas: 19 ou 18). */
    margem: number;
}

/** Armas equipadas (e sintonizadas, se exigir), com os bônus já calculados por `analisar`. */
export function armasAtivas(f: FichaDnd5e, itens: ItensPorId, valores: Record<string, number>): ArmaAtiva[] {
    const armas: ArmaAtiva[] = [];
    for (const secao of f.inventario ?? []) {
        for (const ref of secao.itens ?? []) {
            const item = itens[ref.item_id];
            const arma = (item?.dados as DadosItemDnd5e | null | undefined)?.arma;
            if (!item || !arma || !ativo(ref, item)) continue;
            armas.push({
                itemId: ref.item_id,
                nome: item.nome ?? 'Arma',
                dano: dadosDeDano(f, itens, ref.item_id).join('+'),
                tipoDano: arma.tipoDano ?? null,
                ataque: valores[`arma.${ref.item_id}.ataque`],
                danoBonus: valores[`arma.${ref.item_id}.dano`],
                margem: valores[`arma.${ref.item_id}.margem`],
            });
        }
    }

    return armas;
}

/**
 * O inventário depois de entregar o item `itemId` à ficha (o mestre arrasta o item para a janela da ficha). Item que
 * a ficha já tem ganha mais uma unidade; um novo entra desequipado na seção "Equipamento" (ou na primeira seção).
 * Devolve o inventário inteiro, pronto para salvar (a lista é sempre salva por substituição).
 */
export function comItemEntregue(f: FichaDnd5e, itemId: number): FichaDnd5e['inventario'] {
    const inventario: FichaDnd5e['inventario'] = JSON.parse(JSON.stringify(f.inventario ?? []));
    for (const secao of inventario) {
        const ref = secao.itens.find((r) => r.item_id === itemId);
        if (ref) {
            ref.qtd = Math.min(100000, ref.qtd + 1);

            return inventario;
        }
    }

    const nova: ItemInventario = { item_id: itemId, qtd: 1, equipado: false, sintonizado: false };
    const destino = inventario.find((s) => s.secao === 'Equipamento') ?? inventario[0];
    if (destino) destino.itens.push(nova);
    else inventario.push({ secao: 'Equipamento', itens: [nova] });

    return inventario;
}

export type TipoDescanso = 'curto' | 'longo';

/** Bônus de proficiência: 2 + (nível − 1) / 4, mais o ajuste manual. */
export function bonusProficiencia(f: FichaDnd5e): number {
    return 2 + Math.floor((Number(f.nivel) - 1) / 4) + (f.ajustes?.proficiencia ?? 0);
}

/** Máximo de usos de uma característica: fixo, ou igual ao bônus de proficiência (`usos.porProf`). */
export function usosMax(c: Caracteristica, prof: number): number {
    return c.usos?.porProf ? Math.max(0, prof) : (c.usos?.max ?? 0);
}

/**
 * Liga ou desliga o buff de uma característica ativa. LIGAR gasta 1 uso (se a característica tem usos): sem usos
 * restantes não liga (devolve null). Desligar não devolve o uso. Passiva não tem interruptor (null).
 */
export function comBuffAlternado(c: Caracteristica, prof = 2): Caracteristica | null {
    if (c.tipo !== 'ativa') return null;
    if (c.ativa) return { ...c, ativa: false };
    if (c.usos && usosMax(c, prof) > 0) {
        if (c.usos.atual <= 0) return null;

        return { ...c, ativa: true, usos: { ...c.usos, atual: c.usos.atual - 1 } };
    }

    return { ...c, ativa: true };
}

/**
 * Gastar um dado de vida: o dado rolado (`1dX + mod. CON`, `total`) cura PV (nunca abaixo de 0 nem acima do máximo
 * efetivo) e consome um dado. Vazio se não há dado restante.
 */
export function camposDoDadoDeVida(f: FichaDnd5e, total: number, pvMax: number = f.pv.max): Record<string, unknown> {
    if (f.dadosVida.restantes <= 0) return {};

    return {
        'dadosVida.restantes': f.dadosVida.restantes - 1,
        'pv.atual': Math.min(pvMax, f.pv.atual + Math.max(0, total)),
    };
}

/**
 * Teste contra a morte com o d20 puro: 20 = volta com 1 PV e zera as marcas; 1 = duas falhas; 10+ = sucesso;
 * 9 ou menos = falha (no máximo 3 de cada).
 */
export function camposDoTesteContraMorte(f: FichaDnd5e, d20: number): Record<string, unknown> {
    if (d20 >= 20) return { 'pv.atual': Math.max(1, f.pv.atual), 'morte.sucessos': 0, 'morte.falhas': 0 };
    if (d20 >= 10) return { 'morte.sucessos': Math.min(3, f.morte.sucessos + 1) };

    return { 'morte.falhas': Math.min(3, f.morte.falhas + (d20 === 1 ? 2 : 1)) };
}

/**
 * Os campos a salvar ao terminar um descanso (vazio se nada muda).
 * - Os dois: desligam os buffs ativos e restauram os usos das características (o curto, só as de `descanso: 'curto'`;
 *   o longo, todas).
 * - Longo: PV até o máximo EFETIVO (com itens e buffs; `pvMax`), metade dos dados de vida (mín. 1), -1 de exaustão,
 *   testes contra a morte zerados e espaços de magia restaurados.
 */
export function camposDoDescanso(f: FichaDnd5e, tipo: TipoDescanso, pvMax: number = f.pv.max): Record<string, unknown> {
    const campos: Record<string, unknown> = {};

    const prof = bonusProficiencia(f);
    const antes = f.caracteristicas ?? [];
    const depois = antes.map((c) => {
        const recarrega = c.usos !== undefined && (tipo === 'longo' || (c.descanso ?? 'longo') === 'curto');

        return {
            ...c,
            ...(recarrega ? { usos: { ...c.usos!, max: usosMax(c, prof), atual: usosMax(c, prof) } } : {}),
            ...(c.tipo === 'ativa' && c.ativa ? { ativa: false } : {}),
        };
    });
    if (JSON.stringify(antes) !== JSON.stringify(depois)) campos.caracteristicas = depois;

    if (tipo === 'longo') {
        Object.assign(campos, {
            'pv.atual': pvMax,
            'dadosVida.restantes': Math.min(f.nivel, f.dadosVida.restantes + Math.max(1, Math.floor(f.nivel / 2))),
            exaustao: Math.max(0, f.exaustao - 1),
            'morte.sucessos': 0,
            'morte.falhas': 0,
            'magias.espacos': f.magias.espacos.map((e) => ({ ...e, usados: 0 })),
        });
    }

    return campos;
}

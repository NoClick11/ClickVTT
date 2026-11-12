/**
 * Regras do navio (cap. 13 e 14), puras: CR, BR, velocidade, condição, cômodos, lotação, despesas, efetivo e o custo de cada
 * obra. Espelhadas em `app/Sistemas/OnePiece/Navios.php` e conferidas pelos casos de `tests/paridade/navios-casos.json`.
 *
 * O navio é um personagem com o bloco `ficha.navio`. Os PV ficam em `ficha.pv` (os PV paralelos do Reparo Emergencial são os
 * PV temporários), o tesouro em `ficha.belly` e a carga em `ficha.inventario`.
 *
 * Obra: uma peça com `pronto_dia` ainda está em construção e não vale; o servidor zera o campo quando o calendário chega lá.
 */
import {
    ANCORAS,
    AUTO_REPARO,
    BATERIAS_DO_GERADOR,
    CANHOES,
    COMODOS,
    CONDICOES_DO_NAVIO,
    CONSEQUENCIAS,
    FORTIFICACOES,
    FUNCOES,
    KAIROSEKI,
    LEMES,
    MADEIRAS,
    MASTROS,
    MAX_FUNCOES,
    MODELOS,
    MOTORES,
    MOTORES_COM_SALA,
    MOTORES_SOB_DEMANDA,
    PROFISSOES_DO_NAVIO,
    TAMANHOS,
    VELOCIDADE_MINIMA_POR_DANO,
    type Condicao,
    type Peca,
    type Tamanho,
    type TamanhoId,
} from './dados.ts';

/** Parte única do navio (madeira, fortificação, kairoseki, âncora, leme). Em obra, quem vale ainda é `antes`. */
export interface Parte {
    tipo: string | null;
    pronto_dia: number | null;
    antes?: string | null;
}
/** Peça de uma lista (mastro, motor, canhão, cômodo). */
export interface PecaInstalada {
    uid: string;
    tipo: string;
    pronto_dia: number | null;
    nome?: string;
}
export interface Tripulante {
    uid: string;
    nome: string;
    /** Personagem da mesa (para os traços de Carpinteiro e Timoneiro); `null` = tripulante genérico. */
    personagem_id: number | null;
    qtd: number;
    funcoes: string[];
}
export interface Lancamento {
    dia: number;
    texto: string;
    valor: number;
}
export interface NavioFicha {
    tamanho: TamanhoId;
    madeira: Parte;
    fortificacao: Parte;
    kairoseki: Parte;
    ancora: Parte;
    leme: Parte;
    mastros: PecaInstalada[];
    motores: PecaInstalada[];
    canhoes: PecaInstalada[];
    comodos: PecaInstalada[];
    tripulacao: Tripulante[];
    klabautermann: boolean;
    /** Construído por um carpinteiro da tripulação (Eficácia: +12 nós e +3 de CR). */
    feito_por_carpinteiro: boolean;
    /** Lotação fixada pelo mestre (navios da Marinha); `null` = a do tamanho. */
    lotacao: number | null;
    baterias: number;
    conserto: { pronto_dia: number } | null;
    manutencao: { proxima_dia: number; em_dia: boolean };
    /** Mantido pelo servidor: quem da tripulação tem a profissão (o jogador não recebe a ficha dos outros). */
    oficios: { carpinteiro: boolean; timoneiro: boolean; timoneiroNaNavegacao: boolean };
    registro: Lancamento[];
}

export type Grupo = 'madeira' | 'fortificacao' | 'kairoseki' | 'ancora' | 'leme' | 'mastros' | 'motores' | 'canhoes' | 'comodos';
export const GRUPOS_DE_LISTA = ['mastros', 'motores', 'canhoes', 'comodos'] as const;
export const GRUPOS_UNICOS = ['madeira', 'fortificacao', 'kairoseki', 'ancora', 'leme'] as const;
export type GrupoDeLista = (typeof GRUPOS_DE_LISTA)[number];
export type GrupoUnico = (typeof GRUPOS_UNICOS)[number];
export type Modo = 'comprar' | 'construir';

export const tamanhoDe = (id: string): Tamanho => TAMANHOS.find((t) => t.id === id) ?? TAMANHOS[0];
const por = <T extends { id: string }>(lista: T[], id: string | null | undefined): T | undefined => lista.find((x) => x.id === id);
export const pecasDoGrupo = (grupo: Grupo): Peca[] =>
    grupo === 'ancora'
        ? ANCORAS
        : grupo === 'leme'
          ? LEMES
          : grupo === 'mastros'
            ? MASTROS
            : grupo === 'motores'
              ? MOTORES
              : grupo === 'canhoes'
                ? CANHOES
                : [];

/** O tipo que VALE na parte (em obra, o anterior). */
export const tipoEfetivo = (p: Parte | undefined): string | null => (!p ? null : p.pronto_dia === null ? p.tipo : (p.antes ?? null));
const prontas = (lista: PecaInstalada[] | undefined): PecaInstalada[] => (lista ?? []).filter((p) => p.pronto_dia === null);
const tem = (lista: PecaInstalada[], tipo: string): boolean => lista.some((p) => p.tipo === tipo);

export function navioPadrao(tamanho: TamanhoId = 'pequeno', madeira = 'cedro'): NavioFicha {
    const t = tamanhoDe(tamanho);

    return {
        tamanho: t.id,
        madeira: { tipo: madeira, pronto_dia: null },
        fortificacao: { tipo: null, pronto_dia: null },
        kairoseki: { tipo: null, pronto_dia: null },
        ancora: { tipo: t.ordem >= 3 ? 'robusta' : 'normal', pronto_dia: null },
        leme: { tipo: t.ordem >= 2 ? 'circular' : 'tora', pronto_dia: null },
        mastros: [],
        motores: [],
        canhoes: [],
        comodos: [],
        tripulacao: [],
        klabautermann: false,
        feito_por_carpinteiro: false,
        lotacao: null,
        baterias: 0,
        conserto: null,
        manutencao: { proxima_dia: 1, em_dia: true },
        oficios: { carpinteiro: false, timoneiro: false, timoneiroNaNavegacao: false },
        registro: [],
    };
}

/** O navio de um modelo do livro, tudo pronto. `uid` gera os identificadores das peças. */
export function navioDoModelo(modeloId: string, uid: () => string): NavioFicha | null {
    const m = por(MODELOS, modeloId);
    if (!m) return null;
    const pecas = (tipos: string[]): PecaInstalada[] => tipos.map((tipo) => ({ uid: uid(), tipo, pronto_dia: null }));

    return {
        ...navioPadrao(m.tamanho, m.madeira),
        fortificacao: { tipo: m.fortificacao, pronto_dia: null },
        ancora: { tipo: m.ancora, pronto_dia: null },
        leme: { tipo: m.leme, pronto_dia: null },
        mastros: pecas(m.mastros),
        motores: pecas(m.motores),
        canhoes: pecas(m.canhoes),
        comodos: pecas(m.comodos ?? []),
        lotacao: m.lotacao ?? null,
    };
}

/** A condição pela % de PV (arredondada para baixo): a primeira faixa, da pior para a melhor, que a comporta. */
export function condicaoDoNavio(pvAtual: number, pvMax: number): Condicao {
    const pct = pvMax > 0 ? Math.floor((Math.max(0, pvAtual) * 100) / pvMax) : 100;

    return CONDICOES_DO_NAVIO.find((c) => pct <= c.ate) ?? CONDICOES_DO_NAVIO[CONDICOES_DO_NAVIO.length - 1];
}

export interface CalculoDoNavio {
    cr: number;
    br: number;
    pvMax: number;
    /** Velocidade sem dano, em nós. */
    velocidadeBase: number;
    reducaoPorDano: number;
    velocidade: number;
    /** Em combate: cada 2 nós = 1,5 m por rodada. */
    metrosPorRodada: number;
    /** Nós a mais com a turbina acionada (0 = sem turbina). */
    turbina: number;
    condicao: string;
    comodosUsados: number;
    comodosMax: number;
    lotacao: number;
    canhoes: number;
    canhoesMax: number;
    mastrosMax: number;
    despesa: number;
    bateriasMax: number;
    autoReparo: number;
    valor: number;
    resistencias: string[];
}

/** Os cômodos só dão benefício com a manutenção em dia. */
const comodoAtivo = (n: NavioFicha, tipo: string): boolean => n.manutencao?.em_dia !== false && tem(prontas(n.comodos), tipo);

export function calcularNavio(n: NavioFicha, pvAtual: number): CalculoDoNavio {
    const t = tamanhoDe(n.tamanho);
    const madeira = por(MADEIRAS, tipoEfetivo(n.madeira)) ?? MADEIRAS[0];
    const fort = por(FORTIFICACOES, tipoEfetivo(n.fortificacao));
    const kairoseki = tipoEfetivo(n.kairoseki) !== null;
    const eficacia = n.feito_por_carpinteiro ? PROFISSOES_DO_NAVIO.carpinteiro : null;
    const cr = madeira.cr + (fort?.cr ?? 0) + (kairoseki ? KAIROSEKI.cr : 0) + (eficacia?.cr ?? 0);

    const mastros = prontas(n.mastros).reduce((s, p) => s + (por(MASTROS, p.tipo)?.nos ?? 0), 0);
    const motores = prontas(n.motores);
    const salas = prontas(n.comodos).filter((c) => c.tipo === 'sala-maquinas').length;
    let motor = 0;
    for (const m of motores) {
        if (MOTORES_SOB_DEMANDA.includes(m.tipo)) continue;
        // Combustão num Colossal com duas Salas das Máquinas: 16 nós
        const nos = m.tipo === 'combustao' && t.id === 'colossal' && salas >= 2 ? 16 : (por(MOTORES, m.tipo)?.nos ?? 0);
        motor = Math.max(motor, nos);
    }
    const velocidadeBase = Math.max(0, mastros + motor + (eficacia?.nos ?? 0) - t.peso);
    const condicao = condicaoDoNavio(pvAtual, t.pv);
    // "Forçando Limites" (Timoneiro na navegação): ignora a redução por dano. O dano nunca leva a menos de 8 nós.
    const reducao = n.oficios?.timoneiroNaNavegacao ? 0 : condicao.reducao;
    const velocidade = reducao > 0 ? Math.max(Math.min(velocidadeBase, VELOCIDADE_MINIMA_POR_DANO), velocidadeBase - reducao) : velocidadeBase;

    const comodosUsados = (n.comodos ?? []).reduce((s, c) => s + (por(COMODOS, c.tipo)?.espacos ?? 1), 0);
    const despesa = prontas(n.comodos).reduce((s, c) => s + (por(COMODOS, c.tipo)?.despesa ?? 0), 0);
    const resistencias: string[] = [];
    if (fort?.id === 'aco-temperado') resistencias.push('Resistência Titânica: resistência a dano Contundente, Cortante e Perfurante.');
    if (madeira.id === 'adam') resistencias.push('Resistência Anciã: imune a características que aumentam o dano em construções.');
    if (kairoseki) resistencias.push('Casco de kairoseki: ignora encontros com Rei dos Mares e pode ser reparado com ao menos 1 PV.');

    return {
        cr,
        br: madeira.br,
        pvMax: t.pv,
        velocidadeBase,
        reducaoPorDano: velocidadeBase - velocidade,
        velocidade,
        metrosPorRodada: (velocidade / 2) * 1.5,
        turbina: tem(motores, 'turbina') ? (por(MOTORES, 'turbina')?.nos ?? 0) : 0,
        condicao: condicao.id,
        comodosUsados,
        comodosMax: t.comodos,
        lotacao: (n.lotacao ?? t.tripulantes) + (comodoAtivo(n, 'cozinha') ? 5 : 0),
        canhoes: prontas(n.canhoes).length,
        canhoesMax: t.canhoes,
        mastrosMax: t.mastros,
        despesa,
        bateriasMax: comodoAtivo(n, 'gerador') ? BATERIAS_DO_GERADOR : 0,
        autoReparo: n.klabautermann ? AUTO_REPARO * (1 + t.ordem) : 0,
        valor: valorDoNavio(n),
        resistencias,
    };
}

/** Valor do navio (base do teto do conserto em estaleiro): madeira, fortificação, kairoseki, peças e cômodos prontos. */
export function valorDoNavio(n: NavioFicha): number {
    const t = tamanhoDe(n.tamanho);
    let v = t.pecasMadeira * (por(MADEIRAS, tipoEfetivo(n.madeira))?.precoPorPeca ?? 0);
    v += t.pecasFortificacao * (por(FORTIFICACOES, tipoEfetivo(n.fortificacao))?.precoPorPeca ?? 0);
    if (tipoEfetivo(n.kairoseki) !== null) v += t.kairoseki.pecas * KAIROSEKI.precoPorPeca;
    const peca = (lista: Peca[], tipo: string | null) => {
        const p = por(lista, tipo);

        return p ? (p.preco ?? p.custo) : 0;
    };
    v += peca(ANCORAS, tipoEfetivo(n.ancora)) + peca(LEMES, tipoEfetivo(n.leme));
    for (const [lista, dados] of [
        [n.mastros, MASTROS],
        [n.motores, MOTORES],
        [n.canhoes, CANHOES],
    ] as const)
        for (const p of prontas(lista)) v += peca(dados, p.tipo);
    for (const c of prontas(n.comodos)) v += por(COMODOS, c.tipo)?.custo ?? 0;

    return v;
}

export interface CustoDaObra {
    custo: number;
    dias: number;
}

/** Quanto custa e quanto demora a obra. `null` = essa combinação não existe (peça que não se compra, tipo desconhecido). */
export function custoDaObra(n: NavioFicha, grupo: Grupo, tipo: string, modo: Modo): CustoDaObra | null {
    const t = tamanhoDe(n.tamanho);
    const desconto = n.oficios?.carpinteiro ? PROFISSOES_DO_NAVIO.carpinteiro.desconto : 0;
    const comDesconto = (v: number) => Math.floor((v * (100 - desconto)) / 100);
    // "Ajudante Entendido": o timoneiro ajudando o carpinteiro corta o prazo pela metade
    const prazo = (dias: number) => (n.oficios?.carpinteiro && n.oficios?.timoneiro ? Math.ceil(dias / 2) : dias);
    if (grupo === 'madeira') {
        const m = por(MADEIRAS, tipo);

        return m ? { custo: t.pecasMadeira * m.precoPorPeca, dias: prazo(t.diasConstrucao) } : null;
    }
    if (grupo === 'fortificacao') {
        const f = por(FORTIFICACOES, tipo);

        return f ? { custo: t.pecasFortificacao * f.precoPorPeca + comDesconto(f.adicional), dias: prazo(t.diasFortificacao) } : null;
    }
    if (grupo === 'kairoseki')
        return tipo === 'kairoseki'
            ? { custo: t.kairoseki.pecas * KAIROSEKI.precoPorPeca + comDesconto(t.kairoseki.adicional), dias: prazo(t.kairoseki.dias) }
            : null;
    if (grupo === 'comodos') {
        const c = por(COMODOS, tipo);

        return c ? { custo: comDesconto(c.custo), dias: prazo(c.dias) } : null;
    }
    const p = por(pecasDoGrupo(grupo), tipo);
    if (!p) return null;
    if (modo === 'comprar') return p.preco === null ? null : { custo: p.preco, dias: 0 };

    return { custo: comDesconto(p.custo), dias: prazo(p.dias) };
}

/** A obra cabe neste navio? Devolve o motivo quando não (o mestre pode ignorar os limites). */
export function problemaDaObra(n: NavioFicha, grupo: Grupo, tipo: string): string | null {
    const t = tamanhoDe(n.tamanho);
    if ((GRUPOS_UNICOS as readonly string[]).includes(grupo)) {
        const parte = n[grupo as GrupoUnico];
        if (parte?.pronto_dia !== null && parte?.pronto_dia !== undefined) return 'Já há uma obra em andamento nesta parte.';
        if (parte?.tipo === tipo) return 'O navio já tem isto.';
    }
    if (grupo === 'madeira') return por(MADEIRAS, tipo) ? null : 'Madeira desconhecida.';
    if (grupo === 'fortificacao') return por(FORTIFICACOES, tipo) ? null : 'Fortificação desconhecida.';
    if (grupo === 'kairoseki') return tipo === 'kairoseki' ? null : 'Revestimento desconhecido.';
    if (grupo === 'comodos') {
        const c = por(COMODOS, tipo);
        if (!c) return 'Cômodo desconhecido.';
        if (c.unico && tem(n.comodos ?? [], tipo)) return `O navio só comporta um(a) ${c.nome}.`;
        const usados = (n.comodos ?? []).reduce((s, x) => s + (por(COMODOS, x.tipo)?.espacos ?? 1), 0);
        if (usados + c.espacos > t.comodos) return `Faltam espaços: o navio ${t.nome} comporta ${t.comodos} cômodos e ${usados} já estão ocupados.`;
        if (tipo === 'quarto-vigilancia' && !tem(prontas(n.mastros), 'multiplo'))
            return 'O Quarto de Vigilância só pode ser construído em um mastro múltiplo.';

        return null;
    }
    const p = por(pecasDoGrupo(grupo), tipo);
    if (!p) return 'Peça desconhecida.';
    if (p.ordemMinima !== undefined && t.ordem < p.ordemMinima) return `${p.nome}: exige navio ${TAMANHOS[p.ordemMinima].nome} ou maior.`;
    if (p.ordemMaxima !== undefined && t.ordem > p.ordemMaxima) return `${p.nome}: não serve para um navio ${t.nome}.`;
    if (grupo === 'mastros' && (n.mastros ?? []).length >= t.mastros) return `Um navio ${t.nome} comporta ${t.mastros} mastro(s).`;
    if (grupo === 'canhoes' && (n.canhoes ?? []).length >= t.canhoes) return `Um navio ${t.nome} comporta ${t.canhoes} canhões.`;
    if (grupo === 'motores') {
        if (tem(n.motores ?? [], tipo)) return 'O navio já tem este motor (mais de um não aumenta a velocidade).';
        if (MOTORES_COM_SALA.includes(tipo) && !tem(n.comodos ?? [], 'sala-maquinas')) return `${p.nome}: exige o cômodo Sala das Máquinas.`;
    }

    return null;
}

export type Situacao = 'sem-minimo' | 'minimo' | 'ok';
export interface LinhaDoEfetivo {
    id: string;
    nome: string;
    atual: number;
    minimo: number;
    necessario: number;
    situacao: Situacao;
    consequencia: string;
    /** Observação da linha (ex.: rapazes da pólvora na artilharia). */
    detalhe?: string;
}
export interface Efetivo {
    linhas: LinhaDoEfetivo[];
    /** Tripulantes a bordo. */
    total: number;
    lotacao: number;
    /** Falta o necessário em alguma função. */
    skeletonCrew: boolean;
    /** Sem o mínimo de navegação. */
    naoNavega: boolean;
}

const contar = (n: NavioFicha, ...funcoes: string[]): number =>
    (n.tripulacao ?? []).reduce((s, t) => s + (t.funcoes.some((f) => funcoes.includes(f)) ? Math.max(0, t.qtd) : 0), 0);

export function efetivoDoNavio(n: NavioFicha): Efetivo {
    const t = tamanhoDe(n.tamanho);
    const linha = (
        id: string,
        nome: string,
        atual: number,
        minimo: number,
        necessario: number,
        forcada?: Situacao,
        detalhe?: string,
    ): LinhaDoEfetivo => {
        const situacao: Situacao = forcada ?? (atual < minimo ? 'sem-minimo' : atual < necessario ? 'minimo' : 'ok');
        const c = CONSEQUENCIAS[id];
        const consequencia = situacao === 'sem-minimo' ? c.semMinimo : situacao === 'minimo' ? c.semNecessario : '';

        return { id, nome, atual, minimo, necessario, situacao, consequencia, ...(detalhe ? { detalhe } : {}) };
    };
    const total = (n.tripulacao ?? []).reduce((s, x) => s + Math.max(0, x.qtd), 0);
    // "Eficiência da Tripulação": com o timoneiro na navegação, o mínimo cai em 10 (nunca abaixo de 1)
    const corte = n.oficios?.timoneiroNaNavegacao ? PROFISSOES_DO_NAVIO.timoneiro.efetivoMinimo : 0;
    const navMin = Math.max(1, t.efetivo.navegacao[0] - corte);
    const quarto = comodoAtivo(n, 'quarto-vigilancia');
    const vigNec = quarto ? 2 : t.efetivo.vigilancia[1];
    const canhoes = prontas(n.canhoes).length;
    const artilheiros = contar(n, 'artilheiro');
    const rapazes = contar(n, 'rapaz-da-polvora');
    // mínimo: 1 artilheiro por canhão; necessário: também 1 rapaz da pólvora por canhão
    const artilharia: Situacao = artilheiros < canhoes ? 'sem-minimo' : rapazes < canhoes ? 'minimo' : 'ok';
    // Alimentação: 1 cozinheiro alimenta 50 e cada ajudante mais 25, só com a Cozinha; Despensa e Refeitório somam 20 cada
    const cozinheiros = contar(n, 'cozinheiro');
    const temCozinha = comodoAtivo(n, 'cozinha');
    const alimentados =
        temCozinha && cozinheiros > 0
            ? 50 + 25 * contar(n, 'cozinheiro-ajudante') + (comodoAtivo(n, 'despensa') ? 20 : 0) + (comodoAtivo(n, 'refeitorio') ? 20 : 0)
            : 0;
    const linhas = [
        linha('navegacao', 'Navegação', contar(n, 'navegacao'), navMin, Math.max(navMin, t.efetivo.navegacao[1])),
        linha('limpeza', 'Limpeza', contar(n, 'criado-de-bordo'), t.efetivo.limpeza[0], t.efetivo.limpeza[1]),
        linha('vigilancia', 'Vigilância', contar(n, 'sentinela', 'monitor'), Math.min(t.efetivo.vigilancia[0], vigNec), vigNec),
        linha('artilharia', 'Artilharia', artilheiros, canhoes, canhoes, artilharia, `${rapazes} rapaz(es) da pólvora para ${canhoes} canhão(ões)`),
        linha('alimentacao', 'Alimentação', Math.min(alimentados, total), total, total),
    ];
    // sem canhão não há artilharia a cobrar; sem tripulação, nada a alimentar
    const validas = linhas.filter((l) => (l.id !== 'artilharia' || canhoes > 0) && (l.id !== 'alimentacao' || total > 0));
    const lotacao = (n.lotacao ?? t.tripulantes) + (temCozinha ? 5 : 0);

    return {
        linhas: validas,
        total,
        lotacao,
        skeletonCrew: validas.some((l) => l.situacao !== 'ok'),
        naoNavega: validas.some((l) => l.id === 'navegacao' && l.situacao === 'sem-minimo'),
    };
}

/** A lista de tripulantes é válida? (até 3 funções, uma só de comando, funções conhecidas) */
export function problemaDaTripulacao(lista: Tripulante[]): string | null {
    for (const t of lista) {
        if (!t.nome.trim()) return 'Todo tripulante precisa de um nome.';
        if (!Number.isInteger(t.qtd) || t.qtd < 1 || t.qtd > 5000) return `${t.nome}: quantidade inválida.`;
        if (t.personagem_id !== null && t.qtd !== 1) return `${t.nome}: um personagem conta como 1 tripulante.`;
        if (t.funcoes.length > MAX_FUNCOES) return `${t.nome}: no máximo ${MAX_FUNCOES} funções.`;
        if (new Set(t.funcoes).size !== t.funcoes.length) return `${t.nome}: função repetida.`;
        const funcoes = t.funcoes.map((f) => FUNCOES.find((x) => x.id === f));
        if (funcoes.some((f) => !f)) return `${t.nome}: função desconhecida.`;
        if (funcoes.filter((f) => f!.grupo === 'comando').length > 1) return `${t.nome}: só uma função de comando.`;
    }
    const capitaes = lista.filter((t) => t.funcoes.includes('capitao')).reduce((s, t) => s + t.qtd, 0);
    if (capitaes > 1) return 'O navio tem um só capitão.';

    return null;
}

export interface Conserto {
    /** Motivo de não poder consertar; `null` = pode. */
    motivo: string | null;
    pv: number;
    /** Carpinteiro: custo exato. Estaleiro: o teto (o valor combinado vem de quem paga). */
    custo: number;
    /** Carpinteiro: máximo do dado dos dias. Estaleiro: os dias da tabela. */
    dias: number;
    dado: string | null;
}

/** O conserto do navio pela condição atual. `modo`: `carpinteiro` (da tripulação) ou `estaleiro` (profissionais contratados). */
export function consertoDoNavio(n: NavioFicha, pvAtual: number, modo: 'carpinteiro' | 'estaleiro'): Conserto {
    const t = tamanhoDe(n.tamanho);
    const c = condicaoDoNavio(pvAtual, t.pv);
    const pv = Math.max(0, t.pv - pvAtual);
    const nada = (motivo: string): Conserto => ({ motivo, pv, custo: 0, dias: 0, dado: null });
    if (pv <= 0) return nada('O navio está íntegro.');
    if (n.conserto) return nada('Já há um conserto em andamento.');
    // Irreparável: só o casco de kairoseki ainda aceita conserto (com ao menos 1 PV), pela tabela da faixa seguinte
    const faixa = c.id === 'irreparavel' ? (tipoEfetivo(n.kairoseki) !== null && pvAtual >= 1 ? CONDICOES_DO_NAVIO[1] : null) : c;
    if (!faixa) return nada('Navio irreparável: os PV não podem mais ser recuperados.');
    if (modo === 'carpinteiro') {
        if (!n.oficios?.carpinteiro) return nada('Não há um Carpinteiro na tripulação.');
        const madeira = por(MADEIRAS, tipoEfetivo(n.madeira)) ?? MADEIRAS[0];

        return {
            motivo: null,
            pv,
            custo: faixa.carpinteiro!.fixo + pv * madeira.consertoPorPv,
            dias: faixa.carpinteiro!.maximo,
            dado: faixa.carpinteiro!.dias,
        };
    }

    return { motivo: null, pv, custo: Math.floor((valorDoNavio(n) * faixa.estaleiro!.teto) / 100), dias: faixa.estaleiro!.dias, dado: null };
}

/** Dano no navio: o Bônus de Resistência da madeira reduz todo dano recebido. */
export const danoNoNavio = (n: NavioFicha, dano: number): number => Math.max(0, dano - (por(MADEIRAS, tipoEfetivo(n.madeira))?.br ?? 0));

/** PV e CR sobre o token do navio. */
export function resumoDoNavio(ficha: { navio: NavioFicha; pv: { atual: number; temp?: number } }) {
    const c = calcularNavio(ficha.navio, ficha.pv.atual);

    return { pvAtual: ficha.pv.atual, pvMax: c.pvMax, cr: c.cr };
}

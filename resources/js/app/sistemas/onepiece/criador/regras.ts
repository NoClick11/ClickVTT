// Criador de Técnicas (lógica pura, sem Vue; espelhada em app/Sistemas/OnePiece/Criador.php): custo em PP, limites por grau
// e por nível, Manifestações de Poder (pontos virtuais) e a conversão para uma `Tecnica` da ficha.
import { CRIACAO_DE_POINTS } from '../akuma/zoan.ts';
import type { Acao, EfeitoDeTecnica, FormaDeAlcance, GrauDeTecnica, TipoDeTecnica } from './dados.ts';
import {
    AUXILIAR,
    CONDICOES_DE_TECNICA,
    CUSTO_TIPO_DE_DANO,
    EFEITOS_SEM_DANO,
    GRAUS,
    MAX_CONDICOES,
    MODIFICACOES,
    PONTOS_VIRTUAIS,
    efeitoPorId,
    planoDeUsuario,
} from './dados.ts';

export type OrigemDoCriador =
    | { tipo: 'nivel' }
    | { tipo: 'genialidade'; indice: number }
    /** Zoan: parte de um Point criado pelo jogador (`genialidade`: o Point veio da Genialidade Inusitada nº N). */
    | { tipo: 'point'; ponto: number; genialidade?: number }
    /** Logia: a Técnica Auxiliar do Corpo Elemental (só o efeito Power Up). */
    | { tipo: 'aspecto' };
export type FormaDaTecnica = 'base' | 'aperfeicoada' | 'alternativa';
export type TipoDeAlvo = 'unico' | 'area';
export type ModoDoDano = 'ataque' | 'salvaguarda_metade' | 'salvaguarda_nada';

export interface EscolhaDeEfeito {
    id: string;
    params?: Record<string, number | string | boolean>;
    /** Aplica "Em Duração Prolongada" (por `minutos`, no mínimo 1). */
    prolongada?: boolean;
    minutos?: number;
    /** `condicao`: ids das condições (máx. 3) e qual delas fica prolongada (1 minuto). */
    condicoes?: string[];
    condicaoProlongada?: string;
}

/** Tudo que o jogador escolhe no criador; é guardado em `Tecnica.criador` para o servidor refazer a conta. */
export interface EscolhasDaTecnica {
    tipo: TipoDeTecnica;
    /** 1–7 (0 em Técnicas Auxiliares e Manifestações de Poder). */
    grau: number;
    forma: FormaDaTecnica;
    /** `aperfeicoada`: grau da Técnica de Combate original (o grau escolhido é de 1 a 2 acima, no máximo 5). */
    grauOriginal?: number;
    origem: OrigemDoCriador;
    alvo: TipoDeAlvo;
    modoDoDano: ModoDoDano;
    /** Dados de dano base (1 PP cada). */
    dados: number;
    /** Dado trocado de d6 para d8 em área limitada (6.4 "Intensificando o dano"). */
    intensificado: boolean;
    formaDeAlcance: FormaDeAlcance;
    /** Metros (raio, comprimento do cone ou da linha). */
    alcance: number;
    acao: Acao;
    /** A Técnica usa jogada de ataque (Técnicas). */
    ataque: boolean;
    /** A Técnica exige Salvaguarda de alvos. */
    salvaguarda: boolean;
    atributoSalvaguarda?: AtributoId;
    tipoDano: string;
    efeitos: EscolhaDeEfeito[];
    /** MP: requisito de ativação (`PONTOS_VIRTUAIS.ativacao`). */
    ativacao?: string;
}

export interface UsuarioDaFicha {
    nivel: number;
    /** `akuma.usuario` ('' conta como simples). */
    usuario: string;
    despertado: boolean;
    /** Zoan Comum, Ancestral ou Mítica ('' fora da Zoan): muda o que o nível dá. */
    zoan?: string;
}

export interface DetalheDeCusto {
    id: string;
    nome: string;
    custo: number;
}

export interface ResultadoDoCusto {
    dano: number;
    tipoDeDano: number;
    efeitos: DetalheDeCusto[];
    modificacao: number;
    /** Soma das reduções (positiva). */
    reducao: number;
    bruto: number;
    /** Custo final em PP (mín. 1); em MP, a soma dos pontos virtuais dos efeitos. */
    total: number;
}

export interface OpcoesDoCusto {
    /** Regra opcional "Alterar o tipo de dano" (6.5), escolhida pelo mestre. */
    regraDoTipoDeDano?: boolean;
}

const meioCima = (n: number): number => Math.ceil(n / 2);

const zoanDe = (u: UsuarioDaFicha): '' | 'comum' | 'ancestral' | 'mitica' =>
    u.zoan === 'comum' || u.zoan === 'ancestral' || u.zoan === 'mitica' ? u.zoan : '';

export function grauDe(grau: number): GrauDeTecnica | undefined {
    return GRAUS.find((g) => g.grau === grau);
}

const num = (v: unknown, padrao = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);

function grauParaCusto(e: EscolhasDaTecnica, ef: EscolhaDeEfeito): number {
    const ref = num(ef.params?.grauRef);
    if (e.tipo === 'combate' && e.forma !== 'aperfeicoada') {
        return ref > 0 ? ref : e.grau;
    }
    if (e.tipo === 'combate') {
        return ref > 0 ? ref : e.grau;
    }
    if (e.tipo === 'mp') {
        return PONTOS_VIRTUAIS.grauPadrao;
    }
    return ref;
}

function custoDeCondicoes(ef: EscolhaDeEfeito): number {
    return (ef.condicoes ?? []).reduce((s, id) => s + (CONDICOES_DE_TECNICA.find((c) => c.id === id)?.custo ?? 0), 0);
}

/** Custo (ou, nas reduções, valor negativo) de um efeito já escolhido, conforme o tipo e o grau da Técnica. */
export function custoDoEfeito(e: EscolhasDaTecnica, ef: EscolhaDeEfeito): number {
    const def = efeitoPorId(ef.id);
    if (!def) {
        return 0;
    }
    const aux = e.tipo === 'auxiliar';
    if (def.id === 'condicao') {
        const base = custoDeCondicoes(ef);
        const extra = ef.condicaoProlongada ? Math.ceil((CONDICOES_DE_TECNICA.find((c) => c.id === ef.condicaoProlongada)?.custo ?? 0) / 2) + 1 : 0;

        return base + (extra > 0 ? prolongadaDe(ef, extra) : 0);
    }
    let custo = aux && def.baseAuxiliar !== undefined ? def.baseAuxiliar : def.base;
    const g = grauParaCusto(e, ef);
    if (!(aux && def.baseAuxiliar !== undefined)) {
        if (def.grau === 'grau') {
            custo += g;
        } else if (def.grau === 'meio_cima') {
            custo += meioCima(g);
        } else if (def.grau === 'meio_cima_sem1') {
            custo += g <= 1 ? 0 : meioCima(g);
        } else if (def.grau === 'meio_baixo') {
            custo += Math.floor(g / 2);
        }
    }
    if (def.id === 'concentracao') {
        return -(2 + Math.max(0, num(ef.params?.minutos, 1) - 1));
    }
    if (def.id === 'dependente') {
        return -Math.min(3, Math.max(1, Math.floor(num(ef.params?.pp) / 2)));
    }
    if (def.id === 'colateral') {
        return -(Math.min(4, num(ef.params?.geral)) + Math.min(4, Math.floor(num(ef.params?.dano) / 5)));
    }
    for (const p of def.params ?? []) {
        const v = ef.params?.[p.id];
        if (p.tipo === 'num' && p.custoPorUnidade !== undefined) {
            const n = Math.max(0, num(v, p.min ?? 0));
            custo += Math.floor(n / (p.divisor ?? 1)) * p.custoPorUnidade;
        } else if (p.tipo === 'opcao') {
            custo += p.opcoes?.find((o) => o.id === String(v ?? ''))?.custo ?? 0;
        } else if (p.tipo === 'marca' && v === true) {
            custo += p.custo ?? 0;
        }
    }
    if (ef.prolongada && def.prolongada !== null && def.id !== 'condicao-area') {
        custo += prolongadaDe(ef, def.prolongada);
    }
    return custo;
}

/** "Em Duração Prolongada": o 1º minuto custa `primeiro`; cada minuto a mais, metade (para baixo, mínimo 1 PP). */
function prolongadaDe(ef: EscolhaDeEfeito, primeiro: number): number {
    const minutos = Math.max(1, ef.minutos ?? 1);

    return primeiro + (minutos - 1) * Math.max(1, Math.floor(primeiro / 2));
}

/** Soma o custo de uma Técnica (ou de uma MP, em pontos virtuais). Não valida limites: veja `problemasDaTecnica`. */
export function custoDaTecnica(e: EscolhasDaTecnica, opcoes: OpcoesDoCusto = {}): ResultadoDoCusto {
    const efeitos: DetalheDeCusto[] = [];
    let reducao = 0;
    let soma = 0;
    for (const ef of e.efeitos) {
        const def = efeitoPorId(ef.id);
        if (!def) {
            continue;
        }
        let c = custoDoEfeito(e, ef);
        if (def.id === 'condicao-area' && ef.prolongada) {
            const cond = e.efeitos.find((x) => x.id === 'condicao');
            // "O custo da condição/efeito + 1 PP": usa a(s) condição(ões) da Técnica ou, sem elas, o custo da própria área.
            c += prolongadaDe(ef, (cond ? custoDeCondicoes(cond) : c) + 1);
        }
        efeitos.push({ id: ef.id, nome: def.nome, custo: c });
        if (def.grupo === 'reducao') {
            reducao += -c;
        } else {
            soma += c;
        }
    }
    if (e.tipo === 'mp') {
        const total = Math.max(0, soma);
        return { dano: 0, tipoDeDano: 0, efeitos, modificacao: 0, reducao, bruto: total, total };
    }
    const dano = e.tipo === 'combate' ? Math.max(0, Math.floor(e.dados)) : 0;
    const tipoDeDano = opcoes.regraDoTipoDeDano && e.tipo === 'combate' ? custoDoTipoDeDano(e.tipoDano, e.grau) : 0;
    const modificacao =
        e.tipo !== 'combate' ? 0 : e.forma === 'aperfeicoada' ? Math.floor(e.grau / 2) : e.forma === 'alternativa' ? Math.floor(e.grau / 2) : 0;
    const bruto = dano + tipoDeDano + soma + modificacao;

    return { dano, tipoDeDano, efeitos, modificacao, reducao, bruto, total: Math.max(1, bruto - reducao) };
}

export function custoDoTipoDeDano(tipo: string, grau: number): number {
    const t = tipo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const regra = CUSTO_TIPO_DE_DANO[t];
    if (regra === 'um') {
        return 1;
    }
    if (regra === 'meio_ate2') {
        return Math.min(2, Math.max(1, Math.floor(grau / 2)));
    }
    if (regra === 'verdadeiro') {
        return Math.max(3, Math.floor(grau / 2));
    }

    return 0;
}

/** Limites de PP de uma Técnica: pelo tipo e grau (`desperta` só para Técnicas Auxiliares). */
export function limitesDe(e: Pick<EscolhasDaTecnica, 'tipo' | 'grau'>, desperta = false) {
    if (e.tipo === 'auxiliar' || e.tipo === 'mp') {
        const d = e.tipo === 'auxiliar' && desperta;

        return {
            pp: d ? AUXILIAR.ppDesperta : AUXILIAR.pp,
            dados: 0,
            esfera: d ? AUXILIAR.esferaDesperta : AUXILIAR.esfera,
            cone: d ? AUXILIAR.coneDesperta : AUXILIAR.cone,
            linha: d ? AUXILIAR.linhaDesperta : AUXILIAR.linha,
            reducao: AUXILIAR.reducaoMax,
        };
    }
    const g = grauDe(e.grau);

    return { pp: g?.pp ?? 0, dados: g?.dados ?? 0, esfera: g?.esfera ?? 0, cone: g?.cone ?? 0, linha: g?.linha ?? 0, reducao: 2 * e.grau };
}

/** Grau/auxiliar que o personagem pode escolher no nível, conforme o tipo de usuário (6.11). */
export function grausDisponiveis(u: UsuarioDaFicha): { graus: number[]; auxiliar: boolean; auxiliarDesperta: boolean } {
    const plano = planoDeUsuario(u.usuario === 'avancado' ? 'avancado' : 'simples', u.despertado, zoanDe(u));
    const graus = Object.entries(plano.graus)
        .filter(([, nivel]) => u.nivel >= nivel)
        .map(([g]) => Number(g))
        .sort((a, b) => a - b);
    const auxiliares = plano.auxiliares.filter((n) => u.nivel >= n);

    return { graus, auxiliar: auxiliares.some((n) => n < 16), auxiliarDesperta: auxiliares.some((n) => n >= 16) };
}

/** Quantas Técnicas de cada grau (e Auxiliares) o personagem pode ter pelo nível: uma por grau; Auxiliares por nível de ganho. */
export function espacosPorNivel(u: UsuarioDaFicha): {
    combate: Record<number, number>;
    auxiliares: number;
    auxiliaresDespertas: number;
    manifestacoes: number;
} {
    const plano = planoDeUsuario(u.usuario === 'avancado' ? 'avancado' : 'simples', u.despertado, zoanDe(u));
    const combate: Record<number, number> = {};
    for (const [g, nivel] of Object.entries(plano.graus)) {
        if (u.nivel >= nivel) {
            combate[Number(g)] = 1;
        }
    }
    const auxs = plano.auxiliares.filter((n) => u.nivel >= n);

    return {
        combate,
        auxiliares: auxs.filter((n) => n < 16).length,
        auxiliaresDespertas: auxs.filter((n) => n >= 16).length,
        manifestacoes: plano.manifestacoes,
    };
}

/** Nível mínimo para criar uma Técnica do tipo/grau informados (pela tabela de graus, sem considerar o tipo de usuário). */
export function nivelMinimo(tipo: TipoDeTecnica, grau: number): number {
    if (tipo !== 'combate') {
        return 1;
    }

    return grauDe(grau)?.nivel ?? 99;
}

/** Pontos virtuais disponíveis em uma MP (6.9): base + requisito de ativação + 1 por PP de redução. */
export function pontosVirtuais(e: EscolhasDaTecnica, reducao: number): { disponivel: number; limite: number } {
    const ajuste = PONTOS_VIRTUAIS.ativacao.find((a) => a.id === e.ativacao)?.ajuste ?? 0;

    return { disponivel: PONTOS_VIRTUAIS.base + ajuste + reducao, limite: PONTOS_VIRTUAIS.limiteDosEfeitos };
}

export interface ContextoDeValidacao extends UsuarioDaFicha {
    /** Trilha usada: Técnica de nível/Genialidade e o grau máximo liberado por ela. */
    genialidades?: number;
    opcoes?: OpcoesDoCusto;
    /** Tipo de Akuma da ficha: Logia/Paramecia/Zoan ('' fora da aba Akuma). */
    akuma?: string;
    /** Aba de destino (`akuma` aceita MP e é limitada pelo tipo de usuário; `estilo`, só pela Genialidade). */
    destino: 'akuma' | 'estilo';
    /** Points da ficha (`akuma.points`), para as Técnicas e Traços Realçados criados dentro deles. */
    points?: { ponto: number; modelo: string }[];
    mestre?: boolean;
}

function exigenciasDeEfeito(e: EscolhasDaTecnica, ef: EscolhaDeEfeito, def: EfeitoDeTecnica, problemas: string[]): void {
    const aux = e.tipo === 'auxiliar';
    const nome = def.nome;
    if (def.apenas === 'combate' && e.tipo !== 'combate') {
        problemas.push(`${nome}: só em Técnicas de Combate.`);
    }
    if (def.apenas === 'auxiliar' && !aux) {
        problemas.push(`${nome}: só em Técnicas Auxiliares.`);
    }
    if (e.tipo === 'mp' && !def.mp) {
        problemas.push(`${nome}: não pode ser usado em Manifestações de Poder.`);
    }
    if (def.grauMax !== undefined && (e.tipo !== 'combate' || e.grau > def.grauMax)) {
        problemas.push(`${nome}: só em Técnicas de ${def.grauMax}º grau ou menor.`);
    }
    if (def.grauMin !== undefined && e.tipo === 'combate' && e.grau < def.grauMin) {
        problemas.push(`${nome}: não pode ser Técnica de 1º grau.`);
    }
    if (def.acao && e.tipo !== 'mp' && !def.acao.includes(e.acao)) {
        problemas.push(
            `${nome}: exige ${def.acao.map((a) => (a === 'bonus' ? 'Ação Bônus' : a === 'reacao' ? 'Reação' : 'Ação Poderosa')).join(' ou ')}.`,
        );
    }
    for (const r of def.requer ?? []) {
        const falta =
            (r === 'ataque' && !e.ataque) ||
            (r === 'area' && e.alvo !== 'area') ||
            (r === 'linha' && e.formaDeAlcance !== 'linha') ||
            (r === 'salvaguarda' && !e.salvaguarda) ||
            (r === 'dano' && e.tipo === 'combate' && e.dados <= 0) ||
            (r === 'haki' && false);
        if (falta && e.tipo !== 'mp') {
            problemas.push(`${nome}: ${def.exigencia}`);
            break;
        }
    }
    for (const outro of def.naoCom ?? []) {
        if (e.efeitos.some((x) => x.id === outro)) {
            problemas.push(`${nome}: não combina com "${efeitoPorId(outro)?.nome}".`);
        }
    }
    if (def.id === 'condicao') {
        const n = ef.condicoes?.length ?? 0;
        if (n < 1 || n > MAX_CONDICOES) {
            problemas.push(`${nome}: escolha de 1 a ${MAX_CONDICOES} condições.`);
        }
        if ((ef.condicoes ?? []).some((c) => !CONDICOES_DE_TECNICA.some((x) => x.id === c))) {
            problemas.push(`${nome}: condição desconhecida.`);
        }
        if (ef.condicaoProlongada && !(ef.condicoes ?? []).includes(ef.condicaoProlongada)) {
            problemas.push(`${nome}: a condição prolongada precisa estar entre as escolhidas.`);
        }
    }
    for (const p of def.params ?? []) {
        const v = ef.params?.[p.id];
        if (p.tipo === 'num' && p.min !== undefined && p.max !== undefined && v !== undefined) {
            if (typeof v !== 'number' || v < 0 || v > p.max) {
                problemas.push(`${nome}: ${p.rotulo} fora do limite.`);
            }
        }
        if (p.tipo === 'num' && p.min !== undefined && p.min > 0 && v === undefined && def.id !== 'condicao-area') {
            problemas.push(`${nome}: informe ${p.rotulo}.`);
        }
        if (p.tipo === 'opcao' && !p.opcoes?.some((o) => o.id === String(v ?? ''))) {
            problemas.push(`${nome}: escolha ${p.rotulo}.`);
        }
    }
    if (def.id === 'condicao-area' && aux && num(ef.params?.grauRef) < 1) {
        problemas.push(`${nome}: em Técnica Auxiliar informe o grau de referência da área.`);
    }
    if (def.id === 'power-up' && e.tipo === 'mp' && ef.params?.dados === true) {
        problemas.push(`${nome}: os dados de dano extra não existem em MP (não pode aumentar dano).`);
    }
    if (def.id === 'cr' && e.tipo === 'mp' && e.ativacao !== 'poderosa') {
        problemas.push(`${nome}: em MP só com o requisito Ação Poderosa.`);
    }
    if (ef.prolongada && def.prolongada === null) {
        problemas.push(`${nome}: não tem Duração Prolongada.`);
    }
    if (def.id === 'lacaio') {
        const total = custoDoEfeito(e, ef);
        if (total > 15) {
            problemas.push(`${nome}: o lacaio custa no máximo 15 PP.`);
        }
    }
    if (def.id === 'colateral') {
        const total = Math.min(4, num(ef.params?.geral)) + Math.min(4, Math.floor(num(ef.params?.dano) / 5));
        if (total > 8) {
            problemas.push(`${nome}: a redução máxima é 8 PP.`);
        }
    }
    if (def.id === 'concentracao' && num(ef.params?.minutos, 1) < 1) {
        problemas.push(`${nome}: a Técnica deve durar pelo menos 1 minuto.`);
    }
}

/** Tudo que impede a Técnica: grau acima do nível, PP/dano/alcance acima do grau, redução demais, exigências dos efeitos. */
function problemasDoPoint(e: EscolhasDaTecnica, ctx: ContextoDeValidacao, zoan: boolean): string[] {
    const o = e.origem as { tipo: 'point'; ponto: number; genialidade?: number };
    const p: string[] = [];
    const linha = CRIACAO_DE_POINTS.find((x) => x.ponto === o.ponto);
    if (!zoan || !linha) {
        return ['Points são da Akuma no Mi Zoan.'];
    }
    if (!(ctx.points ?? []).some((x) => x.ponto === o.ponto && x.modelo === 'custom')) {
        p.push(`Crie o ${o.ponto}º Point (modelo próprio) na seção Points antes.`);
    }
    if (e.tipo === 'combate' && e.grau !== o.ponto) {
        p.push(`A Técnica do ${o.ponto}º Point é de ${o.ponto}º grau.`);
    }
    if (e.tipo === 'combate' && e.forma !== 'base') {
        p.push('Formas Aperfeiçoada/Alternativa não valem dentro de um Point.');
    }
    if (e.tipo !== 'mp' && e.tipo !== 'combate' && e.tipo !== 'auxiliar') {
        p.push('Tipo inválido.');
    }

    return p;
}

export function problemasDaTecnica(e: EscolhasDaTecnica, ctx: ContextoDeValidacao): string[] {
    const problemas: string[] = [];
    const custo = custoDaTecnica(e, ctx.opcoes);
    const ids = e.efeitos.map((x) => x.id);
    if (new Set(ids).size !== ids.length) {
        problemas.push('Um efeito só pode ser escolhido uma vez.');
    }
    if (e.efeitos.some((x) => !efeitoPorId(x.id))) {
        problemas.push('Efeito desconhecido.');
    }
    const zoan = ctx.destino === 'akuma' && ctx.akuma === 'zoan';
    if (zoan && !ctx.zoan) {
        problemas.push('Escolha se a Zoan é Comum, Ancestral ou Mítica.');
    }
    if (zoan && ctx.zoan !== 'mitica' && e.origem.tipo !== 'point') {
        problemas.push('Usuários de Zoan Comum e Ancestral recebem Técnicas apenas pelos Points.');
    }
    if (e.origem.tipo === 'point') {
        problemas.push(...problemasDoPoint(e, ctx, zoan));
    }
    if (e.origem.tipo === 'aspecto') {
        if (ctx.destino !== 'akuma' || ctx.akuma !== 'logia' || e.tipo !== 'auxiliar') {
            problemas.push('O Corpo Elemental dá uma Técnica Auxiliar só aos usuários de Logia.');
        } else if (e.efeitos.length === 0 || e.efeitos.some((x) => x.id !== 'power-up')) {
            problemas.push('A Técnica do Corpo Elemental é composta exclusivamente pelo efeito "Power Up".');
        }
    }
    if (ctx.destino === 'akuma' && (ctx.akuma ?? '') === '') {
        problemas.push('Escolha o tipo da Akuma no Mi.');
    }
    // --- grau × nível
    if (e.tipo === 'combate') {
        problemas.push(...problemasDoGrau(e, ctx));
    } else if (e.tipo === 'auxiliar') {
        problemas.push(...problemasDaAuxiliar(e, ctx));
    } else if (e.tipo === 'mp') {
        if (ctx.destino !== 'akuma') {
            problemas.push('Manifestações de Poder são da Akuma no Mi.');
        }
        if (e.origem.tipo !== 'nivel' && e.origem.tipo !== 'point') {
            problemas.push('Manifestações de Poder não vêm do treinamento Genialidade Inusitada.');
        }
        const esp = espacosPorNivel(ctx);
        if (e.origem.tipo === 'nivel' && esp.manifestacoes < 1 && ctx.akuma !== undefined) {
            problemas.push('Sem Manifestação de Poder disponível (Aspecto Inato alternativo: a MP adicional conta no limite da ficha).');
        }
    }
    for (const ef of e.efeitos) {
        const def = efeitoPorId(ef.id);
        if (def) {
            exigenciasDeEfeito(e, ef, def, problemas);
        }
    }
    if (e.tipo === 'mp') {
        const pv = pontosVirtuais(e, custo.reducao);
        const traco = e.origem.tipo === 'point';
        if (!traco && !PONTOS_VIRTUAIS.ativacao.some((a) => a.id === e.ativacao)) {
            problemas.push('Escolha o requisito de ativação da Manifestação de Poder.');
        }
        if (traco) {
            const maxPoint = CRIACAO_DE_POINTS.find((p) => p.ponto === (e.origem as { ponto: number }).ponto)?.tracos ?? 0;
            if (custo.total > maxPoint) {
                problemas.push(`O Traço Realçado do ${(e.origem as { ponto: number }).ponto}º Point custa no máximo ${maxPoint} Pontos Virtuais.`);
            }
            if (maxPoint === 0) {
                problemas.push('O 1º Point não tem Traço Realçado.');
            }
        }
        if (e.efeitos.length === 0) {
            problemas.push('Escolha ao menos um efeito.');
        }
        if (custo.total > pv.limite) {
            problemas.push(`A soma dos efeitos (${custo.total}) passa de ${pv.limite} Pontos Virtuais.`);
        }
        if (!traco && custo.total > pv.disponivel) {
            problemas.push(`A soma dos efeitos (${custo.total}) passa dos ${pv.disponivel} Pontos Virtuais disponíveis.`);
        }

        return problemas;
    }
    const lim = limitesDe(e, ctx.akuma !== undefined && ctx.despertado && e.tipo === 'auxiliar' && ctx.nivel >= 16);
    if (e.dados < 0 || e.dados > lim.dados) {
        problemas.push(
            e.tipo === 'auxiliar' ? 'Técnicas Auxiliares não causam dano diretamente.' : `No máximo ${lim.dados} dados de dano (o dobro do grau).`,
        );
    }
    if (e.efeitos.some((x) => EFEITOS_SEM_DANO.includes(x.id)) && e.dados > 0) {
        problemas.push('Esta Técnica não pode causar dano direto.');
    }
    if (custo.reducao > lim.reducao) {
        problemas.push(`A redução de custo passa do máximo de ${lim.reducao} PP.`);
    }
    if (custo.total > lim.pp) {
        problemas.push(`O custo (${custo.total} PP) passa do máximo de ${lim.pp} PP.`);
    }
    problemas.push(...problemasDoAlcance(e, lim));
    if (!e.ataque && !e.salvaguarda && e.tipo === 'combate' && e.dados > 0) {
        problemas.push('Dano exige jogada de ataque (Técnicas) ou Salvaguarda.');
    }
    if (e.acao !== 'poderosa' && e.tipo === 'combate' && !e.efeitos.some((x) => efeitoPorId(x.id)?.acao?.includes(e.acao))) {
        problemas.push('Técnicas de Combate exigem Ação Poderosa (ou o efeito Técnica Rápida).');
    }
    if (e.tipo === 'auxiliar' && e.acao === 'poderosa' && !e.efeitos.some((x) => x.id === 'demorada')) {
        problemas.push('Técnicas Auxiliares exigem Ação Bônus ou Reação (ou o efeito Técnica Demorada).');
    }

    return problemas;
}

function problemasDoGrau(e: EscolhasDaTecnica, ctx: ContextoDeValidacao): string[] {
    const p: string[] = [];
    const g = grauDe(e.grau);
    if (!g) {
        return ['Escolha um grau de 1 a 7.'];
    }
    if (e.forma === 'aperfeicoada') {
        const o = e.grauOriginal ?? 0;
        if (!grauDe(o) || e.grau < o + 1 || e.grau > o + MODIFICACOES.aperfeicoadaGrausAcima || e.grau > MODIFICACOES.aperfeicoadaGrauMax) {
            p.push('A Forma Aperfeiçoada tem de 1 a 2 graus acima da original (máximo 5º grau).');
        }
    }
    if (ctx.mestre) {
        return p;
    }
    if (e.origem.tipo === 'genialidade') {
        const indice = e.origem.indice;
        if (!Number.isInteger(indice) || indice < 1 || indice > (ctx.genialidades ?? 0)) {
            p.push('Esta Genialidade Inusitada não foi aprendida.');
        } else if (e.grau !== indice) {
            // A N-ésima Genialidade Inusitada cria uma Técnica de Combate do N-ésimo grau (1º, depois 2º ... até o 7º).
            p.push(`A Genialidade Inusitada nº ${indice} cria uma Técnica de ${indice}º grau.`);
        }
        if (ctx.destino === 'akuma' && ctx.usuario !== 'avancado') {
            p.push('Usuário simples não aprende novas Técnicas de Akuma no Mi com a Genialidade Inusitada.');
        }
    } else if (e.origem.tipo !== 'point') {
        if (ctx.destino !== 'akuma') {
            p.push('Técnicas de estilo só são criadas com a Genialidade Inusitada.');
        }
        const disp = grausDisponiveis(ctx);
        if (!disp.graus.includes(e.grau) && e.forma === 'base') {
            p.push(
                `Ainda não dá para criar uma Técnica de ${e.grau}º grau: nível ${g.nivel}${g.exige ? ` e ${g.exige === 'avancado' ? 'usuário avançado' : 'estágio desperto'}` : ''}.`,
            );
        }
    }
    if (g.exige === 'desperto' && !ctx.despertado && ctx.destino === 'akuma') {
        p.push('Técnicas de 6º e 7º grau exigem o estágio Desperto.');
    }
    if (ctx.nivel < g.nivel && e.forma !== 'aperfeicoada') {
        p.push(`Técnica de ${e.grau}º grau exige o nível ${g.nivel}.`);
    }

    return p;
}

function problemasDaAuxiliar(e: EscolhasDaTecnica, ctx: ContextoDeValidacao): string[] {
    const p: string[] = [];
    if (e.origem.tipo === 'point' || e.origem.tipo === 'aspecto') {
        return p;
    }
    if (ctx.mestre) {
        return p;
    }
    if (e.origem.tipo === 'genialidade') {
        p.push('A Genialidade Inusitada cria apenas Técnicas de Combate.');

        return p;
    }
    if (ctx.destino !== 'akuma') {
        p.push('Técnicas de estilo só são criadas com a Genialidade Inusitada.');
    }
    const disp = grausDisponiveis(ctx);
    if (!disp.auxiliar && !disp.auxiliarDesperta) {
        p.push('Você ainda não recebeu uma Técnica Auxiliar (níveis 1, 6 e 12; desperta: 16 e 20).');
    }

    return p;
}

function problemasDoAlcance(e: EscolhasDaTecnica, lim: ReturnType<typeof limitesDe>): string[] {
    const p: string[] = [];
    const extra = (id: string, param: string): number => num(e.efeitos.find((x) => x.id === id)?.params?.[param]);
    const maxEsfera = lim.esfera + (e.formaDeAlcance === 'esfera' ? extra('area', 'metros') : 0);
    const maxCone = lim.cone + (e.formaDeAlcance === 'cone' ? extra('area', 'metros') : 0);
    const maxLinha = lim.linha + (e.formaDeAlcance === 'linha' ? extra('area', 'metros') + extra('alcance', 'metros') : 0);
    if (e.formaDeAlcance === 'esfera' && e.alcance > maxEsfera) {
        p.push(`Esfera/Cilindro/Emanação: no máximo ${maxEsfera} m de raio.`);
    }
    if (e.formaDeAlcance === 'cone' && e.alcance > maxCone) {
        p.push(`Cone: no máximo ${maxCone} m.`);
    }
    if (e.formaDeAlcance === 'linha' && e.alcance > maxLinha) {
        p.push(`Linha: no máximo ${maxLinha} m.`);
    }

    return p;
}

/** Dado de dano da Técnica (6.4): alvo único d10 (ataque ou Salvaguarda sem dano), d8 (Salvaguarda para metade); área d6 ou d8. */
export function dadoDoDano(e: Pick<EscolhasDaTecnica, 'alvo' | 'modoDoDano' | 'intensificado' | 'efeitos'>): number {
    if (e.alvo === 'unico') {
        return e.modoDoDano === 'salvaguarda_metade' ? 8 : 10;
    }

    return e.intensificado || e.efeitos.some((x) => x.id === 'indomavel') ? 8 : 6;
}

const ROTULO_ACAO: Record<Acao, string> = { poderosa: 'Ação Poderosa', bonus: 'Ação Bônus', reacao: 'Reação' };

export function rotuloDoAlcance(forma: FormaDeAlcance, metros: number): string {
    if (forma === 'pessoal') {
        return 'Pessoal';
    }
    if (forma === 'toque') {
        return 'Toque';
    }
    const m = String(metros).replace('.', ',');

    return forma === 'esfera' ? `${m} m de raio` : forma === 'cone' ? `Cone de ${m} m` : `${m} m em Linha`;
}

export interface TecnicaGerada {
    nome: string;
    origem: string;
    custo: number;
    alcance: string;
    efeito: string;
    descricao: string;
    rolagem: string;
    tipoDano?: string;
    acao: 'padrao' | 'poderosa' | 'bonus' | 'livre' | 'reacao';
    builder: 'criador';
    criador: EscolhasDaTecnica;
}

export function rotuloDoTipo(tipo: TipoDeTecnica, grau: number): string {
    return tipo === 'combate' ? `Técnica de ${grau}º grau` : tipo === 'auxiliar' ? 'Técnica Auxiliar' : 'Manifestação de Poder';
}

/** Monta a `Tecnica` da ficha a partir das escolhas (chame depois de `problemasDaTecnica` vazio). */
export function tecnicaDoCriador(nome: string, e: EscolhasDaTecnica, opcoes: OpcoesDoCusto = {}): TecnicaGerada {
    const custo = custoDaTecnica(e, opcoes);
    const linhas = e.efeitos.map((ef) => {
        const def = efeitoPorId(ef.id);
        const cond = (ef.condicoes ?? []).map((c) => CONDICOES_DE_TECNICA.find((x) => x.id === c)?.nome ?? c).join(', ');

        return `${def?.nome ?? ef.id}${cond ? `: ${cond}` : ''}${ef.prolongada || ef.condicaoProlongada ? ' (duração prolongada)' : ''}`;
    });
    const origemTipo = e.origem.tipo === 'genialidade' ? ` · Genialidade Inusitada ${e.origem.indice}` : '';
    const dado = dadoDoDano(e);
    const tipoDano = e.tipoDano.trim();

    const nomesAtributos: Record<string, string> = {
        for: 'Força',
        des: 'Destreza',
        con: 'Constituição',
        sab: 'Sabedoria',
        pre: 'Presença',
        von: 'Vontade',
    };
    const attrNome = nomesAtributos[e.atributoSalvaguarda ?? 'des'] ?? 'Destreza';
    const modoSalv = e.modoDoDano === 'salvaguarda_nada' ? 'sem dano se passar' : 'Salvaguarda para metade';
    const descSalv = `Salvaguarda de ${attrNome} (${e.modoDoDano === 'salvaguarda_nada' ? 'sem dano se passar' : 'metade do dano se passar'})`;

    const descDano =
        e.dados > 0
            ? `Dano: ${e.dados}d${dado}${tipoDano ? ` de ${tipoDano}` : ''} (${e.ataque ? 'jogada de ataque (Técnicas)' : e.salvaguarda ? descSalv : modoSalv}).`
            : e.salvaguarda
              ? `Exige ${descSalv}.`
              : '';

    return {
        nome: nome.trim(),
        origem: `${rotuloDoTipo(e.tipo, e.grau)}${origemTipo}`,
        custo: e.tipo === 'mp' ? 0 : custo.total,
        alcance: rotuloDoAlcance(e.formaDeAlcance, e.alcance),
        efeito: e.tipo === 'mp' ? `MP: ${ROTULO_ACAO[e.acao]}` : (linhas[0] ?? (e.dados > 0 ? 'Dano' : '')),
        descricao: [descDano, ...linhas.map((l) => `• ${l}`)].filter(Boolean).join('\n'),
        rolagem: e.dados > 0 ? `${e.dados}d${dado}` : '',
        tipoDano: e.dados > 0 && tipoDano ? tipoDano : undefined,
        acao: e.acao,
        teste: e.salvaguarda
            ? {
                  tipo: 'salvaguarda',
                  atributo: e.atributoSalvaguarda ?? 'des',
                  aoPassar: e.modoDoDano === 'salvaguarda_nada' ? 'nada' : 'metade',
              }
            : e.ataque
              ? { tipo: 'ataque' }
              : undefined,
        builder: 'criador',
        criador: e,
    };
}

/** Escolhas iniciais do criador (Técnica de Combate de alvo único, jogada de ataque, Ação Poderosa). */
export function escolhasPadrao(tipo: TipoDeTecnica = 'combate', grau = 1, origem: OrigemDoCriador = { tipo: 'nivel' }): EscolhasDaTecnica {
    return {
        tipo,
        grau: tipo === 'combate' ? grau : 0,
        forma: 'base',
        origem,
        alvo: 'unico',
        modoDoDano: 'ataque',
        dados: 0,
        intensificado: false,
        formaDeAlcance: tipo === 'combate' ? 'linha' : 'pessoal',
        alcance: 0,
        acao: tipo === 'combate' ? 'poderosa' : 'bonus',
        ataque: tipo === 'combate',
        salvaguarda: false,
        atributoSalvaguarda: 'des',
        tipoDano: '',
        efeitos: [],
        ativacao: tipo === 'mp' ? 'inacao' : undefined,
    };
}

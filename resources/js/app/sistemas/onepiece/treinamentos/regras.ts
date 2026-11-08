/**
 * Regras dos Treinamentos (cap. 5.7), puras: PT ganhos e gastos, pedidos, conclusão e as características/técnicas geradas.
 * Espelhadas em `app/Sistemas/OnePiece/Treinamentos.php` (conferidas por `tests/paridade/treinamentos.json`).
 *
 * O saldo é CALCULADO: 3 PT no 2º nível e a cada nível par até o 10º (15), mais os do Traço Cultural (mod. de Sabedoria),
 * mais os que o mestre dá, menos o custo dos treinamentos aprendidos. O jogador PEDE o treinamento (fica em andamento
 * com os dias) e o mestre conclui: só então os PT são gastos e os efeitos entram na ficha.
 */
import type { TracoDados } from '../construtor/dados/tipos.ts';
import { caracteristicaDe } from '../construtor/regras.ts';
import type { Caracteristica, FichaOnePiece, Tecnica } from '../regras.ts';
import { CUSTO_GENIALIDADE, TREINAMENTOS, treinamentoPorId, type Treinamento } from './dados.ts';

export interface TreinamentoAprendido {
    id: string;
    /** Nível do personagem ao aprender (Iniciada em Haki depende dele). */
    nivel: number;
    /** Escolha pedida pelo treinamento (opção do Corredor, atributo do Autoaperfeiçoamento...). */
    opcao?: string;
}

export interface PedidoDeTreinamento {
    id: string;
    opcao?: string;
    /** Dias de treino já cumpridos (o mestre marca). */
    dias: number;
}

export interface TreinamentoFicha {
    /** PT que o mestre deu (ou tirou, se negativo). */
    extras: number;
    /** Código de Honra escolhido (opcional, só 1). */
    codigo: string;
    aprendidos: TreinamentoAprendido[];
    pedidos: PedidoDeTreinamento[];
}

export const treinamentoPadrao = (): TreinamentoFicha => ({ extras: 0, codigo: '', aprendidos: [], pedidos: [] });

/** PT pelo nível: 3 no 2º e a cada nível par até o 10º (15 no total). */
export const ptDoNivel = (nivel: number): number => 3 * Math.floor(Math.min(Math.max(1, Math.floor(Number(nivel)) || 1), 10) / 2);

const modificador = (valor: number): number => Math.floor((valor - 10) / 2);

/** Traço Cultural (espécie): PT igual ao mod. de Sabedoria, quando positivo. */
export function ptCulturais(f: Pick<FichaOnePiece, 'caracteristicas' | 'atributos'> & { nivel?: number }): number {
    const tem = (f.caracteristicas ?? []).some((c) => c.nome === 'Traços Culturais');
    const cultural = tem ? Math.max(0, modificador(f.atributos?.sab ?? 10)) : 0;
    // Singularidade Disciplinado: 1 PT a cada nível par de personagem.
    const disciplinado = (f.caracteristicas ?? []).some((c) => c.nome === 'Disciplinado' && c.builder === 'individualidade')
        ? Math.floor(Math.min(20, Math.max(1, Math.floor(Number(f.nivel)) || 1)) / 2)
        : 0;

    // Esforço Heroico (Herói): 5 PT no 1º nível e 2 a cada nível par (o texto pede que sejam usados na Genialidade Inusitada)
    const heroico = (f.caracteristicas ?? []).some((c) => c.nome.includes('Esforço Heroico'))
        ? 5 + 2 * Math.floor(Math.min(20, Math.max(1, Math.floor(Number(f.nivel)) || 1)) / 2)
        : 0;

    return cultural + disciplinado + heroico;
}

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Custo em PT de aprender o treinamento agora (Genialidade Inusitada sobe de grau a cada vez). */
export function custoDe(t: Treinamento, aprendidos: { id: string }[]): number {
    if (t.id === 'genialidade-inusitada')
        return CUSTO_GENIALIDADE[Math.min(aprendidos.filter((a) => a.id === t.id).length, CUSTO_GENIALIDADE.length - 1)];

    return t.pt;
}

/** Gasto dos treinamentos aprendidos (em ordem: a Genialidade encarece a cada grau). */
export function gastoDosAprendidos(aprendidos: { id: string }[]): number {
    let gasto = 0;
    const vistos: { id: string }[] = [];
    for (const a of aprendidos) {
        const t = treinamentoPorId(a.id);
        if (t) gasto += custoDe(t, vistos);
        vistos.push(a);
    }

    return gasto;
}

export interface ResumoDosPT {
    ganhos: number;
    extras: number;
    gasto: number;
    disponiveis: number;
    /** O que os pedidos em andamento vão custar. */
    comprometidos: number;
    /** Disponíveis depois de reservar os pedidos. */
    livres: number;
}

export function resumoDosPT(f: Pick<FichaOnePiece, 'nivel' | 'caracteristicas' | 'atributos'> & { treinamento: TreinamentoFicha }): ResumoDosPT {
    const t = { ...treinamentoPadrao(), ...(f.treinamento ?? {}) };
    const ganhos = ptDoNivel(f.nivel) + ptCulturais(f) + (t.extras || 0);
    const gasto = gastoDosAprendidos(t.aprendidos);
    let comprometidos = 0;
    const simulados = [...t.aprendidos];
    for (const p of t.pedidos) {
        const tr = treinamentoPorId(p.id);
        if (tr) comprometidos += custoDe(tr, simulados);
        simulados.push({ id: p.id, nivel: 0 });
    }

    return { ganhos, extras: t.extras || 0, gasto, disponiveis: ganhos - gasto, comprometidos, livres: ganhos - gasto - comprometidos };
}

type FichaParaPedido = Pick<FichaOnePiece, 'nivel' | 'caracteristicas' | 'atributos'> & { especie?: string; treinamento: TreinamentoFicha };

/** Motivos que impedem de PEDIR o treinamento agora (lista vazia = pode). O mestre confere ferramentas, tutor e dias. */
export function problemasDoPedido(f: FichaParaPedido, id: string, opcao?: string): string[] {
    const t = treinamentoPorId(id);
    if (!t) return ['Treinamento desconhecido.'];
    const tr = { ...treinamentoPadrao(), ...(f.treinamento ?? {}) };
    const p: string[] = [];
    if (!t.repetivel && tr.aprendidos.some((a) => a.id === id)) p.push('Este treinamento só pode ser aprendido uma vez.');
    if (tr.pedidos.some((x) => x.id === id) && !t.repetivel) p.push('Este treinamento já está em andamento.');
    if (t.repetivel && tr.pedidos.some((x) => x.id === id)) p.push('Conclua o treinamento em andamento antes de repetir.');
    if (t.repetivel && t.id === 'genialidade-inusitada' && tr.aprendidos.filter((a) => a.id === id).length >= CUSTO_GENIALIDADE.length)
        p.push('Todos os graus da Genialidade Inusitada já foram aprendidos.');
    if (t.requer && !tr.aprendidos.some((a) => a.id === t.requer)) p.push(`Exige o treinamento ${treinamentoPorId(t.requer)?.nome ?? t.requer}.`);
    if (!t.atributos.some((a) => (f.atributos?.[a] ?? 0) >= t.minimo))
        p.push(`Exige ${t.atributos.map((a) => a.toUpperCase()).join(' ou ')} ${t.minimo}.`);
    if (t.especie && !norm(f.especie ?? '').includes(norm(t.especie))) p.push(`Só para ${t.especie} (ou mestiços).`);
    if (t.escolha && !t.escolha.opcoes.some((o) => o.id === opcao)) p.push(`Escolha: ${t.escolha.rotulo}.`);
    const r = resumoDosPT(f);
    const custo = custoDe(t, tr.aprendidos);
    if (r.livres < custo) p.push(`Faltam PT: custa ${custo} e você tem ${Math.max(0, r.livres)} livres.`);

    return p;
}

/** Os traços de um treinamento, com a escolha aplicada (Corredor, Autoaperfeiçoamento). */
export function tracosDoTreinamento(t: Treinamento, opcao?: string): TracoDados[] {
    if (t.id === 'corredor')
        return [
            opcao === 'longa'
                ? {
                      id: 'corredor',
                      nome: 'Corredor: Corrida de Longa Distância',
                      descricao: 'Seu deslocamento normal se torna 15 metros.',
                      efeitos: [{ alvo: 'movimento.normal', modo: 'min', valor: 150 }],
                  }
                : {
                      id: 'corredor',
                      nome: 'Corredor: Corrida de Obstáculos',
                      descricao: 'Você não recebe penalidade de deslocamento por terreno difícil.',
                      etiquetas: ['Ignora terreno difícil'],
                  },
        ];
    if (t.id === 'autoaperfeicoamento' && opcao) return t.tracos.map((x) => ({ ...x, nome: `${x.nome} (${opcao.toUpperCase()})` }));
    if (t.id === 'resiliencia' && opcao) return t.tracos.map((x) => ({ ...x, nome: `${x.nome} (Salv. ${opcao.toUpperCase()})` }));

    return t.tracos;
}

/** As características dos treinamentos aprendidos (`builder: 'treinamento'`). */
export function caracteristicasDosTreinamentos(aprendidos: TreinamentoAprendido[], nivel: number): Caracteristica[] {
    return aprendidos.flatMap((a) => {
        const t = treinamentoPorId(a.id);
        if (!t) return [];

        return tracosDoTreinamento(t, a.opcao).map((traco) =>
            caracteristicaDe({ traco, origem: `Treinamento: ${t.nome}`, builder: 'treinamento' }, nivel),
        );
    });
}

/** As técnicas que os treinamentos dão. */
export function tecnicasDosTreinamentos(aprendidos: { id: string }[]): Tecnica[] {
    return aprendidos.flatMap((a) => (treinamentoPorId(a.id)?.tecnicas ?? []).map((tec): Tecnica => ({ ...tec, builder: 'treinamento' })));
}

/** A lista de características com as dos treinamentos refeitas (mantém usos gastos e interruptores). */
export function refazerCaracteristicasDosTreinamentos(atuais: Caracteristica[], aprendidos: TreinamentoAprendido[], nivel: number): Caracteristica[] {
    const antigas = new Map(atuais.filter((c) => c.builder === 'treinamento').map((c) => [`${c.origem}|${c.nome}`, c]));
    const novas = caracteristicasDosTreinamentos(aprendidos, nivel).map((c) => {
        const antiga = antigas.get(`${c.origem}|${c.nome}`);
        if (antiga?.usos && c.usos) c.usos = { ...c.usos, atual: Math.min(c.usos.max, antiga.usos.atual) };
        if (antiga?.ativa !== undefined && c.tipo === 'ativa' && c.efeitos) c.ativa = antiga.ativa;

        return c;
    });

    return [...atuais.filter((c) => c.builder !== 'treinamento'), ...novas];
}

/** Iniciada em Haki (Kuja): PA igual ao nível ao aprender e +2 por nível par depois, no máximo 10. */
export function paDeHakiDosTreinamentos(f: { nivel: number; treinamento?: TreinamentoFicha }): number {
    const a = f.treinamento?.aprendidos?.find((x) => x.id === 'iniciada-em-haki');
    if (!a) return 0;
    const nivel = Math.max(1, Math.floor(Number(f.nivel)));
    let pa = a.nivel;
    for (let n = a.nivel + 1; n <= nivel; n++) if (n % 2 === 0) pa += 2;

    return Math.min(10, pa);
}

/**
 * O mestre conclui o pedido `indice`: os campos da ficha a salvar (treinamento, características, técnicas e os efeitos
 * diretos: +1 de atributo do Autoaperfeiçoamento até 20, salvaguarda da Resiliência, d12 dos Gigantes).
 */
export function camposDaConclusao(f: FichaOnePiece, indice: number): Record<string, unknown> {
    const tr = { ...treinamentoPadrao(), ...(f.treinamento ?? {}) };
    const pedido = tr.pedidos[indice];
    const t = treinamentoPorId(pedido?.id);
    if (!pedido || !t) return {};
    const aprendidos = [...tr.aprendidos, { id: pedido.id, nivel: Number(f.nivel), ...(pedido.opcao ? { opcao: pedido.opcao } : {}) }];
    const campos: Record<string, unknown> = {
        'treinamento.aprendidos': aprendidos,
        'treinamento.pedidos': tr.pedidos.filter((_, i) => i !== indice),
        caracteristicas: refazerCaracteristicasDosTreinamentos(f.caracteristicas ?? [], aprendidos, Number(f.nivel)),
        'tecnicas.lista': [...(f.tecnicas?.lista ?? []).filter((x) => x.builder !== 'treinamento'), ...tecnicasDosTreinamentos(aprendidos)],
    };
    if (t.id === 'autoaperfeicoamento' && pedido.opcao) {
        const atual = (f.atributos as Record<string, number>)[pedido.opcao] ?? 10;
        if (atual < 20) campos[`atributos.${pedido.opcao}`] = atual + 1;
    }
    if (t.id === 'resiliencia' && pedido.opcao && !(f.salvaguardas ?? []).includes(pedido.opcao as never))
        campos.salvaguardas = [...(f.salvaguardas ?? []), pedido.opcao];
    if (t.id === 'resistencia-dos-gigantes') campos['dadosVida.tipo'] = 'd12';

    return campos;
}

/** Remove um treinamento aprendido (mestre): tira as características e devolve os PT (o saldo é calculado). */
export function camposDaRemocao(f: FichaOnePiece, indice: number): Record<string, unknown> {
    const tr = { ...treinamentoPadrao(), ...(f.treinamento ?? {}) };
    const aprendidos = tr.aprendidos.filter((_, i) => i !== indice);

    return {
        'treinamento.aprendidos': aprendidos,
        caracteristicas: refazerCaracteristicasDosTreinamentos(f.caracteristicas ?? [], aprendidos, Number(f.nivel)),
        'tecnicas.lista': [...(f.tecnicas?.lista ?? []).filter((x) => x.builder !== 'treinamento'), ...tecnicasDosTreinamentos(aprendidos)],
    };
}

export { TREINAMENTOS };

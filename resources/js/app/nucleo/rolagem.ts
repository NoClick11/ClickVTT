/**
 * Tipos e helpers da rolagem — independentes de sistema. O servidor (`App\Nucleo\Rolagem\Rolador`) é quem
 * interpreta a expressão e sorteia; aqui só se descreve e exibe o resultado.
 */
export interface TermoDados {
    tipo: 'dados';
    /** Trecho da expressão deste termo, ex.: `4d6kh3`. */
    expressao: string;
    faces: number;
    resultados: number[];
    /** Índices de `resultados` que não entraram na soma (manter maior/menor, descartar). */
    descartados: number[];
    subtotal: number;
    sinal: 1 | -1;
}
export interface TermoNumero {
    tipo: 'numero';
    valor: number;
    sinal: 1 | -1;
}
export interface TermoVariavel {
    tipo: 'variavel';
    nome: string;
    valor: number;
    sinal: 1 | -1;
}
export type TermoRolagem = TermoDados | TermoNumero | TermoVariavel;

/**
 * Botão que o card da rolagem oferece em seguida (ex.: rolar o dano de uma arma depois do ataque). O sistema decide
 * quais; ao clicar, `expressao` é rolada como qualquer outra, pelo mesmo personagem.
 */
export interface AcaoDaRolagem {
    id: string;
    rotulo: string;
    /** A rolagem já resolvida, curta, para mostrar no botão (ex.: `1d8+4`). */
    resumo: string;
    expressao: string;
    /** Título da nova rolagem no chat (ex.: `Espada Longa`; o tipo da rolagem se vê pelos dados e pela fórmula). */
    rotuloRolagem: string;
    destaque?: 'critico';
    /** Rolagem de dano: o tipo (fogo, cortante...) vai junto para o dano aplicado respeitar resistências e imunidades. */
    dano?: { tipo: string | null };
}

/** Resultado de um ataque com alvo (ver `Pipeline` no servidor). */
export interface Resolucao {
    estado: 'aguardando' | 'resolvido';
    evento_id: number;
    alvo?: string;
    defesa?: number;
    base?: number;
    acerto?: boolean;
    critico?: boolean;
    falha?: boolean;
    mods?: { fonte: string; valor: number }[];
}

/** Marcas que o SISTEMA põe numa rolagem já feita (ex.: ataque crítico). O núcleo só as repassa e exibe. */
export interface MarcasDoSistema {
    /** Item/arma do ataque, quando é um ataque com arma. */
    arma?: number;
    /** d20 puro igual ou maior que isto é crítico (20 por padrão). */
    margem?: number;
    destaque?: 'critico' | 'falha';
    /** Andamento do ataque contra um alvo: janela de reação aberta (`aguardando`) ou resolvido (acertou ou errou). */
    resolucao?: Resolucao;
    /** Esta rolagem é um dano que pode ser aplicado a um alvo (o tipo pode ser nulo). */
    dano?: { tipo: string | null };
    /** Botões do card (ex.: Dano, Dano crítico). */
    acoes?: AcaoDaRolagem[];
    /** Expertise da arma no acerto crítico (efeitos para o jogador e o Narrador aplicarem). */
    expertise?: { id: string; texto: string }[];
}

export interface DadosRolagem {
    expressao: string;
    /** Nome da rolagem dado pelo sistema/ficha (ex.: "Percepção"); null em rolagens livres. */
    rotulo: string | null;
    termos: TermoRolagem[];
    total: number;
    /** Marcas do sistema (ex.: ataque crítico), quando houver. */
    sistema?: MarcasDoSistema;
}

export interface DadoRolado {
    faces: number;
    valor: number;
    descartado: boolean;
}

/** Todos os dados individuais da rolagem, na ordem em que aparecem (para o chat e a animação). */
export function dadosRolados(d: DadosRolagem): DadoRolado[] {
    return d.termos.flatMap((t) =>
        t.tipo === 'dados' ? t.resultados.map((valor, i) => ({ faces: t.faces, valor, descartado: t.descartados.includes(i) })) : [],
    );
}

/** Crítico/falha natural: só vale para um d20 que entrou na soma. `margem` = d20 puro a partir do qual é crítico (padrão 20). */
export function destaqueDado(r: DadoRolado, margem = 20): 'critico' | 'falha' | null {
    if (r.faces !== 20 || r.descartado) return null;
    return r.valor >= margem ? 'critico' : r.valor === 1 ? 'falha' : null;
}

/**
 * A fórmula da rolagem em poucas palavras, para o card do chat: os dados com seus modificadores e todo o bônus fixo
 * somado numa conta só (`1d20 + 7`, `2d8 + 3`, `2d20kh1 − 1`). Quem quiser os detalhes olha os dados ao lado.
 */
export function resumoFormula(d: DadosRolagem): string {
    let fixo = 0;
    const dados: { sinal: 1 | -1; texto: string }[] = [];
    for (const t of d.termos) {
        if (t.tipo === 'dados') dados.push({ sinal: t.sinal, texto: t.expressao });
        else fixo += t.sinal * t.valor;
    }

    let texto = dados.map((p, i) => (i === 0 ? (p.sinal < 0 ? '−' : '') + p.texto : ` ${p.sinal < 0 ? '−' : '+'} ${p.texto}`)).join('');
    if (fixo !== 0 || texto === '') texto += texto === '' ? String(fixo) : ` ${fixo < 0 ? '−' : '+'} ${Math.abs(fixo)}`;

    return texto;
}

/** Destaque do card: o que o sistema marcou, ou o 20/1 natural de um d20 que entrou na soma. */
export function destaqueDaRolagem(d: DadosRolagem): 'critico' | 'falha' | null {
    if (d.sistema?.destaque) return d.sistema.destaque;
    for (const r of dadosRolados(d)) {
        const x = destaqueDado(r, d.sistema?.margem);
        if (x) return x;
    }

    return null;
}

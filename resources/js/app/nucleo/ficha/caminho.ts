/** Caminhos com pontos (`pv.atual`) sobre objetos: o mesmo formato dos `campos` que o servidor valida. */

/** Define `valor` em `caminho`, criando os objetos do meio. Muta e devolve o próprio objeto. */
export function definirCaminho<T extends object>(objeto: T, caminho: string, valor: unknown): T {
    const partes = caminho.split('.');
    let atual = objeto as Record<string, unknown>;
    for (const parte of partes.slice(0, -1)) {
        if (typeof atual[parte] !== 'object' || atual[parte] === null) atual[parte] = {};
        atual = atual[parte] as Record<string, unknown>;
    }
    atual[partes[partes.length - 1]] = valor;

    return objeto;
}

export function lerCaminho(objeto: unknown, caminho: string): unknown {
    return caminho.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), objeto);
}

/** Cópia profunda de dados JSON (listas inteiras são salvas por substituição: edite a cópia e envie). */
export function clonar<T>(valor: T): T {
    return JSON.parse(JSON.stringify(valor)) as T;
}

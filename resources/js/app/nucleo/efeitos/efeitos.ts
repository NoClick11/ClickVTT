/**
 * Motor de efeitos, independente de sistema. ESPELHA `app/Nucleo/Efeitos/Efeitos.php`
 * (casos de `tests/paridade/efeitos.json` rodam nas duas implementações). Veja a documentação do modelo lá:
 * modos `base` → `soma` → `min` → `max` dentro de um alvo; `vantagem`/`desvantagem` só orientam a rolagem; `dados`
 * (dano extra, `3d6`) não mexe no valor: quem monta a rolagem lê esses efeitos.
 *
 * Arquivo PURO: o Node o executa direto nos testes de paridade.
 */
import { avaliar, FormulaInvalida, type Variaveis } from './formula.ts';

export type ModoEfeito = 'soma' | 'base' | 'min' | 'max' | 'vantagem' | 'desvantagem' | 'dados';
export const MODOS: ModoEfeito[] = ['soma', 'base', 'min', 'max', 'vantagem', 'desvantagem', 'dados'];

/** Dados extras (`3d6`): 1 a 20 dados de 2 a 100 faces. Espelha `Efeitos::REGEX_DADOS`. */
export const REGEX_DADOS = /^(?:[1-9]|1\d|20)d(?:[2-9]|[1-9]\d|100)$/;
export const dadosValidos = (valor: unknown): valor is string => typeof valor === 'string' && REGEX_DADOS.test(valor);

/** Efeito como guardado no item/condição: sem a fonte. `valor` = número ou fórmula (não vale em vantagem/desvantagem). */
export interface EfeitoBruto {
    alvo: string;
    modo: ModoEfeito;
    valor?: number | string | null;
}
/** Efeito ativo: a fonte (nome do item/condição) acompanha, para mostrar a origem de cada número. */
export interface Efeito extends EfeitoBruto {
    fonte: string;
}
export interface Origem {
    fonte: string;
    modo: ModoEfeito;
    valor: number;
}
export type Rolagem = 'vantagem' | 'desvantagem' | null;

const NUMERICOS: ModoEfeito[] = ['base', 'soma', 'min', 'max'];

export function deFonte(fonte: string, efeitos: EfeitoBruto[]): Efeito[] {
    return efeitos.map((e) => ({ fonte, alvo: e.alvo, modo: e.modo, valor: e.valor ?? null }));
}

/** `pericia.*` casa `pericia.percepcao`; sem curinga, só o próprio alvo. */
export function casa(padrao: string, alvo: string): boolean {
    if (padrao.endsWith('.*')) return alvo.startsWith(padrao.slice(0, -1));

    return padrao === alvo;
}

function valorDe(valor: unknown, variaveis: Variaveis): number | null {
    if (typeof valor === 'number') return valor;
    if (typeof valor === 'string') {
        try {
            return avaliar(valor, variaveis);
        } catch (e) {
            if (e instanceof FormulaInvalida) return null;
            throw e;
        }
    }

    return null;
}

/** Aplica ao valor-base do `alvo` os efeitos que o casam. */
export function aplicar(alvo: string, base: number, efeitos: Efeito[], variaveis: Variaveis = {}): { valor: number; origens: Origem[] } {
    const porModo: Record<string, { fonte: string; valor: number }[]> = { base: [], soma: [], min: [], max: [] };
    for (const e of efeitos) {
        if (!NUMERICOS.includes(e.modo) || !casa(e.alvo, alvo)) continue;
        const v = valorDe(e.valor, variaveis);
        if (v !== null) porModo[e.modo].push({ fonte: e.fonte ?? '', valor: v });
    }

    let valor = base;
    const origens: Origem[] = [];

    if (porModo.base.length) {
        let vencedor = porModo.base[0];
        for (const c of porModo.base) if (c.valor > vencedor.valor) vencedor = c;
        valor = vencedor.valor;
        origens.push({ fonte: vencedor.fonte, modo: 'base', valor: vencedor.valor });
    }
    for (const c of porModo.soma) {
        valor += c.valor;
        origens.push({ fonte: c.fonte, modo: 'soma', valor: c.valor });
    }
    for (const c of porModo.min) {
        if (c.valor > valor) {
            valor = c.valor;
            origens.push({ fonte: c.fonte, modo: 'min', valor: c.valor });
        }
    }
    for (const c of porModo.max) {
        if (c.valor < valor) {
            valor = c.valor;
            origens.push({ fonte: c.fonte, modo: 'max', valor: c.valor });
        }
    }

    return { valor, origens };
}

/** `vantagem`, `desvantagem` ou null (nenhuma, ou as duas — que se anulam). */
export function rolagem(alvo: string, efeitos: Efeito[]): Rolagem {
    let vantagem = false;
    let desvantagem = false;
    for (const e of efeitos) {
        if (!casa(e.alvo, alvo)) continue;
        vantagem = vantagem || e.modo === 'vantagem';
        desvantagem = desvantagem || e.modo === 'desvantagem';
    }

    return vantagem === desvantagem ? null : vantagem ? 'vantagem' : 'desvantagem';
}

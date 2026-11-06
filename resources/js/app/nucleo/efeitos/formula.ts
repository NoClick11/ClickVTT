/**
 * Avaliador de fórmulas numéricas dos efeitos (SEM dados). ESPELHA `app/Nucleo/Efeitos/Formula.php`:
 * o cliente calcula ao vivo e o servidor decide as rolagens; os casos de `tests/paridade/formula.json` rodam
 * nas duas implementações (`npm run test:regras` e a suíte PHP).
 *
 * Arquivo PURO (sem Vue nem imports de pacotes): o Node o executa direto nos testes de paridade.
 *
 * Gramática (espaços e maiúsculas são ignorados):
 *   expr   := termo (('+' | '-') termo)*
 *   termo  := fator (('*' | '/') fator)*          (divisão arredonda para baixo)
 *   fator  := ('-' | '+') fator | '(' expr ')' | INTEIRO | '@' variavel | funcao '(' expr (',' expr)* ')'
 *   funcao := 'min' | 'max' | 'floor'
 */

export class FormulaInvalida extends Error {}

export const MAX_TAMANHO = 100;
const MAX_PROFUNDIDADE = 10;
const MAX_ARGUMENTOS = 8;

export type Variaveis = Record<string, number>;

class Avaliador {
    private s = '';
    private i = 0;
    private profundidade = 0;

    private readonly resolver: (nome: string) => number;

    // (sem "parameter property": o Node só remove tipos, não transforma sintaxe)
    constructor(resolver: (nome: string) => number) {
        this.resolver = resolver;
    }

    executar(expressao: string): number {
        const limpa = expressao.replace(/\s+/g, '').toLowerCase();
        if (limpa === '') throw new FormulaInvalida('Informe uma fórmula.');
        if (limpa.length > MAX_TAMANHO) throw new FormulaInvalida(`Fórmula longa demais (máximo ${MAX_TAMANHO} caracteres).`);
        this.s = limpa;
        this.i = 0;
        this.profundidade = 0;

        const valor = this.expr();
        if (this.i < this.s.length) throw new FormulaInvalida(`Não entendi "${this.s[this.i]}" na posição ${this.i + 1} da fórmula.`);

        return valor;
    }

    private olhar(): string | null {
        return this.i < this.s.length ? this.s[this.i] : null;
    }

    private expr(): number {
        let valor = this.termo();
        for (let op = this.olhar(); op === '+' || op === '-'; op = this.olhar()) {
            this.i++;
            const direita = this.termo();
            valor = op === '+' ? valor + direita : valor - direita;
        }

        return valor;
    }

    private termo(): number {
        let valor = this.fator();
        for (let op = this.olhar(); op === '*' || op === '/'; op = this.olhar()) {
            this.i++;
            const direita = this.fator();
            if (op === '*') valor = valor * direita;
            else {
                if (direita === 0) throw new FormulaInvalida('Divisão por zero na fórmula.');
                valor = Math.floor(valor / direita);
            }
        }

        return valor;
    }

    private fator(): number {
        const c = this.olhar();
        if (c === '-' || c === '+') {
            this.i++;
            if (++this.profundidade > MAX_PROFUNDIDADE) throw new FormulaInvalida('Fórmula aninhada demais.');
            const valor = this.fator();
            this.profundidade--;

            return c === '-' ? -valor : valor;
        }
        if (c === '(') {
            this.i++;
            if (++this.profundidade > MAX_PROFUNDIDADE) throw new FormulaInvalida('Parênteses aninhados demais.');
            const valor = this.expr();
            this.fechar();
            this.profundidade--;

            return valor;
        }
        if (c === '@') return this.variavel();
        if (c !== null && c >= '0' && c <= '9') {
            const m = /^\d+/.exec(this.s.slice(this.i))!;
            this.i += m[0].length;

            return Number(m[0]);
        }
        if (c !== null && c >= 'a' && c <= 'z') return this.funcao();

        throw new FormulaInvalida(c === null ? 'A fórmula terminou antes do esperado.' : `Não entendi "${c}" na posição ${this.i + 1} da fórmula.`);
    }

    private fechar() {
        if (this.olhar() !== ')') throw new FormulaInvalida('Faltou fechar um parêntese.');
        this.i++;
    }

    private variavel(): number {
        this.i++; // '@'
        const m = /^[a-z0-9_.]+/.exec(this.s.slice(this.i));
        if (!m) throw new FormulaInvalida('Variável sem nome depois de "@".');
        this.i += m[0].length;

        return this.resolver(m[0]);
    }

    private funcao(): number {
        const nome = /^[a-z]+/.exec(this.s.slice(this.i))![0];
        this.i += nome.length;
        if (nome !== 'min' && nome !== 'max' && nome !== 'floor') throw new FormulaInvalida(`Função desconhecida: ${nome}.`);
        if (this.olhar() !== '(') throw new FormulaInvalida(`Faltou "(" depois de ${nome}.`);
        this.i++;
        if (++this.profundidade > MAX_PROFUNDIDADE) throw new FormulaInvalida('Parênteses aninhados demais.');
        const args = [this.expr()];
        while (this.olhar() === ',') {
            this.i++;
            if (args.length >= MAX_ARGUMENTOS) throw new FormulaInvalida('Argumentos demais na função.');
            args.push(this.expr());
        }
        this.fechar();
        this.profundidade--;

        if (nome === 'floor') {
            if (args.length !== 1) throw new FormulaInvalida('floor() recebe um único valor.');

            return Math.floor(args[0]);
        }

        return nome === 'min' ? Math.min(...args) : Math.max(...args);
    }
}

/** Avalia `expressao` com as `variaveis` (nome sem `@`, minúsculo). Lança `FormulaInvalida`. */
export function avaliar(expressao: string, variaveis: Variaveis = {}): number {
    const minusculas: Variaveis = {};
    for (const [nome, valor] of Object.entries(variaveis)) minusculas[nome.toLowerCase()] = valor;

    return new Avaliador((nome) => {
        if (!(nome in minusculas)) throw new FormulaInvalida(`Variável @${nome} desconhecida.`);

        return minusculas[nome];
    }).executar(expressao);
}

/** Só a sintaxe (qualquer variável vale 1): para validar o que o mestre digita antes de salvar. */
export function sintaxeValida(expressao: string): boolean {
    try {
        new Avaliador(() => 1).executar(expressao);

        return true;
    } catch (e) {
        if (e instanceof FormulaInvalida) return false;
        throw e;
    }
}

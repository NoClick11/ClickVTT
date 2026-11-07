// Armas Meito, Kokuto e Yoto (cap. 8, "Armas Meito"), Expertise das armas e as melhorias dos Pontos de Forja (profissão Ferreiro).
// Dados e regras puras (sem Vue); espelhadas em app/Sistemas/OnePiece/Forja.php (catálogo em dados/forja.json, gerado deste arquivo).

export type QualidadeMeito = 'wazamono' | 'ryo-wazamono' | 'o-wazamono' | 'saijo-o-wazamono';
export type MaldicaoYoto = 'ataque-amaldicoado' | 'aura-amaldicoada' | 'azar-mortal' | 'devoradora-espiritual' | 'sede-de-sangue';

export interface Meito {
    id: QualidadeMeito;
    nome: string;
    /** Pontos de Forja para chegar a esta qualidade (profissão Ferreiro). */
    pf: number;
    /** Dado mínimo de dano Cortante (a arma causa, no mínimo, isto). */
    danoMinimo: string;
    /** Bônus nas jogadas de ataque (comum) corpo a corpo (prevalece o maior entre fontes similares). */
    bonusAtaque: number;
    /** Margem de acerto crítico nos ataques corpo a corpo (20 = a normal). */
    margem: number;
    /** Dados adicionais ao executar uma Técnica com arma cortante como requisito (dobrados em críticos). */
    dadosDeTecnica: number;
    texto: string;
}

export const MEITO: Meito[] = [
    {
        id: 'wazamono',
        nome: 'Wazamono',
        pf: 2,
        danoMinimo: '1d6',
        bonusAtaque: 0,
        margem: 20,
        dadosDeTecnica: 1,
        texto: 'Causa no mínimo 1d6 de dano Cortante. Ao executar uma Técnica que tenha arma(s) cortante(s) como requisito, +1 dado adicional (dobrado em críticos), que só ajuda a Técnica a alcançar o máximo de dano possível.',
    },
    {
        id: 'ryo-wazamono',
        nome: 'Ryo Wazamono',
        pf: 4,
        danoMinimo: '1d8',
        bonusAtaque: 1,
        margem: 20,
        dadosDeTecnica: 2,
        texto: 'Causa no mínimo 1d8 de dano Cortante; +1 nas jogadas de acerto (comum) corpo a corpo (prevalece o maior entre armas similares); +2 dados adicionais nas Técnicas com arma cortante como requisito (dobrados em críticos; só ajudam a alcançar o máximo da Técnica).',
    },
    {
        id: 'o-wazamono',
        nome: 'Ô Wazamono',
        pf: 6,
        danoMinimo: '1d10',
        bonusAtaque: 2,
        margem: 19,
        dadosDeTecnica: 3,
        texto: 'Causa no mínimo 1d10 de dano Cortante; +2 nos acertos (comum) corpo a corpo (prevalece o maior); margem de acerto crítico 19-20 nos ataques corpo a corpo; +3 dados adicionais nas Técnicas com arma cortante como requisito (dobrados em críticos; só ajudam a alcançar o máximo da Técnica).',
    },
    {
        id: 'saijo-o-wazamono',
        nome: 'Saijo Ô Wazamono',
        pf: 10,
        danoMinimo: '1d12',
        bonusAtaque: 3,
        margem: 18,
        dadosDeTecnica: 4,
        texto: 'Causa no mínimo 1d12 de dano Cortante; +3 nos acertos (comum) corpo a corpo (prevalece o maior); margem de crítico 18-20; ao executar uma Técnica com arma cortante como requisito, role a jogada de dano duas vezes e fique com a maior (até 3 vezes, recuperadas em um descanso longo); +4 dados adicionais nas Técnicas (dobrados em críticos; só ajudam a alcançar o máximo da Técnica).',
    },
];

export const meitoPorId = (id: string | null | undefined): Meito | undefined => MEITO.find((m) => m.id === id);

export const KOKUTO =
    'Espada Kokuto (lâmina negra, extremamente rara mesmo entre as Meito): em Técnicas com arma cortante como requisito, criaturas na área que façam Salvaguarda para sofrer metade ou todo o dano têm desvantagem nela; alcance em Linha: mínimo 15 m (ou +9 m se já tiver 15 m ou mais); em Cone: mínimo 9 m (ou +6 m se já tiver 9 m ou mais); em Esfera ou Cilindro: mínimo 6 m (ou +3 m se já tiver 6 m ou mais).';

export interface Yoto {
    id: MaldicaoYoto;
    nome: string;
    texto: string;
}

export const YOTO: Yoto[] = [
    {
        id: 'ataque-amaldicoado',
        nome: 'Ataque Amaldiçoado',
        texto: 'Uma vez por dia, ao fazer uma jogada de ataque (comum) corpo a corpo com esta arma, o Narrador pode considerar o ataque como um erro crítico.',
    },
    {
        id: 'aura-amaldicoada',
        nome: 'Aura Amaldiçoada',
        texto: 'A aura ameaçadora alerta as criaturas: a primeira jogada de ataque (comum) contra uma criatura, dentro de um encontro, é feita com desvantagem.',
    },
    {
        id: 'azar-mortal',
        nome: 'Azar Mortal',
        texto: 'Uma vez por dia, ao receber uma jogada de ataque (comum) enquanto empunha ou carrega esta arma, o Narrador pode considerar o ataque como um acerto crítico.',
    },
    {
        id: 'devoradora-espiritual',
        nome: 'Devoradora Espiritual',
        texto: 'Apenas um usuário de Haki do Armamento no "Estágio Perito" consegue atacar com esta arma sem ter a vitalidade absorvida e sem evitar que o ataque aconteça.',
    },
    {
        id: 'sede-de-sangue',
        nome: 'Sede de Sangue',
        texto: 'Ao causar dano em uma criatura com esta espada, você não pode escolher não matá-la. Se tirar a arma da bainha sem deixar sangue fresco banhar a lâmina, você recebe 1d12 de dano Psíquico.',
    },
];
export const yotoPorId = (id: string | null | undefined): Yoto | undefined => YOTO.find((y) => y.id === id);
export const TEXTO_DO_YOTO =
    'Armas Yoto são amaldiçoadas ou sobrenaturais e sempre Meito. O espadachim sofre a consequência sobrenatural, mas pode passar por uma provação (determinação, vidas ou sangue) e encerrar os efeitos enquanto for o dono da arma. Cada espada só tem um tipo de maldição.';

/** Expertise: efeito do acerto crítico natural (só com proficiência na arma). `dados`: dano extra que o card do chat rola. */
export interface Expertise {
    id: string;
    texto: string;
    /** Dano extra automático (um botão no card do crítico). */
    dados?: string;
    tipoDano?: string;
    /** Os dados de dano da arma são maximizados (botão de dano máximo). */
    maximizar?: boolean;
}

export const EXPERTISES: Expertise[] = [
    { id: 'sangramento', texto: 'A criatura atingida recebe a condição "Sangramento".' },
    { id: 'proxima-falha', texto: 'A próxima jogada de ataque (comum) feita contra você, até o final do seu próximo turno, falha.' },
    { id: 'cr-mais-2', texto: 'Você recebe +2 na Classe de Resistência, até o início do seu próximo turno.' },
    { id: 'maximizar', texto: 'Os dados de dano da arma são maximizados.', maximizar: true },
    { id: 'empoderado', texto: 'Você recebe a condição "Empoderado", até o final do seu próximo turno.' },
    {
        id: 'area-cortante',
        texto: 'Você causa 1d6 de dano Cortante em todas as criaturas a até 3 metros de você.',
        dados: '1d6',
        tipoDano: 'Cortante',
    },
    { id: 'critico-16', texto: 'Sua próxima jogada de ataque (comum), até o final do seu próximo turno, tem margem de acerto crítico 16-20.' },
    { id: 'salvaguarda-des', texto: 'A próxima Salvaguarda de Destreza recebe sucesso automático, até o fim do encontro de combate.' },
    { id: 'pv-temporarios', texto: 'Você recebe 20 Pontos de Vida temporários, que duram até o início do seu próximo turno.' },
    { id: 'acerto-mais-3', texto: 'A sua próxima jogada de ataque (comum ou Técnicas), até o final do seu próximo turno, recebe +3 de acerto.' },
    { id: 'caido', texto: 'A criatura atingida recebe a condição "Caído".' },
    {
        id: 'empurrar-ou-1d8',
        texto: 'Ao final do cálculo de dano, empurre a criatura por 6 metros ou adicione 1d8 de dano Contundente adicional.',
        dados: '1d8',
        tipoDano: 'Contundente',
    },
    { id: 'contundente-1d12', texto: 'Ao final do cálculo de dano, adicione 1d12 de dano Contundente.', dados: '1d12', tipoDano: 'Contundente' },
    { id: 'deslocamento-6', texto: 'Você recebe +6 metros de deslocamento, até o fim do seu próximo turno.' },
    {
        id: 'dois-ataques',
        texto: 'Caso tenha errado uma ou mais jogadas de ataque (comum ou Técnicas) no turno atual, você recebe 2 jogadas de ataque (comum) adicionais que causam apenas o dano da arma/munição.',
    },
    { id: 'enfurecido', texto: 'A criatura atingida recebe a condição "Enfurecido", até o final do próximo turno da criatura.' },
    { id: 'incapacitado', texto: 'A criatura atingida recebe a condição "Incapacitado", até o final do próximo turno da criatura.' },
    {
        id: 'puxar-ou-1d8',
        texto: 'Ao final do cálculo de dano, puxe a criatura para 1,5 metro de você ou adicione 1d8 de dano adicional.',
        dados: '1d8',
    },
    { id: 'metade-da-cr', texto: 'Ao final do cálculo de dano, adicione pontos de dano extra em um valor igual à metade da CR do alvo.' },
    { id: 'deslocamento-metade', texto: 'A criatura atingida tem seu deslocamento reduzido pela metade, até o final do próximo turno dela.' },
    { id: 'impedido', texto: 'A criatura atingida recebe a condição "Impedido", até o final do próximo turno da criatura.' },
];
export const expertisePorId = (id: string | null | undefined): Expertise | undefined => EXPERTISES.find((e) => e.id === id);

/** As melhorias que os Pontos de Forja compram (Lâminas, profissão Ferreiro): custo em PF. */
export const CUSTO_DE_MELHORIA = { expertise: 1, supremacia: 2, densidade: 1, dureza: 1, balanco: 2, fio: 2 } as const;
export const MAX_EXPERTISES = 2;
export const TIPOS_DE_DANO_FISICO = ['contundente', 'cortante', 'perfurante'] as const;

/** Sequência de dados do Fio (dano sobe um passo): 1 → 1d4 → 1d6 → 1d8 → 1d10 → 1d12 → 2d6 → 3d6. */
export const PASSOS_DO_FIO = ['1', '1d4', '1d6', '1d8', '1d10', '1d12', '2d6', '3d6'];
export const MAX_FIO = PASSOS_DO_FIO.length - 1;

export interface ForjaDaArma {
    meito?: QualidadeMeito | null;
    kokuto?: boolean;
    yoto?: MaldicaoYoto | null;
    /** Expertise da arma (até 2: a segunda é a Supremacia). */
    expertise?: string[];
    /** Ignora a resistência a este tipo de dano (contundente, cortante ou perfurante). */
    densidade?: string | null;
    dureza?: boolean;
    /** Ignora a invulnerabilidade ao tipo da Densidade. */
    balanco?: boolean;
    /** Quantos passos de dado o Fio deu ao dano da arma. */
    fio?: number;
}

const D = /^(\d+)d(\d+)$/;
const maxDe = (d: string): number => {
    const m = D.exec(d);

    return m ? Number(m[1]) * Number(m[2]) : d === '1' ? 1 : 0;
};

/** Sobe o dado `passos` degraus da sequência do Fio; dado fora da sequência (3d10...) não muda. */
export function sobeFio(dano: string, passos: number): string {
    if (passos <= 0) return dano;
    const i = PASSOS_DO_FIO.indexOf(dano);
    if (i < 0) return dano;

    return PASSOS_DO_FIO[Math.min(PASSOS_DO_FIO.length - 1, i + passos)];
}

/**
 * O dano da arma com a forja: o dado mínimo da qualidade Meito (a arma causa NO MÍNIMO aquele dado, em dano Cortante) e depois
 * os passos do Fio. Armas de dano maior que o mínimo (2d6) continuam como estão.
 */
export function danoComForja(dano: string, forja: ForjaDaArma | null | undefined): string {
    if (!forja) return dano;
    let d = dano;
    const m = meitoPorId(forja.meito);
    if (m && maxDe(m.danoMinimo) > maxDe(d)) d = m.danoMinimo;

    return sobeFio(d, Math.max(0, Math.min(MAX_FIO, Math.floor(forja.fio ?? 0))));
}

/** Bônus de acerto da Meito (corpo a corpo) e margem crítica: a arma usa o maior entre o da forja e o que ela já tinha. */
export const bonusDeAtaqueDaForja = (forja: ForjaDaArma | null | undefined): number => meitoPorId(forja?.meito)?.bonusAtaque ?? 0;
export const margemDaForja = (forja: ForjaDaArma | null | undefined): number => meitoPorId(forja?.meito)?.margem ?? 20;
export const dadosDeTecnicaDaForja = (forja: ForjaDaArma | null | undefined): number => meitoPorId(forja?.meito)?.dadosDeTecnica ?? 0;

/** Etiquetas da arma para o card de ataque (o que a forja deu). */
export function etiquetasDaForja(forja: ForjaDaArma | null | undefined): string[] {
    if (!forja) return [];
    const e: string[] = [];
    const m = meitoPorId(forja.meito);
    if (m) e.push(m.nome);
    if (forja.kokuto) e.push('Kokuto');
    const y = yotoPorId(forja.yoto);
    if (y) e.push(`Yoto: ${y.nome}`);
    if (forja.dureza) e.push('Indestrutível');
    if (forja.densidade) e.push(`Ignora resistência (${forja.densidade})`);
    if (forja.balanco && forja.densidade) e.push(`Ignora invulnerabilidade (${forja.densidade})`);
    if ((forja.fio ?? 0) > 0) e.push(`Fio +${forja.fio}`);

    return e;
}

/** Problemas dos dados de forja de uma arma (o servidor confere o mesmo). */
export function problemasDaForja(forja: ForjaDaArma | null | undefined, ehCortante = true): string[] {
    const p: string[] = [];
    if (!forja) return p;
    if (forja.meito && !meitoPorId(forja.meito)) p.push('Qualidade Meito desconhecida.');
    if (forja.meito && !ehCortante) p.push('Meito são espadas e outras armas cortantes.');
    if (forja.kokuto && !forja.meito) p.push('Espadas Kokuto são Meito.');
    if (forja.yoto && !yotoPorId(forja.yoto)) p.push('Maldição Yoto desconhecida.');
    if (forja.yoto && !forja.meito) p.push('Armas Yoto sempre pertencem às Meito.');
    const ex = forja.expertise ?? [];
    if (ex.length > MAX_EXPERTISES) p.push(`No máximo ${MAX_EXPERTISES} Expertises (a segunda é a Supremacia).`);
    if (new Set(ex).size !== ex.length) p.push('Expertises repetidas.');
    if (ex.some((x) => !expertisePorId(x))) p.push('Expertise desconhecida.');
    if (forja.densidade && !(TIPOS_DE_DANO_FISICO as readonly string[]).includes(forja.densidade))
        p.push('A Densidade vale para dano Contundente, Cortante ou Perfurante.');
    if (forja.balanco && !forja.densidade) p.push('O Balanço exige a Densidade (ignora a invulnerabilidade ao mesmo tipo).');
    const fio = forja.fio ?? 0;
    if (!Number.isInteger(fio) || fio < 0 || fio > MAX_FIO) p.push(`O Fio sobe de 0 a ${MAX_FIO} passos.`);

    return p;
}

/** PF gastos para ir da forja `de` à forja `para` (só os acréscimos; nada se devolve). `null` = pedido inválido. */
export function custoEmPF(de: ForjaDaArma | null | undefined, para: ForjaDaArma): { total: number; itens: string[] } | null {
    const a = de ?? {};
    let total = 0;
    const itens: string[] = [];
    const meitoDe = meitoPorId(a.meito)?.pf ?? 0;
    const meitoPara = meitoPorId(para.meito)?.pf ?? 0;
    if (meitoPara < meitoDe) return null;
    if (meitoPara > meitoDe) {
        total += meitoPara - meitoDe;
        itens.push(`${meitoPorId(para.meito)!.nome} (${meitoPara - meitoDe} PF)`);
    }
    const exA = a.expertise ?? [];
    const exB = para.expertise ?? [];
    if (exB.length < exA.length) return null; // não se tira expertise
    // Trocar a expertise de uma arma custa 1 PF; a expertise adicional (Supremacia) custa 2 PF (a primeira, numa arma sem nenhuma, custa 1).
    for (let i = 0; i < exA.length; i++) {
        if (exB[i] !== exA[i]) {
            total += CUSTO_DE_MELHORIA.expertise;
            itens.push('Troca de Expertise');
        }
    }
    for (let i = exA.length; i < exB.length; i++) {
        total += i === 0 ? CUSTO_DE_MELHORIA.expertise : CUSTO_DE_MELHORIA.supremacia;
        itens.push(i === 0 ? 'Expertise' : 'Supremacia');
    }
    if (para.densidade && para.densidade !== a.densidade) {
        total += CUSTO_DE_MELHORIA.densidade;
        itens.push('Densidade');
    }
    if (para.dureza && !a.dureza) {
        total += CUSTO_DE_MELHORIA.dureza;
        itens.push('Dureza');
    }
    if (para.balanco && !a.balanco) {
        total += CUSTO_DE_MELHORIA.balanco;
        itens.push('Balanço');
    }
    const passos = (para.fio ?? 0) - (a.fio ?? 0);
    if (passos < 0) return null;
    if (passos > 0) {
        total += CUSTO_DE_MELHORIA.fio * passos;
        itens.push(`Fio ×${passos}`);
    }

    return { total, itens };
}

/** Custo em dinheiro de uma melhoria ou forja: 1 lingote de metal e ฿ 20.000 ou 20% do valor de compra (o maior). */
export const custoEmDinheiro = (precoDeCompra: number | null): number => Math.max(20000, Math.ceil((precoDeCompra ?? 0) * 0.2));

/** Pontos de Forja do Ferreiro: 1 por 10 anos de vida, 1 por 10 lâminas comuns, 2 por graduação, mais os que o mestre deu. Espelha `Ferreiro::pontos`. */
export interface FichaForja {
    idade: number;
    laminas: number;
    extras: number;
    gastos: number;
}
export const forjaPadrao = (): FichaForja => ({ idade: 0, laminas: 0, extras: 0, gastos: 0 });

export function pontosDeForja(f: {
    forja?: Partial<FichaForja>;
    profissoes?: { lista?: { id: string; graduacao: number }[]; semProfissao?: boolean };
}) {
    const x = { ...forjaPadrao(), ...(f.forja ?? {}) };
    const ferreiro = f.profissoes?.semProfissao ? undefined : f.profissoes?.lista?.find((p) => p.id === 'ferreiro');
    const porIdade = Math.floor(Math.max(0, x.idade) / 10);
    const porLaminas = Math.floor(Math.max(0, x.laminas) / 10);
    const porGraduacao = 2 * (ferreiro?.graduacao ?? 0);
    const ganhos = porIdade + porLaminas + porGraduacao + x.extras;

    return {
        ganhos,
        gastos: x.gastos,
        disponiveis: ganhos - x.gastos,
        porIdade,
        porLaminas,
        porGraduacao,
        extras: x.extras,
        cd: 16 - (ferreiro?.graduacao ?? 0),
        ehFerreiro: !!ferreiro,
    };
}

export type FormaDaTecnica = 'linha' | 'cone' | 'esfera';

/** Kokuto: alcance mínimo e acréscimo (m) por forma: se o alcance já é igual ou maior que o mínimo, soma o acréscimo. */
export const ALCANCE_KOKUTO: Record<FormaDaTecnica, { minimo: number; extra: number; nome: string }> = {
    linha: { minimo: 15, extra: 9, nome: 'Linha' },
    cone: { minimo: 9, extra: 6, nome: 'Cone' },
    esfera: { minimo: 6, extra: 3, nome: 'Esfera/Cilindro' },
};

/** Lê o alcance em texto da Técnica ("Até 15 metros, Linha", "Cone de 18 m", "4,5 m de raio"): forma e metros; null se não der para ler. */
export function lerAlcance(texto: string): { forma: FormaDaTecnica; metros: number } | null {
    const t = texto.toLowerCase();
    const forma: FormaDaTecnica | null = /\bcone\b/.test(t)
        ? 'cone'
        : /\blinha\b/.test(t)
          ? 'linha'
          : /esfera|cilindro|emana[cç][aã]o|\braio\b/.test(t)
            ? 'esfera'
            : null;
    const m = /(\d+(?:[.,]\d+)?)\s*(?:m\b|metros?\b)/.exec(t);
    if (!forma || !m) return null;

    return { forma, metros: Number(m[1].replace(',', '.')) };
}

/**
 * O alcance de uma Técnica com arma cortante como requisito empunhando uma Espada Kokuto (Linha: mínimo 15 m, ou +9 m se já tem 15 m ou
 * mais; Cone: mínimo 9 m ou +6 m; Esfera/Cilindro: mínimo 6 m ou +3 m). `metros` = o alcance novo; null se o texto não tem forma e metros.
 */
export function alcanceComKokuto(texto: string): { metros: number; texto: string; mudou: boolean } | null {
    const a = lerAlcance(texto);
    if (!a) return null;
    const r = ALCANCE_KOKUTO[a.forma];
    const metros = a.metros >= r.minimo ? a.metros + r.extra : r.minimo;
    const fmt = (n: number) => String(n).replace('.', ',');

    return {
        metros,
        mudou: metros !== a.metros,
        texto: a.forma === 'linha' ? `${fmt(metros)} m em Linha` : a.forma === 'cone' ? `Cone de ${fmt(metros)} m` : `${fmt(metros)} m de raio`,
    };
}

/** Usos da Saijo Ô Wazamono por descanso longo (rolar o dano da Técnica duas vezes e ficar com o maior). */
export const USOS_DA_SAIJO = 3;

/**
 * Regras e tipos da ficha de One Piece (derivada do D&D 5e: atributos, perícias e pontos de poder próprios). ESPELHA `app/Sistemas/OnePiece/Regras.php` (o cliente mostra ao vivo, o servidor
 * decide as rolagens): qualquer mudança aqui tem de ser feita nos dois. Os casos de `tests/paridade/onepiece.json`
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
import { avaliar } from '../../nucleo/efeitos/formula.ts';
import type { AkumaFicha } from './akuma/regras.ts';
import { condicaoPorId } from './condicoes.ts';
import type { EscolhasDaTecnica } from './criador/regras.ts';
import { estagio as estagioDoHaki, type HakiFicha } from './haki/calculo.ts';
import type { IndividualidadesFicha } from './individualidades/regras.ts';
import {
    bonusDeAtaqueDaForja,
    dadosDeTecnicaDaForja,
    danoComForja,
    etiquetasDaForja,
    margemDaForja,
    type FichaForja,
    type ForjaDaArma,
} from './itens/forja.ts';
import type { ProfissoesFicha } from './profissoes/regras.ts';
import type { TreinamentoFicha } from './treinamentos/regras.ts';

export type AtributoId = 'for' | 'des' | 'con' | 'sab' | 'pre' | 'von';

export const ATRIBUTOS: { id: AtributoId; sigla: string; nome: string }[] = [
    { id: 'for', sigla: 'FOR', nome: 'Força' },
    { id: 'des', sigla: 'DES', nome: 'Destreza' },
    { id: 'con', sigla: 'CON', nome: 'Constituição' },
    { id: 'sab', sigla: 'SAB', nome: 'Sabedoria' },
    { id: 'pre', sigla: 'PRE', nome: 'Presença' },
    { id: 'von', sigla: 'VON', nome: 'Vontade' },
];

export const PERICIAS: { id: string; nome: string; atributo: AtributoId }[] = [
    { id: 'atletismo', nome: 'Atletismo', atributo: 'for' },
    { id: 'acrobacia', nome: 'Acrobacia', atributo: 'des' },
    { id: 'furtividade', nome: 'Furtividade', atributo: 'des' },
    { id: 'prestidigitacao', nome: 'Prestidigitação', atributo: 'des' },
    { id: 'historia', nome: 'História', atributo: 'sab' },
    { id: 'investigacao', nome: 'Investigação', atributo: 'sab' },
    { id: 'medicina', nome: 'Medicina', atributo: 'sab' },
    { id: 'natureza', nome: 'Natureza', atributo: 'sab' },
    { id: 'sobrevivencia', nome: 'Sobrevivência', atributo: 'sab' },
    { id: 'atuacao', nome: 'Atuação', atributo: 'pre' },
    { id: 'enganacao', nome: 'Enganação', atributo: 'pre' },
    { id: 'intimidacao', nome: 'Intimidação', atributo: 'pre' },
    { id: 'persuasao', nome: 'Persuasão', atributo: 'pre' },
    { id: 'provocacao', nome: 'Provocação', atributo: 'pre' },
    { id: 'haki', nome: 'Haki', atributo: 'von' },
    { id: 'intuicao', nome: 'Intuição', atributo: 'von' },
    { id: 'percepcao', nome: 'Percepção', atributo: 'von' },
    { id: 'sobrenatural', nome: 'Sobrenatural', atributo: 'von' },
    { id: 'sorte', nome: 'Sorte', atributo: 'von' },
    /** A perícia da Profissão (cap. 4): vem treinada com a profissão e soma a proficiência em Testes de QUALQUER atributo ligados a ela. */
    { id: 'oficio', nome: 'Ofício', atributo: 'sab' },
];

/** As perícias que se escolhem livremente (Foco, antecedente, estilo...): o Ofício só vem da Profissão. */
export const PERICIAS_ESCOLHIVEIS = PERICIAS.filter((p) => p.id !== 'oficio');

/** 0 = sem proficiência, 1 = proficiente, 2 = especialista. */
export type Proficiencia = 0 | 1 | 2;

/** Pontos de poder ganhos por nível (4; 5 com certas características). */
export const PP_POR_NIVEL = [4, 5] as const;

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
export interface DadosItemOnePiece {
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
        /** Arma à distância: o anão (Armas Reduzidas) causa só metade do dano com ela. */
        distancia?: boolean;
        /** Tamanho da arma: gigantes só usam armas de gigante, e nenhum outro tamanho usa a de um gigante. */
        tamanho?: 'padrao' | 'gigante' | null;
        /** Meito, Kokuto, Yoto, Expertise e melhorias de Pontos de Forja: valem sozinhos com a arma equipada. */
        forja?: ForjaDaArma;
    };
}
/** O que o cálculo precisa de um item da mesa (campos ausentes valem: equipável, sem sintonia, sem efeitos). */
export interface ItemParaCalculo {
    nome?: string;
    /** Peso de 1 unidade, em kg. */
    peso: number;
    equipavel?: boolean;
    requer_sintonia?: boolean;
    dados?: DadosItemOnePiece | Record<string, unknown> | null;
    efeitos?: EfeitoBruto[];
}
export type ItensPorId = Record<number, ItemParaCalculo>;
/** Botão de uma característica. `condicao`: aplica uma condição (com salvaguarda do alvo e duração); `hospedar`: o anão entra no espaço do alvo mirado; `dadoExtra`: rola 1 dado extra de dano. */
/** Categorias de ação do combate do One Piece (o servidor é quem as declara: `OnePiece::categoriasDeAcao`). */
/** Reação a um ataque: a quem serve, bônus na defesa de quem foi atacado (mesmo que a reação seja de outro jogador) e cura. */
export interface ReacaoDeCombate {
    gatilho: 'ataque_declarado';
    alcance: 'si' | 'aliado' | 'ambos';
    /** Bônus na defesa de quem foi atacado: número ou fórmula da ficha de quem reage (`@prof-floor(@prof/2)`). */
    defesa?: number | string;
    /** Categoria que a reação gasta (padrão: reação; Aparar Aprimorado gasta livre). */
    categoria?: CategoriaDeAcao;
    /** Valor ou dados (`1d8`) curados em quem foi atacado. */
    cura?: string;
}
export type CategoriaDeAcao = 'padrao' | 'poderosa' | 'bonus' | 'livre' | 'reacao';
export interface AcaoCaracteristica {
    rotulo: string;
    /** Categoria de ação que o botão gasta no combate (nenhuma = não gasta). */
    acao?: CategoriaDeAcao;
    tipo: 'condicao' | 'hospedar' | 'dadoExtra' | 'recuperar' | 'rolar' | 'deslocar' | 'gastar' | 'socorrer';
    /** `recuperar`: o recurso que a rolagem devolve. */
    recurso?: 'pp' | 'pv';
    /** `recuperar` e `rolar`: a expressão (pode usar `@variaveis`, ex.: `1d8+@prof`). */
    rolagem?: string;
    /** `deslocar`: quantas vezes o deslocamento do turno é somado ao turno (2 = recuar o dobro). */
    fator?: number;
    /** O botão gasta 1 uso da característica. */
    usa?: boolean;
    /** `rolar`/`recuperar`: sobe os dados desta rolagem pelos passos do alvo `passo.<x>` (ex.: `desarmado`). */
    passo?: 'corpo' | 'distancia' | 'desarmado' | 'tecnica';
    /** `socorrer`: só encerra as condições (sem cura nem PV temporários); vale quantas vezes quiser. */
    soCondicoes?: boolean;
    /** `rolar`: efeito cujo vantagem vale para esta rolagem (ex.: `concentracao`). */
    vantagemAlvo?: string;
    alvo?: 'proprio' | 'mirado';
    condicao?: string;
    /** Salvaguarda do alvo (atributo e CD) contra a condição. */
    atributo?: AtributoId;
    cd?: number;
    /** Duração: número de turnos ou dados (`1d4`). */
    turnos?: string;
    aoDano?: boolean;
}
export interface Caracteristica {
    nome: string;
    origem: string;
    tipo: 'ativa' | 'passiva';
    /** `porProf`: o máximo acompanha o bônus de proficiência (ver `usosMax`); `max` guarda o último valor calculado. */
    usos?: {
        atual: number;
        max: number;
        porProf?: boolean;
        porNivel?: boolean;
        /** Máximo por fórmula (`2*@nivel`, `1+floor(@nivel/2)`): vale a cada nível. */ formula?: string;
    };
    /** Texto da característica (regras, restrições). */
    descricao?: string;
    /** Quem criou: o assistente de criação marca `especie`/`variacao`, para refazer o passo sem duplicar. */
    builder?: 'especie' | 'variacao' | 'estilo' | 'maestria' | 'haki' | 'treinamento' | 'antecedente' | 'profissao' | 'akuma' | 'individualidade';
    /** Categoria de ação que ligar/usar a característica gasta no combate (nenhuma = não gasta). */
    acao?: CategoriaDeAcao;
    /** Faixa de nível em que a característica vale (as Habilidades Básicas mudam com o nível). */
    nivelMin?: number;
    nivelMax?: number;
    /** De qual Habilidade Básica ela vem (id do catálogo). */
    hb?: string;
    /** Reação a um ataque (a característica com usos gasta um). */
    reacao?: ReacaoDeCombate;
    /** Etiquetas de combate mostradas na ficha (ex.: "Alcança alvos Enormes"). */
    etiquetas?: string[];
    /** Limite por rodada compartilhado no grupo (Heat, Electro, Potencializador) e a rodada do último uso. */
    grupoRodada?: string;
    usadoNaRodada?: number | null;
    /** Forma alternativa (junto da jogada de ataque, sem ação bônus): contador próprio de usos. */
    alternativo?: { atual: number; max: number };
    /** Botões da característica: aplicar condição (a si ou ao alvo mirado), hospedar-se, rolar dado extra. */
    acoes?: AcaoCaracteristica[];
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
/** Uma técnica: gasta pontos de poder (`custo`) e pode ter uma rolagem própria (ex.: `3d8+@mod.for`). */
/**
 * Como a Técnica acerta o alvo. `ataque`: jogada de ataque (Técnicas) contra a defesa; `salvaguarda`: cada criatura na área rola a
 * salvaguarda contra a CD de quem usou; `automatico`: acerta sem rolar. `aoPassar` vale para o dano da salvaguarda (metade ou nada).
 * `secundaria` é a salvaguarda do EFEITO (condição) de quem foi atingido ou falhou.
 */
/** A condição que a Técnica aplica a quem falha (aplicada sozinha, com a duração): `turnos` = fim do turno do afetado que zera a contagem. */
export interface EfeitoDeCondicao {
    condicao: string;
    turnos?: number;
    /** Acaba ao receber dano. */
    aoDano?: boolean;
}

export interface TesteDaTecnica {
    tipo: 'ataque' | 'salvaguarda' | 'automatico';
    /** Salvaguarda: o atributo que o alvo rola. */
    atributo?: AtributoId;
    desvantagem?: boolean;
    aoPassar?: 'metade' | 'nada';
    /** A condição de quem falha na Salvaguarda desta Técnica (Salvaguarda de área, sem dano ou com). */
    aplica?: EfeitoDeCondicao;
    secundaria?: { atributo: AtributoId; desvantagem?: boolean; efeito: string; aplica?: EfeitoDeCondicao };
}

export interface Tecnica {
    nome: string;
    /** De onde vem: estilo de luta, fruta, haki, profissão... */
    origem: string;
    custo: number;
    alcance: string;
    /** Dano ou efeito em texto curto (ex.: "3d8 cortante"). */
    efeito: string;
    descricao: string;
    /** Expressão de dados (pode usar `@variaveis`); vazia = a técnica só gasta PP. */
    rolagem: string;
    /** Tipo do dano (fogo, elétrico...): o dano aplicado respeita resistências e imunidades do alvo. */
    tipoDano?: string;
    /** Categoria de ação que usar a técnica gasta no combate (padrão: poderosa, só para técnicas). */
    acao?: CategoriaDeAcao;
    /** Reação: usada quando alguém é atacado (fora do turno), a si ou a um aliado. */
    reacao?: ReacaoDeCombate;
    /** Como a Técnica acerta (ataque, salvaguarda da área ou automática); sem isto, "Usar" só rola a `rolagem`. */
    teste?: TesteDaTecnica;
    /** A Técnica tem uma arma cortante como requisito: as armas Meito equipadas somam dados ao dano dela. */
    armaCortante?: boolean;
    /** Quem criou: o assistente de criação marca `especie`, para refazer o passo sem duplicar. */
    builder?: 'especie' | 'estilo' | 'maestria' | 'treinamento' | 'criador' | 'akuma';
    /** Escolhas do Criador de Técnicas (o servidor refaz o custo e os limites a partir delas). */
    criador?: EscolhasDaTecnica;
}

/** Tipo da Akuma no Mi ('' = sem fruta definida). */
export type TipoAkuma = '' | 'paramecia' | 'zoan' | 'logia';
export const TIPOS_AKUMA: { id: TipoAkuma; nome: string }[] = [
    { id: '', nome: 'Sem tipo' },
    { id: 'paramecia', nome: 'Paramecia' },
    { id: 'zoan', nome: 'Zoan' },
    { id: 'logia', nome: 'Logia' },
];

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
export interface FichaOnePiece {
    nivel: number;
    especie: string;
    /** Estilo de luta (ex.: Espadachim). */
    estilo: string;
    profissao: string;
    /** Fruta do Diabo (se tiver). */
    fruta: string;
    antecedente: string;
    xp: { atual: number };
    inspiracao: boolean;
    /** Categoria de tamanho (Miúdo, Pequeno, Médio, Grande, Enorme). */
    tamanho: string;
    /** Deslocamentos em metros (0 = não tem). `deslocamento` é o texto mostrado. */
    movimento: { normal: number; nado: number; escalada: number; voo: number };
    /** Traços de Ancestralidade (Zoan) em texto livre, até o catálogo existir. */
    ancestralidade: string;
    /** Primeiros Socorros: esta criatura já recebeu o tratamento (volta no descanso longo). */
    socorrido: boolean;
    /** Atributo primário do estilo de combate (Defesa Aprimorada, Defesa Ofensiva...). */
    atributoPrimario: AtributoId;
    /** Haki (cap. 7): PA, tipos liberados, Haki Principal e os talentos comprados. */
    haki: HakiFicha;
    /** Treinamentos (cap. 5.7): PT, pedidos em andamento e os aprendidos. */
    treinamento: TreinamentoFicha;
    /** Profissões (cap. 4): a do 1º nível, graduações e os avanços já usados. */
    profissoes: ProfissoesFicha;
    individualidades: IndividualidadesFicha;
    /** Pontos de Forja do Ferreiro (idade, lâminas, PF dados e gastos); o mestre e a forja do servidor alteram. */
    forja?: FichaForja;
    /** Usos gastos da Saijo Ô Wazamono (até 3 por descanso longo); o servidor consome ao rolar o dano duas vezes. */
    meito?: { usados: number };
    maestria: string;
    tracosDeMaestria: { id: string; nivel: number }[];
    estiloId: string;
    estiloCaminho: string;
    /** Habilidades Básicas escolhidas (id, nível em que vieram e a opção, no Quebrador de Regras). */
    habilidadesBasicas: { id: string; nivel: number; opcao?: string }[];
    /** Anão com Hóspede Feérico: id do personagem em cujo espaço ele está. */
    hospedado: number | null;
    /** Recompensa pela cabeça do personagem, em Belly. */
    recompensa: number;
    /** Dinheiro, em Belly. */
    belly: number;
    atributos: Record<AtributoId, number>;
    salvaguardas: AtributoId[];
    pericias: Partial<Record<string, Proficiencia>>;
    deslocamento: string;
    pv: { atual: number; max: number; temp: number; escudo?: number };
    /** Pontos de poder: o recurso das técnicas. O máximo é `nivel × porNivel` (mais efeitos); volta no descanso longo. */
    pp: { atual: number; porNivel: number };
    dadosVida: { restantes: number; tipo: string };
    exaustao: number;
    sentidos: string[];
    idiomas: string[];
    resistencias: string[];
    imunidades: string[];
    vulnerabilidades: string[];
    proficienciasArmas: string[];
    proficienciasArmaduras: string[];
    ferramentas: Ferramenta[];
    inventario: { secao: string; itens: ItemInventario[] }[];
    /** Ids das condições ativas (`CONDICOES`), ex.: `envenenado`. */
    condicoes?: string[];
    /** Condições com duração: turnos que faltam e se acabam ao receber dano. O servidor conta os turnos (rastreador de turnos). */
    duracoes?: Record<string, { turnos: number; aoDano: boolean }>;
    caracteristicas: Caracteristica[];
    /** A Akuma no Mi: tipo, despertar e os poderes da fruta (mesmo formato das técnicas, gastam os mesmos PP). O nome é `fruta`. */
    akuma: AkumaFicha;
    /** Técnicas do personagem; `atributo` é o que define a CD e o ataque delas. */
    tecnicas: { atributo: AtributoId; lista: Tecnica[] };
    ajustes: Ajustes;
}

/** Deslocamentos em texto (`9 m · nado 4,5 m`): só os que a criatura tem. */
export function textoDeMovimento(m: { normal: number; nado: number; escalada: number; voo: number }): string {
    const metros = (n: number) => `${String(n).replace('.', ',')} m`;

    return [
        metros(m.normal),
        m.nado ? `nado ${metros(m.nado)}` : '',
        m.escalada ? `escalada ${metros(m.escalada)}` : '',
        m.voo ? `voo ${metros(m.voo)}` : '',
    ]
        .filter(Boolean)
        .join(' · ');
}

/** Características do Haki só valem com o interruptor "Haki ativo" ligado (aba Haki). Espelha `Regras::hakiDesligado`. */
export const hakiDesligado = (c: { builder?: string }, f: { haki?: { ativo?: boolean } }): boolean => c.builder === 'haki' && !f.haki?.ativo;

/** A característica vale neste nível? Sem `nivelMin`/`nivelMax` vale sempre. Espelha `Regras::ativaNoNivel`. */
export const ativaNoNivel = (c: { nivelMin?: number; nivelMax?: number }, nivel: number): boolean =>
    nivel >= (c.nivelMin ?? 1) && nivel <= (c.nivelMax ?? 99);

/** Os tamanhos de dado, em ordem, para o "aumento em um passo" (1d4 → 1d6 → 1d8 → 1d10 → 1d12). */
export const DEGRAUS = [4, 6, 8, 10, 12];

/** Sobe os dados da expressão `passos` degraus (`1d8` + 1 → `1d10`; no 1d12 para). Só os dados `NdM` mudam. Espelha `Regras::degrau`. */
export function degrau(expressao: string, passos: number): string {
    if (passos <= 0) return expressao;

    return expressao.replace(/(\d+)d(\d+)/gi, (todo, n: string, faces: string) => {
        const i = DEGRAUS.indexOf(Number(faces));

        return i < 0 ? todo : `${n}d${DEGRAUS[Math.min(DEGRAUS.length - 1, i + passos)]}`;
    });
}

/**
 * Rolagem de um botão da ficha: `{fórmula}` vira o número (aceita `floor`, `min`, `max` e `@variaveis`: `{@nivel+floor(@prof/2)}`)
 * e `passo` sobe os dados pelos passos que os efeitos dão (`passo.desarmado`...).
 */
export function expandirRolagem(expressao: string, variaveis: Record<string, number>, passo?: string): string {
    const numerica = expressao.replace(/\{([^}]*)\}/g, (_, f: string) => String(avaliar(f, variaveis)));

    return degrau(numerica, passo ? Math.max(0, Math.floor(variaveis[`passo.${passo}`] ?? 0)) : 0);
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
    const a = (item.dados as DadosItemOnePiece | null | undefined)?.armadura;
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
export function efeitosAtivos(f: FichaOnePiece, itens: ItensPorId): Efeito[] {
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
        if (!ativaNoNivel(c, Number(f.nivel)) || hakiDesligado(c, f)) continue;
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
 * carga.max, pp.max, xp.proximo, dv.max, treinamento.pontos e, por arma ativa, arma.<item_id>.ataque / .dano / .margem.
 * Tolerante a chaves ausentes (ficha salva antes de um campo existir): usa 0.
 */
export function analisar(f: FichaOnePiece, itens: ItensPorId = {}): Analise {
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
    // Teste de atributo: o modificador (os efeitos somam bônus, ex.: Força Colossal; o botão do atributo rola `@teste.<atr>`)
    for (const { id } of ATRIBUTOS) base[`teste.${id}`] = mod[id];
    // Haki Treinado (21+ PA distribuídos) dá proficiência na perícia Haki
    const hakiTreinado = f.haki ? estagioDoHaki(f.haki) >= 2 : false;
    for (const p of PERICIAS)
        base[`pericia.${p.id}`] =
            mod[p.atributo] + (p.id === 'haki' && hakiTreinado ? Math.max(1, f.pericias[p.id] ?? 0) : (f.pericias[p.id] ?? 0)) * prof;
    const conjuracao = mod[f.tecnicas.atributo];
    base.iniciativa = mod.des;
    base.ca = 10 + mod.des;
    base.cd = 8 + prof + conjuracao;
    base.ataque = prof + conjuracao;
    base['ataque.arma'] = 0;
    base['dano.arma'] = 0;
    base['carga.max'] = 15 * r['atributos.for'];
    base['pv.max'] = f.pv?.max ?? 0;
    base['pp.max'] = nivel * (f.pp?.porNivel ?? 4);
    // Pontos de Escudo (Endurecimento Defensivo): o máximo vem dos efeitos; sem o talento é 0
    base['escudo.max'] = 0;
    // Alcance corpo a corpo e deslocamentos em decímetros (15 = 1,5 m): efeitos e fórmulas só trabalham com inteiros.
    base['alcance.corpo'] = 15;
    for (const tipo of ['normal', 'nado', 'escalada', 'voo'] as const) base[`movimento.${tipo}`] = Math.round((f.movimento?.[tipo] ?? 0) * 10);
    base['dano.distancia.pct'] = 100;
    // Passos de dado (Mira Treinada, Força Magnífica, Perito em Técnicas...), margem de crítico por tipo de arma e ataque desarmado
    for (const p of ['corpo', 'distancia', 'desarmado', 'tecnica']) base[`passo.${p}`] = 0;
    base['margem.corpo'] = 20;
    base['margem.distancia'] = 20;
    base['ataque.desarmado'] = prof + mod.for;
    base['dano.desarmado'] = mod.for;

    // Fase 3: efeitos sobre os valores-base
    const variaveis = { ...r, ...base };
    for (const [chave, valor] of Object.entries(base)) r[chave] = aplicarEm(chave, valor, variaveis);
    for (const p of PERICIAS) r[`passiva.${p.id}`] = 10 + r[`pericia.${p.id}`];
    f.ferramentas.forEach((t, i) => (r[`ferramenta.${i}`] = mod[t.atributo] + t.prof * prof));

    // Armas ativas
    for (const secao of f.inventario ?? []) {
        for (const ref of secao.itens ?? []) {
            const item = itens[ref.item_id];
            const arma = (item?.dados as DadosItemOnePiece | null | undefined)?.arma;
            if (!item || !arma || !ativo(ref, item) || !armaCabe(arma, f.tamanho)) continue;
            // Ataque e dano podem usar atributos diferentes; sem `atributoDano`, o dano usa o mesmo do ataque.
            const mAtaque = modificadorDaArma(arma.atributo, mod);
            const mDano = modificadorDaArma(arma.atributoDano ?? arma.atributo, mod);
            // Bônus simples de acerto e de dano, separados; armas antigas (só `bonusMagico`) usam o mesmo nos dois.
            // Meito: +1/+2/+3 no acerto corpo a corpo (prevalece o maior entre a forja e o bônus que a arma já tinha)
            const bonusAtaque = Math.max(arma.bonusAtaque ?? arma.bonusMagico ?? 0, arma.distancia ? 0 : bonusDeAtaqueDaForja(arma.forja));
            const bonusDano = arma.bonusDano ?? arma.bonusMagico ?? 0;
            r[`arma.${ref.item_id}.ataque`] = mAtaque + (arma.proficiente ? prof : 0) + bonusAtaque + r['ataque.arma'];
            r[`arma.${ref.item_id}.dano`] = mDano + bonusDano + r['dano.arma'];
            // d20 puro igual ou maior que isto é crítico: a margem da arma ou a do tipo (Crítico Marcial: 19), a menor
            r[`arma.${ref.item_id}.margem`] = Math.min(
                arma.margemCritica ?? 20,
                arma.distancia ? 20 : margemDaForja(arma.forja),
                r[arma.distancia ? 'margem.distancia' : 'margem.corpo'],
            );
        }
    }

    let peso = 0;
    for (const secao of f.inventario) for (const ref of secao.itens) peso += ref.qtd * (itens[ref.item_id]?.peso ?? 0); // item removido da mesa não pesa
    r['carga.atual'] = Math.round(peso * 100) / 100;
    r['xp.proximo'] = XP_PROXIMO[Math.min(Math.max(nivel, 1), 20)];
    r['dv.max'] = nivel;
    r['treinamento.pontos'] = Math.max(0, mod.sab); // Traços Culturais: pontos de treinamento = mod. SAB positivo

    return { valores: r, origens, efeitos };
}

/** O gigante (tamanho Enorme) só usa armas de gigante, e nenhum outro tamanho usa a arma de um gigante. Espelha `Regras::armaCabe`. */
export function armaCabe(arma: { tamanho?: string | null }, tamanho: string | undefined): boolean {
    return (arma.tamanho ?? 'padrao') === 'gigante' ? (tamanho ?? 'Médio') === 'Enorme' : (tamanho ?? 'Médio') !== 'Enorme';
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
export function calcular(f: FichaOnePiece, itens: ItensPorId = {}): Record<string, number> {
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
export function dadosDeDano(f: FichaOnePiece, itens: ItensPorId, itemId: number, valores: Record<string, number> = {}): string[] {
    const arma = (itens[itemId]?.dados as DadosItemOnePiece | null | undefined)?.arma;
    if (!arma || typeof arma.dano !== 'string') return [];

    // O dado da arma sobe os degraus do tipo dela (corpo a corpo ou à distância); os extras não
    const dados = [degrau(danoComForja(arma.dano, arma.forja), valores[arma.distancia ? 'passo.distancia' : 'passo.corpo'] ?? 0)];
    for (const extra of arma.danoExtra ?? []) if (dadosValidos(extra.dados)) dados.push(extra.dados);
    for (const e of efeitosAtivos(f, itens)) if (e.modo === 'dados' && casa(e.alvo, 'dano.arma') && dadosValidos(e.valor)) dados.push(e.valor);

    return dados;
}

/** Dados extras que os efeitos ativos somam ao dano das técnicas (ex.: o 1d10 de Heat/Electro): efeitos `dados` em `dano.tecnica`. */
export function dadosExtrasDeTecnica(efeitos: Efeito[]): string[] {
    return efeitos.filter((e) => e.modo === 'dados' && casa(e.alvo, 'dano.tecnica') && dadosValidos(e.valor)).map((e) => e.valor as string);
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
    /** O que a forja deu à arma (Meito, Yoto, Fio...), para o card de ataque. */
    etiquetas: string[];
    /** Expertise da arma (ids), que vale no acerto crítico quando há proficiência. */
    expertise: string[];
}

/** Uma arma equipada com a forja pedida (Saijo Ô Wazamono, Espada Kokuto). Espelha `Regras::saijoEquipada`. */
function armaEquipadaCom(f: FichaOnePiece, itens: ItensPorId, teste: (forja: ForjaDaArma) => boolean): boolean {
    for (const secao of f.inventario ?? []) {
        for (const ref of secao.itens ?? []) {
            const item = itens[ref.item_id];
            const arma = (item?.dados as DadosItemOnePiece | null | undefined)?.arma;
            if (item && arma?.forja && ativo(ref, item) && armaCabe(arma, f.tamanho) && teste(arma.forja)) return true;
        }
    }

    return false;
}
export const saijoEquipada = (f: FichaOnePiece, itens: ItensPorId): boolean => armaEquipadaCom(f, itens, (x) => x.meito === 'saijo-o-wazamono');
export const kokutoEquipada = (f: FichaOnePiece, itens: ItensPorId): boolean => armaEquipadaCom(f, itens, (x) => !!x.kokuto);

/**
 * A rolagem da Técnica com os dados adicionais da Meito: soma `extra` dados do mesmo tipo do primeiro dado da Técnica e limita a soma
 * dos DADOS ao máximo possível da Técnica (`|N`): "o valor extra não pode ultrapassar o máximo de dano da Técnica, sendo usado apenas
 * para ajudar a Técnica a alcançar o máximo". O bônus fixo fica de fora do limite. Sem extra ou sem dados, devolve a expressão igual.
 */
export function comDadosDaMeito(expressao: string, extra: number): string {
    if (extra <= 0) return expressao;
    const dados = [...expressao.matchAll(/(?:^|[+(])\s*(\d*)d(\d+)/gi)];
    if (!dados.length) return expressao;
    const faces = Number(dados[0][2]);
    // máximo da Técnica sem os extras: cada termo de dados da expressão (sem contar os que subtraem)
    const maximo = dados.reduce((s, m) => s + (m[1] === '' ? 1 : Number(m[1])) * Number(m[2]), 0);

    return `${expressao}+${extra}d${faces}|${maximo}`;
}

/**
 * Dados adicionais que a arma Meito equipada dá às Técnicas com arma cortante como requisito (1 Wazamono, 2 Ryo, 3 Ô, 4 Saijo Ô):
 * vale o maior entre as armas equipadas. Espelha `Regras::dadosExtrasDeMeito`.
 */
export function dadosExtrasDeMeito(f: FichaOnePiece, itens: ItensPorId): number {
    let n = 0;
    for (const secao of f.inventario ?? []) {
        for (const ref of secao.itens ?? []) {
            const item = itens[ref.item_id];
            const arma = (item?.dados as DadosItemOnePiece | null | undefined)?.arma;
            if (!item || !arma || !ativo(ref, item) || !armaCabe(arma, f.tamanho)) continue;
            n = Math.max(n, dadosDeTecnicaDaForja(arma.forja));
        }
    }

    return n;
}

/** Armas equipadas (e sintonizadas, se exigir), com os bônus já calculados por `analisar`. */
export function armasAtivas(f: FichaOnePiece, itens: ItensPorId, valores: Record<string, number>): ArmaAtiva[] {
    const armas: ArmaAtiva[] = [];
    for (const secao of f.inventario ?? []) {
        for (const ref of secao.itens ?? []) {
            const item = itens[ref.item_id];
            const arma = (item?.dados as DadosItemOnePiece | null | undefined)?.arma;
            if (!item || !arma || !ativo(ref, item) || !armaCabe(arma, f.tamanho)) continue;
            armas.push({
                itemId: ref.item_id,
                nome: item.nome ?? 'Arma',
                dano: dadosDeDano(f, itens, ref.item_id, valores).join('+'),
                tipoDano: arma.tipoDano ?? null,
                ataque: valores[`arma.${ref.item_id}.ataque`],
                danoBonus: valores[`arma.${ref.item_id}.dano`],
                margem: valores[`arma.${ref.item_id}.margem`],
                etiquetas: etiquetasDaForja(arma.forja),
                expertise: arma.proficiente ? (arma.forja?.expertise ?? []) : [],
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
export function comItemEntregue(f: FichaOnePiece, itemId: number): FichaOnePiece['inventario'] {
    const inventario: FichaOnePiece['inventario'] = JSON.parse(JSON.stringify(f.inventario ?? []));
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
export function bonusProficiencia(f: FichaOnePiece): number {
    return 2 + Math.floor((Number(f.nivel) - 1) / 4) + (f.ajustes?.proficiencia ?? 0);
}

/** Máximo de usos de uma característica: fixo, igual ao bônus de proficiência (`usos.porProf`) ou ao nível (`usos.porNivel`). */
export function usosMax(c: Caracteristica, prof: number, nivel = 0): number {
    if (c.usos?.formula) {
        try {
            return Math.max(0, Math.floor(avaliar(c.usos.formula, { nivel, prof })));
        } catch {
            return c.usos.max;
        }
    }
    if (c.usos?.porNivel) return Math.max(0, nivel);

    return c.usos?.porProf ? Math.max(0, prof) : (c.usos?.max ?? 0);
}

/**
 * Liga ou desliga o buff de uma característica ativa. LIGAR gasta 1 uso (se a característica tem usos): sem usos
 * restantes não liga (devolve null). Desligar não devolve o uso. Passiva não tem interruptor (null).
 */
export function comBuffAlternado(c: Caracteristica, prof = 2, nivel = 0): Caracteristica | null {
    if (c.tipo !== 'ativa') return null;
    if (c.ativa) return { ...c, ativa: false };
    if (c.usos && usosMax(c, prof, nivel) > 0) {
        if (c.usos.atual <= 0) return null;

        return { ...c, ativa: true, usos: { ...c.usos, atual: c.usos.atual - 1 } };
    }

    return { ...c, ativa: true };
}

/**
 * Gastar um dado de vida: o dado rolado (`1dX + mod. CON`, `total`) cura PV (nunca abaixo de 0 nem acima do máximo
 * efetivo) e consome um dado. Vazio se não há dado restante.
 */
export function camposDoDadoDeVida(f: FichaOnePiece, total: number, pvMax: number = f.pv.max): Record<string, unknown> {
    if (f.dadosVida.restantes <= 0) return {};

    return {
        'dadosVida.restantes': f.dadosVida.restantes - 1,
        'pv.atual': Math.min(pvMax, f.pv.atual + Math.max(0, total)),
    };
}

/** Gastar `custo` pontos de poder numa técnica. Sem PP suficiente devolve null (a técnica não é usada). */
export function camposDoGastoDePP(f: FichaOnePiece, custo: number): Record<string, unknown> | null {
    if (f.pp.atual < custo) return null;

    return { 'pp.atual': f.pp.atual - custo };
}

/**
 * Os campos a salvar ao terminar um descanso (vazio se nada muda).
 * - Os dois: desligam os buffs ativos e restauram os usos das características (o curto, só as de `descanso: 'curto'`;
 *   o longo, todas).
 * - Longo: PV até o máximo EFETIVO (com itens e buffs; `pvMax`), pontos de poder até o máximo EFETIVO (`ppMax`),
 *   metade dos dados de vida (mín. 1) e -1 de exaustão.
 */
export function camposDoDescanso(
    f: FichaOnePiece,
    tipo: TipoDescanso,
    pvMax: number = f.pv.max,
    ppMax: number = f.nivel * (f.pp?.porNivel ?? 4),
): Record<string, unknown> {
    const campos: Record<string, unknown> = {};

    const prof = bonusProficiencia(f);
    const antes = f.caracteristicas ?? [];
    const depois = antes.map((c) => {
        const recarrega = c.usos !== undefined && (tipo === 'longo' || (c.descanso ?? 'longo') === 'curto');

        return {
            ...c,
            ...(recarrega ? { usos: { ...c.usos!, max: usosMax(c, prof, f.nivel), atual: usosMax(c, prof, f.nivel) } } : {}),
            ...(c.tipo === 'ativa' && c.ativa ? { ativa: false } : {}),
            // o limite por rodada e a forma alternativa voltam com os usos
            ...(c.usadoNaRodada != null ? { usadoNaRodada: null } : {}),
            ...(c.alternativo && recarrega && tipo === 'longo' ? { alternativo: { ...c.alternativo, atual: c.alternativo.max } } : {}),
        };
    });
    if (JSON.stringify(antes) !== JSON.stringify(depois)) campos.caracteristicas = depois;

    if (tipo === 'longo') {
        if ((f.meito?.usados ?? 0) > 0) campos['meito.usados'] = 0;
        Object.assign(campos, {
            'pv.atual': pvMax,
            'dadosVida.restantes': Math.min(f.nivel, f.dadosVida.restantes + Math.max(1, Math.floor(f.nivel / 2))),
            exaustao: Math.max(0, f.exaustao - 1),
            'pp.atual': ppMax,
            socorrido: false,
        });
    }

    return campos;
}

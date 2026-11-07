// Akuma no Mi (cap. 6): Aspectos Inatos, tipos de usuário, Manifestações de Poder Especiais e Despertar.
// Dados puros (sem Vue); os ids e os limites são espelhados em `app/Sistemas/OnePiece/dados/akuma.json` (gerado por script).
import type { TracoDados } from '../construtor/dados/tipos.ts';

export type TipoDoFruto = 'logia' | 'paramecia' | 'zoan';
export type SubtipoZoan = 'comum' | 'ancestral' | 'mitica';
export type CategoriaDoFruto = 's' | 'a' | 'b' | 'c';
export type TipoDeDespertar = 'aprimorador' | 'transmutador' | 'holista';

export const CATEGORIAS_DO_FRUTO: { id: CategoriaDoFruto; nome: string; atributo: number }[] = [
    { id: 's', nome: 'Categoria S', atributo: 20 },
    { id: 'a', nome: 'Categoria A', atributo: 19 },
    { id: 'b', nome: 'Categoria B', atributo: 18 },
    { id: 'c', nome: 'Categoria C', atributo: 17 },
];

/** Propriedades do fruto e os atributos que o despertar exige (qualquer um deles serve). */
export const PROPRIEDADES: { id: string; nome: string; atributos: string[] }[] = [
    { id: 'corporal', nome: 'Corporal', atributos: ['for', 'con'] },
    { id: 'criacao', nome: 'Criação', atributos: ['pre', 'sab'] },
    { id: 'espaco-temporal', nome: 'Espaço-Temporal', atributos: ['sab', 'des'] },
    { id: 'extracorporal', nome: 'Extracorporal', atributos: ['von', 'pre'] },
    { id: 'manipulacao', nome: 'Manipulação', atributos: ['des', 'von'] },
    { id: 'transformacao', nome: 'Transformação', atributos: ['con', 'for'] },
];

export const TIPOS_DE_DESPERTAR: { id: TipoDeDespertar; nome: string }[] = [
    { id: 'aprimorador', nome: 'Despertar Aprimorador' },
    { id: 'transmutador', nome: 'Despertar Transmutador' },
    { id: 'holista', nome: 'Despertar Holista' },
];

const t = (x: TracoDados): TracoDados => x;

/** 6.10 – Aspectos Inatos (uma característica de cada tipo de fruto). */
export const ASPECTOS: Record<'logia' | 'paramecia' | 'zoan' | 'zoan-mitica-alternativo', TracoDados[]> = {
    logia: [
        t({
            id: 'corpo-elemental',
            nome: 'Corpo Elemental',
            descricao:
                'Desde o 1º nível (ou ao consumir o fruto) você recebe uma Técnica Auxiliar adicional, composta exclusivamente pelas características do efeito "Power Up" (crie em Criar técnica, origem "Aspecto Inato"), podendo modificá-la sempre que subir 1 nível. Seu corpo fica permanentemente transformado no elemento do fruto, com a Intangibilidade.',
        }),
        t({
            id: 'intangibilidade-reacao',
            nome: 'Intangibilidade (antes do 6º nível)',
            descricao:
                'Seu corpo não pode ser tocado por ataques normais, inclusive os que ignoram Resistência ou Invulnerabilidade, exceto se forem fortalecidos pelo Haki do Armamento, realizados com Kairoseki ou desferidos por um inimigo natural do elemento (definido pelo Narrador). Antes do 6º nível você ativa a Intangibilidade como reação, até o início do seu próximo turno, um número de vezes igual ao seu nível, recuperando os usos em um descanso curto ou longo.',
            tipo: 'ativa',
            acao: 'reacao',
            usos: { porNivel: true, descanso: 'curto' },
            nivelMax: 5,
        }),
        t({
            id: 'intangibilidade',
            nome: 'Intangibilidade',
            descricao:
                'Controle total (6º nível em diante): o corpo do usuário não pode ser tocado por ataques normais, inclusive os que ignoram Resistência ou Invulnerabilidade, exceto se forem fortalecidos pelo Haki do Armamento, realizados com Kairoseki ou desferidos por um inimigo natural do elemento (definido pelo Narrador).',
            nivelMin: 6,
        }),
    ],
    paramecia: [
        t({
            id: 'uso-alternativo',
            nome: 'Uso Alternativo',
            descricao:
                'Você usa suas habilidades da forma mais criativa possível: pode usar uma Técnica de Combate de qualquer grau ou Técnica Auxiliar sem gastar nenhum Ponto de Poder, desde que a duração seja "Instantânea". Não pode ser usada de novo até o término de um descanso longo.',
            usos: { max: 1, descanso: 'longo' },
        }),
    ],
    zoan: [
        t({
            id: 'vigor-animalesco',
            nome: 'Vigor Animalesco',
            descricao:
                'A modificação corporal da Zoan dá um controle da vitalidade inimaginável: recupere Pontos de Vida igual a 20 + seu nível de personagem ou 1 Nível de Exaustão (nenhuma ação é necessária). Não pode ser usada de novo até o término de um descanso longo.',
            usos: { max: 1, descanso: 'longo' },
            acoes: [{ rotulo: 'Recuperar 20 + nível PV', tipo: 'recuperar', recurso: 'pv', rolagem: '20+@nivel', usa: true }],
        }),
    ],
    'zoan-mitica-alternativo': [
        t({
            id: 'uso-alternativo',
            nome: 'Uso Alternativo',
            descricao:
                'Aspecto Inato alternativo das Zoan Míticas (no lugar do Vigor Animalesco): você pode usar uma Técnica de Combate de qualquer grau ou Técnica Auxiliar sem gastar nenhum Ponto de Poder, desde que a duração seja "Instantânea". Não pode ser usada de novo até o término de um descanso longo.',
            usos: { max: 1, descanso: 'longo' },
        }),
    ],
};

/** Quem pode escolher a MP Especial: Logia, categoria A ou S, ou Logia/estágio desperto. */
export type RestricaoDeMP = '' | 'logia' | 'categoria' | 'logia-ou-desperto';

export interface MPEspecial {
    id: string;
    restricao: RestricaoDeMP;
    traco: TracoDados;
}

/** 6.9 – Manifestações de Poder Especiais (ignoram as regras de Ponto Virtual). */
export const MP_ESPECIAIS: MPEspecial[] = [
    {
        id: 'arauto-do-desastre',
        restricao: 'logia',
        traco: t({
            id: 'arauto-do-desastre',
            nome: 'Arauto do Desastre',
            descricao:
                '(Apenas Logia) Usar Técnicas que causem danos em uma área de efeito recebem um valor de redução de PP igual ao grau da Técnica (mínimo de 1 PP). Essa redução não conta para o máximo de redução que uma Técnica pode ter.',
        }),
    },
    {
        id: 'dano-extremo',
        restricao: 'logia',
        traco: t({
            id: 'dano-extremo',
            nome: 'Dano Extremo',
            descricao:
                '(Apenas Logia) Sempre que usar uma Técnica da sua Akuma no Mi, um único tipo de dano escolhido por você: ignora Resistências e Invulnerabilidades (mesmo vindas do Haki do Armamento); não pode ser reduzido por efeitos de "Contenção de Dano" com alcance "Pessoal"; não pode ter o dano transferido para PV temporários; e o valor dos dados desse dano sempre causa, no mínimo, metade do valor total.',
        }),
    },
    {
        id: 'dano-implacavel',
        restricao: 'categoria',
        traco: t({
            id: 'dano-implacavel',
            nome: 'Dano Implacável',
            descricao:
                '(Categoria A ou S) O dano das Técnicas da Akuma no Mi causa o dobro do dano em estruturas, ignora resistências e causa metade do dano em invulnerabilidades.',
        }),
    },
    {
        id: 'destruidor',
        restricao: 'categoria',
        traco: t({
            id: 'destruidor',
            nome: 'Destruidor',
            descricao:
                '(Categoria A ou S) Sempre que usa as Técnicas da Akuma no Mi, elas causam 4 vezes mais dano em estruturas e dobram o alcance das Técnicas que não sejam de toque ou pessoal.',
        }),
    },
    {
        id: 'invulnerabilidade-parcial',
        restricao: '',
        traco: t({
            id: 'invulnerabilidade-parcial',
            nome: 'Invulnerabilidade Parcial',
            descricao:
                'O corpo do usuário é modificado permanentemente: ele pode ser Invulnerável a 1 tipo de dano ou Resistente a até 3 tipos diferentes de dano. Exceto ataques fortalecidos com Haki do Armamento, com o uso de Kairoseki ou desferidos pelo inimigo natural (escolhido pelo Narrador).',
        }),
    },
    {
        id: 'potencializador-ofensivo',
        restricao: '',
        traco: t({
            id: 'potencializador-ofensivo',
            nome: 'Potencializador Ofensivo',
            descricao:
                'Uma vez por rodada, com uma ação bônus, você pode adicionar 1d10 de dano extra (tipo de acordo com a Akuma no Mi) em uma jogada de ataque (comum ou Técnicas). Alternativamente, pode usar junto da jogada de ataque, sem ação bônus, até 5 vezes, recuperando todos os usos em um descanso longo. Só vale uma vez por rodada (forma padrão ou alternativa), inclusive com características semelhantes como o Benefício da Espécie "Heat"/"Electro".',
            tipo: 'ativa',
            acao: 'bonus',
            alternativo: 5,
            usos: { max: 5, descanso: 'longo' },
            grupoRodada: 'ofensivo',
        }),
    },
    {
        id: 'habilidade-refinada',
        restricao: '',
        traco: t({
            id: 'habilidade-refinada',
            nome: 'Habilidade Refinada',
            descricao:
                'Ao executar uma Técnica que tenha a Akuma no Mi como requisito, escolha uma: vantagem na sua jogada de ataque (Técnicas) executada diretamente pela Técnica; impor desvantagem em uma Salvaguarda qualquer; ou escolher quais criaturas são afetadas dentro da área da Técnica.',
        }),
    },
    {
        id: 'potencializacao-elemental',
        restricao: 'logia-ou-desperto',
        traco: t({
            id: 'potencializacao-elemental',
            nome: 'Potencialização Elemental',
            descricao:
                '(Apenas Logia ou MP Desperta) Sempre que usar uma Técnica da Akuma no Mi, com uma ação bônus escolha: se a Técnica causa dano, imponha uma condição (condizente com o elemento, que custe até 2 PP) em até 3 criaturas que não passem numa Salvaguarda de Constituição, desde que tenham falhado numa primeira Salvaguarda ou sido atingidas por uma jogada de ataque (Técnicas); Cone: +6 m de área; Esfera ou Cilindro: +3 m; Linha: +12 m de comprimento ou +1,5 m de largura; ou +1 dado no dano da Técnica.',
            acao: 'bonus',
        }),
    },
    {
        id: 'orbes',
        restricao: '',
        traco: t({
            id: 'orbes',
            nome: 'Orbes',
            descricao:
                'Ao tocar em uma estrutura ou objeto condizente com seus poderes (rochas, espadas, balas de canhão...) ou criando esses objetos, você pode fazê-lo orbitar ao seu redor (um "Orbe") até desfazer o efeito (sem ação). Mantém simultaneamente um número de orbes igual ao seu modificador de Destreza. Forma Defensiva: ao ser alvo de jogada de ataque, reação para reduzir o dano em 2d8 (o orbe é destruído). Forma Ofensiva: ação bônus, +1 dado de dano em uma Técnica (o orbe é destruído). Forma Espacial: ação bônus, move um orbe por 9 m a qualquer espaço a até 15 m de você; ele pode sustentar uma criatura, objeto ou estrutura Grande ou menor. Forma Estratégica: ação bônus, atrapalha uma criatura a até 9 m que você veja e ganha vantagem na próxima jogada de ataque (comum) contra ela (o orbe é destruído).',
        }),
    },
];

export const mpEspecialPorId = (id: string): MPEspecial | undefined => MP_ESPECIAIS.find((m) => m.id === id);

/** Características do tipo de usuário (6.11): benefícios por simples/avançado e por despertar. */
export const BENEFICIOS_DE_USUARIO: Record<'simples' | 'avancado' | 'simples-desperto' | 'avancado-desperto', TracoDados[]> = {
    simples: [
        t({
            id: 'tecnica-preparada',
            nome: 'Técnica Preparada',
            descricao:
                'Técnicas de Combate de 1º grau da Akuma no Mi podem ser executadas sem custo de PP, um número de vezes igual ao seu Bônus de Proficiência. Recupera todos os usos ao término de um descanso curto ou longo.',
            usos: { porProf: true, descanso: 'curto' },
        }),
        t({
            id: 'finesse',
            nome: 'Finesse',
            descricao:
                'Técnicas de Combate que não se beneficiem do efeito "Técnica Não Ofensiva" podem ser executadas com redução de custo igual à metade do grau da Técnica (para baixo, redução mínima de 1 PP). Não é possível reduzir uma Técnica a menos de 1 PP com esta característica.',
        }),
        t({
            id: 'limitacao-autoimposta',
            nome: 'Limitação Autoimposta',
            descricao: 'Usuários simples não podem aprender novas Técnicas de Akuma no Mi com o treinamento "Genialidade Inusitada".',
        }),
    ],
    avancado: [
        t({
            id: 'usuario-avancado',
            nome: 'Usuário Avançado',
            descricao:
                'Manifestação de Poder Extra (2 MPs desde o 1º nível), Aprimoração Extra (Técnicas de 4º e 5º grau nos níveis 9 e 12) e Técnicas Auxiliares Extra (no 1º e 12º nível).',
        }),
    ],
    'simples-desperto': [
        t({
            id: 'recuperacao-forcada',
            nome: 'Recuperação Forçada',
            descricao:
                'Durante o estágio desperto, com uma ação bônus você recupera 10 Pontos de Poder. Não pode ser usada de novo até o término de um descanso longo.',
            tipo: 'ativa',
            acao: 'bonus',
            usos: { max: 1, descanso: 'longo' },
            acoes: [{ rotulo: 'Recuperar 10 PP', tipo: 'recuperar', recurso: 'pp', rolagem: '10', usa: true, acao: 'bonus' }],
        }),
    ],
    'avancado-desperto': [
        t({
            id: 'aperfeicoamento',
            nome: 'Aperfeiçoamento',
            descricao:
                'Os dados das Técnicas aumentam em um passo (1 → 1d4 → 1d6 → 1d8 → 1d10 → 1d12). Não se acumula com outras características de mesmo efeito. Também recebe uma terceira Manifestação de Poder durante o estágio desperto.',
        }),
    ],
};

/** Estágio Desperto de Logia e Paramecia. */
export const ESTAGIO_DESPERTO: TracoDados[] = [
    t({
        id: 'liberacao-cansativa',
        nome: 'Liberação Cansativa',
        descricao:
            'Enquanto estiver no Estágio Desperto, 1 PP é consumido ao final de cada um dos seus turnos (sempre ao menos 1 PP, mesmo que entre e saia antes do fim do turno). Ao chegar a 0 PP, o estágio se encerra.',
    }),
    t({
        id: 'novo-patamar',
        nome: 'Novo Patamar',
        descricao:
            'No Estágio Desperto você recebe e pode executar Técnicas de Combate de 6º e 7º grau (níveis 16 e 20), além de duas Técnicas Auxiliares correspondentes.',
    }),
    t({
        id: 'explosao-de-poder',
        nome: 'Explosão de Poder',
        descricao:
            'No Estágio Desperto você pode escolher recuperar 10 Pontos de Poder. Não pode ser usada de novo até o término de um descanso longo.',
        usos: { max: 1, descanso: 'longo' },
        acoes: [{ rotulo: 'Recuperar 10 PP', tipo: 'recuperar', recurso: 'pp', rolagem: '10', usa: true, acao: 'bonus' }],
    }),
    t({
        id: 'impeto-desperto',
        nome: 'Ímpeto Desperto',
        descricao:
            'No Estágio Desperto, ao usar uma Técnica de Combate da sua Akuma no Mi que cause dano diretamente contra uma criatura e tenha como requisito uma "Ação Poderosa", você pode fazer uma jogada de ataque (comum) contra a criatura alvo, como parte dessa mesma ação poderosa. Até 3 vezes; recupera todos os usos em um descanso longo (não acumula com o "Ímpeto Antecipado" do Haki da Observação).',
        usos: { max: 3, descanso: 'longo' },
    }),
];

export const DESPERTARES: Record<TipoDeDespertar, TracoDados[]> = {
    aprimorador: [
        t({
            id: 'corpo-aprimorado',
            nome: 'Corpo Aprimorado',
            descricao:
                'Durante o estágio desperto, seu máximo de PP aumenta em 10 e o de PV em 50. Ao sair do estágio os máximos voltam ao normal (PP/PV atuais acima do máximo são reduzidos). Ligue o interruptor ao entrar no Estágio Desperto e desligue ao sair.',
            tipo: 'ativa',
            efeitos: [
                { alvo: 'pp.max', modo: 'soma', valor: 10 },
                { alvo: 'pv.max', modo: 'soma', valor: 50 },
            ],
        }),
        t({
            id: 'transformacao-sustentavel',
            nome: 'Transformação Sustentável',
            descricao:
                'Ao usar uma Técnica de Combate da sua Akuma no Mi que não tenha o "Estágio Desperto" como requisito, reduza o custo em PP em metade do grau da Técnica (para baixo, mínimo 1 PP de custo).',
        }),
    ],
    transmutador: [
        t({
            id: 'tecnicas-abrangentes',
            nome: 'Técnicas Abrangentes',
            descricao:
                'Ao realizar uma Técnica da sua Akuma no Mi, você pode receber vantagem na jogada de ataque (Técnicas) ou causar desvantagem em uma Salvaguarda que a Técnica impuser.',
        }),
        t({
            id: 'area-afetada',
            nome: 'Área Afetada',
            descricao:
                'Você transforma uma esfera a até 9 m de você com as propriedades do fruto (espessura de 1,5 m em objetos/chão/parede), tendo você como centro. Ao usar qualquer Técnica da Akuma no Mi escolha: Execução Espacial (executa uma Técnica como se estivesse em um ponto da área); Transformação Ofensiva (cada criatura à sua escolha na área passa em Salvaguarda do Narrador, CD das Técnicas, ou sofre 5d8 de dano); Transformação Defensiva (+3 de CR até o final do turno de cada criatura à sua escolha na área); Transformação Variada (Salvaguarda ou uma condição/efeito de até 3 PP). Usos iguais ao Bônus de Proficiência, recuperados em um descanso longo.',
            usos: { porProf: true, descanso: 'longo' },
        }),
    ],
    holista: [
        t({
            id: 'controle-supremo',
            nome: 'Controle Supremo',
            descricao: 'Você escolhe um atributo fixo para ter o valor mudado para 30 enquanto estiver no estágio desperto.',
        }),
        t({
            id: 'efeito-variavel',
            nome: 'Efeito Variável',
            descricao:
                'Ao entrar no Estágio Desperto você escolhe um dos efeitos do Despertar Aprimorador ou do Transmutador. Pode escolher um novo efeito após um descanso curto ou longo.',
        }),
    ],
};

/** Plano de MPs por tipo de usuário (cap. 6.11, 6.12, 6.13). */
export function manifestacoesDoFruto(tipo: TipoDoFruto | '', zoan: SubtipoZoan | '', usuario: 'simples' | 'avancado', desperto: boolean): number {
    if (tipo === 'zoan') {
        return zoan === 'mitica' ? (desperto ? 2 : 1) : 0;
    }
    if (tipo === 'logia' || tipo === 'paramecia') {
        return usuario === 'avancado' ? (desperto ? 3 : 2) : 1;
    }

    return 0;
}

/** O que o usuário atende para o despertar (16º nível): valor de atributo pela categoria e propriedades do fruto. */
export function requisitoDoDespertar(categoria: CategoriaDoFruto | '', propriedades: string[]): { valor: number; atributos: string[] } | null {
    const c = CATEGORIAS_DO_FRUTO.find((x) => x.id === categoria);
    if (!c || !propriedades.length) {
        return null;
    }
    const atributos = [...new Set(propriedades.flatMap((p) => PROPRIEDADES.find((x) => x.id === p)?.atributos ?? []))];

    return { valor: c.atributo, atributos };
}

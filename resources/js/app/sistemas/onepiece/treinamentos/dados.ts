/**
 * Treinamentos (cap. 5.7) e Códigos de Honra (5.8). Arquivo PURO (sem Vue): o Node o executa direto nos testes. O que o
 * PHP precisa (custo, atributo mínimo, espécie, pré-requisito, repetição) está espelhado em
 * `app/Sistemas/OnePiece/dados/treinamentos.json` e conferido por teste; textos e efeitos ficam só aqui.
 */
import type { TracoDados } from '../construtor/dados/tipos.ts';
import type { AtributoId, Tecnica } from '../regras.ts';

export type CategoriaTreinamento = 'geral' | 'arma' | 'especie';
export type DificuldadeTreinamento = 'simples' | 'intermediario' | 'complexo';

export const NOMES_CATEGORIA: Record<CategoriaTreinamento, string> = { geral: 'Gerais', arma: 'Com Arma', especie: 'De Espécie' };
export const NOMES_DIFICULDADE: Record<DificuldadeTreinamento, string> = {
    simples: 'Simples',
    intermediario: 'Intermediários',
    complexo: 'Complexos',
};

/** Uma escolha que o treinamento pede ao ser concluído (Corredor, Autoaperfeiçoamento, Resiliência). */
export interface EscolhaDoTreinamento {
    rotulo: string;
    opcoes: { id: string; nome: string }[];
}

export type TecnicaDeTreinamento = Omit<Tecnica, 'builder'>;

export interface Treinamento {
    id: string;
    nome: string;
    categoria: CategoriaTreinamento;
    dificuldade: DificuldadeTreinamento;
    /** Só para essa espécie (ou mestiços dela): nome como o assistente grava em `especie`. */
    especie?: string;
    dias: number;
    pt: number;
    tutor: boolean;
    /** Basta UM destes atributos atingir `minimo`. */
    atributos: AtributoId[];
    minimo: number;
    /** Requisito adicional em texto (ferramenta, Akuma no Mi, variante da espécie...): o mestre confere ao concluir. */
    adicional?: string;
    /** Treinamento que precisa já estar aprendido. */
    requer?: string;
    /** Pode ser aprendido de novo (Autoaperfeiçoamento, Genialidade Inusitada). */
    repetivel?: boolean;
    escolha?: EscolhaDoTreinamento;
    texto: string;
    /** As características que ele dá (todas `builder: 'treinamento'`). */
    tracos: TracoDados[];
    tecnicas?: TecnicaDeTreinamento[];
}

const ATR_TODOS: AtributoId[] = ['for', 'des', 'con', 'sab', 'pre', 'von'];
const t = (id: string, nome: string, descricao: string, extra: Partial<TracoDados> = {}): TracoDados => ({ id, nome, descricao, ...extra });
const longo = (max: number) => ({ max, descanso: 'longo' as const });
const curto = (max: number) => ({ max, descanso: 'curto' as const });

/** Um treinamento com uma única característica (a maioria): o texto do livro vira a descrição dela. */
function treino(d: Omit<Treinamento, 'tracos' | 'texto'> & { texto: string; extra?: Partial<TracoDados>; tracos?: TracoDados[] }): Treinamento {
    const { extra, tracos, ...resto } = d;

    return { ...resto, tracos: tracos ?? [t(d.id, d.nome, d.texto, extra ?? {})] };
}

// ---------------------------------------------------------------------------------------------------------------------
// TREINAMENTOS GERAIS
// ---------------------------------------------------------------------------------------------------------------------
const GERAIS: Treinamento[] = [
    treino({
        id: 'apostador',
        nome: 'Apostador',
        categoria: 'geral',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['sab', 'von'],
        minimo: 16,
        texto: 'Você vive no fio da navalha. Antes de saber se uma Técnica de Combate com jogada de ataque (Técnicas) acertou ou falhou, pode se arriscar e jogar um d6: 1 a 3, a Técnica falha em acertar; 4, escolha entre 1 dado de dano extra ou recuperar 1 PP; 5, 2 dados extras ou 2 PP; 6, 3 dados extras ou 3 PP.',
        extra: { acoes: [{ rotulo: 'Arriscar (d6)', tipo: 'rolar', rolagem: '1d6', acao: 'livre' }] },
    }),
    treino({
        id: 'bom-nadador',
        nome: 'Bom Nadador',
        categoria: 'geral',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['for', 'con'],
        minimo: 14,
        texto: "Você faz manobras e muda a velocidade livremente dentro d'água: deslocamento de natação de 15 m; sem penalidades de criaturas não aquáticas; prende a respiração por até 10 minutos; vantagem em Salvaguardas de Constituição para manter a respiração presa, mesmo ao receber dano. Usuários que comerem uma Akuma no Mi podem trocar este aprimoramento pelos mesmos PT gastos.",
        extra: { efeitos: [{ alvo: 'movimento.nado', modo: 'min', valor: 150 }], etiquetas: ['Natação 15 m', 'Respira preso por 10 min'] },
    }),
    treino({
        id: 'corredor',
        nome: 'Corredor',
        categoria: 'geral',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['for', 'con'],
        minimo: 15,
        texto: 'Você adquire disposição e fôlego acima do comum para corridas, independentemente dos atributos físicos. Escolha uma opção: Corrida de Obstáculos (sem penalidade de deslocamento por terreno difícil) ou Corrida de Longa Distância (deslocamento normal de 15 m).',
        escolha: {
            rotulo: 'Opção',
            opcoes: [
                { id: 'obstaculos', nome: 'Corrida de Obstáculos' },
                { id: 'longa', nome: 'Corrida de Longa Distância' },
            ],
        },
    }),
    treino({
        id: 'desarmador',
        nome: 'Desarmador',
        categoria: 'geral',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: true,
        atributos: ['for', 'des'],
        minimo: 16,
        texto: 'Uma vez por rodada, você pode trocar o dano de um ataque (comum) corpo a corpo por uma tentativa de desarme: a criatura atingida faz Salvaguarda de Destreza CD 18 ou a arma cai a até 1,5 m dela. Em acerto crítico natural o alvo é desarmado sem Salvaguarda. Com uma ação bônus, você puxa e pega a arma (com ao menos uma mão livre).',
        extra: { etiquetas: ['1×/rodada: desarmar no lugar do dano (CD 18)'] },
    }),
    treino({
        id: 'improvisador',
        nome: 'Improvisador',
        categoria: 'geral',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['sab'],
        minimo: 14,
        texto: 'Você resolve problemas que exigem um material que não possui, usando algo que adaptou. Descreva ao Narrador como improvisa e, se ele aprovar, faça um Teste de Sabedoria para ver se deu certo.',
    }),
    treino({
        id: 'jogador-experiente',
        nome: 'Jogador Experiente',
        categoria: 'geral',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: true,
        atributos: ['sab', 'von'],
        minimo: 14,
        texto: 'O treinamento de um profissional dos jogos de azar: descobre se o jogo foi manipulado, identifica os melhores e piores jogadores ou estima as chances de uma situação delicada. Você tem vantagem em Testes de Vontade (Intuição) ligados a jogos de azar.',
    }),
    treino({
        id: 'ladrao',
        nome: 'Ladrão',
        categoria: 'geral',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['des', 'sab'],
        minimo: 16,
        texto: 'Se o Narrador permitir, faça um Teste de Destreza (Prestidigitação) CD 16 para pegar um objeto específico de uma criatura sem que ela perceba (em caso de falha, repita o teste para que ela não perceba a tentativa). Se existir, um Teste de Vontade (Percepção) CD 14 acha onde os ladrões se reúnem, onde se compram informações e equipamentos de difícil acesso.',
    }),
    treino({
        id: 'genialidade-inusitada',
        nome: 'Genialidade Inusitada',
        categoria: 'geral',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['con', 'sab'],
        minimo: 12,
        repetivel: true,
        texto: 'Você cria uma nova Técnica de Combate de 1º Grau para o seu Estilo de Combate ou Akuma no Mi (Cap. 3 ou 6). Depois de fazê-lo ao menos uma vez, pode treinar de novo para mais Técnicas (ou Points, numa Zoan), subindo de grau: 2º grau/Point, 1 PT e 5 dias; 3º, 4º e 5º grau/Point, 2 PT e 10 dias cada; 6º e 7º grau, 3 PT e 15 dias cada. A técnica nova você cria na aba Técnicas.',
        extra: { etiquetas: ['Cria uma Técnica nova (aba Técnicas)'] },
    }),
    treino({
        id: 'soru',
        nome: 'Soru',
        categoria: 'geral',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: true,
        atributos: ['for', 'des'],
        minimo: 18,
        texto: 'Você pode executar a Técnica Auxiliar "Soru" do Estilo de Combate "Rokushiki".',
    }),
    treino({
        id: 'entusiasta-de-plantas',
        nome: 'Entusiasta de Plantas',
        categoria: 'geral',
        dificuldade: 'intermediario',
        dias: 10,
        pt: 3,
        tutor: true,
        atributos: ['des', 'sab'],
        minimo: 18,
        texto: 'Conhecimento vasto da flora do mundo: em Testes de História, Intuição, Investigação, Percepção, Prestidigitação e Sobrevivência ligados ao mundo vegetal, você tem vantagem. Também pode usar e cultivar as sementes Pop Green (Guia do Narrador).',
    }),
    treino({
        id: 'combatente-montado',
        nome: 'Combatente Montado',
        categoria: 'geral',
        dificuldade: 'intermediario',
        dias: 10,
        pt: 3,
        tutor: false,
        atributos: ['for', 'des'],
        minimo: 13,
        texto: 'Você doma qualquer animal que não seja lendário ou abissal e propício à montaria com um Teste de Presença (Persuasão) CD 12 + ND da criatura. Montado e capaz de agir, tem vantagem em ataques (comum) corpo a corpo contra criaturas desmontadas menores que a montaria. Pode forçar o dano direcionado à montaria a vir para você; se ela for alvo de efeito com Salvaguarda de Destreza para metade do dano, não sofre dano se passar e só metade se falhar.',
    }),
    treino({
        id: 'copiador',
        nome: 'Copiador',
        categoria: 'geral',
        dificuldade: 'intermediario',
        dias: 10,
        pt: 3,
        tutor: false,
        atributos: ['des', 'sab'],
        minimo: 17,
        texto: 'Depois de observar uma Técnica de Combate ou Auxiliar ao menos duas vezes, você a replica como se fosse sua, se tiver os mesmos requisitos ou os compensar (com a aprovação do Narrador). Guarda até 3 Técnicas na memória, usadas por PP igual ao da original + 1; pode trocar uma a qualquer momento. As Salvaguardas usam o cálculo do seu Estilo de Combate. Não copia Técnicas que deem outras Técnicas, características de Akuma no Mi ou Características de Combate que você não tenha.',
        extra: { etiquetas: ['Memoriza até 3 Técnicas observadas (custo + 1 PP)'] },
    }),
    treino({
        id: 'controle-corporal',
        nome: 'Controle Corporal',
        categoria: 'geral',
        dificuldade: 'intermediario',
        dias: 10,
        pt: 3,
        tutor: false,
        atributos: ['des', 'con'],
        minimo: 16,
        texto: 'Domínio total do corpo: controla cabelo ou barba como mão, braço ou perna (Técnicas e ataques de alcance "Toque"); não fica "Impedido" sem estar com os cabelos presos ou cortados; controla o metabolismo (engorda ou emagrece em minutos). Usuário de Zoan na forma híbrida, com uma ação bônus, assume por até 1 minuto: Corpo Largo (Técnicas com 1 dado de dano adicional), Corpo Magro (+1 nos ataques (comum)) ou Corpo Grande (20 PV temporários). Uma forma por vez, até 3 usos (cada troca gasta 1); voltam após um descanso longo.',
        extra: { usos: longo(3), acao: 'bonus' },
    }),
    treino({
        id: 'especialista-em-combate-aereo',
        nome: 'Especialista em Combate Aéreo',
        categoria: 'geral',
        dificuldade: 'intermediario',
        dias: 10,
        pt: 3,
        tutor: false,
        atributos: ['for', 'des'],
        minimo: 15,
        texto: 'No ar, ao se deslocar contra a gravidade, não há penalidade de 1,5 m a cada 1,5 m; vantagem em todos os ataques (comum) lutando no ar, em Salvaguardas de Destreza e em testes para não cair. Contra criatura também no ar, o teste dela para não cair por causa dos seus ataques é feito com desvantagem. Em Técnicas que gastam PP para voo, gaste 1 PP a mais para voo de 9 m por 1 minuto.',
    }),
    treino({
        id: 'estrategista',
        nome: 'Estrategista',
        categoria: 'geral',
        dificuldade: 'intermediario',
        dias: 10,
        pt: 3,
        tutor: false,
        atributos: ['sab', 'pre'],
        minimo: 16,
        texto: 'Capacidade tática notável: quem segue seus planos recebe +2 em todos os Testes de Atributo e Salvaguardas enquanto os acontecimentos estiverem dentro do planejado. O bônus se perde quando o plano é abandonado ou os fatos se desviam muito do previsto.',
    }),
    treino({
        id: 'geppo',
        nome: 'Geppo',
        categoria: 'geral',
        dificuldade: 'intermediario',
        dias: 10,
        pt: 3,
        tutor: true,
        atributos: ['for', 'des'],
        minimo: 18,
        texto: 'Você pode executar a Técnica Auxiliar "Geppo" do Estilo de Combate "Rokushiki".',
    }),
    treino({
        id: 'kamie',
        nome: 'Kamie',
        categoria: 'geral',
        dificuldade: 'intermediario',
        dias: 10,
        pt: 3,
        tutor: true,
        atributos: ['des'],
        minimo: 18,
        texto: 'Você pode executar a Técnica Auxiliar "Kamie" do Estilo de Combate "Rokushiki".',
    }),
    treino({
        id: 'resistencia-a-kairoseki',
        nome: 'Resistência à Kairoseki',
        categoria: 'geral',
        dificuldade: 'intermediario',
        dias: 10,
        pt: 3,
        tutor: false,
        atributos: ['con', 'von'],
        minimo: 16,
        adicional: 'Usuário de Akuma no Mi',
        texto: 'Exclusivo para usuários de Akuma no Mi. Com a condição "Enfraquecido" aplicada só pelo contato com kairoseki (não pelo mar), as características normais dela são trocadas por: deslocamento −3 m, sem bônus de deslocamento e natação 0; sem reações e ações poderosas; incapaz de usar Técnicas ou características de Akuma no Mi; desvantagem em Testes de Força; no máximo 2 ataques por rodada com "Atacar"; desvantagem em Salvaguardas de Força e Constituição. A condição acaba se a causa for removida.',
    }),
    treino({
        id: 'tekkai',
        nome: 'Tekkai',
        categoria: 'geral',
        dificuldade: 'intermediario',
        dias: 10,
        pt: 3,
        tutor: true,
        atributos: ['for', 'con'],
        minimo: 18,
        texto: 'Você pode executar a Técnica Auxiliar "Tekkai" do Estilo de Combate "Rokushiki".',
    }),
    treino({
        id: 'tecnica-as',
        nome: 'Técnica Ás',
        categoria: 'geral',
        dificuldade: 'intermediario',
        dias: 10,
        pt: 3,
        tutor: false,
        atributos: ['for', 'des'],
        minimo: 14,
        texto: 'Escolha uma Técnica de Combate: você tem vantagem nas jogadas de ataque (Técnicas) com ela ou impõe desvantagem na Salvaguarda que ela exige, e rola os dados de dano duas vezes ficando com o maior. Vale só para a forma base (não para a Forma Alternativa nem a Aperfeiçoada). Você pode trocar a Técnica escolhida sempre que subir de nível.',
        extra: { etiquetas: ['Técnica Ás: vantagem e dano rolado 2× (o maior)'] },
    }),
    treino({
        id: 'algoz-de-usuarios-de-akuma-no-mi',
        nome: 'Algoz de Usuários de Akuma no Mi',
        categoria: 'geral',
        dificuldade: 'complexo',
        dias: 15,
        pt: 5,
        tutor: false,
        atributos: ['von'],
        minimo: 15,
        texto: 'Vantagem em Salvaguardas contra efeitos e condições de Akuma no Mi de outras criaturas, somando o Bônus de Proficiência a elas. Ao falhar numa Salvaguarda contra habilidade de Akuma no Mi, pode considerá-la um sucesso (até 3 usos; voltam após um descanso longo). Ao terminar, você adquire ou encontra uma arma especial projetada contra usuários de Akuma no Mi, que os afeta em ataques (comum ou Técnicas) corpo a corpo; o Narrador decide como.',
        extra: { usos: longo(3), acoes: [{ rotulo: 'Tratar a Salvaguarda como sucesso', tipo: 'gastar', usa: true, acao: 'livre' }] },
    }),
    treino({
        id: 'arte-do-tempo',
        nome: 'Arte do Tempo',
        categoria: 'geral',
        dificuldade: 'complexo',
        dias: 15,
        pt: 5,
        tutor: false,
        atributos: ['sab'],
        minimo: 19,
        texto: 'Você estuda os fenômenos climáticos (nuvens, chuvas, tempestades, furacões, raios, ventos) e fica apto a manipular o Clima-Tact, com as regras do Guia do Narrador.',
    }),
    treino({
        id: 'autoaperfeicoamento',
        nome: 'Autoaperfeiçoamento',
        categoria: 'geral',
        dificuldade: 'complexo',
        dias: 15,
        pt: 5,
        tutor: false,
        atributos: ATR_TODOS,
        minimo: 16,
        repetivel: true,
        escolha: {
            rotulo: 'Atributo',
            opcoes: [
                { id: 'for', nome: 'Força' },
                { id: 'des', nome: 'Destreza' },
                { id: 'con', nome: 'Constituição' },
                { id: 'sab', nome: 'Sabedoria' },
                { id: 'pre', nome: 'Presença' },
                { id: 'von', nome: 'Vontade' },
            ],
        },
        texto: 'Você se concentra nas próprias fraquezas: o atributo escolhido (Força, Destreza, Constituição, Sabedoria, Presença ou Vontade) recebe +1 permanente, sem passar de 20 por este treinamento. Pode ser escolhido várias vezes.',
        extra: { etiquetas: ['+1 permanente no atributo escolhido (máx. 20)'] },
    }),
    treino({
        id: 'conhecimento-celestial',
        nome: 'Conhecimento Celestial',
        categoria: 'geral',
        dificuldade: 'complexo',
        dias: 15,
        pt: 5,
        tutor: false,
        atributos: ['sab'],
        minimo: 15,
        texto: 'Ao ver Dials (Guia do Narrador) você entende a engenharia e os mecanismos, mesmo alienígenas: identifica, conhece a função e é proficiente no uso de cada dial só de examiná-lo. Num dial com "Absorção Rápida" (que exige "Preparar"), pode usar a reação. Também aciona "Absorção" ou "Liberação" com uma ação bônus.',
    }),
    treino({
        id: 'guerreiro-treinado',
        nome: 'Guerreiro Treinado',
        categoria: 'geral',
        dificuldade: 'complexo',
        dias: 15,
        pt: 5,
        tutor: false,
        atributos: ['for', 'con'],
        minimo: 16,
        texto: 'Você se torna um guerreiro de combate corpo a corpo: o dado do ataque (comum) desarmado vira 1d4 (prevalece o maior, se tiver outro); seus PV totais aumentam em 3 × o Bônus de Proficiência; pode dar o dano máximo de um ataque (comum), se não for crítico (volta após um descanso longo).',
        extra: {
            efeitos: [{ alvo: 'pv.max', modo: 'soma', valor: '3*@prof' }],
            usos: longo(1),
            acoes: [{ rotulo: 'Dano máximo', tipo: 'gastar', usa: true, acao: 'livre' }],
        },
    }),
    treino({
        id: 'hipnotizador',
        nome: 'Hipnotizador',
        categoria: 'geral',
        dificuldade: 'complexo',
        dias: 15,
        pt: 5,
        tutor: false,
        atributos: ['sab', 'pre'],
        minimo: 16,
        texto: 'Com uma ação, obriga uma criatura que o veja ou ouça, a até 15 m, a uma Salvaguarda de Sabedoria CD 8 + mod. de Sabedoria + proficiência (voluntárias dispensam). Se falhar, fica hipnotizada até sofrer dano, até o fim da duração ou até você encerrar. Com ação bônus: Interrogar (responde sinceramente), Iludir (vê, ouve e sente o que você quiser) ou Comandar (ordens simples). Pode impor qualquer condição do Cap. 10 (ou nova, com aprovação). Cada hipnose dura 1 minuto; quem a sofre ganha +3 (cumulativo) em testes contra hipnose por 24 horas; cada criatura só recebe uma condição assim por dia. O método deve ser único e aprovado pelo Narrador.',
        extra: { acao: 'padrao' },
    }),
    treino({
        id: 'punho-bebado',
        nome: 'Punho Bêbado',
        categoria: 'geral',
        dificuldade: 'complexo',
        dias: 15,
        pt: 5,
        tutor: true,
        atributos: ['con'],
        minimo: 17,
        texto: 'Com a condição "Bêbado", as características normais dela são trocadas por: o deslocamento não provoca reações; o dado do ataque (comum) desarmado vira 1d8 + mod. de Destreza; nenhum ataque (comum) tem vantagem contra você; dura até 1 minuto (encerra quando quiser, sem ação); ataques (comum) desarmados corpo a corpo com vantagem; no início de cada turno role 1d12: 4 ou menos, sem ações, ações bônus ou movimento; 8 ou menos, turno normal; 12 ou menos, uma ação adicional (só Atacar com um desarmado, Disparada, Esconder ou Usar um Objeto).',
    }),
    treino({
        id: 'resistencia-a-kairoseki-superior',
        nome: 'Resistência à Kairoseki Superior',
        categoria: 'geral',
        dificuldade: 'complexo',
        dias: 15,
        pt: 5,
        tutor: false,
        atributos: ['con', 'von'],
        minimo: 20,
        requer: 'resistencia-a-kairoseki',
        texto: 'Só para quem já tem "Resistência à Kairoseki". Com "Enfraquecido" por kairoseki (não pelo mar): deslocamento −1,5 m e natação 0; incapaz de usar Técnicas ou características de Akuma no Mi; −2 em Testes de Força; −2 em Salvaguardas de Força. A condição acaba se a causa for removida.',
    }),
];

// ---------------------------------------------------------------------------------------------------------------------
// TREINAMENTOS COM ARMA
// ---------------------------------------------------------------------------------------------------------------------
const TROCA_ARMA =
    'Você pode escolher essa arma para substituir a sua arma favorita, se tiver o mesmo tipo de jogada de ataque (corpo a corpo ou à distância) e fizer sentido, revertendo a escolha a cada novo nível.';
const MESMO_CALCULO = 'Salvaguardas usam o mesmo cálculo do seu Estilo de Combate (com mais de um estilo, escolha qual determina a CD).';

const ARMAS: Treinamento[] = [
    treino({
        id: 'bombardeador',
        nome: 'Bombardeador',
        categoria: 'arma',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['des', 'sab'],
        minimo: 16,
        texto: `Você treina com canhão e mira projéteis pesados mesmo com vento forte ou o balanço do navio. Soma o Bônus de Proficiência nos ataques com o navio (canhões, armas e munições especiais) e com bazucas. ${TROCA_ARMA}`,
    }),
    treino({
        id: 'combatente-exotico',
        nome: 'Combatente Exótico',
        categoria: 'arma',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['des', 'sab'],
        minimo: 14,
        texto: `Treina com armas pouco conhecidas: proficiência em chicote, mangual, naginata e zarabatana e em uma arma cortante, de fogo, especial ou marcial à escolha. Seu primeiro ataque com uma dessas armas, depois de jogar a iniciativa, é sempre com vantagem. ${TROCA_ARMA}`,
    }),
    treino({
        id: 'combatente-versatil',
        nome: 'Combatente Versátil',
        categoria: 'arma',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['des', 'sab'],
        minimo: 15,
        texto: `Todas as armas de fogo (pistolas, mosquetes) ficam fáceis: soma o Bônus de Proficiência em todas elas e em mais 2 armas quaisquer cortantes, de fogo, especiais ou marciais. ${TROCA_ARMA}`,
    }),
    treino({
        id: 'arqueiro-treinado',
        nome: 'Arqueiro Treinado',
        categoria: 'arma',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['des'],
        minimo: 14,
        texto: `Soma o Bônus de Proficiência nos ataques (comum ou Técnicas) com arcos e recebe: alcance de 36/45 m nos ataques (comum) à distância com arco; ignora meia-cobertura e cobertura de três quartos; flechas causam 1d10 Perfurante e ignoram resistência a esse tipo; Técnicas com requisito de arma à distância podem usar arco e flechas; Técnicas com arco e alvo único somam o mod. de Destreza ao dano (metade com vários alvos); o arco pode substituir a arma favorita (${TROCA_ARMA.toLowerCase()}); acesso à Técnica "Chuva de Flechas".`,
        tecnicas: [
            {
                nome: 'Chuva de Flechas',
                origem: 'Treinamento Arqueiro Treinado: 1º Grau',
                custo: 2,
                alcance: 'Até 12 m, Cone',
                efeito: '2d6 Perfurante',
                rolagem: '2d6',
                tipoDano: 'perfurante',
                acao: 'poderosa',
                descricao: `Você dispara várias flechas em uma saraivada vinda de cima. Toda criatura na área faz Salvaguarda de Destreza: todo o dano se falhar, metade se passar. ${MESMO_CALCULO} Requisito: 1 arco, 10 flechas. Ataque combinado: possível.`,
            },
        ],
    }),
    treino({
        id: 'espadachim-treinado',
        nome: 'Espadachim Treinado',
        categoria: 'arma',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['for', 'des'],
        minimo: 14,
        texto: `Proficiência em todas as armas cortantes (exceto o machado grande) e acesso à Técnica "Lâmina Voadora". ${TROCA_ARMA}`,
        tecnicas: [
            {
                nome: 'Lâmina Voadora',
                origem: 'Treinamento Espadachim Treinado: 1º Grau',
                custo: 2,
                alcance: 'Até 15 m, Linha',
                efeito: '2d10 Cortante',
                rolagem: '2d10',
                tipoDano: 'cortante',
                acao: 'poderosa',
                descricao:
                    'Usa o próprio ar para aumentar o alcance: um balanço circular cria um projétil em espiral contra uma criatura, com jogada de ataque (Técnicas) à distância. Requisito: 1 arma cortante. Ataque combinado: possível.',
            },
        ],
    }),
    treino({
        id: 'estilingueiro-treinado',
        nome: 'Estilingueiro Treinado',
        categoria: 'arma',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['des'],
        minimo: 14,
        texto: `Soma o Bônus de Proficiência nos ataques (comum) com estilingue, com as mesmas características que beneficiam armas de fogo e armas de arremesso do seu estilo, e mais: sempre tem munição (cata pedras e objetos); escolhe dano Contundente, Cortante ou Perfurante; Técnicas com requisito de arma à distância podem usar estilingue; sem redução de alcance pela munição; munição de 1d10; ignora meia-cobertura e cobertura de três quartos; Técnicas com estilingue e alvo único somam o mod. de Destreza ao dano (metade com vários alvos); pode substituir a arma favorita; acesso à Técnica "Hissatsu – Metallic Star".`,
        tecnicas: [
            {
                nome: 'Hissatsu – Metallic Star',
                origem: 'Treinamento Estilingueiro Treinado: 3º Grau',
                custo: 6,
                alcance: 'Até 21 m, Linha',
                efeito: '2d10 Contundente',
                rolagem: '2d10',
                tipoDano: 'contundente',
                acao: 'poderosa',
                descricao: `Jogada de ataque (Técnicas) à distância com grande pressão concentrada: a criatura atingida passa em Salvaguarda de Constituição ou fica "Atordoado" até o fim do próximo turno dela. ${MESMO_CALCULO} Requisito: estilingue. Ataque combinado: impossível.`,
            },
        ],
    }),
    treino({
        id: 'gangster',
        nome: 'Gangster',
        categoria: 'arma',
        dificuldade: 'simples',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['des'],
        minimo: 15,
        adicional: 'Proficiência em armas de fogo',
        texto: `Com proficiência em armas de fogo, você se especializa em escopetas e metralhadoras: ignora a propriedade "recarga"; a escopeta passa a um cone de 4,5 m e a metralhadora a um cone de 9 m; ${TROCA_ARMA.toLowerCase()} Salvaguardas impostas por elas causam no mínimo metade do dano em todas as criaturas afetadas, mesmo contra quem não sofreria dano ao passar. Acesso à Técnica "My Little Friend".`,
        tecnicas: [
            {
                nome: 'My Little Friend',
                origem: 'Treinamento Gangster: 3º Grau',
                custo: 5,
                alcance: 'Até 15 m, Cone',
                efeito: '6d6 Contundente ou Perfurante',
                rolagem: '6d6',
                tipoDano: 'perfurante',
                acao: 'poderosa',
                descricao: `Numa postura intimidadora, você faz 3 rajadas em todas as direções. Toda criatura na área faz Salvaguarda de Destreza: todo o dano se falhar, metade se passar. ${MESMO_CALCULO} Requisito: escopeta (30 munições esféricas) ou metralhadora (60 munições perfurantes). Ataque combinado: possível.`,
            },
        ],
    }),
    treino({
        id: 'lanceiro-treinado',
        nome: 'Lanceiro Treinado',
        categoria: 'arma',
        dificuldade: 'intermediario',
        dias: 10,
        pt: 3,
        tutor: false,
        atributos: ['for', 'des'],
        minimo: 14,
        texto: `Você domina a lança: proficiência com lança e tridente; arremessa-os com uma ação a 9/15 m (ataque com mod. de Força ou Destreza e 1 dado de dano Perfurante extra); ao atacar corpo a corpo com eles, usa uma ação bônus para outro ataque com a parte não cortante (dano Contundente); acesso à Técnica "Perfuração Giratória". ${TROCA_ARMA}`,
        tecnicas: [
            {
                nome: 'Perfuração Giratória',
                origem: 'Treinamento Lanceiro Treinado: 1º Grau',
                custo: 2,
                alcance: 'Toque',
                efeito: '2d10 Perfurante',
                rolagem: '2d10',
                tipoDano: 'perfurante',
                acao: 'poderosa',
                descricao: `Estocada certeira girando a lança ou tridente, com jogada de ataque (Técnicas): o alvo passa em Salvaguarda de Constituição ou recebe "Sangramento". ${MESMO_CALCULO} Requisito: 1 lança ou tridente. Ataque combinado: impossível.`,
            },
        ],
    }),
    treino({
        id: 'combatente-ardiloso',
        nome: 'Combatente Ardiloso',
        categoria: 'arma',
        dificuldade: 'complexo',
        dias: 15,
        pt: 5,
        tutor: false,
        atributos: ['des', 'sab'],
        minimo: 15,
        texto: `Você explora a velocidade das armas curtas. Empunhando adagas, kunais e kogatanas: ataques corpo a corpo com elas têm margem de crítico 18-20; o alcance máximo do arremesso não impõe desvantagem; em cada turno, um ataque (comum) extra com ação bônus; a adaga pode substituir a arma favorita (${TROCA_ARMA.toLowerCase()}); acesso à Técnica "Adagas Voadoras".`,
        extra: { acao: 'bonus', etiquetas: ['Adaga/kunai/kogatana: crítico 18-20', 'Ataque (comum) extra com ação bônus'] },
        tecnicas: [
            {
                nome: 'Adagas Voadoras',
                origem: 'Treinamento Combatente Ardiloso: 2º Grau',
                custo: 4,
                alcance: 'Até 15 m, Linha',
                efeito: '1d10 Perfurante por adaga',
                rolagem: '1d10',
                tipoDano: 'perfurante',
                acao: 'poderosa',
                descricao:
                    'Com todo o foco nos ataques, você lança 3 adagas sem chance de errar, fazendo curvas até o alvo. Cada adaga atinge uma criatura à sua escolha que você veja no alcance; todas atingem ao mesmo tempo (uma criatura ou várias; modificadores da Técnica valem em só um dos ataques). Requisito: 3 adagas. Ataque combinado: possível.',
            },
        ],
    }),
    treino({
        id: 'espadachim-negro',
        nome: 'Espadachim Negro',
        categoria: 'arma',
        dificuldade: 'complexo',
        dias: 15,
        pt: 5,
        tutor: false,
        atributos: ['for', 'des'],
        minimo: 17,
        texto: `Maior força nas mãos para armas grandes: soma o Bônus de Proficiência nos ataques (comum ou Técnicas) com espadas montantes e naginatas. Ao atacar corpo a corpo com elas, usa uma ação bônus para um ataque (comum) circular contra todos a até 1,5 m (cada um sofre só o dano da arma, sem modificador nem dados adicionais, mesmo em crítico). Empunhando-as, ao ser alvo de um ataque (comum ou Técnicas), usa a reação para +3 de CR e nas Salvaguardas de Destreza contra dano até o fim do próximo turno. ${TROCA_ARMA}`,
        extra: { acao: 'reacao', reacao: { gatilho: 'ataque_declarado', alcance: 'si', defesa: 3, categoria: 'reacao' } },
    }),
];

// ---------------------------------------------------------------------------------------------------------------------
// TREINAMENTOS DE ESPÉCIE
// ---------------------------------------------------------------------------------------------------------------------
const ESPECIES: Treinamento[] = [
    treino({
        id: 'pequeno-gigante',
        nome: 'Pequeno Gigante',
        categoria: 'especie',
        dificuldade: 'simples',
        especie: 'Anão',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['con'],
        minimo: 14,
        texto: 'Seus ataques (comum) passam a causar 1d12 (prevalece o maior). Você usa a agilidade em combate: +2 na CR enquanto tiver mais da metade dos PV. Uma vez por dia, escolhe ter sucesso em uma Salvaguarda qualquer.',
        tracos: [
            t(
                'pequeno-gigante',
                'Pequeno Gigante',
                'Seus ataques (comum) passam a causar 1d12 (prevalece o maior). Você usa a agilidade em combate: +2 na CR enquanto tiver mais da metade dos PV (ligue enquanto valer).',
                { tipo: 'ativa', efeitos: [{ alvo: 'ca', modo: 'soma', valor: 2 }] },
            ),
            t(
                'pequeno-gigante-sucesso',
                'Pequeno Gigante: Salvaguarda Garantida',
                'Uma vez por dia, você escolhe ter sucesso em uma Salvaguarda qualquer.',
                { usos: longo(1), acoes: [{ rotulo: 'Sucesso na Salvaguarda', tipo: 'gastar', usa: true, acao: 'livre' }] },
            ),
        ],
    }),
    treino({
        id: 'conexao-com-a-natureza',
        nome: 'Conexão com a Natureza',
        categoria: 'especie',
        dificuldade: 'simples',
        especie: 'Anão',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['sab'],
        minimo: 14,
        texto: '+2 em Testes de Sabedoria (Sobrevivência) em ambientes de grande vegetação. Usa a característica "Adestrar Animais" da profissão Adestrador (Cap. 4) com vantagem e somando a proficiência para convencer insetos ou outros animais não hostis a ajudar. Pode escolher o Treinamento Geral "Entusiasta de Plantas" por apenas 1 PT, sem dias de treino e ignorando os demais requisitos.',
    }),
    treino({
        id: 'afinidade-cultural',
        nome: 'Afinidade Cultural',
        categoria: 'especie',
        dificuldade: 'simples',
        especie: 'Celestial',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['des'],
        minimo: 14,
        texto: 'Em alturas elevadas (a critério do Narrador): vantagem em Testes de Destreza (Acrobacia) e Salvaguardas de Destreza, e redução de 2d6 em qualquer dano de queda. Pode escolher o Treinamento Geral "Conhecimento Celestial" por apenas 1 PT, sem dias de treino e ignorando os demais requisitos.',
    }),
    treino({
        id: 'guerreiro-nato',
        nome: 'Guerreiro Nato',
        categoria: 'especie',
        dificuldade: 'simples',
        especie: 'Gigante',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['con'],
        minimo: 14,
        texto: 'Seus ataques (comum) corpo a corpo recebem +1 para acertar e causam 1d12 (prevalece o maior). Sempre que receber dano de 10 ou mais, e consciente, recupera 1d6 + mod. de Constituição em PV.',
    }),
    treino({
        id: 'resistencia-dos-gigantes',
        nome: 'Resistência dos Gigantes',
        categoria: 'especie',
        dificuldade: 'simples',
        especie: 'Gigante',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['con'],
        minimo: 14,
        texto: 'Independentemente do Estilo de Combate de cada nível, o dado de vida do gigante é sempre o d12. Ao aprender (fora da criação) você rola de novo os dados de vida, trocando-os pelo d12. Com uma Akuma no Mi Zoan com a forma "Heavy Point", ganha +3 PV a cada nível de personagem.',
        extra: { etiquetas: ['Dado de vida d12'] },
    }),
    treino({
        id: 'expertise-cultural',
        nome: 'Expertise Cultural',
        categoria: 'especie',
        dificuldade: 'simples',
        especie: 'Povo do Mar',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['for'],
        minimo: 14,
        texto: 'Soma o Bônus de Proficiência nos ataques (comum ou Técnicas) com tridente. Submerso, +2 nos ataques (comum ou Técnicas) corpo a corpo. Usa "Adestrar Animais" (Cap. 4) com vantagem e somando a proficiência para convencer peixes e animais marinhos não hostis. Seus olhos funcionam normalmente debaixo d\'água, vendo até 36 m (em escuridão total, só em tons de cinza).',
    }),
    treino({
        id: 'iniciada-em-haki',
        nome: 'Iniciada em Haki',
        categoria: 'especie',
        dificuldade: 'simples',
        especie: 'Humano',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['von'],
        minimo: 14,
        adicional: 'Humano da variante Kuja',
        texto: 'Desde a infância as kujas aprendem sobre todos os tipos de Haki. Ao terminar, você recebe PA igual ao seu nível de personagem e +2 PA para cada nível par posterior (no máximo 10 PA com este treinamento). Não garante o despertar do Haki. (Entra sozinha no saldo da aba Haki.)',
        extra: { etiquetas: ['+PA de Haki: nível, +2 por nível par (máx. 10)'] },
    }),
    treino({
        id: 'resiliencia',
        nome: 'Resiliência',
        categoria: 'especie',
        dificuldade: 'simples',
        especie: 'Humano',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['sab'],
        minimo: 14,
        escolha: {
            rotulo: 'Salvaguarda',
            opcoes: [
                { id: 'for', nome: 'Força' },
                { id: 'des', nome: 'Destreza' },
                { id: 'con', nome: 'Constituição' },
                { id: 'sab', nome: 'Sabedoria' },
                { id: 'pre', nome: 'Presença' },
                { id: 'von', nome: 'Vontade' },
            ],
        },
        texto: 'O humano escolhe 1 Salvaguarda na qual passa a ser proficiente.',
    }),
    treino({
        id: 'versatilidade-humana',
        nome: 'Versatilidade Humana',
        categoria: 'especie',
        dificuldade: 'simples',
        especie: 'Humano',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['sab'],
        minimo: 14,
        texto: 'O humano soma metade do Bônus de Proficiência (arredondado para baixo) em qualquer Teste de Atributo que fizer e no qual ainda não tenha proficiência.',
    }),
    treino({
        id: 'hakka',
        nome: 'Hakka',
        categoria: 'especie',
        dificuldade: 'simples',
        especie: 'Lunariano',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['con'],
        minimo: 14,
        texto: 'Ao sofrer dano de um ataque (comum), use a reação para converter o impacto em calor e explodir: o dano cai a 0 e você recupera 1 uso da característica "Heat". Até 3 usos; todos voltam após um descanso longo.',
        extra: { acao: 'reacao', usos: longo(3) },
    }),
    treino({
        id: 'asas-funcionais',
        nome: 'Asas Funcionais',
        categoria: 'especie',
        dificuldade: 'simples',
        especie: 'Lunariano',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['con'],
        minimo: 14,
        texto: 'O lunariano não voa, mas treina as asas para auxiliar a movimentação: você plana por até 15 m no ar e reduz o dano de queda em 2d6.',
    }),
    treino({
        id: 'leao-da-lua',
        nome: 'Leão da Lua',
        categoria: 'especie',
        dificuldade: 'complexo',
        especie: 'Mink',
        dias: 15,
        pt: 5,
        tutor: true,
        atributos: ['con'],
        minimo: 14,
        texto: 'O mink fica totalmente consciente na forma Sulong e recebe: invulnerabilidade a dano Elétrico e vantagem em Salvaguardas de Constituição e Vontade; mantém a forma Sulong sem desgaste por até 5 minutos (depois, a cada minuto perde 2 PP ou ganha/soma 1 Nível de Exaustão; só volta após um descanso curto ou longo; cada ativação consome 1 uso completo); transforma-se e desfaz a transformação sem ação (desfazer conta no mínimo 1 minuto); evitar olhar para a lua não causa desvantagem nem impede a concentração.',
        extra: {
            efeitos: [
                { alvo: 'salv.con', modo: 'vantagem' },
                { alvo: 'salv.von', modo: 'vantagem' },
            ],
            usos: curto(1),
            etiquetas: ['Invulnerável a dano Elétrico', 'Sulong consciente por 5 min'],
        },
    }),
    treino({
        id: 'furtividade-animal',
        nome: 'Furtividade Animal',
        categoria: 'especie',
        dificuldade: 'simples',
        especie: 'Mink',
        dias: 5,
        pt: 1,
        tutor: false,
        atributos: ['des'],
        minimo: 14,
        texto: 'Nenhuma criatura consegue vantagem em um Teste de Vontade (Percepção) para localizar você, nem com o Haki da Observação.',
    }),
];

export const TREINAMENTOS: Treinamento[] = [...GERAIS, ...ARMAS, ...ESPECIES];
export const treinamentoPorId = (id: string | null | undefined): Treinamento | undefined => TREINAMENTOS.find((x) => x.id === id);

/** Genialidade Inusitada: custo em PT de cada grau (1º ao 7º). */
export const CUSTO_GENIALIDADE = [1, 1, 2, 2, 2, 3, 3];

// --- Códigos de Honra (5.8) -----------------------------------------------------------------------------------------------

export interface CodigoDeHonra {
    id: string;
    nome: string;
    texto: string;
}

export const CODIGOS_DE_HONRA: CodigoDeHonra[] = [
    {
        id: 'familia',
        nome: 'Código da Família (Sangue ou Consideração)',
        texto: 'Nunca desonrar as regras da sua família. Nunca ferir sua família, a não ser que um membro tenha traído o código familiar. Buscar vingança implacável contra quem ferir, matar ou trair a sua família.',
    },
    {
        id: 'gratidao',
        nome: 'Código da Gratidão',
        texto: 'Quando alguém salva sua vida, ou de um ente querido seu, você deve oferecer seus serviços para realizar um desejo qualquer dessa pessoa, desde que não fira a sua moral e ética.',
    },
    {
        id: 'honestidade',
        nome: 'Código da Honestidade',
        texto: 'Nunca roubar, trapacear, mentir ou desobedecer às leis locais, nem permitir que seus companheiros o façam, sem uma justificativa muito plausível.',
    },
    {
        id: 'redencao',
        nome: 'Código da Redenção',
        texto: 'Jamais atacar sem necessidade nem tirar vidas, sempre aceitar um pedido de rendição e sempre poupar seus oponentes depois de derrotados ou inconscientes.',
    },
    {
        id: 'conduta',
        nome: 'Código de Conduta',
        texto: 'Nunca desobedecer a seus superiores, seja o Capitão da sua tripulação ou algum contratante de seus serviços. Sempre que seu superior lhe vetar ou mandar você parar, você obedece.',
    },
    {
        id: 'burocrata',
        nome: 'Código do Burocrata',
        texto: 'Sempre que uma situação deva ser resolvida, você estabelece um contrato social entre ambas as partes (verbal ou escrito), deixando claras as obrigações e necessidades de todos, e se torna inteiramente fiel ao que foi acordado. Só pode fazer algo diferente se a outra parte quebrar o contrato ou se ele for cumprido.',
    },
    {
        id: 'cacador',
        nome: 'Código do Caçador',
        texto: 'Nunca matar filhotes ou fêmeas grávidas de qualquer espécie (combater ou capturar, quando necessário, mas nunca matar). Nunca abandonar uma caça abatida. Sempre escolher como oponente a pessoa ou criatura de aparência mais perigosa à vista.',
    },
    {
        id: 'cavalheiro',
        nome: 'Código do Cavalheiro',
        texto: 'Nunca atacar uma mulher (ou fêmea de qualquer espécie humanoide), nem mesmo quando atacado, e nem permitir que seus companheiros o façam. Sempre atender um pedido de ajuda de uma mulher.',
    },
    {
        id: 'combate',
        nome: 'Código do Combate',
        texto: 'Nunca atacar um oponente indefeso. Nunca participar de um encontro estando do lado de maior número (quando os números importarem) e a desvantagem numérica crie uma diferença clara de força entre os lados.',
    },
    {
        id: 'lider',
        nome: 'Código do Líder',
        texto: 'Você sempre deve proteger seus subordinados ou criaturas sob seus cuidados. Quando existirem códigos disciplinadores, para punir insubordinação ou atitudes reprováveis, você deve aplicá-los.',
    },
    {
        id: 'lutador',
        nome: 'Código do Lutador',
        texto: 'Nunca recusar desafio ou pedido de duelo. Quando perder uma disputa, deve buscar lutar novamente e vencer quem o derrotou, com grande determinação.',
    },
    {
        id: 'orgulho',
        nome: 'Código do Orgulho',
        texto: 'Você nunca foge de uma luta e não suporta ser considerado um covarde. Mesmo se o inimigo se mostrar superior, você não demonstra medo e o enfrenta com todas as suas forças.',
    },
    {
        id: 'profissional',
        nome: 'Código do Profissional',
        texto: 'Caso receba um pedido relacionado à sua profissão, você se sente obrigado a ajudar. Mesmo que a pessoa não possa pagar, você aceita qualquer forma de recompensa ou dá alguma desculpa para poder efetuar o serviço.',
    },
    {
        id: 'protetor',
        nome: 'Código do Protetor',
        texto: 'Você não consegue atacar pessoas indefesas nem ficar quieto ao vê-las sendo atacadas, como crianças, idosos, animais e pessoas incapacitadas.',
    },
    {
        id: 'herois',
        nome: 'Código dos Heróis',
        texto: 'Sempre cumprir sua palavra, sempre proteger qualquer pessoa ou criatura que não seja maligna e que seja mais fraca que você, jamais recusar um pedido de ajuda.',
    },
];

/** "Seguindo seu Código": quantos PT o mestre dá ao fim do próximo descanso longo, por situação. */
export const SITUACOES_DO_CODIGO: { id: string; rotulo: string; pt: number }[] = [
    { id: 'si', rotulo: 'Prejudicando a si mesmo', pt: 1 },
    { id: 'aliado', rotulo: 'Confrontando um aliado', pt: 1 },
    { id: 'grupo', rotulo: 'Prejudicando o grupo', pt: 2 },
    { id: 'vida', rotulo: 'Própria vida em risco', pt: 2 },
    { id: 'vida-grupo', rotulo: 'Vida do grupo em risco', pt: 3 },
];

export const codigoPorId = (id: string | null | undefined): CodigoDeHonra | undefined => CODIGOS_DE_HONRA.find((c) => c.id === id);

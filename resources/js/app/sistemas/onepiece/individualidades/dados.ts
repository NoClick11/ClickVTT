// Individualidades (cap. 5.5, regra opcional): Singularidades e Defeitos Suaves, Médios e Fortes.
// Dados puros (sem Vue); ids, níveis e escolhas são espelhados em `app/Sistemas/OnePiece/dados/individualidades.json`.
import type { TracoDados } from '../construtor/dados/tipos.ts';

export type NivelDeIndividualidade = 'suave' | 'media' | 'forte';
export type TipoDeIndividualidade = 'singularidade' | 'defeito';

export const NIVEIS_DE_INDIVIDUALIDADE: { id: NivelDeIndividualidade; nome: string; espacos: number }[] = [
    { id: 'suave', nome: 'Suave', espacos: 1 },
    { id: 'media', nome: 'Média', espacos: 3 },
    { id: 'forte', nome: 'Forte', espacos: 4 },
];

/** Espaços de Singularidade no momento da criação do personagem. */
export const ESPACOS_INICIAIS = 5;

export interface EscolhaDeIndividualidade {
    rotulo: string;
    /** Lista fechada (id → rótulo); sem `opcoes` o jogador escreve um texto curto. */
    opcoes?: { id: string; rotulo: string }[];
}

export interface Individualidade {
    id: string;
    tipo: TipoDeIndividualidade;
    nivel: NivelDeIndividualidade;
    traco: TracoDados;
    escolha?: EscolhaDeIndividualidade;
    /** Só com a aprovação do Narrador (o mestre a adiciona). */
    aprovacaoDoMestre?: boolean;
}

const s = (
    nivel: NivelDeIndividualidade,
    tipo: TipoDeIndividualidade,
    id: string,
    nome: string,
    descricao: string,
    extra: Partial<TracoDados> = {},
    resto: Partial<Individualidade> = {},
): Individualidade => ({
    id,
    tipo,
    nivel,
    traco: { id, nome, descricao, ...extra },
    ...resto,
});
const sing = (
    nivel: NivelDeIndividualidade,
    id: string,
    nome: string,
    d: string,
    extra: Partial<TracoDados> = {},
    resto: Partial<Individualidade> = {},
) => s(nivel, 'singularidade', id, nome, d, extra, resto);
const def = (
    nivel: NivelDeIndividualidade,
    id: string,
    nome: string,
    d: string,
    extra: Partial<TracoDados> = {},
    resto: Partial<Individualidade> = {},
) => s(nivel, 'defeito', id, nome, d, extra, resto);

const PERICIAS_ESTUDIOSO = [
    { id: 'historia', rotulo: 'História' },
    { id: 'investigacao', rotulo: 'Investigação' },
    { id: 'medicina', rotulo: 'Medicina' },
    { id: 'natureza', rotulo: 'Natureza' },
    { id: 'sobrevivencia', rotulo: 'Sobrevivência' },
];
export { PERICIAS_ESTUDIOSO };

export const INDIVIDUALIDADES: Individualidade[] = [
    // ------------------------------------------------------------------ Singularidades Suaves
    sing(
        'suave',
        'amante',
        'Amante',
        'Você mantém um relacionamento amoroso com uma figura importante da sociedade. Por meio dessa relação, você pode recorrer a essa pessoa para obter informações ou pequenos favores, sempre com a aprovação do Narrador. Esses auxílios não são imediatos e podem levar 3d6 dias para chegar.',
    ),
    sing(
        'suave',
        'ambiente-familiar',
        'Ambiente Familiar',
        'Criado em um ambiente específico, você encontra conforto e liberdade nas lembranças desse lugar. Sempre que estiver imerso nesse tipo de cenário, suas habilidades tendem a se sobressair. Escolha um ambiente que mais ressoe com seu passado (dunas, montanhas, neve, selva, campo ou mar). Quando estiver nesse ambiente, você pode refazer qualquer rolagem do d20, escolhendo qual dos resultados utilizar. Pode ser usada até 3 vezes, e todos os usos são recuperados ao final de um descanso longo.',
        { usos: { max: 3, descanso: 'longo' } },
        { escolha: { rotulo: 'Ambiente (dunas, montanhas, neve, selva, campo, mar...)' } },
    ),
    sing(
        'suave',
        'armadura-de-musculos',
        'Armadura de Músculos',
        'Você treina seu corpo diariamente e está mais do que preparado para suportar golpes intensos. Pode substituir o modificador de Destreza adicionado à sua CR pelo modificador de Força. Características que permitam utilizar outro modificador para a CR, como "Defesa Aprimorada", caso nenhum deles seja o modificador de Força, você pode optar por substituí-lo pelo modificador de Força.',
    ),
    sing(
        'suave',
        'beleza-natural',
        'Beleza Natural',
        'O personagem nasceu com uma beleza exuberante. Mesmo sem qualquer preparo, ele já é bonito o suficiente para chamar atenção e conquistar admiradores. O preconceito severo é reduzido para medíocre e o medíocre para débil. Não é possível reduzir o preconceito débil com essa individualidade.',
    ),
    sing(
        'suave',
        'bom-senso',
        'Bom Senso',
        'Pessoas podem ter atitudes estúpidas, mas você não é uma delas. Todas as vezes que o personagem for fazer alguma coisa obviamente idiota, o Narrador pode dizer que ele pretende fazer uma burrice, evitando um desfecho desagradável.',
    ),
    sing(
        'suave',
        'chefe',
        'Chefe',
        'Você impõe respeito naturalmente: por já ter feito parte de uma organização criminosa respeitada, por aparentar grande força ou por manter uma postura firme e inabalável. Uma vez por dia, fora de um encontro de combate, você pode tentar usar esta característica ao causar dano pela primeira vez a uma única criatura (o dano não pode vir de uma Técnica). Faça um Teste de Atributo de Presença (Intimidação) CD 16. Independentemente do resultado, não poderá tentar de novo até o término de um descanso longo. Em caso de sucesso, o dano não desencadeia uma retaliação hostil nem inicia um combate, e você recebe vantagem em Testes de Atributo de Presença contra essa criatura até o final do dia.',
        { usos: { max: 1, descanso: 'longo' } },
    ),
    sing(
        'suave',
        'corpo-fechado',
        'Corpo Fechado',
        'Sua pele parece de aço e, por mais que esteja ferido, raramente você demonstra sinais de lesões e cortes, sendo difícil até mesmo sangrar quando cortado. Ao fazer Salvaguardas contra as condições "Sangramento" e "Queimado", você pode tornar uma falha em um sucesso. Pode ser usada uma quantidade de vezes igual ao seu Bônus de Proficiência; recupera todos os usos ao término de um descanso longo.',
        { usos: { porProf: true, descanso: 'longo' } },
    ),
    sing(
        'suave',
        'corpo-vigoroso',
        'Corpo Vigoroso',
        'Você nasceu com um corpo muito saudável. Suas feridas se curam mais rapidamente, e você suporta uma quantidade incrível de esforço. Sempre que passar de nível e rolar seu Dado de Vida para aumentar seu valor máximo de PV, role-o novamente e escolha o maior dos dois resultados. Ao terminar um descanso curto, você recebe 1 Dado de Vida adicional para ser utilizado; se não tiver mais Dados de Vida disponíveis, recupera pelo menos 1 Dado de Vida ao concluir o descanso curto.',
    ),
    sing(
        'suave',
        'determinacao',
        'Determinação',
        'Você é movido por uma vontade inabalável de alcançar seus sonhos. Esta característica concede 10 Pontos de Determinação, que podem ser gastos para aumentar o valor final de Testes de Atributo ou Salvaguardas diretamente relacionados às suas ambições (acordados previamente com o Narrador). Cada ponto gasto adiciona +1 ao resultado do teste. Os pontos gastos são perdidos e recuperados apenas ao término de um descanso longo.',
        { usos: { max: 10, descanso: 'longo' } },
    ),
    sing(
        'suave',
        'disciplinado',
        'Disciplinado',
        'Dia após dia, você se dedica incansavelmente aos seus treinamentos, buscando aperfeiçoamento físico e mental. A cada nível par de personagem, você recebe 1 Ponto de Treinamento.',
    ),
    sing(
        'suave',
        'equilibrio-perfeito',
        'Equilíbrio Perfeito',
        'O personagem é capaz de se manter em pé mesmo sob tremores intensos ou em superfícies extremamente estreitas, como cordas esticadas, saliências, mastros, galhos de árvores ou estruturas instáveis semelhantes. Além disso, sempre que realizar uma Salvaguarda para evitar ser derrubado ou perder o equilíbrio, você faz o teste com vantagem.',
    ),
    sing(
        'suave',
        'forasteiro',
        'Forasteiro',
        'Você veio de um local conhecido por poucos, com suas próprias culturas e heranças. Dessa forma, você traz consigo itens misteriosos: escolha entre uma "Planta Mãe", um conjunto de dials aleatórios (3 dials cotidianos, 2 dials bélicos e 1 dial restrito) ou um "Clima-Tact". Todos os itens estão no Capítulo 2 do Guia do Narrador.',
        {},
        {
            escolha: {
                rotulo: 'Item',
                opcoes: [
                    { id: 'planta-mae', rotulo: 'Planta Mãe' },
                    { id: 'dials', rotulo: '3 dials cotidianos, 2 bélicos e 1 restrito (aleatórios)' },
                    { id: 'clima-tact', rotulo: 'Clima-Tact' },
                ],
            },
        },
    ),
    sing(
        'suave',
        'indomavel',
        'Indomável',
        'O personagem possui uma reação quase bestial sempre que alguém tenta subjugá-lo, seja por correntes, agarrões, algemas ou habilidades especiais. Sempre que estiver restrito de qualquer forma, você dobra o seu modificador de Força nos Testes de Atributo para se libertar. Além disso, enquanto estiver agarrado, causa 1 dado de dano adicional em jogadas de ataque (comum).',
    ),
    sing(
        'suave',
        'instintos-animais',
        'Instintos Animais',
        'Seus instintos de sobrevivência são extremamente aguçados, e você se comporta, em muitos aspectos, como um animal atento ao ambiente. Sempre que uma criatura considerada inimiga estiver dentro do seu campo de visão, pode realizar um Teste de Atributo de Vontade (Intuição) CD 15 para avaliar se ela representa uma ameaça significativa. Além disso, sempre que uma criatura tiver a intenção de atacá-lo e estiver a até 18 metros, você percebe essa hostilidade instintivamente e identifica a localização da criatura.',
    ),
    sing(
        'suave',
        'integrante-fantasma',
        'Integrante Fantasma',
        'Você tem uma presença sutil e calma, tornando-se praticamente invisível em situações sociais. Desde que não esteja interagindo diretamente com alguma situação ou participando de um combate, você pode se inserir em qualquer interação que esteja acontecendo a até 1 km da sua última localização, como se estivesse presente desde o início. Essa interação deve envolver, originalmente, os outros jogadores da mesa, e você pode se inserir nela mesmo que o Narrador não estivesse ciente previamente de sua presença.',
    ),
    sing(
        'suave',
        'ma-fama',
        'Má Fama',
        'Você possui uma infâmia notória (falhas em missões cruciais, derrotas públicas, ex-criminoso em reabilitação...), com suspeitas consideráveis sobre suas ações, merecidas ou não. Você pode definir uma alcunha inicial para o seu personagem (com aprovação do Narrador) e, mesmo quando derrotado, seus inimigos evitam tirar sua vida, seja por estarem procurando por você no submundo ou para reivindicar alguma recompensa.',
    ),
    sing(
        'suave',
        'metabolismo-anormal',
        'Metabolismo Anormal',
        'Você possui um estômago monstruoso, a ponto de sua barriga poder chegar a até duas vezes o tamanho normal. Ao consumir grandes quantidades de comida, pode optar por passar 1 minuto sob a condição "Paralisado" para digerir completamente os alimentos. Ao final, seu corpo retorna ao estado normal e você recupera 1 PV para cada refeição ingerida. Recomenda-se que cada refeição possua propriedades equivalentes a uma refeição aristocrática (Capítulo 8), considerando peso e valor.',
    ),
    sing(
        'suave',
        'rotina-tranquila',
        'Rotina Tranquila',
        'Você se sente mais confortável seguindo hábitos simples e previsíveis. Sempre que iniciar um dia após um descanso longo completo, pode escolher uma única jogada de d20 feita fora de combate para rolar duas vezes e escolher o melhor resultado. A jogada deve representar uma ação rotineira ou cotidiana (construir algo, navegar, negociar compras, investigar locais...). Não pode ser usada em situações de urgência, perseguições, combates ou eventos claramente caóticos, a critério do Narrador.',
    ),
    sing(
        'suave',
        'sono-seguro',
        'Sono Seguro',
        'Você descansa sem jamais baixar completamente a guarda: mesmo nos estados mais profundos de sono, seus sentidos permanecem parcialmente atentos. Para todos os efeitos de regras, enquanto estiver dormindo, você é considerado consciente. Pode escolher acordar a qualquer momento e realiza Testes de Atributo e Salvaguardas normalmente.',
    ),
    sing(
        'suave',
        'tesouro-precioso',
        'Tesouro Precioso',
        'Você possui um objeto, à sua escolha, que precisa proteger a qualquer custo (um chapéu confiado por seu salvador, a espada de uma amiga falecida, um mapa de um tesouro submerso). Ele não pode ter grande valor monetário e deve ser aprovado pelo Narrador. Enquanto estiver carregando seu tesouro, ao falhar em uma Salvaguarda, você pode optar por receber ou aumentar 1 Nível de Exaustão e transformar a falha em um sucesso (recuperada ao término de um descanso longo). Caso veja seu tesouro sendo danificado, faça uma Salvaguarda de Vontade CD 18; em falha, fica "Atordoado" até o final do seu próximo turno. Se o tesouro for destruído ou desaparecer, você recebe a condição "Letárgico" por 2d6 meses (considerada um Defeito Suave).',
        { usos: { max: 1, descanso: 'longo' } },
        { escolha: { rotulo: 'O objeto' } },
    ),
    // ------------------------------------------------------------------ Singularidades Médias
    sing(
        'media',
        'alter-ego-heroico',
        'Álter Ego Heroico',
        'Você possui uma identidade secreta, à sua escolha, que pode ser invocada sempre que estiver em perigo, desde que tenha seus trajes de herói em mãos. Enquanto estiver vestido como herói, deve proteger sua verdadeira identidade de todos. Durante até 5 minutos, vestido de herói, você recebe vantagem em jogadas de iniciativa; se for o último na ordem de iniciativa, passa automaticamente a ser o primeiro. Além disso, ignora quaisquer efeitos negativos dos seus defeitos. Não poderá ser usada novamente até o término de um descanso longo.',
        { usos: { max: 1, descanso: 'longo' } },
    ),
    sing(
        'media',
        'aparencia-inofensiva',
        'Aparência Inofensiva',
        'Por algum motivo você não parece perigoso (muito pequeno, pareça fraco ou velho: você escolhe o motivo), o que facilita pegar oponentes desprevenidos. O truque não funciona com ninguém que já tenha visto você lutar, e não engana duas vezes a mesma pessoa. Você recebe +5 para acertar alguém que não desconfie de você, usando esta individualidade, e consegue diminuir o preconceito em 1 nível. Porém, recebe -5 em Testes de Atributo de Presença (Intimidação).',
        { efeitos: [{ alvo: 'pericia.intimidacao', modo: 'soma', valor: -5 }] },
    ),
    sing(
        'media',
        'ator',
        'Ator',
        'Você é a personificação de qualquer papel que decidir assumir. Ao realizar um Teste de Atributo de Presença (Atuação), obtém sucesso automático no primeiro teste. No segundo teste, rola com vantagem e, no terceiro, recebe +2. Essa característica se aplica individualmente a cada criatura. Após utilizar os três benefícios contra uma mesma pessoa, só poderá ser utilizada de novo contra ela após 24 horas.',
    ),
    sing(
        'media',
        'aura-assassina',
        'Aura Assassina',
        'Você emana uma presença intimidadora, que não está relacionada à sua aparência física, seja por ter enfrentado inúmeras situações mortais ou por guardar uma intensa fúria dentro de si. Enquanto estiver com todos os seus Pontos de Vida, a primeira jogada de ataque (comum) realizada contra você durante um encontro de combate é feita com desvantagem.',
    ),
    sing(
        'media',
        'estudioso',
        'Estudioso',
        'Desde a infância, você nutriu uma profunda admiração pelo caminho acadêmico. Você recebe o dobro do seu Bônus de Proficiência em uma perícia em que você já seja proficiente: escolha entre "História", "Investigação", "Medicina", "Natureza" ou "Sobrevivência".',
        {},
        { escolha: { rotulo: 'Perícia', opcoes: PERICIAS_ESTUDIOSO } },
    ),
    sing(
        'media',
        'fisico-perfeito',
        'Físico Perfeito',
        'Seu corpo está sempre bem cuidado e tem a capacidade assustadora de se recuperar de ferimentos e esforços mais leves em poucos minutos. O descanso curto, para você, tem uma duração mínima de 15 minutos.',
    ),
    sing(
        'media',
        'negativo',
        'Negativo',
        'Você é naturalmente negativo, sempre pessimista e esperando o pior. Quando algo dá errado, você simplesmente aceita a situação. Por definição, nada que alguém faça ou diga, nem mesmo habilidades de Akuma no Mi, pode deixá-lo mais deprimido ou desmotivado. Você é imune às condições "Empoderado", "Enfeitiçado", "Enfurecido", "Letárgico" e "Sonolento".',
    ),
    sing(
        'media',
        'vocacao',
        'Vocação',
        'Você sente que nasceu para realizar algo específico na vida: ligado à sua profissão (medicina, carpintaria) ou a uma atividade artística, intelectual ou pessoal (pintar um quadro, compor uma música, concluir uma grande obra), sempre com aprovação do Narrador. Ao concluir uma dessas tarefas significativas, você se sente plenamente realizado e pode escolher um dos benefícios: recuperar 1 Nível de Exaustão; recuperar PV em valor igual a 3 vezes o seu nível de personagem; ou recuperar PP em valor igual ao seu nível. Os benefícios só podem ser obtidos novamente após 7 dias.',
        {},
        { escolha: { rotulo: 'A tarefa (vocação)' } },
    ),
    // ------------------------------------------------------------------ Singularidades Fortes
    sing(
        'forte',
        'ambicao-do-rei',
        'Ambição do Rei',
        'Você tem uma ambição grandiosa e inabalável, acompanhada de uma força de vontade que transcende limites. Em situações de grande estresse, você é capaz de manifestar uma aura misteriosa: você se torna capaz de manifestar o Haki do Rei, no estágio "Inexperiente", respeitando todas as regras do Capítulo 7. Só está disponível com a aprovação do Narrador (o mestre libera o Haki do Rei na aba Haki).',
        {},
        { aprovacaoDoMestre: true },
    ),
    sing(
        'forte',
        'grande-planejador',
        'Grande Planejador',
        'Você tem grande habilidade para arquitetar planos complexos e alcançar seus objetivos sem se envolver diretamente. Sempre que tiver um objetivo claro e específico para provocar um evento (a explosão de uma bomba em determinada ilha, um apagão elétrico em uma cidade, forçar o encontro de dois piratas inimigos poderosos, roubar a chuva de um país...), apresente o plano ao Narrador, que determina a quantidade de semanas necessárias. A cada semana, você deve dedicar 1 dia inteiro exclusivamente à coordenação do plano e gastar 1d10 × ฿ 200.000 (subornos, contratações, logística, informações e articulações). Em eventos contínuos, esses custos e a dedicação semanal permanecem até que o evento seja encerrado ou interrompido. Em planos complexos, o Narrador pode determinar que suas ações foram rastreadas ou frustradas por fatores externos (terceiros, clima, agentes políticos, traições internas ou má sorte).',
    ),
    sing(
        'forte',
        'haki-observacao-inato',
        'Haki da Observação Inato',
        'Você nasceu com grande talento para o Haki da Observação. Fora de batalha, pode usar as características "Perceber Emoções", "Perceber Presença" e "Perceber Desafio" do Haki da Observação. Ao escolher esta individualidade, o Haki da Observação será automaticamente seu Haki principal e, ao adquirir controle sobre o Haki da Observação, você recebe 5 Pontos de Ambição (o despertar do Haki). Só o mestre a concede.',
        {},
        { aprovacaoDoMestre: true },
    ),
    sing(
        'forte',
        'pau-para-toda-obra',
        'Pau-para-Toda-Obra',
        'Ao longo da vida, você se dedicou a aprender mais, transitando por diferentes áreas de conhecimento. Você cria seu personagem com duas profissões, em vez de apenas uma, e recebe todos os benefícios iniciais de ambas, exceto as proficiências em perícias e ferramentas: só recebe esses benefícios de uma das profissões iniciais (escolha a segunda na aba Profissões).',
    ),
    sing(
        'forte',
        'recuperacao-espantosa',
        'Recuperação Espantosa',
        'O personagem possui uma recuperação fora do normal. O descanso longo, para você, tem uma duração mínima de 4 horas ou você pode optar por descansar 8 horas e recuperar 1 Nível de Exaustão adicional. Não acumula com outras características que façam você recuperar Níveis de Exaustão, recuperando, no máximo, 1 Nível de Exaustão extra por descanso longo.',
    ),
    sing(
        'forte',
        'voz-de-todas-as-coisas',
        'Voz de Todas as Coisas',
        'Você nasceu com um poder de características únicas e muito misterioso: em algumas situações, é capaz de ouvir a "voz" de qualquer ser vivo e até objetos inanimados (sem necessariamente conseguir se comunicar). Ao ver um objeto misterioso, textos indecifráveis ou animais raros, o Narrador pode solicitar um Teste de Atributo de Vontade (Sobrenatural), com CD determinada por ele. Ao ser bem-sucedido, você ainda não será capaz de ler ou entender, mas recebe os sentimentos que queriam ser passados.',
    ),
    sing(
        'forte',
        'zona',
        'Zona',
        'Ao obter um 20 natural em uma rolagem do d20, durante 1 minuto, você entra em um estado intenso de foco e euforia absoluta. Enquanto estiver nesse estado, você ignora completamente os efeitos de Níveis de Exaustão e pode manter simultaneamente mais de uma característica que exija concentração, sem testes para mantê-las. Não poderá ser usada de novo até o término de um descanso longo.',
        { usos: { max: 1, descanso: 'longo' } },
    ),
    // ------------------------------------------------------------------ Defeitos Suaves
    def(
        'suave',
        'casamento-marcado',
        'Casamento Marcado',
        'Você fez parte de uma família ou organização poderosa que sempre o tratou como alguém descartável e foi prometido como agrado, moeda de troca ou cônjuge político. Para garantir que o acordo seja cumprido, seus antigos aliados intensificam a perseguição à sua tripulação (a Marinha aumenta a vigilância, grandes piratas são incentivados por recompensas). Enquanto você não se apresentar voluntariamente a essa organização, sempre que passar um dia viajando de navio ou ao adentrar uma nova ilha ou localidade, deve realizar um Teste de Atributo de Vontade (Sorte) CD 18. Em caso de falha, você encontra emissários hostis preparados para capturá-lo ou forçá-lo a cumprir o acordo.',
    ),
    def(
        'suave',
        'chantagem',
        'Chantagem',
        'Alguém de grande influência tem um segredo seu, um objeto importante ou mantém como refém uma pessoa muito preciosa para você (deve ser previamente combinado com o Narrador). De tempos em tempos, emissários dessa pessoa surgem para instruí-lo a cumprir demandas, as quais podem acarretar sérios perigos ou entrar em conflito com seus princípios.',
    ),
    def(
        'suave',
        'churriado',
        'Churriado',
        'Você tem muitos pontos positivos, mas a força física certamente não é uma delas, e por mais que invista tempo em treinar seu corpo, o resultado vai acabar sendo só uma aparência melhor. Você tem desvantagem em qualquer Teste de Atributo ou Salvaguarda de Força.',
        {
            efeitos: [
                { alvo: 'teste.for', modo: 'desvantagem' },
                { alvo: 'salv.for', modo: 'desvantagem' },
            ],
        },
    ),
    def(
        'suave',
        'dupla-personalidade',
        'Dupla Personalidade',
        'Sua mente abriga duas personalidades distintas, com valores, comportamentos ou objetivos conflitantes. No início de cada dia, ou sempre que você falhar em uma Salvaguarda de Vontade CD 15 em uma situação de estresse intenso (humilhação, medo extremo, dor emocional, perigo iminente), o Narrador pode determinar qual personalidade assume o controle. Enquanto a secundária estiver ativa: o Narrador pode impor decisões, falas ou atitudes coerentes com ela; você sofre desvantagem em todas as perícias que for proficiente; e falha automaticamente em Salvaguardas de Sabedoria e Vontade (ignorando sucessos automáticos). A personalidade original retorna após um descanso longo ou quando um evento marcante ocorre (definido pelo Narrador).',
    ),
    def(
        'suave',
        'falta-de-higiene',
        'Falta de Higiene',
        'Você foge da água como se ela fosse um veneno, e sua aversão a banhos e à limpeza afeta a forma como as pessoas o veem. Você falha automaticamente em Testes de Atributo de Presença (Persuasão), ignorando sucessos automáticos.',
    ),
    def(
        'suave',
        'falta-de-sorte',
        'Falta de Sorte',
        'A vida parece sempre rir da sua cara: não importa o quanto tente e se prepare, alguma coisa dará errado. Uma vez por dia, o Narrador pode transformar uma rolagem bem-sucedida em uma falha, sua ou de qualquer outro, desde que seja para atrapalhar sua vida.',
    ),
    def(
        'suave',
        'hipocondriaco',
        'Hipocondríaco',
        'Ao ouvir alguém mencionar uma doença desconhecida (mesmo que não exista) você entra em estado de alerta extremo. Caso falhe em uma Salvaguarda de Constituição CD 16, após o próximo descanso longo você passa a sentir sintomas psicossomáticos dessa doença por 1d4 dias.',
    ),
    def(
        'suave',
        'medroso',
        'Medroso',
        'O medo é seu companheiro constante: qualquer coisa possivelmente assustadora o impressiona e faz com que esbugalhe os olhos e grite, mesmo que você seja capaz de fazer o mesmo ou que a criatura seja mais fraca. Você é sempre o último nas ordens de iniciativa. Caso outra criatura tenha esta individualidade, o Narrador decide quem irá primeiro.',
    ),
    def(
        'suave',
        'monstruoso',
        'Monstruoso',
        'Sua aparência é repulsiva, assustadora ou profundamente desconfortável para padrões sociais comuns. Você recebe 1 nível de Preconceito (ou aumenta em 1 nível, caso já possua). Essa monstruosidade pode ser parcialmente ocultada com roupas adequadas, capas ou máscaras, a critério do Narrador.',
    ),
    def(
        'suave',
        'mudo',
        'Mudo',
        'Você é incapaz de produzir fala; para se comunicar precisa recorrer a gestos, escrita, linguagem de sinais ou outros meios. Você falha automaticamente em Testes de Atributo que dependam diretamente da fala (ignorando sucessos automáticos).',
    ),
    def(
        'suave',
        'narcisista',
        'Narcisista',
        'Você ama a si mesmo e dedica grande atenção à própria aparência. Sempre que estiver sujo, desalinhado ou com a aparência comprometida, todos os seus Testes de Atributo sofrem -3 de penalidade.',
    ),
    def(
        'suave',
        'orgulho-cego',
        'Orgulho Cego',
        'Você é incapaz de ignorar provocações e insultos de qualquer tipo direcionados a você, seus companheiros ou entes queridos, independentemente de quão inapropriada seja a situação. Você falha automaticamente em testes contra Provocação e não pode ser acalmado (ignorando sucessos automáticos).',
    ),
    def(
        'suave',
        'rosto-debochado',
        'Rosto Debochado',
        'Sua aparência inspira antipatia e transmite a impressão constante de deboche. Sempre que um encontro se inicia e não houver diferença relevante para as criaturas inimigas na escolha de alvos, elas optarão por atacar você. Seu rosto também desperta irritação na Marinha, que se recusa a conceder grandes recompensas por seus feitos: a cada atualização de recompensa, o valor do seu cartaz aumenta em, no máximo, 1.000 Bellys.',
    ),
    def(
        'suave',
        'sedutor-incorrigivel',
        'Sedutor Incorrigível',
        'Você sente um impulso constante de tentar seduzir qualquer pessoa que se encaixe em seus critérios de interesse, mesmo em situações inadequadas. Enquanto estiver na presença direta de alguém por quem sente atração, você não pode manter concentração para sustentar Técnicas ou características.',
    ),
    def(
        'suave',
        'senso-de-direcao-ruim',
        'Senso de Direção Ruim',
        'Você é tão ruim com senso de direção que pode se perder em um corredor sem portas ou janelas. Sempre que não estiver em um encontro e se deslocar de um lugar para outro, andando ou correndo, jogue um d6: em um resultado 3 ou menor, você se perde e pode parar a até 500 metros do ponto de partida. Se estiver acompanhado, pode jogar o d6 duas vezes e escolher o resultado.',
    ),
    def(
        'suave',
        'sinceridade-excessiva',
        'Sinceridade Excessiva',
        'Você é incapaz de mentir, por valores morais ou dificuldade em ocultar a verdade; por mais que se esforce, sempre será óbvio que não se trata da verdade. Você falha automaticamente em Testes de Atributo de Presença (Enganação), ignorando sucessos automáticos.',
    ),
    def(
        'suave',
        'vicio',
        'Vício',
        'Você é dependente de uma substância específica (álcool, nicotina, açúcar, drogas, determinados alimentos...). Sempre que ficar sem consumi-la, os efeitos da abstinência se acumulam: 1 dia sem consumo, desvantagem nas jogadas de iniciativa; 2 dias, nenhum benefício ao finalizar descansos curtos; a partir do 3º dia, para cada dia adicional você perde 1 PP do valor máximo. Todos os efeitos negativos, incluindo a redução dos PP máximos, são removidos após um descanso longo, desde que o vício tenha sido satisfeito antes desse descanso.',
        {},
        { escolha: { rotulo: 'A substância' } },
    ),
    def(
        'suave',
        'voz-fina',
        'Voz Fina',
        'Você possui uma voz tão fina que chega a ser engraçada, e não importa o quanto tente engrossar ou disfarçar, nem o seu tamanho ou aparência. Você falha automaticamente em Testes de Atributo de Presença (Intimidação), ignorando sucessos automáticos.',
    ),
    def(
        'suave',
        'teimoso',
        'Teimoso',
        'Depois de tomar uma decisão ou concordar com um plano, você se apega a ele de forma absoluta; mudar de ideia é visto como fraqueza. Sempre que recuar ou alterar uma decisão previamente tomada, perde 1 ponto de atributo de Vontade. Cada ponto perdido é recuperado após 1d4 semanas.',
    ),
    def(
        'suave',
        'trapalhao',
        'Trapalhão',
        'Sempre que se move, você esbarra em tudo pela frente ou tropeça no nada, e não consegue carregar nada sem que acabe no chão. Ao realizar uma falha crítica em uma jogada de ataque (comum), além de errar o golpe, desencadeia um dos efeitos, de acordo com o Narrador: acerta a si mesmo ou um aliado próximo, causando até 5 pontos de dano; deixa a arma cair no chão; ou tropeça e recebe a condição "Caído".',
    ),
    // ------------------------------------------------------------------ Defeitos Médios
    def(
        'media',
        'coracao-mole',
        'Coração Mole',
        'Você não aguenta ver os outros sofrerem e evita qualquer situação que implique causar dor física ou emocional a alguém que não mereça ou não possa se defender. Suas jogadas de ataque (comum ou Técnicas), ou qualquer jogada com a intenção de prejudicar criaturas que possam lhe causar empatia, recebem desvantagem.',
    ),
    def(
        'media',
        'dependente',
        'Dependente',
        'Você se sente totalmente inseguro quando não tem seus companheiros para ajudar ou proteger, por medo, insegurança ou por querer se mostrar. Enquanto não estiver com nenhum companheiro ou criatura que esteja cooperando consigo dentro do seu raio de visão, você recebe -2 em todas as suas jogadas com o d20.',
    ),
    def(
        'media',
        'divida-de-jogo',
        'Dívida de Jogo',
        'Você deve uma quantia absurda de dinheiro a figuras extremamente poderosas e influentes, tão elevada que talvez nunca consiga quitá-la; tentar enganar ou despistar seus credores só aumenta a determinação deles em capturá-lo. Uma vez por semana, em um dia predefinido pelo Narrador, um emissário aparece para cobrar 10d10 milhões de Bellys. Se o pagamento não for feito, no início do dia seguinte você faz uma Salvaguarda de Vontade com CD igual ao seu nível + o número de semanas em atraso. Se falhar, independentemente de onde esteja, você nunca estará verdadeiramente seguro: o personagem é considerado perdido, podendo morrer por envenenamento, sabotagem ou sequestro, a critério do Narrador.',
    ),
    def(
        'media',
        'ferida-fantasma',
        'Ferida Fantasma',
        'Você possui uma cicatriz, visível ou não, resultante de um acontecimento terrível (uma derrota, perda de pessoas queridas ou determinação quebrada, a definir com o Narrador). As dores retornam sempre que você enfrenta momentos decisivos: o Narrador pode exigir uma Salvaguarda de Vontade CD 16 até 3 vezes entre descansos longos. Em falha, você não pode realizar ações nem ações poderosas até o início do seu próximo turno e sofre 10 pontos de dano Psíquico. Diante de quem lhe causou o trauma ou de acontecimentos relacionados, a Salvaguarda é feita com desvantagem e o Narrador pode dobrar a quantidade de Salvaguardas entre descansos longos.',
    ),
    def(
        'media',
        'ganancioso',
        'Ganancioso',
        'Você realmente ama dinheiro. Sempre que alguém falar de formas de ganhar quantidades consideráveis de dinheiro (um pedido, uma missão, a localização de um tesouro), você não consegue resistir; se perder a oportunidade, é acometido por uma grande depressão. Caso se recuse a ganhar, perca dinheiro ou chances de enriquecer, recebe -2 em todas as jogadas de ataque (comum ou Técnicas), Testes de Atributo e Salvaguardas por até 1d6 dias.',
    ),
    def(
        'media',
        'linhagem-demoniaca',
        'Linhagem Demoníaca',
        'Você é filho ou descendente, de qualquer grau, de uma figura conhecida em todo o mundo e considerada execrável por grande parte da sociedade. Quando aqueles que odeiam essa pessoa descobrem sua relação com ela, direcionam todo esse ódio a você. Você recebe preconceito severo de qualquer pessoa que odeie o seu antepassado.',
    ),
    def(
        'media',
        'paranoico',
        'Paranoico',
        'Você não confia em ninguém, nem em seus amigos. Nunca pede nem aceita nenhuma ajuda, nem mesmo o tratamento de seus ferimentos, e não consegue descansar ou dormir direito, mesmo em lugar aparentemente seguro. Você precisa de, no mínimo, 2 horas para se acalmar e achar que está tudo certo, para começar um descanso curto ou longo.',
    ),
    def(
        'media',
        'preguicoso',
        'Preguiçoso',
        'No início de cada dia, role 1d4: o resultado indica a quantidade máxima de tarefas que você consegue realizar sem sofrer penalidades. Após exceder esse limite, seus PP atuais são reduzidos à metade (para baixo). Exemplos de tarefas (o Narrador pode estipular outras): desempenhar sua profissão durante o dia; participar de um encontro de combate; executar pedidos, ordens ou favores que não tenham partido de você. A penalidade só ocorre uma vez por dia e é redefinida ao final de um descanso longo.',
    ),
    // ------------------------------------------------------------------ Defeitos Fortes
    def(
        'forte',
        'consumidor-compulsivo',
        'Consumidor Compulsivo',
        'Você é impulsivo quando se trata de compras e gasta dinheiro de maneira descontrolada em itens muitas vezes inúteis ou prejudiciais. Sempre que entrar em uma loja ou mercado, faça uma Salvaguarda de Vontade CD 18 para evitar gastar 50% do dinheiro total que você possuir.',
    ),
    def(
        'forte',
        'doenca-terminal',
        'Doença Terminal',
        'Você sofre de uma doença terrível e incurável, que consome lentamente sua vitalidade; seu corpo está em constante declínio. Sempre que você cair a 0 Pontos de Vida, perde permanentemente 1 ponto do atributo Constituição. Se esse atributo chegar a 0, o personagem morre.',
    ),
    def(
        'forte',
        'ignorante',
        'Ignorante',
        'Você acredita que já detém praticamente todo o conhecimento necessário para alcançar seus objetivos, encarando novos aprendizados como perda de tempo. Você não pode aprender nenhuma profissão além de uma única escolhida na criação do personagem, sob nenhuma circunstância, nem aumentar a graduação dessa profissão.',
    ),
    def(
        'forte',
        'mediocre',
        'Medíocre',
        'Seu personagem não se destaca em nada do que faz, vivendo à sombra da mediocridade e sendo incapaz de brilhar nos momentos mais decisivos. Você nunca recebe dados de dano adicionais, acerto automático ou quaisquer outros benefícios e características que seriam concedidos por acertos críticos naturais em jogadas com o d20.',
    ),
    def(
        'forte',
        'pacifista',
        'Pacifista',
        'Você adota uma postura pacifista, buscando solucionar conflitos pelo diálogo e evitando a violência sempre que possível. Só consegue executar ações que possam causar dano quando um aliado estiver com menos de 50% de PV ou alguma criatura não combatente estiver com risco de vida. Quando sozinho, você sempre se rende ou busca o caminho da não violência.',
    ),
    def(
        'forte',
        'sonolencia',
        'Sonolência',
        'Por algum motivo, você está sempre com sono, tenha dormido normalmente ou acabado de acordar. No início de um encontro de combate, role 1d6: com 3 ou menos, passa a primeira rodada com a condição "Inconsciente". Fora de combate, o Narrador também pode pedir essa rolagem a qualquer momento; com 3 ou menos, você fica "Inconsciente" até ser acordado ou até que se passem 10 minutos.',
    ),
    def(
        'forte',
        'trauma-profundo',
        'Trauma Profundo/Fobia',
        'Em seu passado, você passou por uma situação traumática irreparável (uma perda terrível, agressões sofridas ou outro evento marcante). Sempre que se deparar com uma situação semelhante ou com algum gatilho que traga essas memórias, faça uma Salvaguarda de Vontade CD 17: em sucesso, supera momentaneamente o trauma; em falha, todas as suas jogadas com d20 sofrem -5 durante 1 minuto.',
        {},
        { escolha: { rotulo: 'O trauma ou fobia' } },
    ),
];

export const individualidadePorId = (tipo: TipoDeIndividualidade, id: string): Individualidade | undefined =>
    INDIVIDUALIDADES.find((x) => x.tipo === tipo && x.id === id);
export const espacosDe = (nivel: NivelDeIndividualidade): number => NIVEIS_DE_INDIVIDUALIDADE.find((n) => n.id === nivel)!.espacos;

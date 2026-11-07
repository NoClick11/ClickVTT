import type { EfeitoBruto } from '../../../../nucleo/efeitos/efeitos.ts';
import type { EspecieDados, TracoDados } from './tipos.ts';

/** Traços Culturais: todas as espécies "culturais" (sem Ancestralidade) recebem pontos de treinamento. */
export const TRACO_CULTURAL: TracoDados = {
    id: 'tracos-culturais',
    nome: 'Traços Culturais',
    descricao:
        'Você recebe uma quantidade de Pontos de Treinamento igual ao seu modificador de Sabedoria, desde que ele seja positivo, para adquirir os treinamentos do Capítulo 5. Na criação, os pontos viram treinamentos na hora, sem tutor ou tempo de treinamento. Depois, sempre que o modificador de Sabedoria aumentar permanentemente, você recebe 1 ponto por ponto de aumento. Com modificador 0 ou negativo você não recebe pontos até que ele fique positivo; reduções posteriores não fazem perder treinamentos já adquiridos.',
};

/** Perícias de Presença: "Testes de Atributo de Presença" valem também para elas. */
const PERICIAS_PRE = ['atuacao', 'enganacao', 'intimidacao', 'persuasao', 'provocacao'];
const emTodosOsTestes = (valor: number): EfeitoBruto[] => [
    { alvo: 'teste.*', modo: 'soma', valor },
    { alvo: 'pericia.*', modo: 'soma', valor },
];

const heatOuElectro = (id: string, nome: string, tipoDano: string, quem: string, outros: string): TracoDados => ({
    id,
    nome,
    tipo: 'ativa',
    restrito: true,
    acao: 'bonus',
    grupoRodada: 'ofensivo',
    alternativo: 5,
    etiquetas: ['Um uso por rodada (Heat, Electro, Potencializador)'],
    usos: { porNivel: true, descanso: 'longo' },
    efeitos: [
        { alvo: 'dano.tecnica', modo: 'dados', valor: '1d10' },
        { alvo: 'dano.arma', modo: 'dados', valor: '1d10' },
    ],
    descricao: `Uma vez por rodada, usando uma ação bônus, ${quem} pode adicionar 1d10 de dano ${tipoDano} em uma jogada de ataque (comum ou Técnicas). Pode ser usada uma quantidade de vezes igual ao seu nível de personagem, e todos os usos voltam ao fim de um descanso longo. Alternativamente, pode ser usada junto com a jogada de ataque, sem ação bônus, até 5 vezes (respeitado o limite do nível): com 10 usos, usar a forma alternativa 5 vezes deixa 5 usos para a forma padrão. Só pode ser usada uma vez por rodada, em qualquer forma, e o mesmo vale para ${outros}. Em cada rodada você usa apenas uma dessas características. Ligue a característica para somar o dano extra nos ataques e nas técnicas.`,
});

const necessidades =
    'Não é possível escolher mais de um benefício restrito (Corpo Pequeno, Hóspede Feérico, Força Colossal, Heat, Electro, Corpo Marinho).';
void necessidades;

export const ESPECIES: EspecieDados[] = [
    {
        id: 'humano',
        nome: 'Humanos',
        pv: 10,
        preconceito: 'Inexistente',
        tamanhoCm: [150, 400],
        categoria: 'Médio',
        pesoKg: [65, 600],
        movimento: { normal: 9, nado: 4.5, escalada: 0, voo: 0 },
        tracoCultural: false,
        ancestralidade: false,
        beneficios: [
            {
                id: 'adaptacao',
                nome: 'Adaptação',
                descricao:
                    'O humano escolhe 3 perícias para adicionar sua proficiência, à sua escolha, exceto Haki, Sobrenatural e Sorte. Regra opcional: você pode escolher receber apenas 1 perícia e não receber a Dificuldade da Espécie "Aspectos Humanos".',
                escolhaPericias: { quantidade: 3, nivel: 1, excluir: ['haki', 'sobrenatural', 'sorte'] },
            },
        ],
        dificuldade: {
            id: 'aspectos-humanos',
            nome: 'Aspectos Humanos',
            descricao:
                'A humanidade é imensa e plural, capaz de inúmeros feitos e também de incontáveis defeitos. Você escolhe uma falha de caráter para o seu personagem.',
            falhas: [
                {
                    id: 'ganancia',
                    nome: 'Ganância',
                    tipo: 'ativa',
                    descricao:
                        'Desde que você esteja na frente de um tesouro, ou algum tesouro esteja relacionado a um Teste de Atributo ou Salvaguarda, você recebe -2 no teste. Ligue a característica enquanto isso valer.',
                    efeitos: [...emTodosOsTestes(-2), { alvo: 'salv.*', modo: 'soma', valor: -2 }],
                },
                {
                    id: 'gula',
                    nome: 'Gula',
                    descricao: 'É necessário o dobro de comida e água para você não sofrer as consequências de falta de alimentação.',
                },
                {
                    id: 'inveja',
                    nome: 'Inveja',
                    tipo: 'ativa',
                    descricao:
                        'Quando, durante a mesma rodada, uma ou mais criaturas forem bem-sucedidas em um Teste de Atributo ou Salvaguarda no qual você tenha falhado, você recebe -2 no seu próximo Teste de Atributo. A penalidade permanece até ser aplicada ou até o final do dia e não se acumula consigo mesma. Ligue a característica quando a penalidade passar a valer e desligue depois do próximo teste.',
                    efeitos: emTodosOsTestes(-2),
                },
                {
                    id: 'ira',
                    nome: 'Ira',
                    descricao: 'Você falha automaticamente em Testes de Atributo contra Provocação (ignorando sucessos automáticos).',
                },
                {
                    id: 'luxuria',
                    nome: 'Luxúria',
                    descricao: 'Criaturas do sexo pelo qual o seu personagem sinta atração recebem +2 em Testes Resistidos contra você.',
                },
                {
                    id: 'preguica',
                    nome: 'Preguiça',
                    descricao:
                        'Você leva o dobro do tempo para concluir um descanso curto e recebe 1 Nível de Exaustão adicional sempre que sofrer Exaustão por não realizar um descanso longo.',
                },
                {
                    id: 'orgulho',
                    nome: 'Orgulho',
                    descricao: 'Você recebe -1 em Testes de Atributo de Presença.',
                    efeitos: [
                        { alvo: 'teste.pre', modo: 'soma', valor: -1 },
                        ...PERICIAS_PRE.map((p): EfeitoBruto => ({ alvo: `pericia.${p}`, modo: 'soma', valor: -1 })),
                    ],
                },
            ],
        },
        variantes: [
            {
                id: 'comum',
                nome: 'Humanos Comuns',
                descricao:
                    'A Espécie mais presente em todo o mundo e bastante diversificada em cultura, modo de agir e aparência. Por serem tão imprevisíveis, são a Espécie mais perigosa de todas; apesar dos atributos físicos menos avantajados, sua capacidade de adaptação é acima do comum.',
                beneficio: {
                    id: 'aptidao-natural',
                    nome: 'Aptidão Natural',
                    descricao: 'Você escolhe uma perícia na qual possa usar o seu Bônus de Proficiência e dobra o seu Bônus de Proficiência nela.',
                    escolhaPericias: { quantidade: 1, nivel: 2, excluir: [], soProficientes: true },
                },
            },
            {
                id: 'humanozarrao',
                nome: 'Humanozarrões',
                descricao:
                    'Humanos comuns com corpos de proporções absurdas. Há casos com mais de 8 metros, o que pode assustar até os pais, se tiverem uma estatura comum.',
                beneficio: {
                    id: 'colosso',
                    nome: 'Colosso',
                    descricao: 'Seu tamanho aumenta para Grande e você recebe +2 em Salvaguardas de Força.',
                    tamanho: 'Grande',
                    efeitos: [{ alvo: 'salv.for', modo: 'soma', valor: 2 }],
                },
            },
            {
                id: 'bracos-longos',
                nome: 'Tribo Braços Longos',
                descricao:
                    'Uma tribo com duas articulações nos membros superiores (dois cotovelos em cada braço), com mais alcance e melhor mobilidade. Costumam vestir Changpao e ter algo escrito em kanji nas roupas. Por uma guerra de mais de mil anos com a Tribo Pernas Longas, há grande inimizade entre os dois povos.',
                beneficio: {
                    id: 'bracos-especiais',
                    etiquetas: ['Alcance corpo a corpo 3 m (braços)'],
                    nome: 'Braços Especiais',
                    descricao:
                        'Alcance de 3 metros em jogadas de ataque (comum) corpo a corpo, quando utilizando os braços, e +2 em Testes de Atributo de Destreza (Prestidigitação).',
                    efeitos: [
                        { alvo: 'pericia.prestidigitacao', modo: 'soma', valor: 2 },
                        { alvo: 'alcance.corpo', modo: 'min', valor: 30 },
                    ],
                },
            },
            {
                id: 'kuja',
                nome: 'Tribo Kujas',
                descricao:
                    'Uma tribo composta exclusivamente por mulheres guerreiras, nascidas em Amazon Lily, com cultura isolacionista e pouco conhecimento do mundo exterior. Têm nomes de flores, dão à luz apenas mulheres e odeiam qualquer tipo de homem, proibidos de entrar em seu território. Ser uma kuja torna obrigatória a Dificuldade "Aspectos Humanos", com duas falhas de caráter em vez de uma.',
                falhasObrigatorias: 2,
                beneficio: {
                    id: 'cobra-companheira',
                    companheiro: 'cobra-belica',
                    acoes: [
                        {
                            rotulo: 'Restringir: Incapacitado (Força CD 16)',
                            acao: 'bonus',
                            tipo: 'condicao',
                            alvo: 'mirado',
                            condicao: 'incapacitado',
                            atributo: 'for',
                            cd: 16,
                        },
                        {
                            rotulo: 'Restringir: Agarrado (Força CD 16)',
                            acao: 'bonus',
                            tipo: 'condicao',
                            alvo: 'mirado',
                            condicao: 'agarrado',
                            atributo: 'for',
                            cd: 16,
                        },
                    ],
                    etiquetas: ['Arco de Cobra: +prof, +2 e atributo primário no ataque e no dano com flechas'],
                    nome: 'Cobra Companheira',
                    descricao:
                        'Toda kuja recebe, ao nascer, uma cobra para acompanhá-la por toda a vida. Você escolhe o nome da cobra, e ela entende tudo que você falar, podendo fazer pequenas tarefas. Ela não recebe dano de jogada de ataque (comum ou Técnicas) ou Salvaguarda que não a tenha explicitamente como alvo, enquanto ocupar o mesmo espaço que você. É totalmente obediente e age no mesmo turno que você.\n\nCOBRA BÉLICA: Nível de Desafio 1, 200 XP, Pontos de Poder -. Classe de Resistência 15, PV 39 (7d8+7), proficiência +2, Pequeno (1,5 m), deslocamento 9 m, nado 9 m. FOR 11 (0), DES 20 (+5), CON 13 (+1), SAB 10 (0), PRE 10 (0), VON 10 (0). Perícia: Furtividade +7. Salvaguarda: Destreza +7. Invulnerável à condição Envenenado. Aspectos Agarrador: vantagem nas jogadas de ataque (comum) contra criatura agarrada por ela. Picada: ataque corpo a corpo +7, alcance 1,5 m, 10 (2d4+5) de dano de Veneno; o alvo faz Salvaguarda de Constituição CD 16 ou fica Envenenado por 1 minuto (1d4 de dano de Veneno no início de cada turno), repetindo a salvaguarda no fim de cada turno; ao ter sucesso, fica imune a esse veneno por 24 horas.\n\nUSANDO SUA COBRA (uma vez por turno, sem ação): Arco de Cobra: a cobra vira um arco (propriedades de um arco normal) e você pode usar flechas em ataque à distância com arma, somando o Bônus de Proficiência, usando seu atributo primário para o ataque e o dano e recebendo +2 no ataque (comum) e no dano. Restringir: com uma ação bônus, a cobra se prende aos membros de uma criatura Grande ou menor como algemas de aço; a criatura fica Incapacitada ou Agarrada (à sua escolha) e tenta se soltar com Salvaguarda de Força CD 16 no início de cada turno. Para isso a cobra faz o ataque corpo a corpo e substitui o dano por essa característica; até o agarramento acabar, ela fica Impedida.',
                },
            },
            {
                id: 'pernas-longas',
                nome: 'Tribo Pernas Longas',
                descricao:
                    'Uma tribo de pernas muito mais alongadas que as dos humanos comuns e com musculatura forte. Costumam deixar as pernas expostas e ter uma tatuagem em uma das coxas. Está em guerra com a Tribo Braços Longos.',
                beneficio: {
                    id: 'pernas-especiais',
                    etiquetas: ['Alcance corpo a corpo 3 m (pernas)'],
                    efeitos: [{ alvo: 'alcance.corpo', modo: 'min', valor: 30 }],
                    nome: 'Pernas Especiais',
                    descricao:
                        'Alcance de 3 metros em jogadas de ataque (comum) corpo a corpo, quando utilizando as pernas, e seu deslocamento normal se torna 12 metros.',
                    movimento: { normal: 12 },
                },
            },
        ],
        lore: { aparencia: '', patria: '', cultura: '', comportamento: '', relacao: '' },
    },
    {
        id: 'anao',
        nome: 'Anões',
        pv: 8,
        preconceito: 'Débil',
        tamanhoCm: [10, 15],
        categoria: 'Miúdo',
        pesoKg: [0.5, 2],
        movimento: { normal: 9, nado: 4.5, escalada: 0, voo: 0 },
        tracoCultural: true,
        ancestralidade: false,
        beneficios: [
            {
                id: 'corpo-pequeno',
                nome: 'Corpo Pequeno',
                restrito: true,
                descricao:
                    'Enquanto o anão e seus mestiços permanecerem na categoria Miúdo, eles têm: ESTÔMAGO PEQUENO (itens consumíveis e alimentos feitos para criaturas Médias ou maiores valem com metade da quantidade); PISCAR (se não estiver Impedido, você se move extremamente rápido, some da visão de todos e reaparece em um local desocupado que possa ver, a até 9 metros, sem gastar ação; use até 3 vezes e recupere todos os usos em um descanso longo); ANDAR DAS FADAS (se não estiver Impedido, vantagem em Destreza (Furtividade) fora de um encontro de batalha; dentro de um encontro, pode tentar se esconder à plena vista com uma ação bônus, desde que veja um local desocupado em que caiba e que dê cobertura total).',
                partes: [
                    {
                        id: 'estomago-pequeno',
                        nome: 'Estômago Pequeno',
                        descricao:
                            'Itens consumíveis e alimentos feitos para criaturas Médias ou maiores valem com metade da quantidade usual para os mesmos bônus. Vale enquanto você for Miúdo.',
                    },
                    {
                        id: 'piscar',
                        acao: 'livre',
                        nome: 'Piscar',
                        usos: { max: 3, descanso: 'longo' },
                        descricao:
                            'Se não estiver Impedido, você se move extremamente rápido, some da visão de todos e reaparece em um local desocupado que possa ver, a até 9 metros (nenhuma ação necessária). Até 3 usos; todos voltam em um descanso longo. Vale enquanto você for Miúdo.',
                    },
                    {
                        id: 'andar-das-fadas',
                        nome: 'Andar das Fadas',
                        tipo: 'ativa',
                        descricao:
                            'Se não estiver Impedido, vantagem em Destreza (Furtividade) quando não estiver em um encontro de batalha (ligue a característica fora de combate). Dentro de um encontro, pode tentar se esconder à plena vista com uma ação bônus, desde que veja um local desocupado em que caiba e que dê cobertura total. Vale enquanto você for Miúdo.',
                        efeitos: [{ alvo: 'pericia.furtividade', modo: 'vantagem' }],
                    },
                ],
            },
            {
                id: 'hospede-feerico',
                etiquetas: ['Hospedado: não pode ser alvo; o hospedeiro divide o dano'],
                acoes: [{ rotulo: 'Hospedar-se no alvo mirado (ou sair)', acao: 'livre', tipo: 'hospedar', alvo: 'mirado' }],
                nome: 'Hóspede Feérico',
                restrito: true,
                descricao:
                    'Enquanto o anão e seus mestiços mantiverem a categoria Miúdo, podem ocupar o mesmo espaço de criaturas voluntárias Médias ou maiores, movendo-se apenas pelo corpo da criatura e sendo movidos junto com ela. Compartilhando o espaço, você não pode ser alvo de jogadas de ataque (comum ou Técnicas) nem sofrer danos ou efeitos que exijam Salvaguardas, mas não pode usar ações poderosas e sofre metade de todo o dano direcionado à criatura hospedeira. Esse dano ignora características que alterem o dano do hospedeiro, como invulnerabilidades e resistências.',
            },
        ],
        dificuldade: {
            id: 'ingenuidade-anormal',
            nome: 'Ingenuidade Anormal',
            descricao: 'Anões são muito ingênuos e recebem -10 em Testes de Atributo de Vontade (Intuição).',
            efeitos: [{ alvo: 'pericia.intuicao', modo: 'soma', valor: -10 }],
        },
        extras: [
            {
                id: 'armas-reduzidas',
                etiquetas: ['Armas à distância: metade do dano'],
                efeitos: [{ alvo: 'dano.distancia.pct', modo: 'base', valor: 50 }],
                nome: 'Armas Reduzidas',
                descricao:
                    'Anões fazem em tamanho reduzido, para uso próprio, qualquer arma (Armas de Fogo, Cortantes, Especiais, Marciais ou Munições) cujo funcionamento já tenham visto, gastando 1/5 dos recursos normais. Armas de fogo ou que façam jogada de ataque (comum) à distância têm o dano total reduzido pela metade. As armas do "Estilo de Combate" já vêm adaptadas ao tamanho da espécie.',
            },
        ],
        lore: {
            aparencia:
                'Pessoas pequenas semelhantes aos humanos comuns, que cabem nas mãos de um humano adulto. Têm caudas peludas, cabeças quase tão grandes quanto os corpos, muitos com narizes pontudos e corpos arredondados.',
            patria: 'Originam-se de uma ilha desconhecida sem recursos suficientes e partiram em busca de outro lar. Os que escolheram o subterrâneo de Green Bit, perto de Dressrosa, são a Tribo Tontatta, uma ilha de primavera com plantas e cogumelos enormes, cultivados por eles.',
            cultura:
                'Vivem próximos da natureza, com afinidade com animais (insetos) e plantas. Os de Dressrosa não gostam de ser vistos e roubam de quem os vê, sem entender que é errado. O Reino Tontatta tem pouco mais de 1.000 habitantes, um rei e o exército "Tonta Corps".',
            comportamento:
                'Extremamente fortes para o tamanho (lançam um humano longe, destroem rochas e prédios com as mãos). São muito crédulos e só desconfiam se isso puser um companheiro em risco.',
            relacao:
                'Chamam os humanos de "grandes humanos" e desconfiam deles por causa da escravidão, perguntando se são bons ou ruins e acreditando na resposta. Quem diz ser bom deve provar removendo pertences e roupas.',
        },
    },
    {
        id: 'celestial',
        nome: 'Celestiais',
        pv: 10,
        preconceito: 'Débil',
        tamanhoCm: [150, 250],
        categoria: 'Médio',
        pesoKg: [50, 200],
        movimento: { normal: 12, nado: 3, escalada: 0, voo: 0 },
        tracoCultural: true,
        ancestralidade: false,
        beneficios: [
            {
                id: 'heranca-cultural',
                nome: 'Herança Cultural',
                descricao:
                    'Um celestial conhece e é proficiente com todos os tipos de dials. No início do jogo, à escolha do jogador, recebe 3 dials cotidianos de tipos diferentes e 1 dial bélico (Guia do Narrador; anote-os na ficha). Escolhe também 2 perícias para adicionar proficiência, exceto Sobrenatural e Sorte. No lugar de uma dessas perícias, pode receber a Singularidade "Haki da Observação Inato" e 15 Pontos de Ambição adicionais, que só podem ser investidos no Haki da Observação após despertar o Haki.',
                escolhaPericias: {
                    quantidade: 2,
                    nivel: 1,
                    excluir: ['sobrenatural', 'sorte'],
                    troca: {
                        rotulo: 'Haki da Observação Inato (Singularidade, +15 Pontos de Ambição)',
                        traco: {
                            id: 'haki-observacao-inato',
                            nome: 'Haki da Observação Inato',
                            descricao:
                                'Singularidade: você recebe 15 Pontos de Ambição adicionais, que só podem ser investidos no Haki da Observação, logo após despertar o uso do Haki.',
                        },
                    },
                },
            },
        ],
        dificuldade: {
            id: 'anjos-caidos',
            nome: 'Anjos Caídos',
            tipo: 'ativa',
            descricao:
                'Por estarem há gerações acostumados com atmosferas menos densas, altitudes mais baixas distorcem o senso de equilíbrio dos celestiais: -2 em Testes de Atributo de Destreza (Acrobacia) enquanto você não estiver a mais de 5.000 metros do nível do mar. Ligue a característica quando estiver em altitude baixa.',
            efeitos: [{ alvo: 'pericia.acrobacia', modo: 'soma', valor: -2 }],
        },
        variantes: [
            {
                id: 'birkan',
                nome: 'Birkans',
                descricao:
                    'Habitantes de Birka, ilha no céu a sudeste de Skypiea. Suas asas apontam para baixo (as dos outros apontam para os lados). Alguns lembram um bode. Muitos são adeptos de cerimônias e usam vestimentas religiosas.',
                beneficio: {
                    id: 'sacerdote-celestial',
                    nome: 'Sacerdote Celestial',
                    descricao: 'O celestial recebe +5 em Testes de Atributo de Presença (Atuação).',
                    efeitos: [{ alvo: 'pericia.atuacao', modo: 'soma', valor: 5 }],
                },
            },
            {
                id: 'shandian',
                nome: 'Shandians',
                descricao:
                    'Encontraram seu lar em Jaya, no Mar Azul, até um fenômeno marinho levar a tribo com metade da ilha para os mares do céu. Os Skypeans tomaram suas terras e uma guerra começou. Usam vestimentas tribais, pinturas e tatuagens, e têm apreço pelo treinamento físico e pelo espírito de guerreiro.',
                beneficio: {
                    id: 'guerreiro-celestial',
                    nome: 'Guerreiro Celestial',
                    descricao: 'O celestial recebe +5 em Testes de Atributo de Força (Atletismo).',
                    efeitos: [{ alvo: 'pericia.atletismo', modo: 'soma', valor: 5 }],
                },
            },
            {
                id: 'skypean',
                nome: 'Skypeans',
                descricao:
                    'O povo mais pacato das ilhas do céu, com diversas leis. Usam dials no dia a dia e se cumprimentam dizendo "Heso" (umbigo). Os penteados lembram duas antenas com bolinhas nas pontas, e a pele costuma ser mais clara que a dos Shandians.',
                beneficio: {
                    id: 'diplomata-celestial',
                    nome: 'Diplomata Celestial',
                    descricao: 'O celestial recebe +5 em Testes de Atributo de Presença (Persuasão).',
                    efeitos: [{ alvo: 'pericia.persuasao', modo: 'soma', valor: 5 }],
                },
            },
        ],
        lore: {
            aparencia:
                'Idênticos aos humanos comuns, com pequenas asas nas costas (até 70 cm) que não sustentam o corpo e servem só de estética. As asas dos Birkans são as mais distintas; as dos Shandians são mais cheias, com penas longas e pontudas.',
            patria: 'Nasceram de um lugar distante e misterioso, e têm como terra natal as ilhas do céu, a 10.000 metros de altitude, em duas camadas de mar de nuvens (Mar Branco a 7.000 m e Mar Branco-Branco, 3.000 m acima). A maioria das cidades fica nas Nuvens Insulares. Os Shandians passaram mais de mil anos na Grand Line e fundaram Shandora, em Jaya.',
            cultura:
                'Cada povo segue tradições próprias, todos ligados ao uso diário de dials. Os Birkans lembram cultos religiosos (a Lua é vista como "terra prometida"), os Shandians agem como indígenas com um líder de tribo e a missão de proteger Shandora, e os Skypeans são o povo predominante, governado por um "Deus", numa sociedade extremamente burocrática.',
            comportamento:
                'Cada celestial segue os ensinamentos da cultura em que cresceu. Há uma grande guerra entre os povos do céu pelas terras de Jaya, principalmente entre Shandians e Skypeans.',
            relacao:
                'Chamam os humanos de "povo do mar azul" e sabem que existem (ao contrário dos humanos, que duvidam de gente no céu). Tratam-nos como turistas e visitantes.',
        },
    },
    {
        id: 'gigante',
        nome: 'Gigantes',
        pv: 20,
        preconceito: 'Inexistente',
        tamanhoCm: [1300, 2000],
        categoria: 'Enorme',
        pesoKg: [15000, 45000],
        movimento: { normal: 9, nado: 3, escalada: 0, voo: 0 },
        tracoCultural: true,
        ancestralidade: false,
        beneficios: [
            {
                id: 'forca-colossal',
                etiquetas: ['Técnicas e características alcançam alvos Enormes'],
                nome: 'Força Colossal',
                restrito: true,
                descricao:
                    'O gigante se torna proficiente e dobra o Bônus de Proficiência em qualquer Salvaguarda ou Teste de Atributo de Força. Características e Técnicas que afetam apenas criaturas Grandes ou menores podem afetar também criaturas e alvos Enormes.',
                salvaguardas: ['for'],
                efeitos: [
                    { alvo: 'salv.for', modo: 'soma', valor: '@prof' },
                    { alvo: 'teste.for', modo: 'soma', valor: '@prof*2' },
                ],
            },
            {
                id: 'corpo-assustador',
                nome: 'Corpo Assustador',
                descricao: 'Os gigantes impõem suas presenças àqueles ao seu redor. Recebem +2 em Testes de Atributo de Presença (Intimidação).',
                efeitos: [{ alvo: 'pericia.intimidacao', modo: 'soma', valor: 2 }],
            },
        ],
        dificuldade: {
            id: 'necessidades-gigantescas',
            nome: 'Necessidades Gigantescas',
            descricao:
                'O corpo colossal gera a necessidade de recursos igualmente grandes: o gigante precisa de alimento e líquido 5 vezes maiores que os de um humano (o suficiente para mantê-lo alimentado, não para saciar a fome de verdade) e ocupa o espaço de 20 tripulantes em um navio.',
        },
        extras: [
            {
                id: 'armas-gigantescas',
                etiquetas: ['Só usa armas de gigante'],
                nome: 'Armas Gigantescas',
                descricao:
                    'Pelas proporções colossais, o gigante só pode usar armas próprias para o seu tamanho, e nenhuma outra Espécie pode usar a arma de um gigante. Um ferreiro cobra 10 vezes o valor da arma para criá-la (o mesmo vale para roupas e acessórios). As armas do "Estilo de Combate" já vêm adaptadas.',
            },
        ],
        lore: {
            aparencia:
                'Literalmente humanos gigantes, muitas vezes com proporções e traços faciais mais exagerados. Suas lágrimas podem inundar grandes áreas. Têm no mínimo 12 metros e em média cerca de 20 metros quando adultos.',
            patria: 'A maioria vem de Elbaf, "a terra dos gigantes", em Warland, com montanhas íngremes, uma árvore enorme no centro, vilas de madeira em estética viking e um grande reino. Suas águas são perigosas, com fauna gigantesca.',
            cultura:
                'A cultura de Elbaf, fundada na honra e no orgulho dos guerreiros e com costumes vikings, é a mais difundida. Todo ano há o "Solstício de Inverno": 12 dias de jejum só com água, seguidos de um grande festival.',
            comportamento:
                'Seguem um código de guerreiros: toda disputa se resolve em combate até a morte, com honra, ataques frontais e sem armadilhas ou golpes baixos, sob o olhar dos deuses de Elbaf. Vivem pelo menos três vezes mais que humanos, com perspectiva paciente do tempo, e desejam uma morte gloriosa em combate.',
            relacao:
                'Sua força é muito respeitada por humanos e pelo Governo Mundial: são a única Espécie não humana que pode integrar a Marinha. Não tiveram grande participação na história mundial.',
        },
    },
    {
        id: 'lunariano',
        nome: 'Lunarianos',
        pv: 16,
        preconceito: 'Medíocre',
        tamanhoCm: [180, 500],
        categoria: 'Médio',
        pesoKg: [90, 600],
        movimento: { normal: 9, nado: 3, escalada: 0, voo: 0 },
        tracoCultural: true,
        ancestralidade: false,
        beneficios: [
            heatOuElectro(
                'heat',
                'Heat',
                'de Fogo',
                'o lunariano',
                'o Benefício "Electro" dos Minks e a Manifestação de Poder Especial "Potencializador Ofensivo" da Akuma no Mi',
            ),
            {
                id: 'manipulacao-do-fogo',
                etiquetas: ['Resistência a fogo', 'Luz plena 6 m + penumbra 3 m'],
                tecnicas: [
                    {
                        nome: 'Esfera de Fogo',
                        origem: 'Manipulação do Fogo',
                        custo: 0,
                        alcance: '6 m',
                        efeito: '1d4 de fogo',
                        rolagem: '1d4',
                        tipoDano: 'fogo',
                        acao: 'padrao',
                        descricao:
                            'Use a ação para manipular uma esfera de fogo por até 1 minuto, movendo-a a até 6 m. Ao movê-la para o espaço de uma criatura, faça uma jogada de ataque à distância (o botão Ataque da aba Técnicas): em caso de acerto a esfera se apaga e causa 1d4 de fogo. Ao tocar um objeto inflamável, ela se apaga e provoca combustão.',
                    },
                ],
                nome: 'Manipulação do Fogo',
                descricao:
                    'Enquanto o fogo nas suas costas se mantém: recebe resistência a dano de fogo; seu corpo ilumina até 6 metros com luz plena e mais 3 metros com penumbra; e você pode usar sua ação para manipular uma única esfera de fogo por até 1 minuto, movendo-a a até 6 metros de você (a esfera emite a mesma luz que você). Ao movê-la para o espaço de uma criatura, faça uma jogada de ataque à distância contra ela: em caso de acerto, a esfera se apaga e causa 1d4 de dano de Fogo. Ao tocar um objeto inflamável, a esfera também se apaga e provoca combustão.',
                resistencias: ['Fogo'],
            },
        ],
        dificuldade: {
            id: 'cabeca-a-premio',
            nome: 'Cabeça a Prêmio',
            descricao:
                'O Governo Mundial busca capturar ou exterminar qualquer lunariano e recompensa com fortunas quem der pistas do paradeiro de um. Sempre que você passar por um local e expuser sua aparência em público, o Narrador joga 1d12: com resultado igual ou inferior a 6, em algum momento do dia seguinte surgirá um grupo do Governo Mundial ou da Marinha para capturá-lo.',
        },
        lore: {
            aparencia:
                'Pele morena, cabelos brancos e um par de asas de penas negras, parecidas com as dos birkans mas muito maiores e proporcionais ao corpo. Têm uma esfera de fogo constantemente queimando atrás da parte superior das costas e da nuca.',
            patria: 'Há centenas de anos, antes de serem exterminados, viviam no topo da Red Line, no "Reino dos Deuses".',
            cultura: 'Sua cultura é atualmente um mistério, assim como os motivos do extermínio da espécie.',
            comportamento:
                'Tendem a esconder a origem, disfarçando-se e cobrindo todo o corpo, e costumam se abrigar em poderosas organizações criminosas.',
            relacao:
                'Humanos comuns desconhecem a existência de lunarianos, mas alguns já ouviram histórias ou lendas, junto com a informação da recompensa de ฿ 100.000.000 dada pelo governo. Diz-se que um lunariano capturado vira cobaia e nunca é solto.',
        },
    },
    {
        id: 'mink',
        nome: 'Minks',
        pv: 12,
        preconceito: 'Medíocre',
        tamanhoCm: [130, 600],
        categoria: 'Médio',
        pesoKg: [50, 900],
        movimento: { normal: 9, nado: 4.5, escalada: 0, voo: 0 },
        tracoCultural: false,
        ancestralidade: true,
        beneficios: [
            heatOuElectro(
                'electro',
                'Electro',
                'Elétrico',
                'o mink',
                'o Benefício "Heat" dos Lunarianos e a Manifestação de Poder Especial "Potencializador Ofensivo" da Akuma no Mi',
            ),
        ],
        dificuldade: {
            id: 'instintos-animalescos',
            acoes: [
                {
                    rotulo: 'Resistir ao instinto (Vontade CD 15)',
                    acao: 'livre',
                    tipo: 'condicao',
                    alvo: 'proprio',
                    condicao: 'atordoado',
                    atributo: 'von',
                    cd: 15,
                    turnos: '1d4',
                    aoDano: true,
                },
            ],
            nome: 'Instintos Animalescos',
            descricao:
                'Para todo mink existe algum objeto que o faz perder o controle (um mink coelho, ao ver uma cenoura, precisa se controlar para não ir mordê-la). Nesses casos o mink faz uma Salvaguarda de Vontade CD 15 para não ficar 1d4 turnos "distraído" (condição Atordoado), ou até receber dano.',
        },
        variantes: [
            {
                id: 'agil',
                nome: 'Ágeis',
                descricao:
                    'Minks esguios e rápidos, de estatura abaixo da média e mais difíceis de notar. O pouco peso os faz se mover muito mais em menos tempo.',
                beneficio: {
                    id: 'corpo-leve',
                    nome: 'Corpo Leve',
                    descricao:
                        'Seu deslocamento normal se torna 12 metros e seu deslocamento de escalada se torna 9 metros (se receber outro deslocamento, prevalece o maior).',
                    movimento: { normal: 12, escalada: 9 },
                },
            },
            {
                id: 'meao',
                nome: 'Meãos',
                descricao:
                    'Minks de corpo médio e proporcional, muito semelhante ao dos humanos comuns, distinguidos só pelo pelo, garras ou chifres. Podem escolher entre ser rápidos ou fortes.',
                beneficio: {
                    id: 'estamina-animal',
                    nome: 'Estamina Animal',
                    descricao: 'Seu deslocamento normal se torna 18 metros (se receber outro deslocamento, prevalece o maior).',
                    movimento: { normal: 18 },
                },
            },
            {
                id: 'robusto',
                nome: 'Robustos',
                descricao:
                    'Minks altos e largos, com muita força ou resistência. O tamanho pode assustar os próprios minks, e o peso os torna imponentes só por pisar no chão.',
                beneficio: {
                    id: 'pisada-firme',
                    etiquetas: ['Terreno difícil não reduz o deslocamento'],
                    nome: 'Pisada Firme',
                    descricao:
                        'Seu deslocamento normal se torna 12 metros e não pode ser reduzido por terreno difícil (se receber outro deslocamento, prevalece o maior).',
                    movimento: { normal: 12 },
                },
            },
        ],
        extras: [
            {
                id: 'forma-sulong',
                acao: 'padrao',
                tipo: 'ativa',
                etiquetas: ['Sulong: Electro em todo ataque, sem limite de uso', 'Exaustão 1 por turno após 1 minuto'],
                efeitos: [
                    { alvo: 'movimento.normal', modo: 'soma', valor: '@movimento.normal' },
                    { alvo: 'movimento.voo', modo: 'soma', valor: '@movimento.normal' },
                    { alvo: 'dano.tecnica', modo: 'dados', valor: '1d10' },
                    { alvo: 'dano.arma', modo: 'dados', valor: '1d10' },
                ],
                nome: 'Forma Sulong',
                descricao:
                    'Quando um mink (ou mestiço) olha diretamente para a lua cheia por 6 segundos (ação), pelos e cabelos crescem e ele vira uma fera de pelagem branca, perdendo o controle e agindo por instintos, com grande agressividade. Só o treinamento "Leão da Lua" (Capítulo 5) mantém a consciência. Se evitar olhar para a lua cheia exposta, recebe desvantagem em todos os Testes de Atributo e não pode usar a concentração para outra coisa. Na forma, o corpo fica envolto em eletricidade, o deslocamento normal é dobrado, ganha deslocamento de voo igual à metade desse valor e pode usar "Electro" em cada jogada de ataque (comum ou Técnicas), sem ação bônus e ignorando os limites de uso. Após 1 minuto, sofre 1 Nível de Exaustão ao final de cada turno seguinte, ficando inconsciente no 6º nível (o que encerra a forma). Para reverter, passe 1 turno sem olhar para a lua cheia e use uma ação para cobrir os olhos.',
            },
        ],
        lore: {
            aparencia:
                'Humanoides parecidos com todo tipo de mamífero peludo (leões, coelhos, bodes...). As fêmeas tendem a parecer mais humanas que os machos.',
            patria: 'Zou, ilha nas costas do elefante milenar Zunesha, que vaga pelos mares (log poses e eternal poses não a encontram). Duas vezes ao dia, ele joga água do mar na ilha ("Eruption Rain"), trazendo animais e água purificada. A cidade principal mistura casas, ruínas e florestas, com uma enorme árvore em forma de baleia.',
            cultura:
                'Têm orgulho do pelo, que é parte da identidade, e não comem carne de animais peludos. Não resistem aos instintos animais (um mink macaco esquece uma briga diante de uma banana). São carinhosos: abraçam e dizem "garchu" para agradecer ou cumprimentar.',
            comportamento:
                'Uma tribo de guerreiros sem igual, naturalmente fortes e capazes de gerar e liberar eletricidade. Misturam o corpo ágil e os instintos a treinamento com espada ou corporal. A forma Sulong é poderosa mas exige muito do usuário.',
            relacao:
                'Chamam os humanos de "minks sem pelos" (acreditam que são minks macacos com menos pelo) e não têm rancor deles. Zou é a casa dos minks há cerca de 1.000 anos, com forte ligação com a família Kozuki.',
        },
    },
    {
        id: 'povo-do-mar',
        nome: 'Povo do Mar',
        pv: 14,
        preconceito: 'Severo',
        tamanhoCm: [190, 600],
        categoria: 'Médio',
        pesoKg: [100, 800],
        movimento: { normal: 9, nado: 15, escalada: 0, voo: 0 },
        tracoCultural: false,
        ancestralidade: true,
        beneficios: [
            {
                id: 'forca-superior',
                nome: 'Força Superior',
                descricao:
                    'O povo do mar se torna proficiente e adiciona mais a metade do Bônus de Proficiência (arredondado para baixo) em Salvaguardas e Testes de Atributo de Força.',
                salvaguardas: ['for'],
                efeitos: [
                    { alvo: 'salv.for', modo: 'soma', valor: 'floor(@prof/2)' },
                    { alvo: 'teste.for', modo: 'soma', valor: '@prof+floor(@prof/2)' },
                ],
            },
        ],
        dificuldade: {
            id: 'criatura-do-mar',
            nome: 'Criatura do Mar',
            descricao:
                'Possui brânquias e pulmões, respirando no ar e na água. Se as brânquias ficarem ressecadas ou bloqueadas, pode sufocar submerso. Precisa de duas vezes mais água que humanos em um dia normal e quatro vezes mais em um dia quente, para não receber/aumentar 1 Nível de Exaustão ao final de cada dia.',
        },
        variantes: [
            {
                id: 'homem-peixe',
                nome: 'Homem-Peixe',
                descricao: 'União da estrutura de corpo humanoide comum com características de animais marinhos, como barbatanas e tentáculos.',
                beneficio: {
                    id: 'corpo-marinho',
                    nome: 'Corpo Marinho',
                    restrito: true,
                    pedeAncestralidade: true,
                    descricao:
                        'De acordo com a criatura do mar ancestral, o homem-peixe escolhe 1 Traço Comum das Akuma no Mi Zoan (ignorando o requisito de forma original, híbrida ou animal; Capítulo 6) ou cria um, sujeito à aprovação do Narrador. Escreva o traço no campo de Ancestralidade.',
                },
            },
            {
                id: 'sireno',
                nome: 'Sirenos',
                descricao:
                    'Têm as características dos animais marinhos mais acentuadas da cintura para baixo e parte superior parecida com a humana. Os machos muitas vezes têm a parte superior mais parecida com a de um homem-peixe.',
                beneficio: {
                    id: 'natacao-superior',
                    etiquetas: ['Disparada como ação bônus (nadando)'],
                    nome: 'Natação Superior',
                    descricao: 'Os sirenos recebem 18 metros de nado e podem usar a ação "Disparada" como ação bônus enquanto estiverem nadando.',
                    movimento: { nado: 18 },
                },
            },
        ],
        lore: {
            aparencia:
                'Varia tanto que um leigo diria que nem são da mesma espécie (dois homens-peixe polvo podem ser bem diferentes). Dependendo do animal ancestral, muda a aparência, as características e até a personalidade (um homem-peixe tubarão-branco tem dentes que renascem e personalidade mais agressiva). Os sirenos têm aparência humana da cintura para cima e cauda de peixe na maioria das vezes, com beleza encantadora, principalmente as fêmeas.',
            patria: 'A Ilha dos Homens-Peixe, totalmente submersa a 10.000 metros de profundidade, sob uma redoma de resina yarukiman, abaixo da Red Line, na passagem submersa que liga Paradise ao Novo Mundo (a única que permite a passagem de navios). O ar e a luz vêm das raízes da Árvore Solar Eva. A ilha é um enorme recife de corais com uma cidade mesclada à paisagem.',
            cultura:
                'Ilha turística de forte comércio, parada obrigatória de piratas e viajantes, com a Baía das Sereias, uma famosa fábrica de doces e o Dojo Homem-Peixe, onde se ensina o Caratê Homem-Peixe. Bolhas de resina yarukiman servem de transporte, chão e rodovias. É uma monarquia, governada pela família real Ryugu.',
            comportamento:
                "Respiram no ar e na água e são, em média, 10 vezes mais fortes que humanos (embaixo d'água, ainda mais). A personalidade é parecida com a humana, mas, pelo histórico de opressão, muitos têm pensamentos extremistas de segregação.",
            relacao:
                'Na ilha a maioria se dá bem com humanos, mas há muita diversidade: alguns têm medo deles ou os consideram inferiores, por toda a história de opressão. As sereias temem a superfície por causa do mercado negro de escravos, que existe até na própria ilha, trazido por piratas visitantes.',
        },
    },
];

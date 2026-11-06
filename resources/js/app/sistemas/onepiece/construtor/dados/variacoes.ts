import type { VariacaoRaraDados } from './tipos.ts';

/** Variações Raras: exceções absolutas, só com aprovação do Narrador. Substituem 1 Benefício da Espécie. */
export const AVISO_VARIACAO_RARA =
    'Por representarem condições extremamente incomuns, as Variações Raras são exceções absolutas. Evite repeti-las entre os jogadores; o Narrador pode restringir, adaptar ou negar uma delas.';

export const VARIACOES_RARAS: VariacaoRaraDados[] = [
    {
        id: 'bucaneiro',
        nome: 'Bucaneiro',
        descricao: 'Descendente de um clã antigo envolto em mistérios e poderes desconhecidos.',
        traco: {
            id: 'mente-solar',
            nome: 'Mente Solar',
            descricao:
                'Você descende de um clã antigo envolto em mistérios e poderes desconhecidos. Sua mente é absolutamente resiliente. Nenhuma Técnica, característica ou evento consegue influenciá-la, garantindo sucesso automático em qualquer teste ou efeito que tente controlar ou manipular sua mente, de qualquer forma.',
            imunidades: ['Controle e manipulação da mente'],
        },
    },
    {
        id: 'experimento-cientifico',
        nome: 'Experimento Científico',
        descricao: 'Submetido a experimentos na infância, que alteraram permanentemente a fisiologia.',
        traco: {
            id: 'corpo-engenhado',
            nome: 'Corpo Engenhado',
            descricao:
                'Você foi submetido a experimentos ainda na infância, alterando permanentemente sua fisiologia. Seu corpo se beneficia de forma permanente da característica "Melhoria Genética" da profissão Cientista, podendo escolher entre sua opção principal ou alternativa (anote a escolha quando as profissões forem adicionadas). Como o processo foi traumático, você se torna menos empático e sempre realiza testes das perícias Atuação, Intuição e Persuasão com desvantagem, independentemente de outras características ou bônus.',
            efeitos: [
                { alvo: 'pericia.atuacao', modo: 'desvantagem' },
                { alvo: 'pericia.intuicao', modo: 'desvantagem' },
                { alvo: 'pericia.persuasao', modo: 'desvantagem' },
            ],
        },
    },
    {
        id: 'filho-da-noite',
        nome: 'Filho da Noite',
        descricao: 'Descendente de um clã extremamente antigo, com um corpo que desafia as leis naturais.',
        traco: {
            id: 'corpo-estranho',
            nome: 'Corpo Estranho',
            descricao:
                'Você pode consumir mais de uma Akuma no Mi sem morrer, mantendo múltiplos tipos de poder. A ficha de cada Akuma segue as regras do Capítulo 6: para cada elemento (1 Aspecto Inato e 2 Manifestações de Poder; 1 Traço Comum, 1 Específico e 1 Ancestral se Zoan; 1 Técnica de Combate ou Point por grau do 1º ao 5º e 2 Técnicas Auxiliares; no Estágio Desperto, 1 Manifestação, e 1 Técnica ou Point por grau do 6º e 7º, além de 2 Técnicas Auxiliares) você escolhe de qual fruto ele vem. Ao consumir um novo fruto, pode substituir ou criar qualquer Técnica/Point ou característica da Akuma, indicando de qual fruto vêm. O preço: você não consegue dormir nem se beneficia de descansos longos. Como alternativa, medite por 6 horas e escolha UM benefício: recuperar metade dos PV e Dados de Vida (arredondado para baixo); recuperar metade dos Pontos de Poder; ou recuperar 1 Nível de Exaustão e os usos de características que exigem descanso longo. (A ficha atual guarda uma Akuma só: anote as demais no texto e use este descanso à mão.)',
        },
    },
    {
        id: 'sangue-ancestral',
        nome: 'Sangue Ancestral',
        descricao: 'Sangue de um grupo especial há muitas gerações, com traços físicos marcantes (altura anormal, chifres, presas).',
        traco: {
            id: 'poder-maligno',
            nome: 'Poder Maligno',
            tipo: 'ativa',
            usos: { porNivel: true, descanso: 'longo' },
            descricao:
                'Uma força brutal emana de você, tão intensa que seu próprio corpo sofre para acompanhá-la. Sempre que desejar, você pode causar 1 dado de dano adicional qualquer em jogadas de ataque (comum ou Técnicas). Pode ser usada uma quantidade de vezes igual ao seu nível, limitada a uma vez por rodada; todos os usos voltam ao término de um descanso longo. Até o 12º nível de personagem, sempre que usar esta característica, você sofre dano igual ao valor do dano adicional causado, e esse dano não pode ser reduzido ou evitado de nenhuma forma.',
        },
    },
    {
        id: 'clone',
        nome: 'Clone',
        descricao: 'Resultado da clonagem de uma pessoa que já existiu (ou ainda existe), com memória genética latente.',
        traco: {
            id: 'habilidade-herdada',
            nome: 'Habilidade Herdada',
            descricao:
                'Você é o resultado da clonagem de uma pessoa que já existiu, ou ainda existe. Em seu corpo reside uma memória genética latente, carregando afinidades, instintos e experiências do corpo original. Isso garante 3 espaços adicionais de Singularidade e permite deixar de escolher 1 Defeito Médio ou até 3 Defeitos Suaves, à sua escolha (anote quando Singularidades e Defeitos forem adicionados à ficha).',
        },
    },
];

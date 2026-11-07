/**
 * Antecedentes (cap. 4): o passado do personagem. Cada um dá +2 em um atributo (à escolha; o recomendado vem marcado, teto 20),
 * proficiência em UMA perícia de uma lista e uma Característica Especial. Personalizar: trocar a característica por a de
 * outro antecedente, escolher perícia fora da lista e outro atributo. Arquivo PURO (sem Vue).
 */
import type { AtributoId } from '../../regras.ts';
import type { TracoDados } from './tipos.ts';

export interface Antecedente {
    id: string;
    nome: string;
    descricao: string;
    /** Ids de perícia (uma delas, à escolha). */
    pericias: string[];
    /** Atributos recomendados (o aumento é livre; estes vêm marcados). */
    atributos: AtributoId[];
    caracteristica: TracoDados;
}

const SORTE = { rotulo: 'Teste de Vontade (Sorte)', tipo: 'rolar' as const, rolagem: '1d20+@pericia.sorte' };
/** Característica com um Teste de Vontade (Sorte): o botão rola o teste; com `uma` vez por descanso longo, o uso é gasto. */
const sorte = (id: string, nome: string, descricao: string, uma = false): TracoDados => ({
    id,
    nome,
    descricao,
    ...(uma ? { usos: { max: 1, descanso: 'longo' as const } } : {}),
    acoes: [{ ...SORTE, ...(uma ? { usa: true } : {}) }],
});

export const ANTECEDENTES: Antecedente[] = [
    {
        id: 'amnesia',
        nome: 'Amnésia',
        descricao:
            'Seu passado é um vazio: você não se lembra de quem era, de onde veio ou do que fez. Seu corpo e seus instintos ainda carregam ecos do que você foi. Sua jornada é uma aventura pelos mares e uma busca por respostas sobre a própria identidade.',
        pericias: ['investigacao', 'intuicao', 'percepcao', 'historia'],
        atributos: ['sab'],
        caracteristica: sorte(
            'ecos-do-passado',
            'Ecos do Passado',
            'Em momentos cruciais, fragmentos da sua antiga vida emergem. Uma vez por descanso longo, peça ao Narrador uma lembrança vaga, sensação instintiva ou conhecimento inesperado sobre a situação atual, com um Teste de Vontade (Sorte) de CD definida por ele. No sucesso, você recebe uma informação útil, ainda que incompleta ou simbólica, sobre o que fazer ou evitar; na falha, a lembrança é confusa ou enganosa.',
            true,
        ),
    },
    {
        id: 'artista',
        nome: 'Artista',
        descricao:
            'Antes de se aventurar, você entretinha as pessoas: música em apresentações escandalosas ou demonstrações de força em circos. Dominava e amava uma forma de arte e se sustentava com ela.',
        pericias: ['acrobacia', 'atuacao', 'historia', 'persuasao', 'prestidigitacao', 'provocacao'],
        atributos: ['pre'],
        caracteristica: {
            ...sorte(
                'rock-star',
                'Rock Star',
                'Em centros urbanos você se conecta com grupos de artistas para apresentações (oficiais ou clandestinas). No início do dia, usando 2 horas, faça um Teste de Vontade (Sorte), CD do Narrador, para marcar um show noturno. Com sucesso em um Teste de Presença (Atuação) CD 15 você recebe de cachê 3d10 × 100.000 bellys (3d10 × 20.000 em falha), mais 50.000 por nível de personagem. O show só acaba no amanhecer e você sofre os efeitos de um dia sem descanso longo. Só volta após um descanso longo.',
                true,
            ),
            acoes: [
                { ...SORTE, usa: true },
                { rotulo: 'Atuação (Presença) CD 15', tipo: 'rolar', rolagem: '1d20+@pericia.atuacao' },
            ],
        },
    },
    {
        id: 'criminoso',
        nome: 'Criminoso',
        descricao:
            'Você foi um fora da lei solitário ou de uma organização criminosa, por crimes hediondos ou brandos, para sobreviver: intimidação e violência ou enganações e esquemas. Abandonou essa vida por ter mexido com as pessoas erradas ou para se redimir.',
        pericias: ['enganacao', 'furtividade', 'intimidacao', 'prestidigitacao'],
        atributos: ['des'],
        caracteristica: sorte(
            'contatos',
            'Contatos',
            'Em locais frequentados por criminosos (áreas pobres, prisões, mercados negros), pelo preço certo você arruma contatos para as mais variadas necessidades: informações de difícil acesso, contratar pessoas com habilidades únicas, documentos falsos, sequestros, assassinatos e outros serviços, desde que passe em um Teste de Vontade (Sorte), CD do Narrador. Só volta após um descanso longo.',
            true,
        ),
    },
    {
        id: 'derrotado',
        nome: 'Derrotado',
        descricao:
            'Você já esteve no auge, temido, respeitado ou admirado, até uma derrota esmagadora, traição ou humilhação pública mudar tudo. Vive com o peso do fracasso, tentando se reerguer, provar seu valor ou entender onde errou: mais cauteloso, resiliente ou consumido pela redenção.',
        pericias: ['intuicao', 'investigacao', 'historia', 'sobrevivencia'],
        atributos: ['von'],
        caracteristica: sorte(
            'marcas-da-derrota',
            'Marcas da Derrota',
            'Ao falhar em um Teste de Atributo, você pode fazer um Teste de Vontade (Sorte), CD do Narrador. No sucesso, você aprende algo com a falha: uma pista, uma informação parcial ou reduz as consequências narrativas negativas do erro. Só volta após um descanso longo.',
            true,
        ),
    },
    {
        id: 'erudito',
        nome: 'Erudito',
        descricao:
            'Você dedicou grande parte da vida ao estudo formal, em bibliotecas, academias, mosteiros ou sob a tutela de um mestre. Seu conhecimento vem de livros, debates e pesquisa constante.',
        pericias: ['historia', 'investigacao', 'natureza', 'sobrenatural'],
        atributos: ['sab'],
        caracteristica: sorte(
            'conhecimento-acumulado',
            'Conhecimento Acumulado',
            'Diante de ruínas, textos antigos, símbolos, fenômenos incomuns ou eventos históricos, faça um Teste de Vontade (Sorte), CD do Narrador. No sucesso, ele fornece uma informação útil, uma curiosidade relevante ou relembra um contexto esquecido sobre o assunto.',
        ),
    },
    {
        id: 'escravo',
        nome: 'Escravo',
        descricao:
            'Seu passado traz lembranças dolorosas dos lados mais cruéis da humanidade: nas mãos dos Nobres Mundiais ou arrastado por guerras e tráficos ilegais, destituído dos direitos mais básicos e forçado à servidão. Emancipado, você segue o caminho que quis: os valores do seu libertador ou uma caçada de vingança.',
        pericias: ['atletismo', 'intuicao', 'percepcao', 'sobrevivencia'],
        atributos: ['con'],
        caracteristica: sorte(
            'esperanca',
            'Esperança',
            'Diante de qualquer situação desesperadora, você se mantém firme para buscar uma solução: peça ao Narrador uma pista ou ajuda para resolver qualquer dificuldade, desde que passe em um Teste de Vontade (Sorte), CD do Narrador. Só volta após um descanso longo.',
            true,
        ),
    },
    {
        id: 'exilado',
        nome: 'Exilado',
        descricao:
            'Você ocupou uma posição de grande influência (político, nobre, conselheiro), mas apoiar o lado derrotado, uma conspiração ou falsas acusações o derrubaram. Perseguido, abandonou sua terra; em segredo, outra nação lhe deu abrigo. No exílio, aprendeu os jogos diplomáticos e as alianças ocultas.',
        pericias: ['historia', 'intuicao', 'persuasao', 'investigacao'],
        atributos: ['pre', 'sab'],
        caracteristica: sorte(
            'apoio-no-exilio',
            'Apoio no Exílio',
            'Um reino que não pode se expor ainda o considera um aliado. Em assuntos diplomáticos, negociações políticas ou contato com figuras de poder, faça um Teste de Vontade (Sorte), CD do Narrador. No sucesso, esse reino pode facilitar audiências secretas com nobres, líderes ou autoridades; intermediar acordos políticos ou cessar conflitos menores; ou fornecer informações estratégicas ou apoio indireto por meio de aliados.',
        ),
    },
    {
        id: 'familia-d',
        nome: 'Família D.',
        descricao:
            'Sua família tem um sobrenome secreto cuja origem e significado ninguém conhece, passado de geração em geração. Deve ser mantido em segredo, eventos tristes cercam a vida dessas pessoas e um deles trará uma grande tempestade ao mundo.',
        pericias: ['haki', 'intimidacao', 'intuicao', 'percepcao'],
        atributos: ['von'],
        caracteristica: sorte(
            'vontade-dos-d',
            'Vontade dos D.',
            'O Governo Mundial teme suas ações: seus atos notórios recebem mais atenção que o comum e sua recompensa aumenta muito mais que o normal. Sua forte determinação cria um laço especial com as pessoas: ao zarpar de uma ilha em gratidão com você, faça um Teste de Vontade (Sorte), CD do Narrador; no sucesso, até 3 habitantes podem querer entrar na sua tripulação. Se o personagem morrer, o novo herda a vontade, mantendo à escolha: PV ligados aos Dados de Vida do estilo (se tiver o mesmo tipo de dado), Akuma no Mi, treinamentos cujos requisitos ainda cumpra, equipamentos, dinheiro e nível; é obrigatório escolher este antecedente de novo.',
        ),
    },
    {
        id: 'marinheiro',
        nome: 'Marinheiro',
        descricao:
            'Você já achou estar seguindo o caminho da justiça como membro ativo da Marinha. Pode ter saído por ver hipocrisia e corrupção na corporação ou por não querer mais obedecer ordens. O tempo na Marinha está sempre marcado em suas memórias.',
        pericias: ['atletismo', 'investigacao', 'medicina', 'sobrevivencia'],
        atributos: ['for'],
        caracteristica: sorte(
            'carteirada',
            'Carteirada',
            'Ao interagir com marinheiros, mesmo numa interação turbulenta (detido, prisioneiro, interrogado ou avistado em alto-mar), faça um Teste de Vontade (Sorte), CD do Narrador, para usar sua antiga influência ou encontrar um antigo conhecido que faça vista grossa sobre seus crimes ou captura. Só volta após um descanso longo.',
            true,
        ),
    },
    {
        id: 'mercador',
        nome: 'Mercador',
        descricao:
            'Você cresceu negociando, comprando e vendendo: dono de uma pequena loja, comerciante ambulante, representante de uma guilda mercantil ou atravessador em rotas perigosas. Aprendeu que informação vale tanto quanto dinheiro e que bons acordos abrem portas tão bem quanto a força.',
        pericias: ['enganacao', 'intuicao', 'investigacao', 'persuasao'],
        atributos: ['pre'],
        caracteristica: sorte(
            'bom-negocio',
            'Bom Negócio',
            'Ao negociar compra, venda ou troca de bens e serviços, faça um Teste de Vontade (Sorte), CD do Narrador. No sucesso, você obtém uma vantagem comercial significativa: desconto, bônus na troca, prioridade de entrega ou informação adicional relevante sobre o item ou o mercado.',
        ),
    },
    {
        id: 'mercenario',
        nome: 'Mercenário',
        descricao:
            'Você lutou por dinheiro, contratos ou favores; a bandeira pouco importava desde que o pagamento fosse justo. Serviu exércitos, nobres, criminosos ou revolucionários e aprendeu a sobreviver entre conflitos e alianças instáveis.',
        pericias: ['atletismo', 'intimidacao', 'investigacao', 'sobrevivencia'],
        atributos: ['for'],
        caracteristica: sorte(
            'contrato-temporario',
            'Contrato Temporário',
            'Ao chegar a uma região, faça um Teste de Vontade (Sorte), CD do Narrador, para encontrar alguém disposto a contratar você ou seu grupo para um serviço pontual (escolta, intimidação, proteção ou coleta de informações). O pagamento é negociado na hora: dinheiro, favores, artefatos etc.',
        ),
    },
    {
        id: 'nobre',
        nome: 'Nobre',
        descricao:
            'Sua família foi ou ainda é regente de uma das ilhas do mundo. Isso não garantiu necessariamente uma vida luxuosa (há reinos pobres e ricos), mas uma educação de primeira e alguma influência nos círculos mais altos da sociedade.',
        pericias: ['historia', 'intuicao', 'investigacao', 'natureza', 'sorte'],
        atributos: ['sab'],
        caracteristica: sorte(
            'influencia',
            'Influência',
            'Ao interagir com outros nobres ou membros da alta sociedade, use sua influência para conseguir favores (entrada livre em áreas privadas, dinheiro emprestado, alguém que ateste suas palavras, audiências privadas com outros nobres), desde que passe em um Teste de Vontade (Sorte), CD do Narrador. Só volta após um descanso longo.',
            true,
        ),
    },
    {
        id: 'orfao',
        nome: 'Órfão',
        descricao:
            'Suas origens são desconhecidas: você pode saber seu sobrenome, mas ele não dá pista alguma da família. Nunca houve uma figura que cuidasse de você e sempre teve de se virar para comer e sobreviver, o que pode ter lhe deixado amargo ou empolgado para construir do zero seus sonhos.',
        pericias: ['atletismo', 'furtividade', 'intuicao', 'sobrevivencia'],
        atributos: ['for'],
        caracteristica: sorte(
            'malandragem',
            'Malandragem',
            'Em centros urbanos, com sucesso em um Teste de Vontade (Sorte), CD do Narrador, você reconhece os padrões e caminhos secretos típicos e acha passagens que outros não notariam, viajando entre dois pontos da cidade duas vezes mais rápido que o seu deslocamento e de forma segura. O mesmo teste serve para achar comida e água para você e até cinco pessoas, uma vez por dia, se possível.',
        ),
    },
    {
        id: 'pescador',
        nome: 'Pescador',
        descricao:
            'Anos de vida no mar lhe ensinaram muito mais que lançar redes: você conheceu portos, tripulações e histórias de toda parte, navegou por inúmeras rotas e, se não esteve em todas as ilhas, ao menos conhece suas lendas, perigos e peculiaridades.',
        pericias: ['enganacao', 'intuicao', 'persuasao', 'sobrevivencia'],
        atributos: ['pre'],
        caracteristica: sorte(
            'historias-do-mar',
            'Histórias do Mar',
            'Sua reputação e lábia rendem hospitalidade quase automática. Em um porto ou entre marinheiros e civis ligados ao mar, faça um Teste de Vontade (Sorte), CD do Narrador: no sucesso, você viaja gratuitamente em qualquer navio. Além disso, ao contar histórias e causos marítimos você pode distrair uma criatura que o ouça: Salvaguarda de Sabedoria CD 17; se falhar, fica distraída por até 30 minutos, deixa de ser hostil a qualquer criatura e evita atividades ou movimentos, mesmo em combate, desde que sem risco. A criatura afetada não pode sofrer isso de novo por 24 horas.',
        ),
    },
    {
        id: 'politico',
        nome: 'Político',
        descricao:
            'A política fez parte da sua vida: prefeito de uma vila, parte das disputas entre dois regentes, conselheiro de um rei ou ativista por uma causa do seu povo. Saindo dela, manteve o conhecimento dos bastidores dos governos, das decisões difíceis e das cordas que controlam a população.',
        pericias: ['atuacao', 'enganacao', 'historia', 'intuicao', 'persuasao', 'provocacao'],
        atributos: ['pre'],
        caracteristica: sorte(
            'discurso',
            'Discurso',
            'Ao confrontar uma pessoa hostil fora de combate, com sucesso em um Teste de Vontade (Sorte), CD do Narrador, você a convence a ajudá-lo. Ela se alia a você por até 24 horas, enquanto os objetivos dela não forem totalmente contrários aos seus. Só volta após um descanso longo.',
            true,
        ),
    },
    {
        id: 'predestinado',
        nome: 'Predestinado',
        descricao:
            'Desde que se entende por gente, tudo conspira a seu favor: encontros improváveis, sobrevivência milagrosa, oportunidades únicas. Uns chamam de sorte, outros de profecia. Resta saber se você será digno desse destino ou se ele cobrará um preço alto demais.',
        pericias: ['intuicao', 'percepcao', 'persuasao', 'sorte'],
        atributos: ['von'],
        caracteristica: {
            id: 'mao-do-destino',
            nome: 'Mão do Destino',
            descricao:
                'Uma vez por descanso longo, antes de uma decisão importante, peça ao Narrador que revele a consequência futura mais provável da sua ação. Além disso, em momentos de extrema necessidade pode ocorrer uma reviravolta que altera o curso dos acontecimentos (um fruto ordinário que é um Fruto Mítico, um corpo comum fruto de experiência científica, um Haki do Rei excepcional...). Ela representa a intervenção do destino e só ocorre UMA vez em toda a aventura. Gatilhos (a critério do Narrador): a morte definitiva do personagem; uma derrota que encerraria a aventura; uma situação crítica sem saída plausível. Efeitos imediatos: recuperar todos os PV e PP; abrir uma fuga; resolver um obstáculo implacável (como causar dano a um oponente intangível). Resultados permanentes: mudança da Akuma no Mi, da espécie ou acesso a novas características. Uma vez ativada, não pode ser revertida, alterada ou reutilizada até o fim da aventura.',
            usos: { max: 1, descanso: 'longo' },
            etiquetas: ['Reviravolta do destino: 1× por aventura'],
        },
    },
    {
        id: 'revolucionario',
        nome: 'Revolucionário',
        descricao:
            'Você foi membro ativo do Exército Revolucionário: guerras, golpes e revoluções, de forma estratégica ou no combate. Conquistou a reputação de libertador, mas por algum motivo abandonou a missão e agora vaga pelos mares com novos objetivos.',
        pericias: ['acrobacia', 'atletismo', 'historia', 'medicina', 'persuasao'],
        atributos: ['des'],
        caracteristica: sorte(
            'heroi-do-povo',
            'Herói do Povo',
            'Seu passado turbulento faz sua identidade ser facilmente percebida. Com sucesso em um Teste de Vontade (Sorte), CD do Narrador, você encontra um lugar para se esconder, descansar ou se recuperar entre pessoas que simpatizam com a causa revolucionária (a menos que você tenha sido uma ameaça para elas). Elas o protegem da lei ou de quem o procure, mas não arriscam a vida por você.',
        ),
    },
    {
        id: 'sacerdote',
        nome: 'Sacerdote',
        descricao:
            'Você trabalhou em uma igreja (sua, dos seus pais ou de alguém que conhece), ajudando na educação, no tratamento médico, na alimentação e em outros direitos básicos negados aos menos favorecidos. Isso lhe deu uma visão humanista do mundo e pode ter sido o gatilho para ajudar mais pessoas ou combater quem causa esse sofrimento.',
        pericias: ['historia', 'medicina', 'persuasao', 'sobrenatural'],
        atributos: ['sab'],
        caracteristica: sorte(
            'fieis',
            'Fiéis',
            'Ao entrar em locais povoados, faça um Teste de Vontade (Sorte), CD do Narrador. No sucesso, você encontra até 3 pessoas que já ajudou: plebeus capazes de tarefas mundanas, que não lutarão por você, não o seguirão em áreas evidentemente perigosas e o abandonarão se forem ameaçados ou abusados com frequência.',
        ),
    },
    {
        id: 'sobrevivente',
        nome: 'Sobrevivente',
        descricao:
            'Um grande evento histórico (a destruição da sua ilha pelo Governo Mundial, uma doença ultrarrara, uma guerra que virou desastre natural) deixou você como único sobrevivente conhecido, e uma mítica se criou à sua volta, para o bem ou para o mal.',
        pericias: ['historia', 'intuicao', 'percepcao', 'sobrevivencia'],
        atributos: ['von'],
        caracteristica: sorte(
            'reputacao',
            'Reputação',
            'Em qualquer povoado civilizado, faça um Teste de Vontade (Sorte), CD do Narrador, para saber se os locais conhecem seu passado. No sucesso, você sai impune de crimes menores (recusar-se a pagar uma refeição, arrombar a porta de uma loja local), porque a maioria terá medo ou pena de relatar sua atividade às autoridades.',
        ),
    },
    {
        id: 'tenryuubito',
        nome: 'Tenryuubito',
        descricao:
            'Sua linhagem vem dos Nobres Mundiais (descendente direto ou com um dos pais Tenryuubito). Você pode ou não ter dividido seus costumes e pensamentos, mas quis se aventurar livre no mundo inferior, mesmo sabendo que isso rompe a relação entre vocês.',
        pericias: ['historia', 'intimidacao', 'investigacao', 'natureza'],
        atributos: ['con'],
        caracteristica: sorte(
            'costas-quentes',
            'Costas Quentes',
            'Ao interagir com membros do Governo Mundial ou do alto escalão da Marinha, você pode usar suas conexões com os Nobres Mundiais para publicar ou alterar notícias de jornal, solicitar ataques contra tripulações inimigas (fornecendo as informações), criar distrações etc., desde que passe em um Teste de Vontade (Sorte), CD do Narrador. Só volta após um descanso longo.',
            true,
        ),
    },
];

export const antecedentePorId = (id: string | null | undefined): Antecedente | undefined => ANTECEDENTES.find((a) => a.id === id);

/** O aumento de +2 num atributo: nunca passa de 20 por esta característica (e não reduz quem já passou). */
export const comAumentoDeAntecedente = (valor: number): number => Math.max(valor, Math.min(20, valor + 2));

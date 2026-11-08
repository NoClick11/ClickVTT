/**
 * Estilos de Combate (a "classe" do One Piece). Cada estilo é só dados: o assistente lê este catálogo e a ficha sai pronta.
 * Arquivo PURO (sem Vue): o Node o executa direto nos testes. Estilo novo = item novo em `ESTILOS`, sem mudar a lógica.
 *
 * O que o motor de efeitos modela entra em `efeitos`/`usos`/`acao`; o resto vira descrição + `etiquetas` (o resumo curto
 * que aparece na ficha). Características com `nivelMin` só valem a partir do nível indicado.
 */
import type { AtributoId, CategoriaDeAcao, DuracaoDaTecnica, Tecnica, TesteDaTecnica } from '../../regras.ts';
import type { DadoDeVida } from '../regras.ts';
import type { TracoDados } from './tipos.ts';

/** Técnica do estilo: entra na lista quando o personagem alcança o `nivel`. */
export type TecnicaDoEstilo = Omit<Tecnica, 'builder' | 'origem'> & {
    nivel: number;
    /** 1 a 7 para Técnica de Combate; vazio para Técnica Auxiliar. */
    grau?: number;
    caminho?: string;
};

/** Característica do estilo; `caminho` limita a um caminho (o outro caminho só vale a partir do nível `herdaTudoEm`). */
export type TracoDoEstilo = TracoDados & { caminho?: string };

export interface CaminhoDoEstilo {
    id: string;
    nome: string;
    descricao: string;
}

/** Um item do catálogo do Cap. 8 (id) e quantas unidades. */
export interface ItemInicial {
    catalogo: string;
    qtd: number;
}

/**
 * O equipamento inicial do estilo: entra no inventário ao concluir a criação. `porArma` depende da arma favorita escolhida ("2 pistolas ou
 * 1 mosquete"); `itens` valem sempre; `dinheiro` é fixo (`valor`) ou rolado (`dados` × `multiplicador`, rolado no servidor por um botão).
 */
export interface EquipamentoInicial {
    porArma?: Record<string, ItemInicial[]>;
    itens: ItemInicial[];
    dinheiro?: { valor: number } | { dados: string; multiplicador: number };
}

export interface EstiloDados {
    id: string;
    nome: string;
    descricao: string;
    dado: DadoDeVida;
    /** Atributos primários possíveis: com 2, o jogador escolhe um deles na criação (com 1, é fixo). */
    atributosPrimarios: AtributoId[];
    salvaguardas: AtributoId[];
    /** Proficiência com armas e equipamentos. */
    proficiencias: string[];
    /** Quantas perícias o jogador escolhe (livres, ou entre `periciasPermitidas`). */
    pericias: number;
    /** Se houver, as perícias do estilo só podem ser escolhidas desta lista (ids). */
    periciasPermitidas?: string[];
    armasFavoritas: string[];
    /** As duas Habilidades Básicas Inatas entre as quais o jogador escolhe (ids do catálogo de Habilidades Básicas). */
    habilidadesInatas: { id: string; nome: string }[];
    equipamento: string;
    /** O mesmo equipamento em dados, para o servidor entregar no inventário (o texto acima é o do livro). */
    equipamentoInicial?: EquipamentoInicial;
    caminhos?: CaminhoDoEstilo[];
    /** Nível em que o personagem recebe também o que não escolheu dos caminhos (Rei Atirador). */
    herdaTudoEm?: number;
    /** Níveis do Aumento no Valor de Atributo. */
    niveisAva: number[];
    /** Níveis em que ganha Técnicas (Combate e Auxiliar). */
    niveisDeTecnica: number[];
    tracos: TracoDoEstilo[];
    tecnicas: TecnicaDoEstilo[];
}

const REI = 11;

const tec = (
    nivel: number,
    grau: number | undefined,
    caminho: string,
    nome: string,
    custo: number,
    acao: CategoriaDeAcao,
    alcance: string,
    efeito: string,
    rolagem: string,
    tipoDano: string | undefined,
    descricao: string,
    extra: Partial<TecnicaDoEstilo> = {},
): TecnicaDoEstilo => ({ nivel, grau, caminho, nome, custo, acao, alcance, efeito, rolagem, ...(tipoDano ? { tipoDano } : {}), descricao, ...extra });

const CAMINHO_DUELISTA = 'duelista';
const CAMINHO_SNIPER = 'sniper';

export const ATIRADOR: EstiloDados = {
    id: 'atirador',
    nome: 'Atirador',
    descricao:
        'Olhos de águia: visão perfeita e precisão inigualável para atingir alvos difíceis a grande distância. Armas de fogo, canhões, arpões e, no fundo, a mira e a sagacidade do próprio atirador.',
    dado: 'd8',
    atributosPrimarios: ['des'],
    salvaguardas: ['des', 'sab'],
    proficiencias: ['Armas de Fogo', 'Lançador de Arpão', 'Bazuca', 'Canhão', 'Armas de Navio'],
    pericias: 3,
    armasFavoritas: ['Pistola', 'Mosquete'],
    habilidadesInatas: [
        { id: 'mira-treinada', nome: 'Mira Treinada' },
        { id: 'superioridade-absoluta', nome: 'Superioridade Absoluta' },
    ],
    equipamento: '2 pistolas ou 1 mosquete com 80 unidades de munição esférica e 5d10 x 1000 Bellys.',
    equipamentoInicial: {
        porArma: { Pistola: [{ catalogo: 'pistola', qtd: 2 }], Mosquete: [{ catalogo: 'mosquete', qtd: 1 }] },
        itens: [{ catalogo: 'municao-esferica', qtd: 80 }],
        dinheiro: { dados: '5d10', multiplicador: 1000 },
    },
    caminhos: [
        {
            id: CAMINHO_SNIPER,
            nome: 'Caminho do Sniper',
            descricao: 'Mosquetes de longa distância: precisão, alcance e impacto letal.',
        },
        {
            id: CAMINHO_DUELISTA,
            nome: 'Caminho do Duelista',
            descricao: 'Duas pistolas ao mesmo tempo, mesmo a curta distância: mobilidade e cadência de disparos.',
        },
    ],
    herdaTudoEm: REI,
    niveisAva: [4, 8, 12, 16, 20],
    niveisDeTecnica: [1, 3, 6, 9, 12, 16, 20],
    tracos: [
        // --- Caminho do Duelista ---
        {
            id: 'gun-fu',
            caminho: CAMINHO_DUELISTA,
            nome: 'Gun-Fu',
            descricao:
                'Enquanto estiver empunhando sua arma favorita, você recebe o benefício "Defesa Aprimorada" da Habilidade Básica Geral "Corpo de Guerreiro".',
            etiquetas: ['Defesa Aprimorada com a arma favorita'],
        },
        {
            id: 'corpo-treinado',
            caminho: CAMINHO_DUELISTA,
            nome: 'Corpo Treinado',
            descricao:
                'A experiência do combate aproximado faz você ficar mais resistente: +1 no máximo de Pontos de Vida no 1º nível e +1 a cada nível de Atirador posterior.',
            efeitos: [{ alvo: 'pv.max', modo: 'soma', valor: '@nivel' }],
        },
        {
            id: 'pistoleiro',
            caminho: CAMINHO_DUELISTA,
            nome: 'Pistoleiro',
            descricao: 'Estar a 1,5 metro de uma criatura não impõe desvantagem em jogadas de ataque (comum ou Técnicas) à distância.',
            etiquetas: ['Sem desvantagem à distância a 1,5 m'],
        },
        // --- Caminho do Sniper ---
        {
            id: 'visao-do-cacador',
            caminho: CAMINHO_SNIPER,
            nome: 'Visão do Caçador',
            descricao: 'Enquanto estiver empunhando sua arma favorita, você recebe os benefícios da Habilidade Básica Geral "Perito em Técnicas".',
            etiquetas: ['Perito em Técnicas com a arma favorita'],
        },
        {
            id: 'visao-alem-do-alcance',
            caminho: CAMINHO_SNIPER,
            nome: 'Visão Além do Alcance',
            descricao:
                'Com a mira de um mosquete, sua visão alcança 5 km em condições normais e o dobro em locais altos. Dentro de metade desse alcance você é proficiente e dobra o Bônus de Proficiência em testes de Percepção que dependam da visão. Jogadas de ataque (comum) à distância além da distância normal da arma não recebem desvantagem.',
            etiquetas: ['Visão de 5 km (10 km no alto)', 'Sem desvantagem além da distância normal'],
        },
        {
            id: 'corrida-continua',
            caminho: CAMINHO_SNIPER,
            nome: 'Corrida Contínua',
            descricao:
                'Carregando menos de 10 vezes o seu valor de Força em quilos (ignorando armas e equipamentos que normalmente carrega), você não recebe Níveis de Exaustão ao se manter em disparada por até 1 hora. Seu deslocamento normal se torna 15 metros e não pode ser reduzido por terreno difícil.',
            efeitos: [{ alvo: 'movimento.normal', modo: 'min', valor: 150 }],
            etiquetas: ['Deslocamento 15 m', 'Ignora terreno difícil', 'Disparada sem exaustão (1 h)'],
        },
        // --- Guarda Astuta ---
        {
            id: 'rompante-defensivo',
            nome: 'Guarda Astuta: Rompante Defensivo',
            nivelMin: 2,
            descricao:
                'Na primeira vez em cada rodada em que um inimigo que você possa ver acertar você com uma jogada de ataque (comum), você reduz pela metade o dano sofrido.',
            etiquetas: ['1ª vez por rodada: dano do ataque (comum) pela metade'],
        },
        {
            id: 'queda-suave',
            nome: 'Guarda Astuta: Queda Suave',
            nivelMin: 4,
            descricao: 'Ao receber dano de queda, você reduz o dano em 5 vezes o seu nível de Atirador.',
            etiquetas: ['Dano de queda −5 × nível'],
        },
        {
            id: 'sentido-de-perigo',
            nome: 'Guarda Astuta: Sentido de Perigo',
            nivelMin: 6,
            descricao:
                'Você tem vantagem em Salvaguardas de Destreza contra Técnicas e armadilhas. Para receber esse benefício, você não pode estar sob as condições "Cego", "Surdo" ou "Incapacitado".',
            efeitos: [{ alvo: 'salv.des', modo: 'vantagem' }],
            etiquetas: ['Vantagem em Salv. DES contra Técnicas e armadilhas'],
        },
        {
            id: 'esquiva-fugaz',
            nome: 'Guarda Astuta: Esquiva Fugaz',
            nivelMin: 8,
            descricao:
                'Quando for alvo de um efeito que exige Salvaguarda de Destreza para sofrer metade do dano, você não sofre dano algum se passar e apenas metade se falhar.',
            etiquetas: ['Salv. DES: passa = 0 de dano, falha = metade'],
        },
        {
            id: 'elusivo',
            nome: 'Guarda Astuta: Elusivo',
            nivelMin: 10,
            descricao: 'Nenhuma jogada de ataque (comum) tem vantagem contra você, desde que você não esteja "Incapacitado".',
            etiquetas: ['Ataques (comuns) não têm vantagem contra você'],
        },
        // --- Atirador de Elite ---
        {
            id: 'atirador-de-elite',
            nome: 'Atirador de Elite',
            nivelMin: 3,
            descricao:
                'Aplicável às jogadas de ataque com armas à distância: o alcance das Técnicas de ataque à distância é dobrado e o alcance máximo das armas não impõe desvantagem; seus ataques (comum ou Técnicas) à distância ignoram meia-cobertura e três quartos de cobertura; nos ataques (comum) à distância você dobra o Bônus de Proficiência.',
            etiquetas: ['Alcance das Técnicas à distância ×2', 'Ignora meia e 3/4 de cobertura', 'Prof. dobrada em ataques (comum) à distância'],
        },
        {
            id: 'tiro-pesado',
            nome: 'Atirador de Elite: Tiro Pesado',
            nivelMin: 3,
            tipo: 'ativa',
            descricao:
                'Antes de uma jogada de ataque (comum) à distância na qual seja proficiente, você pode sofrer −5 na jogada. Se acertar, adiciona +10 ao dano. Ligue antes de atacar.',
            efeitos: [
                { alvo: 'ataque.arma', modo: 'soma', valor: -5 },
                { alvo: 'dano.arma', modo: 'soma', valor: 10 },
            ],
        },
        {
            id: 'rapido-no-gatilho',
            caminho: CAMINHO_DUELISTA,
            nome: 'Duelista de Elite: Rápido no Gatilho',
            nivelMin: 3,
            descricao:
                'Uma vez por turno, ao realizar uma jogada de ataque (comum ou Técnicas) à distância, você pode usar uma ação bônus para realizar outra jogada de ataque (comum) à distância.',
            acao: 'bonus',
            etiquetas: ['1×/turno: ataque (comum) extra à distância com ação bônus'],
        },
        {
            id: 'tiro-de-oportunidade',
            caminho: CAMINHO_DUELISTA,
            nome: 'Duelista de Elite: Tiro de Oportunidade',
            nivelMin: 3,
            descricao:
                'Com sua reação, você pode fazer uma jogada de ataque (comum) à distância contra uma criatura que você veja e que se mova voluntariamente para fora ou para dentro de um espaço a 1,5 metro de você.',
            acao: 'reacao',
            etiquetas: ['Reação: ataque (comum) à distância contra quem entra ou sai de 1,5 m'],
        },
        {
            id: 'alvo-na-mira',
            caminho: CAMINHO_SNIPER,
            nome: 'Sniper de Elite: Alvo na Mira',
            nivelMin: 3,
            tipo: 'ativa',
            acao: 'bonus',
            descricao:
                'Com uma ação bônus, dobre o alcance normal da sua arma para todas as jogadas de ataque (comum) à distância durante seu turno, sem desvantagem pela distância.',
            etiquetas: ['Alcance normal da arma ×2 no turno'],
        },
        {
            id: 'posicionamento-perfeito',
            caminho: CAMINHO_SNIPER,
            nome: 'Sniper de Elite: Posicionamento Perfeito',
            nivelMin: 3,
            descricao:
                'Você ganha 9 metros de escalada, que podem ser reduzidos pela metade para passar automaticamente em Testes de Atributo de escalada.',
            efeitos: [{ alvo: 'movimento.escalada', modo: 'min', valor: 90 }],
        },
        // --- Franco Atirador (5º) ---
        {
            id: 'carga-de-adrenalina',
            nome: 'Franco Atirador: Carga de Adrenalina',
            nivelMin: 5,
            tipo: 'ativa',
            acao: 'bonus',
            usos: { max: 3, descanso: 'longo' },
            descricao:
                'Com uma ação bônus, você aumenta sua Classe de Resistência em +3 por 1 minuto. Até 3 usos; recupera 1 uso ao final de um descanso longo. Não acumula consigo mesma.',
            efeitos: [{ alvo: 'ca', modo: 'soma', valor: 3 }],
        },
        {
            id: 'alvo-travado',
            nome: 'Franco Atirador: Alvo Travado',
            nivelMin: 5,
            tipo: 'ativa',
            acao: 'bonus',
            usos: { max: 1, descanso: 'longo' },
            descricao:
                'Com uma ação bônus, escolha uma criatura que você veja. Por 1 minuto: ao usar a ação "Atacar", você pode fazer 10 jogadas de ataque (comum) à distância extras contra o alvo travado, no máximo 2 desses ataques por rodada; seus ataques (comum) à distância contra ele têm vantagem; ataques (comum) contra qualquer outra criatura têm desvantagem.',
            etiquetas: ['Alvo travado: até 10 ataques extras (máx. 2/rodada), com vantagem'],
        },
        {
            id: 'talento-confiavel',
            nome: 'Franco Atirador: Talento Confiável',
            nivelMin: 5,
            descricao: 'Em um Teste de Atributo em que você tenha proficiência, trate qualquer resultado de 9 ou menos no d20 como 10.',
            etiquetas: ['Teste com proficiência: d20 ≤ 9 vale 10'],
        },
        {
            id: 'melhorar-municao',
            nome: 'Franco Atirador: Melhorar Munição',
            nivelMin: 5,
            descricao:
                'Após 1 hora aprimorando 50 munições, elas: ignoram resistência a dano Contundente ou Perfurante; passam a causar 1d10; e um dano de 4 ou menos nelas conta como 5. Alternativamente, gaste o mesmo tempo para manufaturar 50 munições esféricas ou perfurantes comuns com sucata.',
        },
        // --- Do 6º ao 10º ---
        {
            id: 'emissario-da-morte',
            nome: 'Emissário da Morte',
            nivelMin: 6,
            usos: { max: 1, descanso: 'curto' },
            descricao:
                'Uma vez por encontro, ao acertar uma criatura que não esteja ciente da sua presença ou "Surpreso", os PV atuais dela caem para metade do máximo (arredondado para baixo), se ainda não estiverem, antes do dano. Não vale contra criaturas imunes a "Surpreso" ou com percepção às cegas. Além disso, o dano contra criaturas com menos da metade dos PV máximos não pode ser menor que o seu nível de Atirador.',
            etiquetas: ['Dano mínimo = nível contra alvos com menos da metade dos PV'],
        },
        {
            id: 'ataque-extra',
            nome: 'Ataque Extra',
            nivelMin: 7,
            descricao: 'Você pode atacar duas vezes, em vez de uma, ao usar a ação "Atacar" no seu turno.',
            etiquetas: ['Ação Atacar: 2 ataques'],
            efeitos: [{ alvo: 'ataques.acao', modo: 'soma', valor: 1 }],
        },
        {
            id: 'contagem-de-balas',
            nome: 'Contagem de Balas',
            nivelMin: 10,
            usos: { max: 10, descanso: 'longo' },
            descricao:
                'No início de cada dia você recebe 10 disparos de precisão máxima: cada um é uma jogada de ataque (comum) à distância adicional, no máximo uma por rodada, junto da ação "Atacar". São acertos automáticos e dobram a quantidade de dados de dano da munição. O que sobrar é perdido ao fim do dia.',
        },
        {
            id: 'rei-atirador',
            nome: 'Rei Atirador',
            nivelMin: REI,
            descricao:
                'Pistolas e mosquetes tornam-se suas armas favoritas e você recebe todas as características e Técnicas dos caminhos que não escolheu. Com ฿ 100.000 e 2 horas de manutenção, você melhora uma arma à distância: Adaptação Absoluta (recebe os benefícios que você aplica a pistolas e mosquetes), Alcance Absoluto (sem limite de alcance; basta ver o alvo), Crítico Aprimorado (margem 18-20 nos ataques (comum) à distância), Máximo Aproveitamento (3 dados adicionais nas Técnicas, dobrados em crítico, sem passar do dano máximo) e Precisão Aprimorada (+3 no acerto; prevalece o maior).',
            etiquetas: ['Arma melhorada: crítico 18-20, +3 no acerto, sem limite de alcance'],
        },
        {
            id: 'execucao-perfeita',
            nome: 'Rei Atirador: Execução Perfeita',
            nivelMin: REI,
            usos: { max: 3, descanso: 'longo' },
            descricao:
                'Ao executar uma Técnica que tenha a arma melhorada como requisito, role o dano duas vezes e fique com o maior. 3 usos; todos voltam no descanso longo.',
        },
        {
            id: 'tempestade-de-balas',
            nome: 'Tempestade de Balas',
            nivelMin: 14,
            descricao:
                'Sempre que reduzir uma criatura a 0 PV, você recebe 2 jogadas de ataque (comum) à distância adicionais até o fim do seu turno.',
            etiquetas: ['Abate: +2 ataques (comum) à distância'],
        },
        {
            id: 'mira-absoluta',
            nome: 'Mira Absoluta',
            nivelMin: 15,
            descricao:
                'Suas jogadas de ataque (comum) à distância causam dano Verdadeiro e atravessam todo o alcance em linha reta, atingindo todas as criaturas no trajeto. Cada criatura adicional sofre metade do dano inicial (arredondado para cima).',
            etiquetas: ['Ataques à distância: dano Verdadeiro, atravessam em linha'],
        },
        {
            id: 'mestre-atirador',
            nome: 'Mestre Atirador',
            nivelMin: 18,
            descricao:
                'Distribua livremente 6 pontos entre seus atributos, respeitando o máximo de 24 em cada um. Dois atributos à sua escolha podem chegar a 30. (Aplique na aba Atributos.)',
        },
        {
            id: 'engatilhado',
            nome: 'Deus Atirador: Engatilhado',
            nivelMin: 19,
            descricao: 'Você recebe 2 jogadas de ataque (comum) à distância adicionais na característica "Ataque Extra".',
            etiquetas: ['Ataque Extra: +2 ataques à distância'],
            efeitos: [{ alvo: 'ataques.distancia', modo: 'soma', valor: 2 }],
        },
        {
            id: 'next-level',
            nome: 'Deus Atirador: Next Level',
            nivelMin: 19,
            descricao: 'Ao atingir criaturas com ND 6 ou menor, você reduz os PV delas a 0. Em acertos críticos, vale também para ND 9 ou menor.',
        },
        {
            id: 'homem-sem-nome',
            nome: 'Deus Atirador: Homem sem Nome',
            nivelMin: 19,
            descricao:
                'Enquanto estiver com mais da metade dos seus PV, você não erra nenhuma jogada de ataque (comum) à distância e pode rolar os dados só para verificar acertos críticos e outras características, ignorando penalidades.',
            etiquetas: ['Mais da metade dos PV: ataques (comum) à distância não erram'],
        },
    ],
    tecnicas: [
        // ============ Duelista ============
        tec(
            1,
            1,
            CAMINHO_DUELISTA,
            'Death Blossom',
            2,
            'poderosa',
            'Arma, Esfera',
            '2d6 Contundente ou Perfurante',
            '2d6',
            'perfurante',
            'Disparos contra as criaturas ao redor, escolhendo quais estão no alcance. Cada criatura na área faz Salvaguarda de Destreza com desvantagem: todo o dano se falhar, metade se passar. <Gun Powder Party> No 6º nível pode ser usada como de 3º Grau: 6d6 e 5 PP. Requisito: arma favorita, 8 munições (qualquer). Ataque combinado: impossível.',
        ),
        tec(
            3,
            2,
            CAMINHO_DUELISTA,
            'Covering',
            4,
            'poderosa',
            'Arma, Linha',
            '4d10 Contundente ou Perfurante',
            '4d10',
            'perfurante',
            'Disparos cadenciados: jogada de ataque (Técnicas) à distância contra uma criatura. Se acertar, a próxima jogada de ataque (comum ou Técnicas) dela tem desvantagem até o fim do próximo turno dela. Requisito: arma favorita, 6 munições (qualquer). Ataque combinado: possível.',
        ),
        tec(
            6,
            3,
            CAMINHO_DUELISTA,
            'Quick Fire',
            6,
            'reacao',
            'Arma, Linha',
            '2d10 Perfurante',
            '2d10',
            'perfurante',
            'Ao ser alvo de uma jogada de ataque (comum), faça em resposta uma jogada de ataque (Técnicas) à distância. A criatura atingida deve passar em Salvaguarda de Constituição ou encerra o turno logo após sofrer o dano. Requisito: arma favorita, 1 munição (perfurante). Ataque combinado: impossível.',
        ),
        tec(
            9,
            4,
            CAMINHO_DUELISTA,
            'Death Shower',
            8,
            'poderosa',
            'Arma, Cone',
            '8d6 Perfurante',
            '8d6',
            'perfurante',
            'Cada criatura na área faz Salvaguarda de Destreza com desvantagem: todo o dano se falhar, metade se passar. Quem falhar faz uma Salvaguarda de Constituição ou recebe "Sangramento". Requisito: arma favorita, 12 munições (perfurante).',
        ),
        tec(
            12,
            5,
            CAMINHO_DUELISTA,
            'Stunning Shot',
            10,
            'poderosa',
            'Arma, Linha',
            '6d10 Contundente',
            '6d10',
            'contundente',
            'Jogada de ataque (Técnicas) à distância com disparos seguidos em pontos fracos. A criatura atingida deve passar em Salvaguarda de Constituição ou recebe "Atordoado" até o fim do próximo turno dela. Requisito: arma favorita, 2 munições (esférica).',
        ),
        tec(
            16,
            6,
            CAMINHO_DUELISTA,
            'Quick Draw',
            12,
            'bonus',
            'Até 15 m, Esfera',
            '2d10 Contundente ou Perfurante',
            '2d10',
            'perfurante',
            'Duração: até 1 minuto. No início do turno de cada criatura que você veja no alcance, faça uma jogada de ataque (Técnicas) à distância contra ela. Em cada acerto, cause o dano e escolha: movimento da criatura a 0 até o fim do turno; +2d10 de dano Contundente ou Perfurante; ou impedi-la de realizar a ação naquele turno. Requisito: arma favorita.',
        ),
        tec(
            20,
            7,
            CAMINHO_DUELISTA,
            'Execução',
            14,
            'poderosa',
            'Arma, Linha',
            '11d10 Contundente ou Perfurante',
            '11d10',
            'perfurante',
            'Jogada de ataque à distância (Técnicas) contra uma criatura que você veja no alcance. Se ela tiver 150 PV ou menos, antes de descontar o dano, morre instantaneamente. Requisito: arma favorita, 1 munição (qualquer).',
        ),
        tec(
            1,
            undefined,
            CAMINHO_DUELISTA,
            'Último Recurso',
            2,
            'bonus',
            'Até 9 m, Linha',
            'Sem dano; Incapacitado',
            '',
            undefined,
            'Arremesse uma arma (mesmo sem munição) contra uma criatura no alcance: jogada de ataque (Técnicas), sem dano. A criatura atingida deve passar em Salvaguarda de Constituição, com desvantagem, ou fica "Incapacitado" até o fim do próximo turno dela. Requisito: 1 arma.',
        ),
        tec(
            6,
            undefined,
            CAMINHO_DUELISTA,
            'Defesa Improvisada',
            2,
            'reacao',
            'Pessoal',
            'Reduz o dano em 6d8',
            '6d8',
            undefined,
            'Ao ser atingido por uma jogada de ataque (comum ou Técnicas), defenda-se com suas pistolas e reduza o dano em 6d8. Gaste 1 PP para somar 2d8 à redução, até 20d8 no total. Requisito: pistola.',
        ),
        tec(
            12,
            undefined,
            CAMINHO_DUELISTA,
            'Acerto Debilitante',
            10,
            'bonus',
            'Pessoal',
            'Próximo ataque debilita',
            '',
            undefined,
            'A próxima jogada de ataque (comum) à distância que acertar, até o fim do seu próximo turno, obriga a criatura a uma Salvaguarda de Constituição com desvantagem. Se falhar, por 1 minuto: sem ações bônus nem reações; deslocamento pela metade; em cada turno usa ação OU ação poderosa. Ao fim de cada turno dela, repete a salvaguarda (com desvantagem) para encerrar.',
        ),
        // ============ Sniper ============
        tec(
            1,
            1,
            CAMINHO_SNIPER,
            'Tiro de Advertência',
            2,
            'poderosa',
            'Arma, Linha',
            '2d10 Psíquico',
            '2d10',
            'psiquico',
            'Disparo rápido que quase raspa no inimigo: jogada de ataque (Técnicas) à distância. O alvo faz Salvaguarda de Vontade; se falhar, escolhe entre se mover ou realizar uma ação e não usa reação nem ação bônus até o fim do próximo turno dele. Requisito: arma favorita, 1 munição (qualquer). Ataque combinado: possível.',
        ),
        tec(
            3,
            2,
            CAMINHO_SNIPER,
            'Tiro Certeiro',
            4,
            'poderosa',
            'Arma, Linha',
            '3d10 Contundente ou Perfurante',
            '3d10',
            'perfurante',
            'Jogada de ataque (Técnicas) à distância contra criatura que você veja no alcance: o disparo acerta automaticamente. Requisito: mosquete, 1 munição (qualquer). Ataque combinado: possível.',
        ),
        tec(
            6,
            3,
            CAMINHO_SNIPER,
            'Mira Cruel',
            6,
            'poderosa',
            'Arma, Linha',
            '5d10 Perfurante',
            '5d10',
            'perfurante',
            'Mirando nas articulações: a criatura atingida tem o movimento reduzido pela metade e deve passar em Salvaguarda de Constituição ou recebe "Impedido" até o fim do próximo turno. Requisito: mosquete, 1 munição (perfurante).',
        ),
        tec(
            9,
            4,
            CAMINHO_SNIPER,
            'Overwatch',
            8,
            'poderosa',
            'Arma, Linha',
            'Sem dano direto',
            '',
            undefined,
            'Duração: até 1 minuto, concentração. Marque uma esfera de até 3 m de raio. Sempre que uma criatura realizar uma ação na duração, antes que a complete, faça uma jogada de ataque (comum) contra ela; a atingida deve passar em Salvaguarda de Constituição ou encerra o turno logo após sofrer o dano. Ação bônus: mover o centro da esfera até 6 m. Qualquer outra atividade encerra a Técnica. Requisito: mosquete, 1 munição por ataque.',
        ),
        tec(
            12,
            5,
            CAMINHO_SNIPER,
            'Shooting Stars',
            10,
            'poderosa',
            'Até 18 m, Cone',
            '10d6 Contundente ou Perfurante',
            '10d6',
            'perfurante',
            'Série de disparos contra todos os inimigos: cada criatura na área faz Salvaguarda de Destreza (todo o dano se falhar, metade se passar). Requisito: mosquete, 20 munições (qualquer). Ataque combinado: possível.',
        ),
        tec(
            16,
            6,
            CAMINHO_SNIPER,
            'Zona do Atirador',
            12,
            'poderosa',
            'Arma, Linha',
            '5d10 Perfurante',
            '5d10',
            'perfurante',
            'Jogada de ataque (Técnicas) à distância certeira. Ao acertar, enquanto durar (até 1 minuto) você tem vantagem em jogadas de ataque (comum) e 60 PV temporários. Requisito: mosquete, 10 munições (perfurante).',
        ),
        tec(
            20,
            7,
            CAMINHO_SNIPER,
            'Headshot',
            14,
            'poderosa',
            'Arma, Linha',
            '12d10 Perfurante',
            '12d10',
            'perfurante',
            'Contra criatura com ao menos uma cabeça, em acerto crítico natural você atravessa a cabeça e ela morre se não sobreviver sem ela. Se não tiver ou não precisar de cabeça, tiver Ações Lendárias ou o Narrador decidir, ela sofre 6d10 Perfurante extra após o crítico. Sem efeito se o alvo não puder sofrer dano. Requisito: mosquete, 1 munição (perfurante).',
        ),
        tec(
            1,
            undefined,
            CAMINHO_SNIPER,
            'Saída Forçada',
            2,
            'reacao',
            'Até 1,5 m, Esfera',
            'Derruba os cercanos',
            '',
            undefined,
            'Cercado, gire o mosquete e acerte todas as criaturas ao redor. Cada uma faz Salvaguarda de Destreza para não receber "Caído" e perder a reação nesta rodada. Requisito: mosquete (ou algo semelhante).',
        ),
        tec(
            6,
            undefined,
            CAMINHO_SNIPER,
            'Manobra Evasiva',
            6,
            'reacao',
            'Pessoal',
            '+3 na CR; recua até 9 m',
            '',
            undefined,
            'Ao ser alvo de uma jogada de ataque (comum ou Técnicas), afaste-se até 9 m sem provocar reações de nenhum tipo e receba +3 na CR até o início do seu próximo turno.',
            { reacao: { gatilho: 'ataque_declarado', alcance: 'si', defesa: 3 } },
        ),
        tec(
            12,
            undefined,
            CAMINHO_SNIPER,
            'Ruptura',
            10,
            'bonus',
            'Pessoal',
            '8d10 Verdadeiro ao se mover',
            '',
            undefined,
            'A próxima jogada de ataque (comum) à distância que acertar causa danos internos: por até 1 minuto, se a criatura se mover voluntariamente, sofre 8d10 de dano Verdadeiro ao fim do turno dela (não se for movida por terceiros). Tratar exige uma ação e Teste de Sabedoria (Medicina) CD 20.',
        ),
    ],
};

/**
 * Como cada Técnica do Atirador acerta (Capítulo de estilos): ataque (Técnicas), Salvaguarda da área ou automática; `secundaria` é a
 * Salvaguarda do efeito. Sem entrada, a Técnica não tem teste (reação, buff ou efeito sem alvo).
 */
const TESTES_DO_ATIRADOR: Record<string, TesteDaTecnica> = {
    'Death Blossom': { tipo: 'salvaguarda', atributo: 'des', desvantagem: true, aoPassar: 'metade' },
    Covering: { tipo: 'ataque' },
    'Quick Fire': { tipo: 'ataque', secundaria: { atributo: 'con', efeito: 'encerra o turno logo após sofrer o dano' } },
    'Death Shower': {
        tipo: 'salvaguarda',
        atributo: 'des',
        desvantagem: true,
        aoPassar: 'metade',
        secundaria: { atributo: 'con', efeito: 'Sangramento', aplica: { condicao: 'sangramento' } },
    },
    'Stunning Shot': {
        tipo: 'ataque',
        secundaria: { atributo: 'con', efeito: 'Atordoado até o fim do próximo turno dela', aplica: { condicao: 'atordoado', turnos: 1 } },
    },
    'Quick Draw': { tipo: 'ataque' },
    Execução: { tipo: 'ataque' },
    'Último Recurso': {
        tipo: 'ataque',
        secundaria: {
            atributo: 'con',
            desvantagem: true,
            efeito: 'Incapacitado até o fim do próximo turno dela',
            aplica: { condicao: 'incapacitado', turnos: 1 },
        },
    },
    'Tiro de Advertência': {
        tipo: 'ataque',
        secundaria: { atributo: 'von', efeito: 'escolhe entre se mover ou realizar uma ação, sem reação nem ação bônus até o fim do próximo turno' },
    },
    'Tiro Certeiro': { tipo: 'automatico' },
    'Mira Cruel': {
        tipo: 'ataque',
        secundaria: { atributo: 'con', efeito: 'Impedido até o fim do próximo turno', aplica: { condicao: 'contido', turnos: 1 } },
    },
    'Shooting Stars': { tipo: 'salvaguarda', atributo: 'des', aoPassar: 'metade' },
    'Zona do Atirador': { tipo: 'ataque' },
    Headshot: { tipo: 'ataque' },
    'Saída Forçada': { tipo: 'salvaguarda', atributo: 'des', aoPassar: 'nada', aplica: { condicao: 'caido' } },
};
for (const t of ATIRADOR.tecnicas) if (TESTES_DO_ATIRADOR[t.nome]) t.teste = TESTES_DO_ATIRADOR[t.nome];

/**
 * Técnicas que duram vários turnos: ficam ativas no combate e pedem um ataque no início do turno de cada criatura ao alcance (o jogador
 * clica para rolar). Quick Draw: até 1 minuto (10 rodadas); no acerto, causa o dano e o jogador escolhe um dos três efeitos.
 */
const DURACOES_DO_ATIRADOR: Record<string, DuracaoDaTecnica> = {
    'Quick Draw': {
        rodadas: 10,
        opcoes: [
            { id: 'movimento', rotulo: 'Movimento da criatura a 0 até o fim do turno', efeito: { tipo: 'movimento_zero' } },
            { id: 'dano', rotulo: '+2d10 de dano Contundente ou Perfurante', efeito: { tipo: 'dano', expressao: '2d10', tipoDano: 'perfurante' } },
            { id: 'acao', rotulo: 'Impedi-la de realizar a ação neste turno', efeito: { tipo: 'sem_acao' } },
        ],
    },
    // Até 1 minuto, concentração: a esfera dispara um ataque (comum) quando uma criatura age ou se move nela; a Ação bônus a move até 6 m
    Overwatch: { rodadas: 10, concentracao: true, vigia: { raio: 3, mover: 6 } },
};
for (const t of ATIRADOR.tecnicas) if (DURACOES_DO_ATIRADOR[t.nome]) t.duracao = DURACOES_DO_ATIRADOR[t.nome];

/**
 * Aventureiro (chicote e pistola). Regra do projeto: só dano, área e PP são automáticos (Técnicas); condições, estados, gatilhos e as
 * reações que não reduzem o dano do próprio personagem ficam como texto para a mesa conduzir. `etiquetas` é o resumo curto da ficha.
 */
export const AVENTUREIRO: EstiloDados = {
    id: 'aventureiro',
    nome: 'Aventureiro',
    descricao:
        'Acostumado a todo tipo de perigo, reage de forma instantânea às adversidades, tem um sexto sentido para o perigo e transforma desafios em oportunidades. Chicote e pistola garantem alcance e versatilidade; resistência e foco permitem contornar a exaustão.',
    dado: 'd10',
    atributosPrimarios: ['des'],
    salvaguardas: ['des', 'con'],
    proficiencias: ['Armas Cortantes', 'Armas de Fogo', 'Armas Especiais', 'Armas Marciais'],
    pericias: 3,
    armasFavoritas: ['Chicote', 'Pistola'],
    habilidadesInatas: [
        { id: 'defesa-ofensiva', nome: 'Defesa Ofensiva' },
        { id: 'perito-em-tecnicas', nome: 'Perito em Técnicas' },
    ],
    equipamento: '1 pistola com 80 unidades de munição esférica, 1 chicote, 1 adaga e 10d10 x 1000 Bellys.',
    equipamentoInicial: {
        itens: [
            { catalogo: 'pistola', qtd: 1 },
            { catalogo: 'municao-esferica', qtd: 80 },
            { catalogo: 'chicote', qtd: 1 },
            { catalogo: 'adaga', qtd: 1 },
        ],
        dinheiro: { dados: '10d10', multiplicador: 1000 },
    },
    niveisAva: [4, 8, 12, 16, 20],
    niveisDeTecnica: [1, 3, 6, 9, 12, 16, 20],
    tracos: [
        // --- Whip and Gun (1º) ---
        {
            id: 'whip-and-gun-chicote',
            nome: 'Whip and Gun: Chicote',
            descricao:
                'Poder e Precisão Máximos: com um chicote, o dado da arma é o 1d10. Crítico Frenético: uma vez por turno, num acerto crítico com jogada de ataque (comum) de chicote, você pode fazer uma jogada de ataque adicional com a pistola. Golpe Moral: seus ataques (comum ou Técnicas) com chicote ignoram resistência a dano Cortante e causam metade do dano em invulnerabilidades. Astúcia da Víbora: use sua reação para uma jogada de ataque (comum) quando um inimigo que você veja entrar ou sair voluntariamente do alcance do chicote.',
            etiquetas: [
                'Chicote: dado 1d10 (ajuste a arma)',
                'Crítico Frenético: acerto crítico → ataque extra de pistola',
                'Chicote ignora resistência Cortante',
            ],
        },
        {
            id: 'whip-and-gun-pistola',
            nome: 'Whip and Gun: Pistola',
            descricao:
                'Tiro Oportunista: em acerto crítico com pistola, role os dados de dano da arma três vezes em vez de duas. Olhar Afiado: seus ataques (comum ou Técnicas) à distância ignoram meia cobertura e cobertura de três quartos. Disparo Rápido: tendo feito ao menos um ataque (comum) com chicote no turno, use a ação bônus para um ataque (comum) adicional com pistola.',
            etiquetas: [
                'Crítico com pistola: 3 vezes os dados',
                'Ataques à distância ignoram meia e 3/4 de cobertura',
                'Disparo Rápido: bônus após ataque de chicote',
            ],
        },
        {
            id: 'fan-firing',
            nome: 'Whip and Gun: Fan Firing',
            usos: { max: 1, descanso: 'longo' },
            descricao:
                'Com a ação, faça 3 jogadas de ataque (comum) à distância com a pistola, todas com desvantagem e alcance de até 6 metros. Depois, você fica incapaz de outras jogadas de ataque (comum) até o início do seu próximo turno. No 6º nível de Aventureiro, passam a ser 6 jogadas.',
            etiquetas: ['Fan Firing: 3 ataques com desvantagem (6 no 6º)'],
        },
        // --- Pronto para a Aventura (2º) ---
        {
            id: 'pronto-para-o-perigo',
            nome: 'Pronto para a Aventura: Pronto para o Perigo',
            nivelMin: 2,
            descricao:
                'Fora de combate você usa as Técnicas do Aventureiro sem gastar PP, desde que não afetem encontros futuros nem outras criaturas. Seu máximo de PP aumenta em 4 + seu Bônus de Proficiência. No início de cada encontro você recupera até metade dos seus PP, se não tiver Níveis de Exaustão. Você recupera 1 Nível de Exaustão adicional ao fim de um descanso longo e pode gastar 6 PP ao fim de um descanso curto para recuperar 1.',
            efeitos: [{ alvo: 'pp.max', modo: 'soma', valor: '@prof+4' }],
            etiquetas: ['PP máx +4 + prof.', 'Início do encontro: recupera até metade dos PP'],
        },
        {
            id: 'pronto-para-a-exploracao',
            nome: 'Pronto para a Aventura: Pronto para a Exploração',
            nivelMin: 2,
            descricao:
                'Carregando menos de 10 vezes o seu valor de Força em quilos (ignorando armas e equipamentos que normalmente carrega), você não recebe Níveis de Exaustão em disparada por até 1 hora. Seu deslocamento normal se torna 15 metros e não é reduzido por terreno difícil. Você é proficiente em montarias e veículos e seu deslocamento de natação iguala o normal. Você recebe proficiência em Sabedoria (Investigação), ou dobra o Bônus de Proficiência se já a tiver.',
            efeitos: [
                { alvo: 'movimento.normal', modo: 'min', valor: 150 },
                { alvo: 'movimento.nado', modo: 'min', valor: 150 },
            ],
            etiquetas: ['Deslocamento 15 m (nado igual)', 'Ignora terreno difícil', 'Investigação: proficiência ou dobro'],
        },
        // --- Estilo Arriscado (3º) ---
        {
            id: 'ataque-empolgante',
            nome: 'Estilo Arriscado: Ataque Empolgante',
            nivelMin: 3,
            descricao:
                'Ao fazer uma jogada de ataque (comum) com chicote e obter um acerto crítico natural, sua margem de crítico com essa arma aumenta em 1 até o fim do encontro (19-20, depois 18-20...), no máximo 15-20.',
            etiquetas: ['Crítico natural com chicote: margem −1 até o fim do encontro (mín. 15)'],
        },
        {
            id: 'tiro-sem-paciencia',
            nome: 'Estilo Arriscado: Tiro Sem Paciência',
            nivelMin: 3,
            usos: { max: 1, descanso: 'longo' },
            descricao:
                'Com a ação poderosa, faça um disparo com arma de fogo: a jogada de ataque (comum) à distância recebe 1 dado de dano adicional (munição) por rodada em que você participou do encontro, limitado a 2 vezes o seu nível de Aventureiro (máximo 30 dados).',
            etiquetas: ['Ação poderosa: +1 dado de munição por rodada do encontro (máx. 2 × nível)'],
        },
        {
            id: 'domador-da-coragem',
            nome: 'Estilo Arriscado: Domador da Coragem',
            nivelMin: 3,
            usos: { max: 5, descanso: 'curto' },
            descricao:
                'Ao acertar uma criatura, use sua reação para reduzir as jogadas de ataque (comum ou Técnicas) de todas as criaturas hostis a até 9 metros de você em um valor igual ao seu Bônus de Proficiência, até o início do seu próximo turno. Até 5 usos; recupera todos ao fim de um descanso curto ou longo.',
            etiquetas: ['Reação: hostis a 9 m com −prof. nos ataques até seu próximo turno'],
        },
        {
            id: 'errar-com-vontade',
            nome: 'Estilo Arriscado: Errar com Vontade',
            nivelMin: 3,
            descricao:
                'Ao obter uma falha crítica em jogada de ataque (comum) com chicote, você acerta a si mesmo, sofrendo 2d12 de dano Verdadeiro. Essa falha crítica também aumenta a margem de crítico do Ataque Empolgante.',
            etiquetas: ['Falha crítica com chicote: 2d12 Verdadeiro em você'],
        },
        // --- Caminho da Aventura (5º): Dados de Aventura ---
        {
            id: 'dados-de-aventura',
            nome: 'Caminho da Aventura: Dados de Aventura',
            nivelMin: 5,
            usos: { max: 2, formula: 'max(@nivel/2, min(@nivel, (@nivel-9)*100))', descanso: 'curto' },
            descricao:
                'Você recebe Dados de Aventura iguais à metade do seu nível de Aventureiro (d8). Gaste 1 dado: +3 m no deslocamento até o fim do turno; ou +1 na CR até o início do seu próximo turno; ou recupere PV iguais ao resultado; ou, numa Técnica instantânea de alvo único, cause metade do dano em outra criatura no alcance; ou some o dado ao dano de uma Técnica instantânea (limitado ao grau dela). Gaste 2 dados para refazer um Teste de Atributo ou Salvaguarda falho, somando seu nível de Aventureiro. Uma vez por turno, quando um ataque falhar contra você ou você errar, recupere 1 dado. Todos voltam em descanso curto ou longo. No 10º nível: dados d12, quantidade igual ao nível, 6 dados para voltar com metade dos PV máximos ao cair a 0, e todos voltam no início de cada encontro.',
            etiquetas: ['Dados de Aventura: d8 (d12 no 10º); quantidade = ½ nível (nível no 10º)'],
        },
        // --- Companheiro Inseparável (6º) ---
        {
            id: 'reacao-agressiva',
            nome: 'Companheiro Inseparável: Reação Agressiva',
            nivelMin: 6,
            descricao:
                'Sempre que usar uma reação, você pode, na mesma reação, fazer uma jogada de ataque contra uma criatura no alcance do seu chicote. O ataque causa 3d6 de dano, sem modificadores nem efeitos adicionais (como críticos ou outras Características de Combate).',
            etiquetas: ['Toda reação: ataque de chicote extra de 3d6'],
        },
        {
            id: 'mobilidade-aprimorada',
            nome: 'Companheiro Inseparável: Mobilidade Aprimorada',
            nivelMin: 6,
            descricao:
                'Empunhando um chicote e havendo onde prendê-lo, seu movimento de escalada é o dobro do deslocamento normal e saltos não impõem salvaguardas (respeitando suas capacidades de salto).',
            etiquetas: ['Com chicote: escalada ×2 e saltos sem salvaguarda'],
        },
        {
            id: 'wha-pah',
            nome: 'Companheiro Inseparável: Wha-Pah',
            nivelMin: 6,
            descricao:
                'Ao acertar uma jogada de ataque (comum) com o chicote, gaste ação bônus e 2 PP para: Desarmar (mira a arma/objeto que o inimigo segura, sem dano; o objeto vai para uma mão livre sua ou cai a até 1,5 m); Restringir (condição "Impedido" em criatura Grande ou menor até que use uma ação para se libertar; ou como reação quando uma criatura que você veja se mover a até 3 m de você); Imprevisibilidade (altera a trajetória para forçar um acerto crítico).',
            etiquetas: ['Acerto de chicote + bônus + 2 PP: Desarmar, Restringir ou crítico forçado'],
        },
        // --- 7º em diante ---
        {
            id: 'ataque-extra',
            nome: 'Ataque Extra',
            nivelMin: 7,
            descricao: 'Você pode atacar duas vezes, em vez de uma, ao usar a ação "Atacar" no seu turno.',
            etiquetas: ['Ação Atacar: 2 ataques'],
            efeitos: [{ alvo: 'ataques.acao', modo: 'soma', valor: 1 }],
        },
        {
            id: 'reacao-imediata',
            nome: 'Reação Imediata',
            nivelMin: 10,
            usos: { max: 3, descanso: 'longo' },
            descricao:
                'Quando for alvo de uma jogada de ataque (comum ou Técnicas), forçado a uma Salvaguarda ou exposto a qualquer perigo, ganhe um turno especial que interrompe o turno em andamento (sem causar dano a nenhuma criatura); o turno interrompido segue depois. Até 3 usos, apenas um por encontro; recupera todos em descanso longo.',
            etiquetas: ['Turno especial (sem dano), 1 por encontro'],
        },
        {
            id: 'controle-do-ambiente',
            nome: 'Controle do Ambiente',
            nivelMin: 11,
            descricao:
                'Por falha ou sucesso, você não sofre dano de Salvaguardas de Força ou Destreza. Se a causa for uma armadilha ou desastre natural, toda criatura a até 3 metros de você também recebe o benefício.',
            etiquetas: ['Sem dano de Salvaguardas de Força ou Destreza'],
        },
        {
            id: 'domador',
            nome: 'Domador',
            nivelMin: 14,
            descricao:
                'Quando nenhuma criatura, ambiente, estrutura ou objeto for afetado pela execução de uma Técnica sua, você pode não perder PP. Se for Técnica de Combate instantânea, as criaturas alvejadas fazem Salvaguarda de Sabedoria: se falharem, recebem metade do dano que a Técnica causaria, convertido em Psíquico.',
            etiquetas: ['Técnica sem efeito: pode não gastar PP; alvos falham em SAB: ½ dano Psíquico'],
        },
        {
            id: 'aventura-frenetica',
            nome: 'Aventura Frenética',
            nivelMin: 15,
            descricao:
                'Gaste Dados de Aventura para jogadas de ataque (comum) adicionais com chicote ou pistola: cada dado concede 1 ataque adicional até o fim do turno, no máximo 2 dados por rodada com essa finalidade.',
            etiquetas: ['1 Dado de Aventura = 1 ataque extra (máx. 2 por rodada)'],
        },
        {
            id: 'mestre-aventureiro',
            nome: 'Mestre Aventureiro',
            nivelMin: 18,
            descricao:
                'Distribua livremente 6 pontos entre seus atributos, respeitando o máximo de 24 em cada um. Você pode escolher dois atributos para aplicar esses pontos até o máximo de 30.',
        },
        {
            id: 'explorador-destemido',
            nome: 'Explorador Destemido',
            nivelMin: 19,
            descricao:
                'Interrupção Relâmpago: gaste 6 Dados de Aventura para anular todos os efeitos de uma Técnica executada por uma criatura que você veja a até 9 m, no momento em que é ativada. Domínio Fatal: Técnicas com chicote ou pistola como requisito e duração instantânea causam sempre o valor máximo dos dados de dano. Arsenal do Desbravador: seus ataques (comum) com chicote causam 4d8 de dano, e você recebe um ataque (comum) adicional no Ataque Extra, exclusivamente com pistola.',
            etiquetas: [
                'Chicote: 4d8 (ajuste a arma)',
                'Ataque Extra: +1 ataque só com pistola',
                'Técnicas instantâneas de chicote/pistola: dano máximo',
            ],
        },
    ],
    tecnicas: [
        tec(
            1,
            1,
            '',
            'Whiplash',
            2,
            'poderosa',
            'Até 12 m, Cone',
            '2d6 Cortante',
            '2d6',
            'cortante',
            'Série de ataques com o chicote. Cada criatura na área faz Salvaguarda de Destreza: todo o dano se falhar, metade se passar. Quem falhar faz Salvaguarda de Constituição ou tem o deslocamento reduzido pela metade até o fim do próximo turno dela. Alternativamente, foque uma criatura com jogada de ataque (Técnicas) corpo a corpo (até 6 m, linha): 2d10 Cortante e a mesma Salvaguarda de Constituição. Requisito: chicote. Ataque combinado: possível.',
        ),
        tec(
            1,
            undefined,
            '',
            'Fire Lash',
            5,
            'bonus',
            'Pessoal',
            '+5 dados de Fogo (limitado ao grau)',
            '',
            undefined,
            'Com as chamas do ambiente ou um isqueiro, adicione 5 dados de dano de Fogo à sua próxima Técnica de Combate instantânea, limitados ao grau da Técnica (uma de 1º Grau só recebe 1 dado). Para cada dado que não puder ser adicionado, reduza o custo em PP dessa Técnica em 1. Duração: até o fim do seu turno. Requisito: ignição.',
        ),
        tec(
            3,
            2,
            '',
            'Power Pistol',
            4,
            'poderosa',
            'Até 9 m, Linha',
            '4d8 Perfurante',
            '4d8',
            'perfurante',
            'Disparo que atravessa todos os inimigos no caminho (9 m de comprimento, 1,5 m de largura). Cada criatura na área faz Salvaguarda de Destreza com desvantagem: todo o dano se falhar, metade se passar. Requisito: pistola. Ataque combinado: possível.',
        ),
        tec(
            6,
            3,
            '',
            'Sonic Boom',
            6,
            'poderosa',
            'Até 6 m de raio, Esfera',
            '6d6 Trovejante',
            '6d6',
            'trovejante',
            'Com o estalar do chicote, uma onda sonora explode em um ponto escolhido a até 21 m, num raio de 6 m. Cada criatura na área faz Salvaguarda de Destreza: todo o dano se falhar, metade se passar. Requisito: chicote. Ataque combinado: possível.',
        ),
        tec(
            6,
            undefined,
            '',
            'Prison Whip',
            6,
            'bonus',
            'Até 6 m, Linha',
            'Paralisado até 1 minuto',
            '',
            undefined,
            'Escolha uma criatura que você veja no alcance para imobilizar com o chicote. Ela faz Salvaguarda de Destreza ou fica "Paralisada" enquanto a Técnica durar; ao fim de cada turno dela, pode fazer Salvaguarda de Força para encerrar a condição. Duração: até 1 minuto, concentração.',
        ),
        tec(
            9,
            4,
            '',
            'Power Whip',
            8,
            'poderosa',
            'Até 6 m, Linha',
            '8d10 Cortante',
            '8d10',
            'cortante',
            'Chicoteada única contra um alvo, em jogada de ataque (Técnicas) corpo a corpo. A criatura Grande ou menor que falhar numa Salvaguarda de Força é empurrada até 6 m para um espaço desocupado; se bater num objeto ou estrutura com mais de 1,5 m de raio, recebe 2d8 de dano extra. Requisito: chicote. Ataque combinado: possível.',
        ),
        tec(
            12,
            5,
            '',
            'Laço de Dominação',
            10,
            'poderosa',
            'Até 6 m, Linha',
            '3d8 Contundente (e 2d8 a cada turno)',
            '3d8',
            'contundente',
            'Envolve uma criatura com o chicote. Ela faz Salvaguarda de Força ou fica "Incapacitada" enquanto a Técnica durar, repetindo a Salvaguarda de Força com desvantagem ao fim de cada turno dela. Ao aplicar, sofre 3d8 Contundente; incapacitada, sofre 2d8 no início de cada turno dela e não pode se mover para longe de você. Duração: até 1 minuto. Requisito: chicote. Ataque combinado: impossível.',
        ),
        tec(
            12,
            undefined,
            '',
            'Nebula Storm',
            10,
            'bonus',
            'Pessoal',
            'CR +2; 2 ataques extras por turno',
            '',
            undefined,
            'Mantém o chicote em movimento ao seu redor. Enquanto durar: jogadas de ataque (comum) à distância com objetos, armas e projéteis físicos são defletidas antes de acertar e não causam dano; sua CR aumenta em +2; em cada turno você recebe 2 jogadas de ataque (comum) adicionais. Duração: até 1 minuto.',
        ),
        tec(
            16,
            6,
            '',
            'Círculo da Morte',
            12,
            'poderosa',
            'Até 9 m de raio, Esfera',
            '6d6 Cortante',
            '6d6',
            'cortante',
            'Série de ataques que formam um círculo mortal. Criaturas no espaço (ou que iniciem o turno nele) fazem Salvaguarda de Constituição ou ficam "Impedidas" até o fim do próximo turno delas. A primeira vez que uma criatura entra no círculo, ou o círculo entra no espaço dela, e sempre que inicia o turno nele, ela faz Salvaguarda de Destreza: todo o dano se falhar, metade se passar. Duração: até 1 minuto, concentração. Requisito: chicote. Ataque combinado: impossível.',
        ),
        tec(
            20,
            7,
            '',
            'Pain Whip',
            14,
            'poderosa',
            'Até 6 m, Linha',
            '14d10 Cortante',
            '14d10',
            'cortante',
            'Chicoteada com toda a sua força. O alvo atingido faz Salvaguarda de Constituição ou não pode realizar mais de uma jogada de ataque (comum), usar reações e ações bônus até o fim do próximo turno dele; no próximo turno, escolhe entre se mover, realizar uma ação ou uma ação poderosa. Requisito: chicote. Ataque combinado: possível.',
        ),
    ],
};

/** Como cada Técnica do Aventureiro causa o dano: ataque (Técnicas) ou Salvaguarda da área. Sem entrada, não há teste automático (buff ou efeito de mesa). */
const TESTES_DO_AVENTUREIRO: Record<string, TesteDaTecnica> = {
    Whiplash: { tipo: 'salvaguarda', atributo: 'des', aoPassar: 'metade' },
    'Power Pistol': { tipo: 'salvaguarda', atributo: 'des', desvantagem: true, aoPassar: 'metade' },
    'Sonic Boom': { tipo: 'salvaguarda', atributo: 'des', aoPassar: 'metade' },
    'Power Whip': { tipo: 'ataque' },
    'Laço de Dominação': { tipo: 'salvaguarda', atributo: 'for', aoPassar: 'nada' },
    'Círculo da Morte': { tipo: 'salvaguarda', atributo: 'des', aoPassar: 'metade' },
    'Pain Whip': { tipo: 'ataque' },
};
for (const t of AVENTUREIRO.tecnicas) if (TESTES_DO_AVENTUREIRO[t.nome]) t.teste = TESTES_DO_AVENTUREIRO[t.nome];

/**
 * Brutamontes (kanabo e força bruta). Regra do projeto: só dano, área e PP são automáticos (Técnicas); o resto das características fica como
 * texto/etiqueta para a mesa conduzir. Exceções numéricas simples: PV máximos, Ataque Extra, deslocamento e usos por descanso.
 */
const TODOS_OS_DANOS = [
    'Contundente',
    'Cortante',
    'Perfurante',
    'Fogo',
    'Gelo',
    'Elétrico',
    'Ácido',
    'Veneno',
    'Trovejante',
    'Psíquico',
    'Verdadeiro',
];

export const BRUTAMONTES: EstiloDados = {
    id: 'brutamontes',
    nome: 'Brutamontes',
    descricao:
        'Combatente desumano que abusa da violência: seus golpes causam impactos aterrorizantes, drenam a força dos inimigos só de estarem perto e ele fica mais forte quanto mais sangue é derramado. Mestre do kanabo, é imparável no campo de batalha.',
    dado: 'd12',
    atributosPrimarios: ['for'],
    salvaguardas: ['for', 'con'],
    proficiencias: ['Kanabo/Tacape'],
    pericias: 2,
    periciasPermitidas: ['atletismo', 'intimidacao', 'provocacao', 'sobrevivencia'],
    armasFavoritas: ['Kanabo', 'Machado Grande', 'Martelo de Guerra', 'Espada Montante', 'Corporal'],
    habilidadesInatas: [
        { id: 'corpo-de-guerreiro', nome: 'Corpo de Guerreiro' },
        { id: 'superioridade-absoluta', nome: 'Superioridade Absoluta' },
    ],
    equipamento: '1 kanabo e 6d10 x 1000 Bellys.',
    equipamentoInicial: {
        itens: [{ catalogo: 'kanabo', qtd: 1 }],
        dinheiro: { dados: '6d10', multiplicador: 1000 },
    },
    niveisAva: [4, 8, 12, 16, 20],
    niveisDeTecnica: [1, 3, 6, 9, 12, 16, 20],
    tracos: [
        {
            id: 'demonio-incarnado',
            nome: 'Demônio Incarnado',
            descricao:
                'Suas jogadas de ataque (comum) com a arma favorita causam +1 de dano extra para cada criatura hostil reduzida a 0 PV que você tenha ferido no encontro (máximo igual à metade do seu nível de Brutamontes, mínimo de +1). O bônus dura até o fim do encontro. Alternativamente, se houver apenas uma criatura hostil no início ou durante o encontro, gaste 2 PP para obter imediatamente até metade do bônus máximo (arredondado para cima).',
            etiquetas: ['+1 de dano por inimigo abatido (máx. ½ nível)', '1 inimigo: 2 PP dão metade do bônus máximo'],
        },
        {
            id: 'sede-de-sangue',
            nome: 'Sede de Sangue',
            nivelMin: 2,
            descricao:
                'Você recupera 1d12 PV ao reduzir uma criatura hostil a 0 PV, logo após o cálculo do dano; se um aliado reduzir a 0 PV uma criatura que você feriu no encontro, recupera 1d6. O máximo recuperado é 5 vezes o seu nível de Brutamontes, renovado em descanso longo. Alternativamente, com apenas uma criatura hostil no encontro, gaste 1 PP em cada ataque para recuperar 1d12 PV ao acertar (comum ou Técnicas) com a arma favorita, respeitando o mesmo limite.',
            etiquetas: ['Abate: recupera 1d12 PV (aliado abate: 1d6); limite 5 × nível'],
        },
        {
            id: '8-trigramas',
            nome: '8 Trigramas',
            nivelMin: 3,
            acao: 'bonus',
            usos: { porProf: true, max: 2, descanso: 'curto' },
            descricao:
                'Com uma ação bônus, você transita entre modos de combate aleatórios por 1 minuto. No início de cada turno seu, jogue 1d8 e receba o bônus da tabela "Movimentos Caóticos" até o início do próximo turno. Usos iguais ao Bônus de Proficiência; todos voltam em descanso curto ou longo. 1 Sedutor: ao receber dano de criatura hostil, recupera 1d10 PV (2d10 no 10º). 2 Chorão: deslocamento normal 15 m e sem provocar reações (18 m e nenhuma reação, nem as que ignoram isso, no 10º). 3 Depressivo: nenhum bônus. 4 Brigão: com a ação Atacar ou ação poderosa de Técnica de Combate, um ataque (comum) corpo a corpo adicional com a arma favorita, mesmo com Ataque Extra, uma vez por rodada (dois ataques no 10º). 5 Sanguinário: ataques (comum) corpo a corpo com a arma favorita com margem de crítico 19-20 e um dado de dano adicional no dano extra do crítico (18-20 e 3 dados no 10º). 6 Risonho: vantagem em todos os ataques (comum) corpo a corpo (no 10º, uma vez por encontro, transforme uma falha com a arma favorita em acerto). 7 Ladrão: com a ação poderosa, reproduza qualquer Técnica de Combate usada a partir da 1ª rodada, por metade dos PP (mín. 1), de grau igual ou menor a uma que você tenha e com o aval do Narrador (no 10º, sem gastar PP). 8 Lúcido: escolha qualquer um dos outros movimentos.',
            etiquetas: ['Ação bônus: 1d8 por turno entre 8 modos (Sedutor, Chorão, Depressivo, Brigão, Sanguinário, Risonho, Ladrão, Lúcido)'],
        },
        {
            id: 'guerreiro-bruto',
            nome: 'Guerreiro Bruto',
            nivelMin: 5,
            descricao:
                'Ataque de Oportunidade Brutal: com a reação, ataque (comum) corpo a corpo contra criatura que você veja sair voluntariamente do seu alcance; se acertar, tente empurrá-la (Grande ou menor) até 9 m, com Salvaguarda de Força; se bater em objeto ou estrutura de mais de 1,5 m de raio, sofre 3d8 Contundente adicional. Brutalidade Excessiva: num acerto crítico corpo a corpo, todas as criaturas que vejam o ataque têm desvantagem em ataques (comum ou Técnicas) contra você até o início do seu próximo turno. Arma Brutal: ataques (comum) com a arma favorita causam 2d6. Balanço Sanguinário: ao atacar corpo a corpo com a arma favorita, troque o ataque por um giro que atinge todas as criaturas num raio de 3 m (Salvaguarda de Destreza, dano total na falha): 3d8 mais 1d8 por criatura além da primeira (máx. 6d8), sem outros efeitos de características.',
            etiquetas: [
                'Arma favorita: dano 2d6 (ajuste a arma)',
                'Balanço Sanguinário: giro 3 m, 3d8 (+1d8 por alvo, máx. 6d8)',
                'Crítico: todos que veem têm desvantagem contra você',
            ],
        },
        {
            id: 'corpo-de-criatura',
            nome: 'Corpo de Criatura',
            nivelMin: 6,
            usos: { max: 3, descanso: 'curto' },
            descricao:
                'Seus PV máximos aumentam permanentemente em 60. Ao sofrer qualquer dano, você pode usar a reação para reduzi-lo a 0. Até 3 usos; todos voltam em descanso curto ou longo.',
            efeitos: [{ alvo: 'pv.max', modo: 'soma', valor: 60 }],
            etiquetas: ['PV máx +60', 'Reação: dano sofrido vira 0 (3 usos)'],
        },
        {
            id: 'ataque-extra',
            nome: 'Ataque Extra',
            nivelMin: 7,
            descricao: 'Você pode atacar duas vezes, em vez de uma, ao usar a ação "Atacar" no seu turno.',
            etiquetas: ['Ação Atacar: 2 ataques'],
            efeitos: [{ alvo: 'ataques.acao', modo: 'soma', valor: 1 }],
        },
        {
            id: 'besta-imparavel',
            nome: '3 Caminhos da Besta: Besta Imparável',
            nivelMin: 10,
            usos: { porProf: true, max: 4, descanso: 'curto' },
            descricao:
                'No início do seu turno, seja tomado pela fúria: dobra o deslocamento e recebe 30 PV temporários até o início do próximo turno. Alternativamente, refaça uma Salvaguarda falha e use o novo resultado. Usos iguais ao Bônus de Proficiência; todos voltam em descanso curto ou longo.',
            etiquetas: ['Início do turno: deslocamento ×2 e 30 PV temporários, ou refazer uma Salvaguarda'],
        },
        {
            id: 'rugido-furioso',
            nome: '3 Caminhos da Besta: Rugido Furioso',
            nivelMin: 10,
            acao: 'bonus',
            usos: { max: 3, descanso: 'longo' },
            descricao:
                'Com uma ação bônus, emita um brado por 1 minuto: criaturas hostis a até 9 m que o ouviram causam 5 de dano a menos contra você e seus aliados, se o dano for Contundente, Cortante ou Perfurante. Até 3 usos; voltam em descanso longo.',
            etiquetas: ['Hostis a 9 m: −5 de dano Contundente/Cortante/Perfurante contra você e aliados'],
        },
        {
            id: 'aspecto-bestial',
            nome: '3 Caminhos da Besta: Aspecto Bestial',
            nivelMin: 10,
            descricao:
                'Ao reduzir uma criatura a 0 PV, o dano excedente vira dano Psíquico e atinge todas as criaturas hostis a até 6 m que vejam o ataque e falhem numa Salvaguarda de Vontade.',
            etiquetas: ['Abate: dano excedente Psíquico em hostis a 6 m (Salv. VON)'],
        },
        {
            id: 'sede-de-sangue-revigorante',
            nome: 'Sede de Sangue Revigorante',
            nivelMin: 11,
            descricao:
                'Para cada criatura hostil reduzida a 0 PV por você, recupere 1d6 PP, até 50 PP (limite restaurado em descanso longo). Alternativamente, com apenas uma criatura hostil no encontro, recupere 1 PP ao acertar (comum ou Técnicas) com a arma favorita, respeitando as limitações do uso padrão.',
            etiquetas: ['Abate: recupera 1d6 PP (máx. 50 PP por descanso longo)'],
        },
        {
            id: '6-caminhos-da-destruicao',
            nome: '6 Caminhos da Destruição',
            nivelMin: 14,
            usos: { max: 3, descanso: 'curto' },
            descricao:
                'Num acerto crítico (comum ou Técnicas), você ativa "8 Trigramas" sem gastar usos e escolhe o modo (em vez de rolar o d8), que dura toda a característica. Por modo: Sedutor: dados de recuperação de PV e PP maximizados. Chorão: críticos corpo a corpo com a arma favorita (inclusive o que ativou) impõem "Atordoado" até o fim do próximo turno da criatura. Brigão: ataques (comum ou Técnicas) corpo a corpo com a arma favorita recebem +1d8 de dano. Sanguinário: críticos corpo a corpo com a arma favorita adicionam dano extra igual ao seu nível de Brutamontes. Risonho: todos os seus ataques (comum) recebem +5 para acertar. Ladrão: a Técnica copiada passa a ser sua e, quando usada contra você, o custo dela cai 1 PP permanentemente (mín. 2 PP). Alternativamente, aplique esses aprimoramentos já sob "8 Trigramas" (exceto Depressivo): 3 usos; voltam em descanso curto ou longo.',
            etiquetas: ['Crítico: ativa 8 Trigramas de graça, modo à escolha, com aprimoramento do modo'],
        },
        {
            id: 'aposta-certa',
            nome: 'Aposta Certa',
            nivelMin: 15,
            descricao:
                'No início de cada encontro em que só você e uma criatura inimiga estejam na iniciativa, receba Pontos de Duelo (PD) iguais ao seu nível de Brutamontes, até o fim do encontro ou até outra criatura entrar na iniciativa. Escudo Arrogante (3 PD): dano de Técnica de Combate pela metade (para cima). Inabalável (3 PD): sucesso automático numa Salvaguarda. Jogo Sujo (4 PD): um aliado a até 9 m do inimigo age imediatamente, fora da ordem; se ele ficar no combate, isso termina ao fim do turno dele. Olhar do Terror (2 PD): faça uma jogada de ataque (comum) de uma criatura falhar. Peso da Batalha (2 PD): o inimigo tem o deslocamento reduzido em 6 m enquanto os PD durarem.',
            etiquetas: ['Duelo 1 × 1: Pontos de Duelo = nível (Escudo Arrogante, Inabalável, Jogo Sujo, Olhar do Terror, Peso da Batalha)'],
        },
        {
            id: 'mestre-ogro',
            nome: 'Mestre Ogro',
            nivelMin: 18,
            descricao:
                'Distribua livremente 6 pontos entre seus atributos, respeitando o máximo de 24 em cada um. Você pode escolher dois atributos para aplicar esses pontos até o máximo de 30.',
        },
        {
            id: 'invencibilidade',
            nome: 'Invencibilidade',
            nivelMin: 19,
            descricao:
                'Ataques (comum) com a arma favorita causam 4d8; você recebe um ataque (comum) adicional no Ataque Extra; tem resistência a todos os danos, inclusive Verdadeiro; é imune a qualquer condição (exceto "Enfraquecido" e "Inconsciente") e a dano de queda; em todo acerto crítico (comum ou Técnicas) pode jogar 1d12: se sair 12, a criatura tem os PV reduzidos a 0.',
            efeitos: [{ alvo: 'ataques.acao', modo: 'soma', valor: 1 }],
            resistencias: TODOS_OS_DANOS,
            etiquetas: [
                'Arma favorita: 4d8 (ajuste a arma)',
                'Ataque Extra: +1 ataque',
                'Resistência a todos os danos',
                'Crítico: 1d12, 12 reduz a 0 PV',
            ],
        },
    ],
    tecnicas: [
        tec(
            1,
            1,
            '',
            'Nari Kabura',
            2,
            'poderosa',
            'Até 9 m, Linha',
            '2d10 Contundente',
            '2d10',
            'contundente',
            'Golpe poderoso e preciso que transforma o ar, rochas ou destroços em projétil contra uma criatura, em jogada de ataque (Técnicas) à distância com margem de crítico 19-20. <Kongo Kabura> No 6º nível, pode ser usada como Técnica de 3º Grau: 5d10 Contundente, 21 m em Linha, 6 PP e margem de crítico 18-20. Requisito: arma favorita. Ataque combinado: possível.',
        ),
        tec(
            1,
            undefined,
            '',
            'Shinsoku Hakujaku',
            2,
            'bonus',
            'Pessoal',
            'Deslocamento +6 m e não pode ser reduzido',
            '',
            undefined,
            'Você se move rapidamente, com passos firmes: o deslocamento normal aumenta em 6 m e não pode ser reduzido. Duração: até o fim do seu turno.',
        ),
        tec(
            3,
            2,
            '',
            'Kosanze Ragnaraku',
            4,
            'poderosa',
            'Toque',
            '4d10 Contundente ou Perfurante',
            '4d10',
            'contundente',
            'Salta sobre uma criatura e desce um golpe brutal: se ela falhar numa Salvaguarda de Força, fica "Caída". Alternativamente, golpeie o chão e libere uma onda de choque num cone de 15 m: cada criatura faz Salvaguarda de Destreza, sofrendo 4d6 Trovejante se falhar ou metade se passar; quem falhar faz outra Salvaguarda de Destreza ou fica "Caída". Requisito: arma favorita. Ataque combinado: impossível.',
        ),
        tec(
            6,
            3,
            '',
            'Mahoroba',
            6,
            'poderosa',
            'Toque',
            '5d10 Contundente ou Perfurante',
            '5d10',
            'contundente',
            'Golpe de grande força contra uma criatura, em jogada de ataque (Técnicas) corpo a corpo. Se ela (Grande ou menor) falhar numa Salvaguarda de Força, é empurrada até 6 m para um espaço desocupado; se bater em objeto ou estrutura de mais de 1,5 m de raio, recebe 2d8 de dano extra. Requisito: arma favorita. Ataque combinado: possível.',
        ),
        tec(
            6,
            undefined,
            '',
            'Yamantaka',
            4,
            'reacao',
            'Pessoal',
            'Reserva de redução de dano de 10d8 (até 20d8)',
            '',
            undefined,
            'Ao ser alvo de jogada de ataque (comum ou Técnicas), ou de Salvaguarda de Força ou Destreza, use a fúria para criar uma reserva de redução de dano igual a 10d8. Sempre que sofrer dano, reduza-o usando a reserva, que perde o que evitou. Gaste 1 PP para somar 2d8 à reserva, até 20d8. Duração: até o fim do seu próximo turno.',
        ),
        tec(
            9,
            4,
            '',
            'Raimei Hakke',
            8,
            'poderosa',
            'Toque',
            '8d10 Contundente ou Perfurante',
            '8d10',
            'contundente',
            'Golpe extremamente feroz contra uma criatura, em jogada de ataque (Técnicas) corpo a corpo. Se for acerto crítico, ao determinar o dano extra da Técnica, adicione mais 4 dados de dano. Requisito: arma favorita. Ataque combinado: possível.',
        ),
        tec(
            12,
            5,
            '',
            'Gundari Ryuseigun',
            10,
            'poderosa',
            'Toque',
            '10d10 Contundente ou Perfurante',
            '10d10',
            'contundente',
            'Série de ataques rápidos contra uma criatura, em jogada de ataque (Técnicas) corpo a corpo. Ao ser acertado, o alvo faz Salvaguarda de Constituição ou não pode realizar reações até o fim do próximo turno dele; no próximo turno dele, ele escolhe entre se mover, realizar uma ação ou realizar uma ação bônus (só uma das três). Requisito: arma favorita. Ataque combinado: possível.',
        ),
        tec(
            12,
            undefined,
            '',
            'Oni no Youna',
            10,
            'bonus',
            'Pessoal',
            'Todos os modos de 8 Trigramas e 6 Caminhos da Destruição',
            '',
            undefined,
            'Transe de fúria que só a violência sacia: você recebe ao mesmo tempo os bônus dos "Movimentos Caóticos" (exceto Depressivo, Ladrão e Lúcido) e todos os aprimoramentos de "6 Caminhos da Destruição"; fica incapaz de usar Técnicas; ataca aliados e inimigos indiscriminadamente, priorizando os mais próximos (à escolha do Narrador); a Técnica termina se você não fizer jogada de ataque (comum) nem for atacado até o fim do seu turno. Duração: até 1 minuto.',
        ),
        tec(
            16,
            6,
            '',
            'Horai Hakke',
            12,
            'poderosa',
            'Toque',
            '9d10 Contundente ou Perfurante',
            '9d10',
            'contundente',
            'Golpe extremamente feroz contra uma criatura, em jogada de ataque (Técnicas) corpo a corpo, com impacto que pode desligar a consciência do alvo: ele faz Salvaguarda de Constituição ou fica "Atordoado" até o fim do próximo turno dele. Requisito: arma favorita. Ataque combinado: impossível.',
        ),
        tec(
            20,
            7,
            '',
            'Hakai',
            14,
            'poderosa',
            'Até 30 m, Cone',
            '14d6 Contundente',
            '14d6',
            'contundente',
            'Com o balançar do ataque, lance uma onda de destruição contra todos os seus inimigos. Cada criatura na área faz Salvaguarda de Destreza: todo o dano se falhar, metade se passar. A área vira terreno difícil e o dano em estruturas é dobrado. Requisito: arma favorita. Ataque combinado: possível.',
        ),
    ],
};

/** Como cada Técnica do Brutamontes causa o dano: ataque (Técnicas) ou Salvaguarda da área. Sem entrada, não há teste automático. */
const TESTES_DO_BRUTAMONTES: Record<string, TesteDaTecnica> = {
    'Nari Kabura': { tipo: 'ataque' },
    'Kosanze Ragnaraku': { tipo: 'ataque' },
    Mahoroba: { tipo: 'ataque' },
    'Raimei Hakke': { tipo: 'ataque' },
    'Gundari Ryuseigun': { tipo: 'ataque' },
    'Horai Hakke': { tipo: 'ataque' },
    Hakai: { tipo: 'salvaguarda', atributo: 'des', aoPassar: 'metade' },
};
for (const t of BRUTAMONTES.tecnicas) if (TESTES_DO_BRUTAMONTES[t.nome]) t.teste = TESTES_DO_BRUTAMONTES[t.nome];

export const ESTILOS: EstiloDados[] = [ATIRADOR, AVENTUREIRO, BRUTAMONTES];
export const estiloPorId = (id: string | undefined | null): EstiloDados | undefined => ESTILOS.find((e) => e.id === id);

/** O atributo primário do personagem: o escolhido, ou o único possível. */
export const atributoPrimarioDe = (estilo: EstiloDados, escolhido: string | null | undefined): AtributoId | null =>
    estilo.atributosPrimarios.length === 1 ? estilo.atributosPrimarios[0] : (estilo.atributosPrimarios.find((a) => a === escolhido) ?? null);

/** As características do estilo para o caminho escolhido (o outro caminho vale a partir de `herdaTudoEm`). */
export function tracosDoEstiloEscolhido(estilo: EstiloDados, caminho: string | null | undefined): TracoDados[] {
    return estilo.tracos.flatMap((t) => {
        if (!t.caminho || t.caminho === caminho) return [t];
        if (!estilo.herdaTudoEm) return [];

        return [{ ...t, nivelMin: Math.max(t.nivelMin ?? 1, estilo.herdaTudoEm) }];
    });
}

/** Os traços do estilo que o personagem já tem neste nível (os de nível maior entram ao subir de nível). */
export function tracosDoEstiloNoNivel(estilo: EstiloDados, caminho: string | null | undefined, nivel: number): TracoDados[] {
    return tracosDoEstiloEscolhido(estilo, caminho).filter((t) => (t.nivelMin ?? 1) <= nivel);
}

/** As técnicas do estilo que o personagem já tem neste nível (as do outro caminho só depois de `herdaTudoEm`). */
export function tecnicasDoEstiloNoNivel(
    estilo: EstiloDados,
    caminho: string | null | undefined,
    nivel: number,
): (TecnicaDoEstilo & { origem: string })[] {
    return estilo.tecnicas
        .filter((t) => nivel >= t.nivel && (!t.caminho || t.caminho === caminho || (estilo.herdaTudoEm !== undefined && nivel >= estilo.herdaTudoEm)))
        .map((t) => ({
            ...t,
            origem: `${estilo.nome}${t.caminho ? ` (${estilo.caminhos?.find((c) => c.id === t.caminho)?.nome.replace('Caminho do ', '') ?? ''})` : ''}: ${t.grau ? `${t.grau}º Grau` : 'Auxiliar'}`,
        }));
}

/** A técnica do estilo como a ficha a guarda (marcada `builder: 'estilo'` para o assistente poder refazê-la). */
export function tecnicaDoEstilo(t: TecnicaDoEstilo & { origem: string }): Tecnica {
    return {
        nome: t.nome,
        origem: t.origem,
        custo: t.custo,
        alcance: t.alcance,
        efeito: t.efeito,
        descricao: t.descricao,
        rolagem: t.rolagem,
        ...(t.tipoDano ? { tipoDano: t.tipoDano } : {}),
        ...(t.acao ? { acao: t.acao } : {}),
        ...(t.reacao ? { reacao: t.reacao } : {}),
        ...(t.teste ? { teste: t.teste } : {}),
        ...(t.duracao ? { duracao: t.duracao } : {}),
        builder: 'estilo',
    };
}

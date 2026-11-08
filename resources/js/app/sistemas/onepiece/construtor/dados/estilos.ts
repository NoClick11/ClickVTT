/**
 * Estilos de Combate (a "classe" do One Piece). Cada estilo é só dados: o assistente lê este catálogo e a ficha sai pronta.
 * Arquivo PURO (sem Vue): o Node o executa direto nos testes. Estilo novo = item novo em `ESTILOS`, sem mudar a lógica.
 *
 * O que o motor de efeitos modela entra em `efeitos`/`usos`/`acao`; o resto vira descrição + `etiquetas` (o resumo curto
 * que aparece na ficha). Características com `nivelMin` só valem a partir do nível indicado.
 */
import type { AjusteDeArma, AtributoId, BonusDeDano, CategoriaDeAcao, DuracaoDaTecnica, Tecnica, TesteDaTecnica } from '../../regras.ts';
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
export type TracoDoEstilo = TracoDados & {
    caminho?: string;
    /** O traço só vale se o personagem escolheu esta opção da `escolhaDeTracos` do estilo (Escolha Diabólica). */
    escolha?: string;
};

/** Uma escolha entre traços feita ao subir de nível (Usuário Ínsito: a Escolha Diabólica no 2º nível e mais uma no 11º). */
export interface EscolhaDeTracos {
    nome: string;
    /** Os níveis em que se escolhe (uma opção por vez, sem repetir). */
    niveis: number[];
    opcoes: { id: string; nome: string; descricao: string }[];
}

export interface CaminhoDoEstilo {
    id: string;
    nome: string;
    descricao: string;
    /** O dado de vida deste caminho, se mudar o do estilo (Herói: Guerreiro do Poder Oculto d12, Deus da Arma d10). */
    dado?: DadoDeVida;
    /** As armas favoritas permitidas neste caminho (sem isto valem as do estilo). */
    armasFavoritas?: string[];
}

/** Um item do catálogo do Cap. 8 (id) e quantas unidades. */
export interface ItemInicial {
    catalogo: string;
    qtd: number;
    /** Ajustes da arma só nesta ficha (a espada do Deus da Arma: 2d8, +2/+2): vão para o inventário já aplicados. */
    arma?: AjusteDeArma;
}

/**
 * O equipamento inicial do estilo: entra no inventário ao concluir a criação. `porArma` depende da arma favorita escolhida ("2 pistolas ou
 * 1 mosquete"); `itens` valem sempre; `dinheiro` é fixo (`valor`) ou rolado (`dados` × `multiplicador`, rolado no servidor por um botão).
 */
export interface EquipamentoInicial {
    porArma?: Record<string, ItemInicial[]>;
    itens: ItemInicial[];
    dinheiro?: { valor: number } | { dados: string; multiplicador: number; fixo?: number };
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
    escolhaDeTracos?: EscolhaDeTracos;
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
        // Death Blossom aprimorada: no 6º nível entra como Técnica de 3º Grau
        tec(
            6,
            3,
            CAMINHO_DUELISTA,
            'Gun Powder Party',
            5,
            'poderosa',
            'Arma, Esfera',
            '6d6 Contundente ou Perfurante',
            '6d6',
            'perfurante',
            'Death Blossom aprimorada (3º Grau): disparos contra as criaturas ao redor, escolhendo quais estão no alcance. Cada criatura na área faz Salvaguarda de Destreza com desvantagem: todo o dano se falhar, metade se passar. Requisito: arma favorita, 8 munições (qualquer). Ataque combinado: impossível.',
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
    'Gun Powder Party': { tipo: 'salvaguarda', atributo: 'des', desvantagem: true, aoPassar: 'metade' },
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
            tipo: 'ativa',
            acao: 'poderosa',
            usos: { max: 1, descanso: 'longo' },
            descricao:
                'Com a ação poderosa, faça um disparo com arma de fogo: a jogada de ataque (comum) à distância recebe 1 dado de dano adicional (munição) por rodada em que você participou do encontro, limitado a 2 vezes o seu nível de Aventureiro (máximo 30 dados). Ligue antes de disparar e desligue depois.',
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
            { armarBonus: { dados: 5, tipo: 'Fogo', limitarAoGrau: true, reduzCusto: true, instantanea: true } },
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
            // Reação defensiva automática: oferecida quando é atacado; o uso só é gasto quando o dano é de fato zerado
            reacao: { gatilho: 'ataque_declarado', alcance: 'si', reducao: { zerar: true } },
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
        // Nari Kabura aprimorada: no 6º nível entra como Técnica de 3º Grau
        tec(
            6,
            3,
            '',
            'Kongo Kabura',
            6,
            'poderosa',
            'Até 21 m, Linha',
            '5d10 Contundente',
            '5d10',
            'contundente',
            'Nari Kabura aprimorada (3º Grau): o golpe poderoso e preciso transforma o ar, rochas ou destroços em projétil contra uma criatura, em jogada de ataque (Técnicas) à distância com margem de crítico 18-20. Requisito: arma favorita. Ataque combinado: possível.',
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
            { reacao: { gatilho: 'ataque_declarado', alcance: 'si', reducao: { reserva: '10d8', mais: '2d8', maximo: 20 } } },
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
    'Kongo Kabura': { tipo: 'ataque' },
    'Kosanze Ragnaraku': { tipo: 'ataque' },
    Mahoroba: { tipo: 'ataque' },
    'Raimei Hakke': { tipo: 'ataque' },
    'Gundari Ryuseigun': { tipo: 'ataque' },
    'Horai Hakke': { tipo: 'ataque' },
    Hakai: { tipo: 'salvaguarda', atributo: 'des', aoPassar: 'metade' },
};
for (const t of BRUTAMONTES.tecnicas) if (TESTES_DO_BRUTAMONTES[t.nome]) t.teste = TESTES_DO_BRUTAMONTES[t.nome];

/**
 * Black Leg (chutes e chamas). Regra do projeto: só dano, área e PP são automáticos (Técnicas) e a reação defensiva Parry Shot; o resto das
 * características fica como texto/etiqueta para a mesa conduzir. Numéricos simples: deslocamento por nível, Ataque Extra e usos por descanso.
 */
export const BLACK_LEG: EstiloDados = {
    id: 'black-leg',
    nome: 'Black Leg',
    descricao:
        'Mescla os movimentos de perna mais poderosos das artes marciais, fortalecendo os membros inferiores e ganhando velocidade, elasticidade e força descomunal. Os maiores mestres são mais rápidos que a visão humana, correm no próprio céu e criam chamas a partir do atrito com o ar. As mãos ficam de fora: são reservadas à vocação.',
    dado: 'd12',
    atributosPrimarios: ['for', 'des'],
    salvaguardas: ['for', 'des'],
    proficiencias: [],
    pericias: 2,
    periciasPermitidas: ['atletismo', 'acrobacia', 'intuicao', 'percepcao', 'prestidigitacao'],
    armasFavoritas: ['Corporal'],
    habilidadesInatas: [
        { id: 'corpo-de-guerreiro', nome: 'Corpo de Guerreiro' },
        { id: 'perito-em-tecnicas', nome: 'Perito em Técnicas' },
    ],
    equipamento: 'Uma roupa de gala, 90.000 Bellys e 15d10 x 1000 Bellys.',
    equipamentoInicial: {
        itens: [{ catalogo: 'roupa-de-gala', qtd: 1 }],
        dinheiro: { dados: '15d10', multiplicador: 1000, fixo: 90000 },
    },
    niveisAva: [4, 8, 12, 16, 20],
    niveisDeTecnica: [1, 3, 6, 9, 12, 16, 20],
    tracos: [
        {
            id: 'pacto-sagrado',
            nome: 'Pernas Fortes e Mãos Gentis: Pacto Sagrado',
            descricao:
                'Escolha uma vocação, realizada com as próprias mãos (ex.: tocar piano), e jure nunca usá-las em combate nem colocá-las em risco. Criaturas não hostis que experimentarem sua vocação fazem Salvaguarda de Vontade ou ficam "Enfeitiçadas" por até 1 hora (ou até você ou seus companheiros agirem de forma nociva contra elas); você recebe +10 em Testes de Presença (Atuação e Persuasão) contra elas. Quem foi enfeitiçado nas últimas 24 horas sofre −5 nas jogadas de ataque (comum) contra você durante o 1º minuto do encontro. Se usar as mãos em jogada de ataque (comum ou Técnicas) ou as colocar conscientemente em perigo (com aviso do Narrador), perde esses benefícios para sempre. Alternativamente, em vez do Pacto Sagrado, seus ataques (comum) corpo a corpo desarmados recebem os benefícios de uma arma marcial, com qualquer expertise sua (refazível a cada novo nível).',
            etiquetas: [
                'Vocação com as mãos: Enfeitiçado (Salv. VON) e +10 em Atuação/Persuasão',
                'Ou: ataques desarmados como arma marcial (com expertise)',
            ],
        },
        {
            id: 'kicker',
            nome: 'Pernas Fortes e Mãos Gentis: Kicker',
            descricao:
                'Sem gastar ação, ação poderosa, reação ou ação bônus, você destrói construções e objetos até 6 m: 1º nível, tamanho Pequeno ou menor; 6º, Médio (1 PP); 11º, Grande e Enorme (2 PP, 1 Nível de Exaustão e 30 segundos de preparo); 16º, Imenso ou maior (3 PP, 2 Níveis de Exaustão e 1 minuto). Além disso, suas jogadas de ataque (comum) em cada turno recebem +1 no acerto e no dano para cada 4,5 m percorridos no turno.',
            etiquetas: ['Destrói objetos a 6 m (tamanho cresce com o nível)', '+1 acerto e dano a cada 4,5 m percorridos no turno'],
        },
        {
            id: 'hard-walk',
            nome: 'Godspeed: Hard Walk',
            nivelMin: 2,
            descricao:
                'Seu deslocamento não pode ser reduzido por terreno difícil e não provoca reações de nenhuma criatura, mesmo as que ignoram isso, como "Ataque de Oportunidade Superior".',
            etiquetas: ['Terreno difícil não reduz o deslocamento', 'Deslocamento não provoca reações'],
        },
        {
            id: 'speed-walk-12',
            nome: 'Godspeed: Speed Walk (12 m)',
            nivelMin: 3,
            nivelMax: 4,
            descricao: 'A partir do 3º nível de Black Leg, seu deslocamento normal aumenta para 12 metros.',
            efeitos: [{ alvo: 'movimento.normal', modo: 'min', valor: 120 }],
        },
        {
            id: 'speed-walk-12-nado',
            nome: 'Godspeed: Speed Walk (12 m) e Blue Walk',
            nivelMin: 5,
            nivelMax: 7,
            descricao:
                'Deslocamento normal de 12 metros. Blue Walk (a partir do 5º nível): você não recebe desvantagens por não ser uma criatura aquática (Capítulo 12) e, submerso, seu deslocamento de natação é igual ao normal.',
            efeitos: [
                { alvo: 'movimento.normal', modo: 'min', valor: 120 },
                { alvo: 'movimento.nado', modo: 'min', valor: 120 },
            ],
        },
        {
            id: 'speed-walk-15',
            nome: 'Godspeed: Speed Walk (15 m) e Blue Walk',
            nivelMin: 8,
            nivelMax: 11,
            descricao: 'Deslocamento normal de 15 metros (no 8º nível de Black Leg), e de natação igual ao normal (Blue Walk).',
            efeitos: [
                { alvo: 'movimento.normal', modo: 'min', valor: 150 },
                { alvo: 'movimento.nado', modo: 'min', valor: 150 },
            ],
        },
        {
            id: 'speed-walk-18',
            nome: 'Godspeed: Speed Walk (18 m) e Blue Walk',
            nivelMin: 12,
            descricao: 'Deslocamento normal de 18 metros (no 12º nível de Black Leg), e de natação igual ao normal (Blue Walk).',
            efeitos: [
                { alvo: 'movimento.normal', modo: 'min', valor: 180 },
                { alvo: 'movimento.nado', modo: 'min', valor: 180 },
            ],
        },
        {
            id: 'burst-walk',
            nome: 'Godspeed: Burst Walk',
            nivelMin: 4,
            descricao: 'Você pode usar uma ação bônus em cada turno seu em combate para executar uma "Disparada".',
            etiquetas: ['Ação bônus: Disparada (1 por turno)'],
        },
        {
            id: 'sky-walk',
            nome: 'Godspeed: Sky Walk',
            nivelMin: 7,
            descricao: 'Você tem acesso à técnica auxiliar "Geppo" do Estilo de Combate "Usuário de Rokushiki".',
            etiquetas: ['Técnica auxiliar Geppo (Rokushiki)'],
        },
        {
            id: 'stealth-walk',
            nome: 'Godspeed: Stealth Walk',
            nivelMin: 10,
            descricao:
                'Você pode sacrificar 9 metros de deslocamento para ficar invisível até o início do seu próximo turno, ou até fazer jogada de ataque (comum ou Técnicas), causar qualquer efeito ou dano a uma criatura.',
            etiquetas: ['−9 m de deslocamento: invisível até o próximo turno ou até agir contra alguém'],
        },
        {
            id: 'diable-jambe',
            nome: 'Diable Jambe',
            nivelMin: 3,
            tipo: 'ativa',
            interruptor: true,
            // 19º (Hell Memories): sem limite de usos
            usos: { max: 3, formula: '3+97*max(0,min(1,@nivel-18))', descanso: 'longo' },
            bonusDano: [
                { alvo: 'desarmado', dados: '1d4', tipo: 'Fogo', nivelMax: 6, grupo: 'diable-desarmado', prioridade: 1 },
                { alvo: 'desarmado', dados: '1d6', tipo: 'Fogo', nivelMin: 7, nivelMax: 10, grupo: 'diable-desarmado', prioridade: 1 },
                { alvo: 'desarmado', dados: '1d8', tipo: 'Fogo', nivelMin: 11, grupo: 'diable-desarmado', prioridade: 1 },
                // Ifrit Jambe (ligado): o extra vira 1d12 e todo ataque desarmado soma +5 de Fogo
                { alvo: 'desarmado', dados: '1d12', tipo: 'Fogo', nivelMin: 15, requer: ['Ifrit Jambe'], grupo: 'diable-desarmado', prioridade: 2 },
                { alvo: 'desarmado', fixo: 5, tipo: 'Fogo', nivelMin: 15, requer: ['Ifrit Jambe'] },
                // Técnicas: dados de Fogo iguais à metade do grau (mín. 1); com Hell Memories, ao grau inteiro
                { alvo: 'tecnica', porGrau: 0.5, tipo: 'Fogo', grupo: 'diable-tecnica', prioridade: 1 },
                { alvo: 'tecnica', porGrau: 1, tipo: 'Fogo', nivelMin: 19, grupo: 'diable-tecnica', prioridade: 2 },
            ],
            descricao:
                'O atrito dos chutes cria labaredas nas pernas por até 1 minuto: resistência a dano de Fogo; ataques (comum) corpo a corpo desarmados com 1d4 de dano de Fogo extra (1d6 no 7º nível, 1d8 no 11º); ao executar uma Técnica, aumenta uma quantidade de dados de dano de Fogo igual à metade do grau (mín. 1 dado); ao acertar duas jogadas de ataque (comum) consecutivas nos seus turnos (só a primeira rolagem de cada ataque, sem repetições nem acertos automáticos), você ganha uma ação bônus ou reação adicional até o início do próximo turno — a sequência segue de turno a turno enquanto durar, uma vez por turno. Até 3 usos; voltam em descanso longo.',
            etiquetas: [
                'Resistência a Fogo',
                'Desarmado: +1d4 Fogo (1d6 no 7º, 1d8 no 11º)',
                'Técnicas: +½ grau em dados de Fogo',
                '2 acertos seguidos: ação bônus ou reação extra',
            ],
        },
        {
            id: 'way-of-the-kick',
            nome: 'Way of the Kick',
            nivelMin: 5,
            descricao:
                'Uma vez no seu turno, com uma ação bônus, você faz jogadas de ataque (comum) desarmadas adicionais, uma para cada 5 níveis de Black Leg (no 10º nível, até 2). No 11º nível (Overdrive) ela é ativada com a primeira jogada de ataque (comum) feita, em vez da ação bônus, e aumenta em 2 as jogadas adicionais.',
            etiquetas: ['Ação bônus (1 por turno): 1 ataque desarmado extra a cada 5 níveis'],
        },
        {
            id: 'shoot',
            nome: 'Shoot',
            nivelMin: 6,
            descricao:
                'Quem for atingido por um ou mais ataques corpo a corpo desarmados seus escolhe, no início do próprio turno seguinte, ficar impedido de: deslocamento, ação, ação bônus ou reação (se ainda disponível); o impedimento dura até o início do turno seguinte dela. Além disso, se o d20 de um ataque (comum) corpo a corpo desarmado bem-sucedido for 16 ou mais, a criatura faz Salvaguarda de Constituição ou recebe a condição do "Kick Festival" até o fim do próximo turno dela: 16 Letárgico (barriga), 17 Caído (perna), 18 Impedido (nuca), 19 Cego (olhos), 20 Atordoado (cabeça). Se já a acertou no turno, pode somar ou subtrair o resultado pelo número de ataques, ou trocar uma dessas variações por desvantagem na Salvaguarda. Parage Shoot: sequência de chutes no rosto de uma criatura voluntária: 1d4 de dano por nível (ou ND) dela e aparência nova irreconhecível, com um defeito adicional do Capítulo 5 à escolha do Narrador; num crítico natural contra humanoide inimigo, você pode alterar as feições em vez da tabela.',
            etiquetas: [
                'Atingido: escolhe perder deslocamento, ação, bônus ou reação',
                'd20 16+ no desarmado: Kick Festival (Letárgico, Caído, Impedido, Cego, Atordoado; Salv. CON)',
            ],
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
            id: 'enfer-de-flammes',
            nome: 'Enfer de Flammes',
            nivelMin: 10,
            usos: { max: 1, formula: '1+2*min(1,max(0,floor((@nivel-10)/5)))', descanso: 'longo' },
            descricao:
                'Escolha uma esfera de até 4,5 m de raio, centrada num ponto a até 9 m de você. Por 1 minuto, você se move em alta velocidade por toda essa área. Sempre que uma criatura na área iniciar uma ação, antes de concluí-la, você pode fazer uma jogada de ataque (comum) contra ela; quem for atingido faz Salvaguarda de Constituição e, se falhar, o turno termina logo após o dano. Enquanto ativa, você não faz turnos normais e não pode ser alvo de ataques nem sofrer efeitos; pode encerrá-la a qualquer momento, sem ação, escolhendo um espaço desocupado na área. Um uso até descanso longo; no 15º nível, até 3 usos (um por encontro).',
            etiquetas: ['Esfera de 4,5 m por 1 minuto: ataque ao iniciarem ação; você fica intocável'],
        },
        {
            id: 'spectre',
            nome: 'Spectre',
            nivelMin: 14,
            descricao:
                'Ao fazer uma jogada de ataque (comum) corpo a corpo desarmado, escolha um efeito: compare a mesma jogada com a CR de cada criatura a até 1,5 m de você (cada atingida sofre só o dano base do desarmado, sem modificadores, efeitos nem dados adicionais, nem de crítico); empurre a criatura até 3 m, para um espaço desocupado; ou aumente em 1,5 m o alcance do ataque.',
            etiquetas: ['Desarmado: ataca todos a 1,5 m (dano base), empurra 3 m ou +1,5 m de alcance'],
        },
        {
            id: 'ifrit-jambe',
            nome: 'Ifrit Jambe',
            nivelMin: 15,
            tipo: 'ativa',
            interruptor: true,
            usos: { max: 1, formula: '1+2*max(0,min(1,@nivel-18))', descanso: 'longo' },
            descricao:
                'As chamas ficam azuladas. Ao usar o "Diable Jambe": ataques (comum) corpo a corpo desarmados causam +5 de dano de Fogo; o dano de Fogo extra do Diable Jambe vira 1d12; com uma ação bônus, ao atacar desarmado, faça a jogada com vantagem ou imponha "Queimado" se a criatura falhar numa Salvaguarda de Constituição. O dano das características de Black Leg ignora resistência a Fogo. Um uso até descanso longo (3 usos no 19º nível).',
            etiquetas: ['Com Diable Jambe: +5 Fogo, extra 1d12, vantagem ou Queimado; ignora resistência a Fogo'],
        },
        {
            id: 'mestre-black-leg',
            nome: 'Mestre Black Leg',
            nivelMin: 18,
            descricao:
                'Distribua livremente 6 pontos entre seus atributos, respeitando o máximo de 24 em cada um. Você pode escolher dois atributos para aplicar esses pontos até o máximo de 30.',
        },
        {
            id: 'hell-memories',
            nome: 'Hell Memories',
            nivelMin: 19,
            descricao:
                'Você envolve o corpo em chamas sempre que quiser: o "Diable Jambe" perde os limites de uso (e pode ser escolhido em cada jogada de ataque isoladamente); o "Ifrit Jambe" passa a até 3 usos; todo dano de Fogo que você causa impõe "Queimado"; o dano das características de Black Leg ignora invulnerabilidade a Fogo e, contra quem não tem resistência nem invulnerabilidade a Fogo, conta como vulnerabilidade; as Técnicas de Black Leg ganham dados de Fogo extras iguais ao grau (em vez da metade).',
            etiquetas: ['Diable Jambe sem limite de uso', 'Dano de Fogo: Queimado e vulnerabilidade', 'Técnicas: +grau em dados de Fogo'],
        },
    ],
    tecnicas: [
        tec(
            1,
            1,
            '',
            'Kick Shot',
            2,
            'poderosa',
            'Toque',
            '2d10 Contundente',
            '2d10',
            'contundente',
            'Chute rápido contra uma criatura, em jogada de ataque (Técnicas) corpo a corpo desarmado. A criatura atingida faz Salvaguarda de Constituição ou recebe desvantagem na próxima jogada de ataque (comum ou Técnicas). <Kick Strike> No 6º nível, pode ser usada como Técnica de 3º Grau: 6d10 Contundente e 5 PP. Ataque combinado: possível.',
        ),
        // Kick Shot aprimorada: no 6º nível entra como Técnica de 3º Grau
        tec(
            6,
            3,
            '',
            'Kick Strike',
            5,
            'poderosa',
            'Toque',
            '6d10 Contundente',
            '6d10',
            'contundente',
            'Kick Shot aprimorada (3º Grau): chute rápido contra uma criatura, em jogada de ataque (Técnicas) corpo a corpo desarmado. A criatura atingida faz Salvaguarda de Constituição ou recebe desvantagem na próxima jogada de ataque (comum ou Técnicas). Ataque combinado: possível.',
        ),
        tec(
            1,
            undefined,
            '',
            'Anti-Manner Kick Course',
            2,
            'bonus',
            'Toque',
            'Empurra até 9 m; 3d8 Contundente ao bater',
            '',
            undefined,
            'Ao fazer jogada de ataque (comum ou Técnicas) corpo a corpo desarmado, aumente o impacto: a criatura (Grande ou menor) é empurrada até 9 m para um espaço desocupado se falhar numa Salvaguarda de Força; se bater em objeto ou estrutura de mais de 1,5 m de raio, recebe 3d8 de dano Contundente.',
        ),
        tec(
            3,
            2,
            '',
            'Party Table Kick Course',
            3,
            'poderosa',
            'Até 1,5 m, Esfera',
            '4d8 Contundente',
            '4d8',
            'contundente',
            'Com as mãos no chão, gire o corpo e chute todos os inimigos ao redor. Cada criatura na área faz Salvaguarda de Destreza: todo o dano se falhar, metade se passar. Ataque combinado: impossível.',
        ),
        tec(
            6,
            3,
            '',
            'Frites Assorties',
            5,
            'poderosa',
            'Até 18 m, Cone',
            '6d6 Contundente',
            '6d6',
            'contundente',
            'Três chutes rápidos provocam uma forte rajada de vento contra seus inimigos. Cada criatura na área faz Salvaguarda de Destreza: todo o dano se falhar, metade se passar. Ataque combinado: possível.',
        ),
        tec(
            6,
            undefined,
            '',
            'Parry Shot',
            3,
            'reacao',
            'Pessoal',
            'Reduz 8d8 do dano (até 20d8)',
            '',
            undefined,
            'Ao receber jogada de ataque (comum ou Técnicas) ou ter de fazer Salvaguarda de Força ou Destreza, use força e reflexo para proteger o corpo e reduzir 8d8 do dano. Se isso reduzir a 0 o dano que sofreria, você pode fazer imediatamente uma jogada de ataque (comum) corpo a corpo desarmado contra a criatura responsável, se estiver ao seu alcance. Gaste 1 PP para somar 2d8 à redução, até 20d8.',
            { reacao: { gatilho: 'ataque_declarado', alcance: 'si', reducao: { reserva: '8d8', mais: '2d8', maximo: 20, unica: true } } },
        ),
        tec(
            9,
            4,
            '',
            'Concassé',
            8,
            'poderosa',
            'Toque',
            '4d10 Contundente',
            '4d10',
            'contundente',
            'Salte e gire no ar várias vezes para um chute implacável, em jogada de ataque (Técnicas) corpo a corpo desarmado contra uma criatura. Ela faz Salvaguarda de Constituição ou fica "Atordoada" até o fim do próximo turno dela. Ataque combinado: impossível.',
        ),
        tec(
            12,
            5,
            '',
            'Extra Hachis',
            8,
            'poderosa',
            'Toque',
            '10d8 Contundente',
            '10d8',
            'contundente',
            'Série de chutes intermináveis, em jogada de ataque (Técnicas) corpo a corpo desarmado, contra uma criatura, que faz Salvaguarda de Destreza: todo o dano se falhar, metade se passar. Ataque combinado: possível.',
        ),
        tec(
            12,
            undefined,
            '',
            'Strike',
            4,
            'bonus',
            'Pessoal',
            '+5 dados de dano',
            '',
            undefined,
            'Ao executar uma Técnica com tipo de dano "Contundente", intensifique a força do golpe e aumente o poder em 5 dados de dano.',
            { armarBonus: { dados: 5, soTipo: 'contundente' } },
        ),
        tec(
            16,
            6,
            '',
            'Ondo Rare Strike',
            9,
            'poderosa',
            'Até 27 m, Cone',
            '12d6 Contundente',
            '12d6',
            'contundente',
            'Desapareça ao se mover em alta velocidade, golpeando todos os inimigos à frente. Ao término, escolha um espaço desocupado dentro da área para ficar. Cada criatura na área faz Salvaguarda de Destreza: todo o dano se falhar, metade se passar. Ataque combinado: possível.',
        ),
        tec(
            20,
            7,
            '',
            'Beef Burst',
            14,
            'poderosa',
            'Toque',
            '14d10 Contundente',
            '14d10',
            'contundente',
            'Jogada de ataque (Técnicas) corpo a corpo desarmado obliteradora contra uma criatura. Ao acertar, verifique os PV dela antes do dano: se tiver 150 PV ou menos, ela também é arremessada por quilômetros ao céu, fora da vista. Ataque combinado: impossível.',
        ),
    ],
};

/** Como cada Técnica do Black Leg causa o dano: ataque (Técnicas) ou Salvaguarda da área. Sem entrada, não há teste automático. */
const TESTES_DO_BLACK_LEG: Record<string, TesteDaTecnica> = {
    'Kick Shot': { tipo: 'ataque' },
    'Kick Strike': { tipo: 'ataque' },
    'Party Table Kick Course': { tipo: 'salvaguarda', atributo: 'des', aoPassar: 'metade' },
    'Frites Assorties': { tipo: 'salvaguarda', atributo: 'des', aoPassar: 'metade' },
    Concassé: { tipo: 'ataque' },
    'Extra Hachis': { tipo: 'salvaguarda', atributo: 'des', aoPassar: 'metade' },
    'Ondo Rare Strike': { tipo: 'salvaguarda', atributo: 'des', aoPassar: 'metade' },
    'Beef Burst': { tipo: 'ataque' },
};
for (const t of BLACK_LEG.tecnicas) if (TESTES_DO_BLACK_LEG[t.nome]) t.teste = TESTES_DO_BLACK_LEG[t.nome];

/**
 * Herói (sem Técnicas prontas: elas vêm só dos treinamentos). Regra do projeto: só dano, PP e as reações defensivas são automáticos; o resto fica
 * como texto na ficha. Automáticos aqui: dado de vida e armas favoritas por caminho, as armas do Deus da Arma (já ajustadas), Ataque Extra, CR de
 * Lança e Escudo, PT do Esforço Heroico, Dados Heroicos como contador com botões, Virada Heroica e o Escudo (reduzem dano) e a Plot Armor.
 */
const HEROI_FAVORITAS_ARMA = ['Sabre', 'Daito Katana', 'Montante', 'Lança', 'Escudo', 'Arco'];
const C_PODER = 'poder-oculto';
const C_HAREM = 'harem';
const C_ESPADA = 'arma-espada';
const C_LANCA = 'arma-lanca';
const C_ESCUDO = 'arma-escudo';
const C_ARCO = 'arma-arco';
const DEUS_DA_ARMA = [C_ESPADA, C_LANCA, C_ESCUDO, C_ARCO];
const ESPADA_2D8: AjusteDeArma = { dano: '2d8', tipoDano: 'Cortante', bonusAtaque: 2, bonusDano: 2 };

/** Os Dados Heroicos (1d10): 1 no 1º nível e mais 1 por nível até o 10º (e +5 no Despertar Heroico do Guerreiro do Poder Oculto). */
const dadosHeroicos = (caminho: string, despertar: boolean): TracoDoEstilo => ({
    id: `dados-heroicos-${caminho}`,
    caminho,
    nome: 'Dados Heroicos',
    tipo: 'passiva',
    usos: { max: 1, formula: despertar ? 'min(@nivel,10)+5*max(0,min(1,@nivel-9))' : 'min(@nivel,10)', descanso: 'longo' },
    descricao:
        'Os Dados Heroicos (1d10) alimentam as características de combate do Herói: 1 dado no 1º nível e mais 1 a cada nível até o 10º' +
        (despertar ? ' (e +5 no 10º nível, com o Despertar Heroico)' : '') +
        '. Todos voltam em descanso longo. Também dá para recuperar 1 dado quando uma criatura desconhecida lhe agradece diretamente por socorro, ou ao dividir itens (dinheiro, objetos, comida) de valor mínimo ฿ 70.000 com uma ou mais criaturas. No 15º nível o Herói Lendário pode trocar a escolha de caminho por até 30 dados no máximo.',
    acoes: [
        { rotulo: 'Gastar 1 Dado Heroico (1d10)', tipo: 'rolar', rolagem: '1d10', usa: true, custo: 1 },
        { rotulo: 'Gastar 2 Dados Heroicos (2d10)', tipo: 'rolar', rolagem: '2d10', usa: true, custo: 2 },
        { rotulo: 'Gastar 3 Dados Heroicos (3d10)', tipo: 'rolar', rolagem: '3d10', usa: true, custo: 3 },
        { rotulo: 'Gastar 5 Dados Heroicos', tipo: 'gastar', usa: true, custo: 5 },
    ],
    etiquetas: ['Dados Heroicos: 1d10, 1 por nível até o 10º (descanso longo)'],
});

/** O Ataque Extra por caminho: Deus da Arma 2 no 7º e 3 no 11º (Arco: 4 no 10º); Poder Oculto 2 no 10º. */
const ataqueExtra = (caminho: string, nivelMin: number, nivelMax: number | undefined, mais: number, texto: string): TracoDoEstilo => ({
    id: `ataque-extra-${caminho}-${nivelMin}`,
    caminho,
    nome: `Ataque Extra (${texto})`,
    nivelMin,
    ...(nivelMax ? { nivelMax } : {}),
    descricao: `Você pode atacar ${texto} ao usar a ação "Atacar" no seu turno.`,
    efeitos: [{ alvo: 'ataques.acao', modo: 'soma', valor: mais }],
    etiquetas: [`Ação Atacar: ${texto}`],
});

const TRUNFO =
    'Um movimento secreto para as ocasiões mais necessárias: conta como Técnica de 1º grau, só ofensiva, sem condição nem efeito e sem custo de PP; não volta até descanso curto ou longo; ganha +2 dados de dano ao fim de cada encontro em que você participar sem usá-la (máximo igual ao seu nível de Herói); depois de usada, volta a 2 dados. Crie a Técnica na aba Técnicas.';

export const HEROI: EstiloDados = {
    id: 'heroi',
    nome: 'Herói',
    descricao:
        'Para ser herói basta a vontade inabalável de ajudar os outros. Por árduo treino, companheirismo ou poderes misteriosos, protege os mais fracos; o mundo parece mudar as próprias regras a seu favor, e os amigos lhe dão a determinação para passar por cima de qualquer obstáculo. Não aprende Técnicas prontas: só as cria por treinamentos.',
    dado: 'd8',
    atributosPrimarios: ['for', 'von'],
    salvaguardas: ['con', 'von'],
    proficiencias: [],
    pericias: 2,
    periciasPermitidas: ['atletismo', 'acrobacia', 'haki', 'sorte', 'persuasao'],
    armasFavoritas: ['Corporal', ...HEROI_FAVORITAS_ARMA],
    habilidadesInatas: [
        { id: 'aprimoramento-de-atributo', nome: 'Aprimoramento de Atributo' },
        { id: 'perito-em-tecnicas', nome: 'Perito em Técnicas' },
    ],
    equipamento: '12d10 x 1000 Bellys (e a arma sagrada, para o Deus da Arma).',
    equipamentoInicial: {
        porArma: {
            Sabre: [{ catalogo: 'sabre', qtd: 1, arma: ESPADA_2D8 }],
            'Daito Katana': [{ catalogo: 'katana', qtd: 1, arma: ESPADA_2D8 }],
            Montante: [{ catalogo: 'espada-montante', qtd: 1, arma: ESPADA_2D8 }],
            Lança: [{ catalogo: 'lanca', qtd: 1, arma: { dano: '2d8', tipoDano: 'Perfurante', bonusAtaque: 1, bonusDano: 2 } }],
            Escudo: [{ catalogo: 'escudo-de-ferro', qtd: 1, arma: { dano: '1d8', tipoDano: 'Contundente' } }],
            Arco: [
                { catalogo: 'arco', qtd: 1, arma: { bonusAtaque: 3, bonusDano: 1 } },
                { catalogo: 'flecha', qtd: 20 },
            ],
        },
        itens: [],
        dinheiro: { dados: '12d10', multiplicador: 1000 },
    },
    caminhos: [
        {
            id: C_PODER,
            nome: 'Guerreiro do Poder Oculto',
            descricao:
                'Determinação inabalável que faz emergir o verdadeiro potencial: Corpo de Guerreiro, dado de vida d12 e punhos movidos pela Vontade.',
            dado: 'd12',
            armasFavoritas: ['Corporal'],
        },
        {
            id: C_HAREM,
            nome: 'Mestre do Harém',
            descricao: 'Carisma que inspira respeito e a vontade de seguir: companheiros fiéis (Healer, Tanker e Warrior).',
            armasFavoritas: ['Corporal'],
        },
        {
            id: C_ESPADA,
            nome: 'Deus da Arma: Espada',
            descricao: 'Dedicação incessante à espada (sabre, daito katana ou montante, 2d8 Cortante, +2 no ataque e no dano).',
            dado: 'd10',
            armasFavoritas: ['Sabre', 'Daito Katana', 'Montante'],
        },
        {
            id: C_LANCA,
            nome: 'Deus da Arma: Lança',
            descricao: 'Dedicação incessante à lança (2d8 Perfurante, +1 no ataque, +2 no dano e +1 na CR).',
            dado: 'd10',
            armasFavoritas: ['Lança'],
        },
        {
            id: C_ESCUDO,
            nome: 'Deus da Arma: Escudo',
            descricao: 'Dedicação incessante ao escudo (grande e indestrutível, 1d8 Contundente, +3 na CR e 10 PV temporários por turno).',
            dado: 'd10',
            armasFavoritas: ['Escudo'],
        },
        {
            id: C_ARCO,
            nome: 'Deus da Arma: Arco',
            descricao: 'Dedicação incessante ao arco (flechas de 1d12 Perfurante, +3 no ataque e +1 no dano).',
            dado: 'd10',
            armasFavoritas: ['Arco'],
        },
    ],
    niveisAva: [4, 8, 12, 16, 20],
    niveisDeTecnica: [],
    tracos: [
        // --- Jornada do Herói (todos) ---
        {
            id: 'esforco-heroico',
            nome: 'Jornada do Herói: Esforço Heroico',
            descricao:
                'Você não aprende Técnicas (nem as da Akuma no Mi) automaticamente: só por treinamentos ou Maestrias. As Técnicas do treinamento "Genialidade Inusitada" têm os mesmos benefícios das Técnicas dos Estilos de Combate, e você pode criar uma Técnica Auxiliar em vez de uma de Combate, gastando 1 PT mais 1 PT por Auxiliar já aprendida (respeitando o nível de cada grau). O Herói recebe 5 Pontos de Treinamento no 1º nível e mais 2 a cada nível par, que devem ser usados só na Genialidade Inusitada.',
            etiquetas: ['5 PT no 1º nível e +2 por nível par (só Genialidade Inusitada)'],
        },
        dadosHeroicos(C_PODER, true),
        dadosHeroicos(C_HAREM, false),
        ...DEUS_DA_ARMA.map((c) => dadosHeroicos(c, false)),
        {
            id: 'protagonismo',
            nome: 'Protagonismo',
            nivelMin: 2,
            usos: { max: 1, descanso: 'curto' },
            descricao:
                'Você pode escolher uma rolagem de dado qualquer para assumir a jogada (podendo definir a CD): só você vê o resultado e diz ao Narrador se foi bem-sucedida ou malsucedida. Não volta até descanso curto ou longo. Há ainda uma característica extra do seu caminho.',
            etiquetas: ['Assume uma rolagem qualquer (descanso curto)'],
        },
        {
            id: 'ultimo-a-chegar',
            nome: 'Último a Chegar',
            nivelMin: 3,
            descricao:
                'Ao entrar num encontro em que já passou ao menos 1 rodada, você faz um turno especial logo ao entrar (um turno normal, exceto causar dano). The Hero Arrives: recupera 1 Dado Heroico por rodada que já passou (o que passar do máximo fica como sobressalente e some no fim do encontro). Poder da Amizade: recupera 10 PV por aliado consciente no seu primeiro turno (excesso some no fim do encontro). "Eu Não Perdoo!": no primeiro turno recupera 5 PP por aliado caído a 0 PV e, depois, 5 PP cada vez que um aliado cair a 0 PV (excesso some no fim do encontro).',
            etiquetas: ['Entra com atraso: turno especial, +1 Dado Heroico por rodada, +10 PV e +5 PP por aliado'],
        },
        {
            id: 'trunfo',
            nome: 'Trunfo',
            nivelMin: 6,
            usos: { max: 1, descanso: 'curto' },
            descricao: TRUNFO,
            etiquetas: ['Técnica Trunfo: 1º grau, sem PP, +2 dados por encontro sem usar'],
        },
        {
            id: 'super-hero',
            nome: 'Super Hero',
            nivelMin: 7,
            tipo: 'ativa',
            acao: 'bonus',
            usos: { max: 1, descanso: 'longo' },
            descricao:
                'Com uma ação bônus, você acessa o máximo potencial por até 1 minuto: o dado de dano dos seus ataques (comum) vira 1d12 (prevalece o maior); sempre que executar uma característica que gaste 1 ou mais Dados Heroicos, +1 na CR até o início do seu próximo turno; deslocamento de 18 metros. Não volta até descanso longo.',
            efeitos: [{ alvo: 'movimento.normal', modo: 'min', valor: 180 }],
            etiquetas: ['Super Hero: ataques 1d12 (ajuste a arma), +1 CR por Dado Heroico gasto'],
        },
        {
            id: 'plot-armor',
            nome: 'Plot Armor',
            nivelMin: 11,
            tipo: 'ativa',
            acao: 'bonus',
            interruptor: true,
            usos: { max: 1, descanso: 'longo' },
            descricao:
                'Com uma ação bônus, você fica até 1 minuto sem receber nenhum tipo de dano (nem Verdadeiro), com desvantagem em todas as Salvaguardas. Depois recebe "Inconsciente" por 1 minuto (desligue ao fim do efeito). Não volta até descanso longo.',
            etiquetas: ['Ligada: nenhum dano (nem Verdadeiro); desvantagem nas Salvaguardas; depois Inconsciente 1 min'],
        },
        {
            id: 'recuperacao-heroica',
            nome: 'Recuperação Heroica',
            nivelMin: 14,
            descricao:
                'Ao fim de um descanso curto ou longo, você pode gastar 10 Dados Heroicos para recuperar todos os PP e PV e perder os efeitos de Exaustão e doenças até o fim do próximo descanso longo. A cada uso, seu máximo de Constituição cai 2 (até −8 acumulados); os 2 pontos voltam ao fim de 3 descansos longos.',
            etiquetas: ['10 Dados Heroicos: PP e PV totais; −2 de CON máx. por uso'],
        },
        {
            id: 'heroi-lendario',
            nome: 'Herói Lendário',
            nivelMin: 15,
            descricao:
                'Você pode receber todas as características de um dos 2 caminhos de "Tipo de Herói" que não escolheu, ou, em vez disso, aumentar para 30 o máximo de Dados Heroicos.',
        },
        {
            id: 'mestre-heroi',
            nome: 'Mestre Herói',
            nivelMin: 18,
            descricao:
                'Distribua livremente 6 pontos entre seus atributos, respeitando o máximo de 24 em cada um. Você pode escolher dois atributos para aplicar esses pontos até o máximo de 30.',
        },
        {
            id: 'versus',
            nome: 'Versus',
            nivelMin: 19,
            usos: { max: 1, descanso: 'longo' },
            descricao:
                'Escolha uma criatura humanoide que você veja a até 3 m: ambos entram em rodadas especiais num duelo mortal sem interferências. Começa quem tem mais Vontade; ambos trocam os PV por 8 e a CR por 10; acerto +1 e dano 1 (2 no crítico natural); sem reações, ações bônus nem outras características; deslocamento só para se aproximar; a ação só ataca, 1 vez. Antes de saber se acertou, gaste 5 Dados Heroicos para +1 de dano ou vantagem no ataque. Quem chegar a 0 PV morre (o vencedor pode poupar). Registre os PV atuais antes; ao fim os do vencedor voltam ao registrado e então se aplica 10 de dano por ponto de dano recebido no duelo. Não volta até descanso longo.',
            etiquetas: ['Duelo mortal: 8 PV, CR 10, +1 e dano 1; dano final ×10'],
        },
        // --- Guerreiro do Poder Oculto ---
        {
            id: 'corpo-heroico',
            caminho: C_PODER,
            nome: 'Guerreiro do Poder Oculto: Corpo Heroico',
            descricao:
                'Você recebe a Habilidade Básica Geral "Corpo de Guerreiro" e o seu dado de vida passa a ser o d12. Punho da Vontade: você pode usar o modificador de Vontade nas jogadas de ataque (comum) corpo a corpo e de dano. Espírito Indomável: uma vez por rodada, gaste 1 Dado Heroico para aumentar uma rolagem qualquer em um valor igual ao resultado do dado (até 2 dados juntos a partir do 5º nível de Herói).',
            efeitos: [
                { alvo: 'ataque.desarmado', modo: 'soma', valor: 'max(0,@mod.von-@mod.for)' },
                { alvo: 'dano.desarmado', modo: 'soma', valor: 'max(0,@mod.von-@mod.for)' },
            ],
            etiquetas: [
                'Punho da Vontade: usa a Vontade no ataque e no dano corpo a corpo',
                'Espírito Indomável: +1 Dado Heroico à rolagem (1 por rodada)',
            ],
        },
        {
            id: 'discurso-heroico',
            caminho: C_PODER,
            nome: 'Guerreiro do Poder Oculto (5º): Discurso Heroico, Impulso Heroico',
            nivelMin: 5,
            usos: { max: 1, descanso: 'longo' },
            descricao:
                'Discurso Heroico: se uma criatura hostil está com menos da metade dos PV máximos, ela faz Salvaguarda de Vontade; se falhar, se alia a você por até 24 horas, desde que os objetivos não sejam totalmente contrários (1 uso até descanso longo). Impulso Heroico: ao fim do seu turno, você pode fazer uma ação adicional (1 uso até descanso curto ou longo).',
            etiquetas: ['Discurso Heroico: hostil com menos da metade dos PV pode virar aliado', 'Impulso Heroico: ação adicional ao fim do turno'],
        },
        {
            id: 'virada-heroica',
            caminho: C_PODER,
            nome: 'Guerreiro do Poder Oculto (5º): Virada Heroica',
            nivelMin: 5,
            descricao:
                'Com menos da metade dos seus PV, você pode usar a reação para gastar 5 Dados Heroicos e negar um dano qualquer que tenha recebido. A reação é oferecida ao ser atacado e os Dados Heroicos só são gastos quando o dano é de fato negado.',
            reacao: {
                gatilho: 'ataque_declarado',
                alcance: 'si',
                reducao: { zerar: true, gasta: { de: 'Dados Heroicos', qtd: 5 }, pvAbaixoDaMetade: true },
            },
            etiquetas: ['Reação (PV < ½): 5 Dados Heroicos negam um dano'],
        },
        ataqueExtra(C_PODER, 10, undefined, 1, 'duas vezes'),
        {
            id: 'tecnica-assinatura',
            caminho: C_PODER,
            nome: 'Guerreiro do Poder Oculto (10º): Técnica Assinatura e Despertar Heroico',
            nivelMin: 10,
            usos: { porProf: true, max: 2, descanso: 'longo' },
            principal: { pp: 'baixo', dados: 2, grauMax: 4 },
            descricao:
                'Técnica Assinatura: escolha uma Técnica de 4º grau ou menor como principal: ela custa metade dos PP uma quantidade de vezes igual ao Bônus de Proficiência (voltam em descanso longo) e, sempre que executada, causa 2 dados de dano adicionais. Despertar Heroico: +5 no máximo de Dados Heroicos (já somado ao contador). Na aba Técnicas, marque "★ Definir principal" na Técnica escolhida: o desconto de PP (metade, arredondada para baixo, mín. 1) e os 2 dados a mais valem sozinhos.',
            etiquetas: ['Técnica Assinatura: metade dos PP (usos = prof.) e +2 dados de dano'],
        },
        {
            id: 'protagonismo-poder',
            caminho: C_PODER,
            nome: 'Protagonismo: Guerreiro do Poder Oculto',
            nivelMin: 2,
            usos: { max: 1, descanso: 'longo' },
            descricao:
                'Num encontro, se você cair inconsciente com 0 PV sem morrer, após 2 minutos no mesmo encontro você recobra a consciência com um terço dos seus PV. Não volta até descanso longo.',
            etiquetas: ['Inconsciente a 0 PV: acorda após 2 min com ⅓ dos PV'],
        },
        // --- Mestre do Harém ---
        {
            id: 'companheiros',
            caminho: C_HAREM,
            nome: 'Mestre do Harém: Companheiros',
            descricao:
                'Você escolhe um companheiro inicial, totalmente fiel a você (Healer, Tanker ou Warrior); nova escolha no 3º e no 5º nível de Herói, uma vez cada tipo. Healer: CR 10, PV metade dos seus, dano 1d4+1, 9 m, 10 kits de primeiros socorros. Tanker: CR 19, PV o dobro dos seus, dano 1d6+3, 6 m, 1 escudo. Warrior: CR 16, PV iguais aos seus, dano 1d10+5, 15 m, 1 arma corpo a corpo. Cada um tem vantagem numa Salvaguarda (Vontade, Warrior; Força, Tanker; Sabedoria, Healer) e usa os seus atributos e bônus; não usam Akuma no Mi, Treinamentos nem Profissões. O turno deles é logo depois do seu; ao fim de cada turno seu você recebe uma reserva de 3 Ações de Companheiros (+2 por companheiro além do primeiro), sem acumular: Deslocamento (1 ação) e Ataque (2 ações, com o dano da tabela). Healer (1º): gasta Dados Heroicos para curar a 1,5 m com o dobro do resultado; (5º) 2 dados removem 1 Exaustão, ou 1 dado suspende uma condição até o fim do encontro; (10º) 5 dados levantam um caído com metade dos PV. Tanker (1º): perto dele (3 m), sua CR vira 10 + prof. + Vontade (ou concede a outro); (5º) ação bônus para cobertura total; (10º) reação para passar o dano a ele. Warrior (1º): uma vez por turno executa uma Técnica sua com a ação Ataque e os seus PP, e lhe dá proficiência numa arma; (5º) 1 Dado Heroico para atacar duas vezes; (10º) até 2 Dados Heroicos somam o resultado ao dano.',
            etiquetas: ['Companheiros: Healer, Tanker, Warrior (3 ações compartilhadas por turno)'],
        },
        {
            id: 'protagonismo-harem',
            caminho: C_HAREM,
            nome: 'Protagonismo: Mestre do Harém',
            nivelMin: 2,
            descricao:
                'Sempre que o Narrador pedir um Teste de Atributo para convencer uma pessoa a ajudar, você recebe o dobro do seu Bônus de Proficiência.',
            etiquetas: ['Convencer alguém: prof. dobrada'],
        },
        // --- Deus da Arma (todos os caminhos de arma) ---
        ...DEUS_DA_ARMA.flatMap((c): TracoDoEstilo[] => [
            {
                id: `tracos-gerais-${c}`,
                caminho: c,
                nome: 'Deus da Arma: Traços Gerais',
                descricao:
                    'Arma Sagrada: a arma escolhida é a sua arma favorita e os bônus dela valem só para você. Resistência Heroica: uma vez por rodada, some o resultado de 1 Dado Heroico a uma Salvaguarda sua; dado de vida d10. Defesa Heroica: você recebe a Habilidade Básica "Defesa Ofensiva". Dano Inevitável: o dano das jogadas de ataque (comum ou Técnicas) com a arma sagrada ignora resistências. Superação Heroica: a partir do 10º nível, uma característica de 5º nível de outra arma passa a valer na sua; a partir do 15º, uma de 10º nível.',
                etiquetas: [
                    'Dano Inevitável: a arma sagrada ignora resistências',
                    'Resistência Heroica: +1 Dado Heroico numa Salvaguarda (1 por rodada)',
                ],
            },
            {
                id: `protagonismo-arma-${c}`,
                caminho: c,
                nome: 'Protagonismo: Deus da Arma',
                nivelMin: 2,
                tipo: 'ativa',
                interruptor: true,
                usos: { max: 1, descanso: 'longo' },
                descricao:
                    'Por 1 minuto você atinge o máximo da sintonia com a sua arma e soma o Bônus de Proficiência às jogadas de dano com a arma favorita. Não volta até descanso longo.',
                efeitos: [{ alvo: 'dano.arma', modo: 'soma', valor: '@prof' }],
                etiquetas: ['Sintonia: +prof. no dano da arma favorita (1 min)'],
            },
        ]),
        ataqueExtra(C_ESPADA, 7, 10, 1, 'duas vezes'),
        ataqueExtra(C_ESPADA, 11, undefined, 2, 'três vezes'),
        ataqueExtra(C_LANCA, 7, 10, 1, 'duas vezes'),
        ataqueExtra(C_LANCA, 11, undefined, 2, 'três vezes'),
        ataqueExtra(C_ESCUDO, 7, 10, 1, 'duas vezes'),
        ataqueExtra(C_ESCUDO, 11, undefined, 2, 'três vezes'),
        ataqueExtra(C_ARCO, 7, 9, 1, 'duas vezes'),
        ataqueExtra(C_ARCO, 10, undefined, 3, 'quatro vezes'),
        // --- Espada ---
        {
            id: 'espada-5',
            caminho: C_ESPADA,
            nome: 'Espada (5º): dano com Dados Heroicos',
            nivelMin: 5,
            descricao:
                'Uma vez por rodada, ao atacar (comum) com a arma favorita, gaste até 2 Dados Heroicos para aumentar o dano em um valor igual ao resultado dos dados gastos.',
            etiquetas: ['Até 2 Dados Heroicos somam o resultado ao dano (1 por rodada)'],
        },
        {
            id: 'espada-10',
            caminho: C_ESPADA,
            nome: 'Espada (10º): ataque garantido',
            nivelMin: 10,
            descricao: 'Uma vez por rodada, com a ação bônus, faça uma jogada de ataque (comum) adicional com a arma favorita: acerto garantido.',
            etiquetas: ['Ação bônus: ataque adicional com acerto garantido (1 por rodada)'],
        },
        {
            id: 'espada-15',
            caminho: C_ESPADA,
            nome: 'Espada (15º): técnica sem PP',
            nivelMin: 15,
            usos: { max: 1, descanso: 'curto' },
            descricao:
                'Gaste 5 Dados Heroicos para executar uma técnica de 5º grau ou inferior com "arma favorita" como requisito sem gastar PP. Não volta até descanso curto ou longo.',
            etiquetas: ['5 Dados Heroicos: técnica de arma favorita (até 5º grau) sem PP'],
        },
        // --- Lança ---
        {
            id: 'lanca-1',
            caminho: C_LANCA,
            nome: 'Lança (1º): bônus de CR',
            descricao: 'A lança recebida causa 2d8 Perfurante, +1 no ataque e +2 no dano (já ajustados no item) e garante +1 na sua CR.',
            efeitos: [{ alvo: 'ca', modo: 'soma', valor: 1 }],
            etiquetas: ['Lança: +1 na CR'],
        },
        {
            id: 'lanca-5',
            caminho: C_LANCA,
            nome: 'Lança (5º): repetir o ataque',
            nivelMin: 5,
            descricao: 'Ao errar uma jogada de ataque (comum ou Técnicas), gaste 1 Dado Heroico para executar o ataque novamente.',
            etiquetas: ['1 Dado Heroico: repete o ataque que errou'],
        },
        {
            id: 'lanca-margem-18',
            caminho: C_LANCA,
            nome: 'Lança (10º): crítico 18-20',
            nivelMin: 10,
            nivelMax: 14,
            descricao: 'A margem de acerto crítico da lança muda para 18-20.',
            efeitos: [{ alvo: 'margem.corpo', modo: 'min', valor: 18 }],
            etiquetas: ['Lança: crítico 18-20'],
        },
        {
            id: 'lanca-margem-17',
            caminho: C_LANCA,
            nome: 'Lança (15º): crítico 17-20',
            nivelMin: 15,
            descricao: 'A margem de acerto crítico da lança muda para 17-20.',
            efeitos: [{ alvo: 'margem.corpo', modo: 'min', valor: 17 }],
            etiquetas: ['Lança: crítico 17-20'],
        },
        {
            id: 'lanca-15',
            caminho: C_LANCA,
            nome: 'Lança (15º): técnica com +3 dados',
            nivelMin: 15,
            usos: { max: 1, descanso: 'curto' },
            descricao:
                'Gaste 5 Dados Heroicos para executar uma técnica qualquer com "arma favorita" como requisito com 3 dados de dano adicionais. Não volta até descanso curto ou longo.',
            etiquetas: ['5 Dados Heroicos: técnica de arma favorita com +3 dados de dano'],
        },
        // --- Escudo ---
        {
            id: 'escudo-1',
            caminho: C_ESCUDO,
            nome: 'Escudo (1º): grande e indestrutível',
            descricao:
                'O escudo é de grande porte e indestrutível, causa 1d8 Contundente (já no item), tem "duas mãos" e "pesada", garante +3 na CR e 10 PV temporários que se renovam no início de cada turno seu.',
            efeitos: [{ alvo: 'ca', modo: 'soma', valor: 3 }],
            etiquetas: ['Escudo: +3 na CR; 10 PV temporários a cada turno'],
        },
        {
            id: 'escudo-5',
            caminho: C_ESCUDO,
            nome: 'Escudo (5º): reduzir o dano',
            nivelMin: 5,
            descricao:
                'Ao sofrer qualquer dano (mesmo Verdadeiro), use a reação e gaste até 3 Dados Heroicos para reduzi-lo em um valor igual ao resultado dos dados. A reação é oferecida ao ser atacado e gasta 3 Dados Heroicos (3d10 de redução no próximo dano).',
            reacao: {
                gatilho: 'ataque_declarado',
                alcance: 'si',
                reducao: { reserva: '3d10', unica: true, gasta: { de: 'Dados Heroicos', qtd: 3 } },
            },
            etiquetas: ['Reação: 3 Dados Heroicos reduzem o dano em 3d10'],
        },
        {
            id: 'escudo-10',
            caminho: C_ESCUDO,
            nome: 'Escudo (10º): ataque de escudo',
            nivelMin: 10,
            descricao:
                'Uma vez por rodada, com a ação bônus, faça uma jogada de ataque (comum) adicional com a arma favorita; no acerto causa 1d12 Contundente e, em acerto crítico, o alvo recebe "Atordoado" até o fim do próximo turno dele.',
            etiquetas: ['Ação bônus: ataque de escudo 1d12 (crítico atordoa)'],
        },
        {
            id: 'escudo-15',
            caminho: C_ESCUDO,
            nome: 'Escudo (15º): recuperar todos os PV',
            nivelMin: 15,
            usos: { max: 1, descanso: 'curto' },
            descricao: 'Com uma ação, gaste 5 Dados Heroicos para recuperar todos os seus PV. Não volta até descanso curto ou longo.',
            etiquetas: ['Ação + 5 Dados Heroicos: todos os PV'],
        },
        // --- Arco ---
        {
            id: 'arco-1',
            caminho: C_ARCO,
            nome: 'Arco (1º): flechas de 1d12',
            descricao: 'As flechas atiradas com o arco causam 1d12 Perfurante; o arco garante +3 no ataque e +1 no dano (já ajustados no item).',
            etiquetas: ['Arco: flechas 1d12 Perfurante (ajuste a munição)'],
        },
        {
            id: 'arco-5',
            caminho: C_ARCO,
            nome: 'Arco (5º): ataque extra por dado',
            nivelMin: 5,
            descricao:
                'Uma vez por rodada, ao atacar (comum) com a arma favorita, gaste 1 Dado Heroico para fazer mais uma jogada de ataque (comum).',
            etiquetas: ['1 Dado Heroico: mais um ataque (1 por rodada)'],
        },
        {
            id: 'arco-15',
            caminho: C_ARCO,
            nome: 'Arco (15º): técnicas pela metade',
            nivelMin: 15,
            usos: { max: 1, descanso: 'curto' },
            descricao:
                'Gaste 5 Dados Heroicos para executar técnicas com "arma favorita" como requisito pela metade dos PP (mínimo 1 PP) por até 1 minuto. Não volta até descanso curto ou longo.',
            etiquetas: ['5 Dados Heroicos: técnicas de arma favorita pela metade dos PP (1 min)'],
        },
    ],
    tecnicas: [],
};

/**
 * Usuário Ínsito (sem Técnicas prontas: elas vêm só dos treinamentos). Regra do projeto: só dano, PP e reações defensivas são automáticos; o resto
 * fica como texto. Automáticos aqui: PP máximo, PT da Akuma no Chikara (pela Categoria do fruto), dano extra de Logia e Zoan Mítica nas Técnicas e no
 * ataque desarmado, Ataque Extra, usos por descanso, a cura e os PD da Defesa Infundida e a margem de crítico da Transformação Diabólica.
 */
const I_OBJETO = 'objeto-infundido';
const I_DEFESA = 'defesa-infundida';
const I_SELVAGERIA = 'selvageria-infundida';

/** Logia e Zoan Mítica: 1d4 de dano extra nos ataques (comum ou Técnicas), 1d8 a partir do 10º nível. */
const danoDoFruto = (): BonusDeDano[] =>
    (['tecnica', 'desarmado'] as const).flatMap((alvo) =>
        [
            { dados: '1d4', nivelMax: 9 },
            { dados: '1d8', nivelMin: 10 },
        ].flatMap((faixa) => [
            { alvo, ...faixa, requerAkuma: { tipo: ['logia'] } },
            { alvo, ...faixa, requerAkuma: { tipo: ['zoan'], zoan: ['mitica'] } },
        ]),
    );

export const USUARIO_INSITO: EstiloDados = {
    id: 'usuario-insito',
    nome: 'Usuário Ínsito',
    descricao:
        'Consumiu um Fruto do Diabo há muitos anos e, a cada etapa do desenvolvimento das técnicas, incorporou as habilidades sobrenaturais: os poderes dele e os do fruto ficam praticamente indistinguíveis. Não aprende Técnicas prontas: só as cria por treinamentos, mas conta com vários meios de aprimorá-las, reduzir o custo e aumentar o poder de fogo ao extremo.',
    dado: 'd10',
    atributosPrimarios: ['for', 'von'],
    salvaguardas: ['con', 'von'],
    proficiencias: [],
    pericias: 2,
    periciasPermitidas: ['atletismo', 'acrobacia', 'furtividade', 'sobrenatural', 'sobrevivencia'],
    armasFavoritas: ['Corporal'],
    habilidadesInatas: [
        { id: 'aprimoramento-de-atributo', nome: 'Aprimoramento de Atributo' },
        { id: 'perito-em-tecnicas', nome: 'Perito em Técnicas' },
    ],
    equipamento: '12d10 x 1000 Bellys.',
    equipamentoInicial: { itens: [], dinheiro: { dados: '12d10', multiplicador: 1000 } },
    // Escolha Diabólica (2º nível) e Escolha Aprimorada (11º): o personagem escolhe um traço em cada, sem repetir
    escolhaDeTracos: {
        nome: 'Escolha Diabólica',
        niveis: [2, 11],
        opcoes: [
            {
                id: I_OBJETO,
                nome: 'Objeto Infundido',
                descricao: 'Incorpora o poder do fruto num objeto (espada, pincel, chicote...) para liberar ou ajudar a usar esses poderes.',
            },
            {
                id: I_DEFESA,
                nome: 'Defesa Infundida',
                descricao: 'Foca parte dos poderes na proteção, com Pontos de Defesa para CR, cura e PV máximos.',
            },
            {
                id: I_SELVAGERIA,
                nome: 'Selvageria Infundida',
                descricao: 'Usa os poderes de forma explosiva e inconsequente: ignora resistências a um tipo de dano e executa técnicas sem PP.',
            },
        ],
    },
    niveisAva: [4, 8, 12, 16, 20],
    niveisDeTecnica: [],
    tracos: [
        {
            id: 'akuma-no-chikara',
            nome: 'Akuma no Chikara',
            descricao:
                'Você é portador dos poderes de uma Akuma no Mi (o Narrador decide se escolhe o fruto ou se é aleatório) e usa as técnicas dela fora de combate sem gastar PP, desde que não afetem um encontro futuro nem outras criaturas. Tipos: Paramecia, Zoan (Comum, Ancestral ou Mítica) ou Logia, de Categoria S, A, B ou C. Você recebe 2 PT a cada nível par, só para a Genialidade Inusitada, e, no 1º nível, PT adicionais pela Categoria: S, 3; A, 4; B ou C, 6 (em Zoan Comum e Ancestral, os das categorias A, B e C valem em qualquer Treinamento). O seu máximo de PP aumenta em 1 e mais 1 a cada nível de Usuário Ínsito.',
            efeitos: [{ alvo: 'pp.max', modo: 'soma', valor: '@nivel' }],
            etiquetas: ['PP máx +1 por nível', 'PT: 2 por nível par + Categoria (S 3, A 4, B/C 6)'],
        },
        {
            id: 'crescimento-imprevisivel',
            nome: 'Crescimento Imprevisível',
            descricao:
                'Você não aprende nenhuma técnica automaticamente (nem as da Akuma no Mi): só por treinamentos ou Maestrias. As Técnicas do treinamento "Genialidade Inusitada" têm os benefícios das Técnicas dos Estilos de Combate, e você pode criar uma Técnica Auxiliar em vez de uma de Combate, gastando 1 PT mais 1 PT por Auxiliar já aprendida (respeitando o nível de cada grau).',
        },
        {
            id: 'tipo-logia-mitica',
            nome: 'Tipo de Fruto: Logia e Zoan Mítica',
            descricao:
                'O poder do fruto permeia o corpo: 1d4 de dano adicional (da natureza do fruto) nas jogadas de ataque (comum ou Técnicas), 1d8 a partir do 10º nível. Suas Técnicas de Combate sempre causam, no mínimo, metade do dano possível. (O dado extra entra sozinho nas Técnicas e no ataque desarmado quando o tipo do fruto, na aba Akuma, é Logia ou Zoan Mítica; em armas, some à mão.)',
            bonusDano: danoDoFruto(),
            etiquetas: ['Logia / Zoan Mítica: +1d4 de dano (1d8 no 10º); Técnicas com ao menos metade do dano'],
        },
        {
            id: 'tipo-paramecia',
            nome: 'Tipo de Fruto: Paramecia',
            descricao:
                'Você usa Técnicas Auxiliares de custo igual ou inferior à metade do seu nível de Usuário Ínsito (mín. 2 PP) até 3 vezes sem gastar PP (voltam em descanso longo). O limite de Pontos Virtuais na criação de 1 Manifestação de Poder do fruto aumenta em 2.',
            usos: { max: 3, descanso: 'longo' },
            etiquetas: ['Paramecia: 3 Técnicas Auxiliares baratas sem PP; MP com +2 Pontos Virtuais'],
        },
        {
            id: 'tipo-zoan',
            nome: 'Tipo de Fruto: Zoan Comum e Ancestral',
            descricao:
                'Seu dado de vida vira d12; você recebe as Habilidades Básicas "Corpo de Guerreiro" e "Prodígio do Combate"; os PT adicionais das categorias A, B e C valem em qualquer Treinamento; seu dano desarmado sobe 1 passo (1 → 1d4 → 1d6 → 1d8 → 1d10 → 1d12 → 2d6).',
            etiquetas: ['Zoan Comum/Ancestral: d12, Corpo de Guerreiro, Prodígio do Combate, desarmado +1 passo'],
        },
        // --- Escolha Diabólica ---
        {
            id: 'objeto-infundido',
            escolha: I_OBJETO,
            nome: 'Escolha Diabólica: Objeto Infundido',
            nivelMin: 2,
            descricao:
                'Poder Canalizado: gastando 2 PP, o objeto vira uma arma: some o Bônus de Proficiência ao ataque (comum) e use o modificador de Vontade no lugar do normal; causa 2d8 + Vontade de dano de um tipo compatível com o fruto ou o objeto, até o fim do encontro (no 8º nível não gasta mais PP). Armazenamento Ínsito: uma vez por dia, guarde 1 PP no objeto (guarda até o seu nível, máx. 10 PP) e, empunhando-o, gaste esses PP ao executar qualquer Técnica da Akuma no Mi. Objeto Auxiliador: ao errar um ataque (comum), cause dano igual ao modificador de Vontade (se o d20 não for 1); e o objeto recebe só um destes: manter uma técnica sem concentração, ou Técnicas de 1 minuto com o objeto como requisito custam 1 PP a menos e 1 PP a menos por minuto aumentado. Troque o objeto a cada nível ou se ele for destruído.',
            etiquetas: [
                'Objeto: arma de 2d8 + Vontade (2 PP até o fim do encontro; grátis a partir do 8º)',
                'Armazenamento Ínsito: guarda PP no objeto',
            ],
        },
        {
            id: 'defesa-infundida',
            escolha: I_DEFESA,
            nome: 'Escolha Diabólica: Defesa Infundida',
            nivelMin: 2,
            usos: { max: 1, formula: '@nivel', descanso: 'longo' },
            descricao:
                'Você tem Pontos de Defesa (PD) iguais ao seu nível de Usuário Ínsito, que voltam em descanso longo: com a reação, +1 na CR a cada 3 PD gastos até o fim do encontro (máx. +3); com a ação bônus, recupere 20 PV a cada 2 PD gastos (até 5 vezes o seu nível de PV por esta característica); ou aumente seus PV máximos em 30 a cada 5 PD gastos (esses PD não voltam após o uso).',
            acoes: [
                { rotulo: 'Ação bônus: recuperar 20 PV (2 PD)', tipo: 'recuperar', rolagem: '20', recurso: 'pv', acao: 'bonus', usa: true, custo: 2 },
                { rotulo: 'Reação: +1 CR (3 PD)', tipo: 'gastar', acao: 'reacao', usa: true, custo: 3 },
                { rotulo: 'PV máximos +30 (5 PD)', tipo: 'gastar', usa: true, custo: 5 },
            ],
            etiquetas: ['Pontos de Defesa = nível: CR +1 (3 PD, máx. +3), 20 PV (2 PD), PV máx +30 (5 PD)'],
        },
        {
            id: 'selvageria-infundida',
            escolha: I_SELVAGERIA,
            nome: 'Escolha Diabólica: Selvageria Infundida',
            nivelMin: 2,
            usos: { max: 3, descanso: 'longo' },
            descricao:
                'Você escolhe um tipo de dano para o qual seus ataques e técnicas ignoram resistências e causam metade do dano em invulnerabilidades. Você executa uma Técnica de Combate de 3º grau ou menor sem gastar PP, só uma vez por turno, até 3 vezes (voltam em descanso longo). Com 0 PP, você continua usando técnicas gastando PV: 5 PV para cada PP que a técnica consumiria.',
            etiquetas: ['3 Técnicas (até 3º grau) sem PP; com 0 PP gasta 5 PV por PP', 'Um tipo de dano ignora resistências'],
        },
        {
            id: 'tecnica-principal',
            nome: 'Técnica Principal',
            nivelMin: 3,
            usos: { max: 3, descanso: 'longo' },
            principal: { pp: 'cima', dados: 2, ignora: true, grauMax: 4 },
            descricao:
                'Você escolhe uma Técnica de Combate de 4º grau ou menor como técnica principal: ela pode ser executada pela metade dos PP (arredondada para cima) até 3 vezes (voltam em descanso longo) e, sempre que executada, causa 2 dados de dano adicionais, ignora resistências e invulnerabilidades e não é descontada de PV temporários. Troque a técnica a cada novo nível de Usuário Ínsito. Na aba Técnicas, marque "★ Definir principal" na Técnica escolhida: o desconto, os dados a mais e o ignorar defesas valem sozinhos (o texto de não ser descontada de PV temporários fica por conta da mesa).',
            etiquetas: ['Técnica Principal: metade dos PP (3 usos), +2 dados e ignora resistências'],
        },
        {
            id: 'rompante-diabolico',
            nome: 'Rompante Diabólico',
            nivelMin: 5,
            usos: { max: 1, formula: '1+floor((@nivel-5)/5)', descanso: 'curto' },
            descricao:
                'No seu turno, você faz uma ação adicional ou ação poderosa adicional (Técnicas Auxiliares ou Técnicas de Combate de 3º grau ou menor). Um uso até descanso curto ou longo; no 10º nível, até 2 usos (1 por rodada) e, no 15º, até 3 (1 por rodada), voltando em descanso longo.',
            etiquetas: ['Ação ou ação poderosa adicional (técnica até 3º grau)'],
        },
        {
            id: 'sobrecarga-explosiva',
            nome: 'Sobrecarga Explosiva',
            nivelMin: 6,
            descricao:
                'Num encontro, ao usar uma Técnica de Combate da Akuma no Mi, você pode ganhar Dados de Sobrecarga (d6) na quantidade de um d4; continuando a usar Técnicas, role o d4 de novo para acumular mais (perdem-se ao fim do encontro). Após rolar o d4 pelo menos duas vezes, os dados acumulados somam dano numa Técnica de Combate instantânea (ex.: d4 de 2 e 3 = 5d6) e zeram. Com 6 ou mais Dados de Sobrecarga há descontrole: você sofre metade do total (para baixo) em dano Verdadeiro e zera os dados. A partir do 12º nível, em vez do dano, você pode perder a reação (se a tiver).',
            etiquetas: ['Dados de Sobrecarga: d4 de d6 por técnica; 6+ causa descontrole'],
        },
        {
            id: 'ataque-extra',
            nome: 'Ataque Extra',
            nivelMin: 7,
            descricao: 'Você pode atacar duas vezes, em vez de uma, ao usar a ação "Atacar" no seu turno.',
            efeitos: [{ alvo: 'ataques.acao', modo: 'soma', valor: 1 }],
            etiquetas: ['Ação Atacar: 2 ataques'],
        },
        {
            id: 'uso-controlado',
            nome: 'Uso Controlado',
            nivelMin: 10,
            descricao:
                'No 10º nível, se você não tem ao menos uma Técnica de cada grau (até o 4º) e 2 Técnicas Auxiliares, você as aprende; se já as tem, aprende 3 técnicas novas (até 4º grau ou Auxiliar). Nos níveis 12, 16 e 20 você recebe as técnicas de 5º, 6º e 7º grau e, no 12º, uma Técnica Auxiliar extra.',
            etiquetas: ['Técnicas de graus que faltam e Auxiliares (crie na aba Técnicas)'],
        },
        {
            id: 'escolha-aprimorada',
            nome: 'Escolha Aprimorada',
            nivelMin: 11,
            descricao:
                'Você escolhe mais um traço da "Escolha Diabólica" e usufrui dos benefícios das duas escolhas ao mesmo tempo (a escolha é feita ao subir para o 11º nível).',
        },
        {
            id: 'transformacao-diabolica',
            nome: 'Transformação Diabólica',
            nivelMin: 14,
            tipo: 'ativa',
            acao: 'bonus',
            usos: { max: 1, descanso: 'longo' },
            descricao:
                'Por 1 minuto: a margem de acerto crítico dos seus ataques (comum ou Técnicas) vira 18-20; você pode forçar uma criatura a falhar numa Salvaguarda qualquer, até 3 vezes; Técnicas de 1º grau custam 0 PP e podem substituir um dos ataques do Ataque Extra, sem contar no limite de 1 técnica por turno; num acerto crítico, você faz uma Técnica de Combate de 3º grau ou menor com uma ação bônus, também sem contar nesse limite. Um uso até descanso longo.',
            efeitos: [
                { alvo: 'margem.corpo', modo: 'min', valor: 18 },
                { alvo: 'margem.distancia', modo: 'min', valor: 18 },
            ],
            etiquetas: ['Transformação: crítico 18-20, 3 Salvaguardas forçadas, Técnicas de 1º grau sem PP'],
        },
        {
            id: 'singularidade-exaltada',
            nome: 'Singularidade Exaltada',
            nivelMin: 15,
            descricao:
                'O fruto atinge o potencial máximo: Logia, ao realizar uma Técnica de Combate, causa o dano máximo possível (até 3 vezes, voltam em descanso longo); Paramecia recebe uma ação bônus ou reação adicional por rodada, que não pode ser um ataque nem causar dano (até 3 vezes, voltam em descanso longo); Zoan Comum ou Ancestral, +150 nos PV máximos; Zoan Mítica escolhe qualquer uma. No 18º nível, escolha outra característica, ignorando o tipo de fruto.',
            usos: { max: 3, descanso: 'longo' },
            etiquetas: ['Logia: dano máximo (3 usos); Paramecia: ação adicional (3 usos); Zoan: PV máx +150'],
        },
        {
            id: 'mestre-usuario',
            nome: 'Mestre Usuário',
            nivelMin: 18,
            descricao:
                'Distribua livremente 6 pontos entre seus atributos, respeitando o máximo de 24 em cada um. Você pode escolher dois atributos para aplicar esses pontos até o máximo de 30.',
        },
        {
            id: 'poder-sem-limites',
            nome: 'Poder Sem Limites',
            nivelMin: 19,
            descricao:
                'Você entra em sintonia plena com o fruto: cria uma nova "Manifestação de Poder", executa Técnicas e características sem gastar PP e pode usar 2 ações poderosas no mesmo turno (o Rompante Diabólico continua valendo normalmente).',
            etiquetas: ['Sem gastar PP; 2 ações poderosas por turno'],
        },
    ],
    tecnicas: [],
};

export const ESTILOS: EstiloDados[] = [ATIRADOR, AVENTUREIRO, BRUTAMONTES, BLACK_LEG, HEROI, USUARIO_INSITO];
export const estiloPorId = (id: string | undefined | null): EstiloDados | undefined => ESTILOS.find((e) => e.id === id);

/** O dado de vida do estilo para o caminho escolhido (o caminho pode mudá-lo). */
export const dadoDoEstilo = (estilo: EstiloDados, caminho: string | null | undefined): DadoDeVida =>
    estilo.caminhos?.find((c) => c.id === caminho)?.dado ?? estilo.dado;

/** As armas favoritas que o caminho permite. */
export const armasFavoritasDoCaminho = (estilo: EstiloDados, caminho: string | null | undefined): string[] =>
    estilo.caminhos?.find((c) => c.id === caminho)?.armasFavoritas ?? estilo.armasFavoritas;

/** O atributo primário do personagem: o escolhido, ou o único possível. */
export const atributoPrimarioDe = (estilo: EstiloDados, escolhido: string | null | undefined): AtributoId | null =>
    estilo.atributosPrimarios.length === 1 ? estilo.atributosPrimarios[0] : (estilo.atributosPrimarios.find((a) => a === escolhido) ?? null);

/** As características do estilo para o caminho escolhido (o outro caminho vale a partir de `herdaTudoEm`). */
export function tracosDoEstiloEscolhido(estilo: EstiloDados, caminho: string | null | undefined, escolhas: string[] = []): TracoDados[] {
    return estilo.tracos.flatMap((t) => {
        if (t.escolha && !escolhas.includes(t.escolha)) return [];
        if (!t.caminho || t.caminho === caminho) return [t];
        if (!estilo.herdaTudoEm) return [];

        return [{ ...t, nivelMin: Math.max(t.nivelMin ?? 1, estilo.herdaTudoEm) }];
    });
}

/** Os traços do estilo que o personagem já tem neste nível (os de nível maior entram ao subir de nível). */
export function tracosDoEstiloNoNivel(estilo: EstiloDados, caminho: string | null | undefined, nivel: number, escolhas: string[] = []): TracoDados[] {
    return tracosDoEstiloEscolhido(estilo, caminho, escolhas).filter((t) => (t.nivelMin ?? 1) <= nivel);
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
        ...(t.armarBonus ? { armarBonus: t.armarBonus } : {}),
        ...(t.teste ? { teste: t.teste } : {}),
        ...(t.duracao ? { duracao: t.duracao } : {}),
        builder: 'estilo',
    };
}

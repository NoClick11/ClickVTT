/**
 * Estilos de Combate (a "classe" do One Piece). Cada estilo é só dados: o assistente lê este catálogo e a ficha sai pronta.
 * Arquivo PURO (sem Vue): o Node o executa direto nos testes. Estilo novo = item novo em `ESTILOS`, sem mudar a lógica.
 *
 * O que o motor de efeitos modela entra em `efeitos`/`usos`/`acao`; o resto vira descrição + `etiquetas` (o resumo curto
 * que aparece na ficha). Características com `nivelMin` só valem a partir do nível indicado.
 */
import type { AtributoId, CategoriaDeAcao, Tecnica, TesteDaTecnica } from '../../regras.ts';
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
    /** Quantas perícias o jogador escolhe, livres. */
    pericias: number;
    armasFavoritas: string[];
    /** As duas Habilidades Básicas Inatas entre as quais o jogador escolhe (ids do catálogo de Habilidades Básicas). */
    habilidadesInatas: { id: string; nome: string }[];
    equipamento: string;
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

export const ESTILOS: EstiloDados[] = [ATIRADOR];
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
        builder: 'estilo',
    };
}

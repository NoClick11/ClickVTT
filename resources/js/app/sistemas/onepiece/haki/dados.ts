/**
 * Catálogo do Haki (cap. 7): os 3 tipos, os 40 Talentos e o desenho das árvores. Arquivo PURO (sem Vue): o Node o executa
 * direto nos testes. O que o PHP precisa (custos, estágio, pré-requisitos, formas) está espelhado em
 * `app/Sistemas/OnePiece/dados/haki.json` e conferido por teste; os textos, posições e efeitos ficam só aqui.
 *
 * Forma base, Forma Dominada (☆) e Forma Avançada (★): cada uma pode trazer `extras` (efeitos, usos, ações...) que
 * SUBSTITUEM os da forma anterior quando o talento é comprado naquela forma.
 */
import type { EfeitoBruto } from '../../../nucleo/efeitos/efeitos.ts';
import type { TracoDados } from '../construtor/dados/tipos.ts';

export type TipoHaki = 'armamento' | 'observacao' | 'rei';
export const TIPOS_HAKI: { id: TipoHaki; nome: string; sigla: string }[] = [
    { id: 'armamento', nome: 'Haki do Armamento', sigla: 'HdA' },
    { id: 'observacao', nome: 'Haki da Observação', sigla: 'HdO' },
    { id: 'rei', nome: 'Haki do Rei', sigla: 'HdR' },
];

/** 1 Inexperiente, 2 Treinado, 3 Perito (0 = Latente, sem PA distribuídos). */
export type EstagioHaki = 0 | 1 | 2 | 3;
export const NOMES_ESTAGIO = ['Latente', 'Inexperiente', 'Treinado', 'Perito'];

/** Os PA distribuídos que levam a cada estágio (1-20, 21-70, 71+). */
export const LIMITES_ESTAGIO: [number, number][] = [
    [1, 1],
    [21, 2],
    [71, 3],
];

/** O que uma forma do talento acrescenta à característica gerada (herda da forma anterior o que não redefinir). */
export type ExtrasDaForma = Partial<Pick<TracoDados, 'efeitos' | 'usos' | 'acoes' | 'acao' | 'tipo' | 'etiquetas' | 'reacao' | 'descanso'>> & {
    descanso?: 'curto' | 'longo';
};

export interface FormaDoTalento {
    texto: string;
    extras?: ExtrasDaForma;
}

export interface TalentoHaki {
    id: string;
    nome: string;
    tipo: TipoHaki;
    estagio: 1 | 2 | 3;
    /** PA por forma (0 no talento Rei, que vem de graça com o Haki do Rei). */
    custo: number;
    requisitos: string[];
    /** Linha de resumo mostrada na árvore (aba). */
    coluna?: string;
    base: FormaDoTalento;
    dominada?: FormaDoTalento;
    avancada?: FormaDoTalento;
    /** Posição do centro do nó no viewBox da árvore. */
    pos: { x: number; y: number };
}

const f = (texto: string, extras?: ExtrasDaForma): FormaDoTalento => ({ texto, ...(extras ? { extras } : {}) });
const ef = (alvo: string, modo: EfeitoBruto['modo'], valor?: number | string): EfeitoBruto => ({
    alvo,
    modo,
    ...(valor !== undefined ? { valor } : {}),
});

// ---------------------------------------------------------------------------------------------------------------------
// HAKI DO ARMAMENTO
// ---------------------------------------------------------------------------------------------------------------------
const ARMAMENTO: TalentoHaki[] = [
    {
        id: 'ataque-infuso',
        nome: 'Ataque Infuso',
        tipo: 'armamento',
        estagio: 1,
        custo: 5,
        requisitos: [],
        coluna: 'Ofensivo',
        pos: { x: 505, y: 125 },
        base: f(
            'Suas jogadas de ataque (Técnicas) e o dano das suas Técnicas Contundente, Cortante ou Perfurante (ou outro tipo, a critério do Narrador) afetam normalmente usuários de Akuma no Mi, ignorando o Aspecto Inato "Intangibilidade" e suas resistências e invulnerabilidades, exceto resistências não sobrenaturais comuns e as das Zoan (Comum, Ancestral ou Mítica). Nas jogadas de ataque (comum) vale para UMA forma de ataque à sua escolha: corpo a corpo desarmado, corpo a corpo com arma ou à distância.',
            { etiquetas: ['Ataques infusos: afetam usuários de Akuma no Mi'] },
        ),
        dominada: f('Você pode escolher uma forma de ataque adicional.'),
        avancada: f('Você pode escolher uma forma de ataque adicional.'),
    },
    {
        id: 'endurecimento-defensivo',
        nome: 'Endurecimento Defensivo',
        tipo: 'armamento',
        estagio: 1,
        custo: 5,
        requisitos: [],
        coluna: 'Defensivo',
        pos: { x: 985, y: 125 },
        base: f(
            'Você envolve o corpo com Haki e cria 20 Pontos de Escudo. Funcionam como PV temporários, mas: coexistem com PV temporários; são consumidos antes deles; renovam após 10 minutos fora de um encontro de combate. Outras características e Técnicas que interajam com PV temporários valem para os Pontos de Escudo, que têm resistência a dano Cortante, Perfurante e Contundente.',
            { efeitos: [ef('escudo.max', 'min', 20)] },
        ),
        dominada: f('Muda para 40 Pontos de Escudo.', { efeitos: [ef('escudo.max', 'min', 40)] }),
        avancada: f('Muda para 60 Pontos de Escudo.', { efeitos: [ef('escudo.max', 'min', 60)] }),
    },
    {
        id: 'endurecimento-ofensivo',
        nome: 'Endurecimento Ofensivo',
        tipo: 'armamento',
        estagio: 2,
        custo: 4,
        requisitos: ['ataque-infuso'],
        pos: { x: 370, y: 225 },
        base: f(
            'Qualquer jogada de ataque (comum) com dano Contundente, Cortante ou Perfurante (ou outro tipo, a critério do Narrador) recebe +1 de dano adicional.',
            {
                efeitos: [ef('dano.arma', 'soma', 1)],
            },
        ),
        dominada: f('Muda para 1d4 de dano extra.', { efeitos: [ef('dano.arma', 'dados', '1d4')] }),
        avancada: f('Muda para 1d6 de dano extra.', { efeitos: [ef('dano.arma', 'dados', '1d6')] }),
    },
    {
        id: 'chama-do-armamento',
        nome: 'Chama do Armamento',
        tipo: 'armamento',
        estagio: 2,
        custo: 2,
        requisitos: ['ataque-infuso', 'endurecimento-ofensivo'],
        pos: { x: 650, y: 285 },
        base: f('Ao usar "Endurecimento Ofensivo", você pode converter qualquer quantidade do dano adicional dele para o tipo Fogo.'),
        dominada: f(
            'Suas Técnicas não podem causar menos que metade do dano máximo possível, antes de reduções. Além disso, até metade do dano total da Técnica pode ter o tipo convertido para Fogo.',
        ),
        avancada: f(
            'Ao executar uma Técnica, role uma quantidade de dados adicionais igual ao grau dela (dobrados em acertos críticos). Aumentam o dano, mas o valor extra não passa do máximo possível: servem só para a Técnica alcançar seu potencial máximo.',
        ),
    },
    {
        id: 'emissao-defensiva',
        nome: 'Emissão Defensiva',
        tipo: 'armamento',
        estagio: 2,
        custo: 4,
        requisitos: ['endurecimento-defensivo'],
        pos: { x: 840, y: 285 },
        base: f(
            'Ao ser alvo de uma jogada de ataque (comum ou Técnicas) ou de Salvaguardas de Força ou Destreza, use a reação para emitir uma barreira de Haki: uma onda defensiva à sua frente e um cone de 6 m atrás de você, que protege você e todas as criaturas na área anulando todo o dano daquele ataque ou Técnica. Só volta após um descanso longo.',
            { acao: 'reacao', usos: { max: 1, descanso: 'longo' } },
        ),
        dominada: f('Passa a ser recuperada também em descansos curtos.', { usos: { max: 1, descanso: 'curto' } }),
        avancada: f(
            'Alternativamente, ao ser alvo de um ataque (comum ou Técnicas) corpo a corpo, repele o ataque antes que ocorra, cancelando-o e encerrando imediatamente o turno da criatura atacante.',
        ),
    },
    {
        id: 'escudo-de-vontade',
        nome: 'Escudo de Vontade',
        tipo: 'armamento',
        estagio: 2,
        custo: 4,
        requisitos: ['endurecimento-defensivo'],
        pos: { x: 1130, y: 225 },
        base: f(
            'Você canaliza o Haki como barreira contra os efeitos sobrenaturais das Akuma no Mi. Com uma ação, faça uma Salvaguarda de Vontade CD 21: em caso de sucesso, desfaz qualquer característica ou efeito ativo de uma Akuma no Mi que afete diretamente o seu corpo, exceto os que causam só dano.',
            { acao: 'padrao', acoes: [{ rotulo: 'Salvaguarda de Vontade (CD 21)', tipo: 'rolar', rolagem: '1d20+@salv.von', acao: 'padrao' }] },
        ),
        dominada: f('Pode ser usado como ação bônus ou reação (ao ser afetado pela Akuma no Mi), gastando 2 PP. A CD da Salvaguarda passa a 17.', {
            acao: 'bonus',
            acoes: [{ rotulo: 'Salvaguarda de Vontade (CD 17, 2 PP)', tipo: 'rolar', rolagem: '1d20+@salv.von', acao: 'bonus' }],
        }),
        avancada: f('Ao usar como reação ao sofrer dano de Técnicas originadas de Akuma no Mi, você também reduz esse dano pela metade.'),
    },
    {
        id: 'emissao-ofensiva',
        nome: 'Emissão Ofensiva',
        tipo: 'armamento',
        estagio: 2,
        custo: 3,
        requisitos: ['endurecimento-ofensivo'],
        pos: { x: 370, y: 340 },
        base: f(
            'O Haki se projeta além do corpo: o alcance das suas jogadas de ataque (comum ou Técnicas) corpo a corpo aumenta em 1,5 m. Além disso, quando o d20 de um ataque (comum) for 18 ou 19 (sem ser crítico), o dano é o valor máximo possível dos dados de dano. Outros efeitos de dano não são afetados, exceto "Endurecimento Ofensivo".',
            { efeitos: [ef('alcance.corpo', 'soma', 15)], etiquetas: ['d20 18-19: dano máximo dos dados'] },
        ),
        dominada: f('O efeito passa a funcionar em resultados de 16 a 19 (sem ser acerto crítico).', {
            etiquetas: ['d20 16-19: dano máximo dos dados'],
        }),
        avancada: f('O efeito passa a funcionar em resultados de 14 a 19 (sem ser acerto crítico).', {
            etiquetas: ['d20 14-19: dano máximo dos dados'],
        }),
    },
    {
        id: 'corpo-armadurado',
        nome: 'Corpo Armadurado',
        tipo: 'armamento',
        estagio: 2,
        custo: 4,
        requisitos: ['escudo-de-vontade'],
        pos: { x: 1155, y: 340 },
        base: f(
            'Você envolve todo o corpo com Haki e fortalece sua aura. Com uma ação bônus, por 1 minuto, qualquer Salvaguarda que fizer recebe +2 no resultado. Só volta após um descanso longo.',
            {
                tipo: 'ativa',
                acao: 'bonus',
                usos: { max: 1, descanso: 'longo' },
                efeitos: [ef('salv.*', 'soma', 2)],
            },
        ),
        dominada: f(
            'Enquanto ativo, os Pontos de Escudo de "Endurecimento Defensivo" também têm resistência a todos os outros tipos de dano (exceto Verdadeiro).',
        ),
        avancada: f('Enquanto ativo, o dado de "Endurecimento Ofensivo" aumenta em um passo (1 → 1d4 → 1d6 → 1d8).'),
    },
    {
        id: 'destruicao-interna',
        nome: 'Destruição Interna',
        tipo: 'armamento',
        estagio: 3,
        custo: 5,
        requisitos: ['emissao-ofensiva'],
        pos: { x: 505, y: 455 },
        base: f(
            'Suas jogadas de ataque (comum ou Técnicas) que causem dano Contundente, Cortante ou Perfurante (ou outro tipo, a critério do Narrador) passam a causar dano do tipo "Verdadeiro".',
            {
                etiquetas: ['Ataques causam dano Verdadeiro'],
            },
        ),
        dominada: f('Você pode escolher uma característica da Maestria "Armamento Máximo" ou "Imaculado", sem receber os possíveis PA dela.'),
    },
    {
        id: 'armadura-suprema',
        nome: 'Armadura Suprema',
        tipo: 'armamento',
        estagio: 3,
        custo: 6,
        requisitos: ['emissao-defensiva'],
        pos: { x: 860, y: 455 },
        base: f(
            'Sempre que receber dano de uma jogada de ataque (comum) corpo a corpo, a criatura atacante que não tenha o talento "Emissão Ofensiva" recebe 1d10 de dano Contundente.',
            {
                etiquetas: ['Quem te ataca corpo a corpo sofre 1d10 (sem Emissão Ofensiva)'],
            },
        ),
        dominada: f(
            'Enquanto puder usar o Haki do Armamento, você é imune aos efeitos de acertos críticos em ataques (comum), recebendo o dano normal.',
            {
                etiquetas: ['Imune a efeitos de acertos críticos'],
            },
        ),
        avancada: f(
            'Os Pontos de Escudo de "Endurecimento Defensivo" aumentam para 80 (em sua Forma Avançada) e você recebe +40 PV máximos permanentes.',
            {
                efeitos: [ef('pv.max', 'soma', 40), ef('escudo.max', 'min', 80)],
            },
        ),
    },
    {
        id: 'defesa-suprema',
        nome: 'Defesa Suprema',
        tipo: 'armamento',
        estagio: 3,
        custo: 3,
        requisitos: ['emissao-defensiva', 'corpo-armadurado'],
        pos: { x: 1085, y: 455 },
        base: f(
            'Ao sofrer dano, gaste 2 PP e use a reação para manter qualquer resistência ou invulnerabilidade, exceto contra dano "Verdadeiro", em um efeito absoluto que supera qualquer outro efeito.',
            {
                acao: 'reacao',
            },
        ),
        dominada: f('Você não gasta mais PP ao usar esta característica e o efeito dura até o início do seu próximo turno.'),
        avancada: f('Você pode executar uma jogada de ataque (comum) como parte dessa mesma reação.'),
    },
];

// ---------------------------------------------------------------------------------------------------------------------
// HAKI DA OBSERVAÇÃO
// ---------------------------------------------------------------------------------------------------------------------
const OBSERVACAO: TalentoHaki[] = [
    {
        id: 'perceber-emocoes',
        nome: 'Perceber Emoções',
        tipo: 'observacao',
        estagio: 1,
        custo: 2,
        requisitos: [],
        coluna: 'Sensorial',
        pos: { x: 300, y: 120 },
        base: f(
            'Você percebe instantaneamente a disposição de uma criatura em relação a você, até 6 m e visível. Sem teste, identifica se a postura dela é hostil, neutra ou amigável.',
        ),
        dominada: f('Vantagem em Testes de Atributo de Presença ao interagir com criaturas amigáveis.'),
        avancada: f('Vantagem em Testes de Atributo de Presença ao interagir com criaturas neutras.'),
    },
    {
        id: 'antecipacao',
        nome: 'Antecipação',
        tipo: 'observacao',
        estagio: 1,
        custo: 5,
        requisitos: [],
        coluna: 'Precavido',
        pos: { x: 540, y: 120 },
        base: f(
            'Ao usar uma característica que dependa do acerto de um ataque (comum ou Técnicas), ser alvo de um ataque ou precisar de uma Salvaguarda, você pode ativá-la só depois de saber se o ataque ou efeito foi bem-sucedido, sem desperdiçar PP, usos limitados ou outros recursos.',
            { etiquetas: ['Ativa características depois de saber o resultado'] },
        ),
        dominada: f('Ao sofrer dano, você pode perguntar ao Narrador o valor exato antes de decidir se usará suas características.'),
        avancada: f(
            'Se a sua reação não causar nem reduzir dano nem produzir outro efeito, você recupera o uso da reação ao fim do turno em que foi usada.',
        ),
    },
    {
        id: 'antevisao',
        nome: 'Antevisão',
        tipo: 'observacao',
        estagio: 1,
        custo: 4,
        requisitos: [],
        coluna: 'Defensivo',
        pos: { x: 815, y: 120 },
        base: f(
            'Com uma ação bônus e mantendo a Concentração, sua CR aumenta em +1 enquanto durar (nenhuma ação para encerrar). Alternativamente, se não mantiver Concentração com esta habilidade, ao ser alvo de um ataque (comum), use a reação para +2 de CR até o início do seu próximo turno.',
            {
                tipo: 'ativa',
                acao: 'bonus',
                efeitos: [ef('ca', 'soma', 1)],
                reacao: { gatilho: 'ataque_declarado', alcance: 'si', defesa: 2, categoria: 'reacao' },
            },
        ),
        dominada: f('O bônus passa a +2 na CR na forma padrão e +3 na alternativa.', {
            efeitos: [ef('ca', 'soma', 2)],
            reacao: { gatilho: 'ataque_declarado', alcance: 'si', defesa: 3, categoria: 'reacao' },
        }),
        avancada: f('O bônus passa a +3 na CR na forma padrão e +4 na alternativa.', {
            efeitos: [ef('ca', 'soma', 3)],
            reacao: { gatilho: 'ataque_declarado', alcance: 'si', defesa: 4, categoria: 'reacao' },
        }),
    },
    {
        id: 'previsao',
        nome: 'Previsão',
        tipo: 'observacao',
        estagio: 1,
        custo: 3,
        requisitos: [],
        coluna: 'Ofensivo',
        pos: { x: 1090, y: 120 },
        base: f('Ao prever os movimentos do inimigo, seus ataques ficam mais precisos: +1 de bônus nas jogadas de ataque (comum ou Técnicas).', {
            efeitos: [ef('ataque.arma', 'soma', 1), ef('ataque', 'soma', 1)],
        }),
        dominada: f('O bônus passa a +2.', { efeitos: [ef('ataque.arma', 'soma', 2), ef('ataque', 'soma', 2)] }),
        avancada: f('O bônus passa a +3.', { efeitos: [ef('ataque.arma', 'soma', 3), ef('ataque', 'soma', 3)] }),
    },
    {
        id: 'perceber-presenca',
        nome: 'Perceber Presença',
        tipo: 'observacao',
        estagio: 2,
        custo: 2,
        requisitos: ['perceber-emocoes'],
        pos: { x: 300, y: 235 },
        base: f(
            'Com uma ação e mantendo a Concentração, você sente a presença de criaturas vivas em até 6 m: percepção às cegas nessa área e vê as presenças como auras, mesmo invisíveis ou ocultas.',
            {
                acao: 'padrao',
            },
        ),
        dominada: f('A distância aumenta para 12 m.'),
        avancada: f(
            'Você percebe o estado físico (vivo, morto, ferido ou saudável) de qualquer criatura que conheça dentro da ilha em que estiver (fora de uma ilha, o Narrador define a área). Regra opcional (Percepção Ilimitada): com a aprovação do Narrador, escolha este talento de novo quantas vezes quiser, gastando 2 PA cada vez; o alcance dobra a cada nova escolha.',
        ),
    },
    {
        id: 'perceber-desafio',
        nome: 'Perceber Desafio',
        tipo: 'observacao',
        estagio: 2,
        custo: 1,
        requisitos: ['perceber-presenca'],
        pos: { x: 300, y: 345 },
        base: f(
            'Uma vez por encontro, use a ação para focar em uma criatura a até 6 m: você sente o nível de ameaça dela e o Narrador revela um valor aproximado do ND ou dos PV do alvo.',
            {
                acao: 'padrao',
                usos: { max: 1, descanso: 'curto' },
            },
        ),
        dominada: f(
            'Você percebe a presença de qualquer criatura poderosa (ND acima do seu nível de personagem ou assim definida pelo Narrador) dentro, ou que entre, na ilha em que estiver (fora de uma ilha, o Narrador define a área).',
        ),
    },
    {
        id: 'perceber-o-futuro',
        nome: 'Perceber o Futuro',
        tipo: 'observacao',
        estagio: 3,
        custo: 4,
        requisitos: ['perceber-desafio'],
        pos: { x: 300, y: 455 },
        base: f(
            'Fora de um encontro de combate, você pode pedir ao Narrador uma visão dos próximos 30 segundos. Cuidado: os eventos previstos podem ser enganosos ou incompletos e mudar conforme as ações dos jogadores.',
        ),
        dominada: f('Você passa a enxergar até 2 minutos no futuro.'),
        avancada: f('Você passa a enxergar até 10 minutos no futuro.'),
    },
    {
        id: 'clarividencia',
        nome: 'Clarividência',
        tipo: 'observacao',
        estagio: 2,
        custo: 2,
        requisitos: ['antecipacao'],
        pos: { x: 540, y: 235 },
        base: f(
            'Quando uma Técnica que exija jogada de ataque (comum ou Técnicas) não afetar nenhuma criatura, ambiente, estrutura ou objeto, você gasta só metade do custo em PP (arredondado para cima).',
        ),
        dominada: f('Você pode escolher não gastar nenhum PP quando a Técnica não afetar nada. Até 3 usos; todos voltam após um descanso longo.', {
            usos: { max: 3, descanso: 'longo' },
        }),
        avancada: f(
            'A Forma Dominada também vale para Técnicas que imponham Salvaguardas, desde que não afetem nenhuma criatura, ambiente, estrutura ou objeto.',
        ),
    },
    {
        id: 'vidente',
        nome: 'Vidente',
        tipo: 'observacao',
        estagio: 2,
        custo: 2,
        requisitos: ['clarividencia'],
        pos: { x: 540, y: 345 },
        base: f(
            'No início de cada dia (após um descanso longo), role 1d20 e anote o resultado. Até o próximo descanso longo, quando você ou uma criatura que veja fizer um Teste de Atributo ou Salvaguarda, pode substituir o resultado pelo valor guardado (depois de rolar o d20 e antes de saber se foi bem-sucedido). O valor guardado é consumido.',
            { usos: { max: 1, descanso: 'longo' }, acoes: [{ rotulo: 'Rolar o dado do dia', tipo: 'rolar', rolagem: '1d20', usa: true }] },
        ),
        dominada: f('Você passa a rolar e guardar 2 dados por descanso longo.', { usos: { max: 2, descanso: 'longo' } }),
    },
    {
        id: 'premonicao',
        nome: 'Premonição',
        tipo: 'observacao',
        estagio: 3,
        custo: 2,
        requisitos: ['vidente'],
        pos: { x: 462, y: 455 },
        base: f(
            'Sua conexão com o futuro é tão intensa que o tempo não o surpreende: você não pode ser surpreendido, não rola iniciativa e sempre age primeiro na ordem de turnos (com várias criaturas assim, o Narrador decide quem age primeiro).',
            {
                efeitos: [ef('iniciativa', 'min', 100)],
                etiquetas: ['Não é surpreendido; age primeiro'],
            },
        ),
    },
    {
        id: 'ver-o-futuro',
        nome: 'Ver o Futuro',
        tipo: 'observacao',
        estagio: 3,
        custo: 5,
        requisitos: ['vidente'],
        pos: { x: 612, y: 455 },
        base: f(
            'Ao falhar em uma Salvaguarda ou jogada de ataque (comum), você pode tratá-la como um sucesso. Até 3 usos; todos voltam após um descanso longo.',
            {
                usos: { max: 3, descanso: 'longo' },
                acoes: [{ rotulo: 'Tratar como sucesso', tipo: 'gastar', usa: true, acao: 'livre' }],
            },
        ),
    },
    {
        id: 'passo-antecipado',
        nome: 'Passo Antecipado',
        tipo: 'observacao',
        estagio: 2,
        custo: 2,
        requisitos: ['antevisao'],
        pos: { x: 735, y: 235 },
        base: f(
            'Uma vez por rodada, você ignora uma jogada de ataque (comum) provocada pelo seu deslocamento, mesmo que o ataque ignore esse tipo de característica, como "Ataque de Oportunidade Superior".',
            {
                etiquetas: ['1×/rodada: ignora um ataque de oportunidade'],
            },
        ),
    },
    {
        id: 'antevisao-sobrenatural',
        nome: 'Antevisão Sobrenatural',
        tipo: 'observacao',
        estagio: 2,
        custo: 3,
        requisitos: ['antevisao'],
        pos: { x: 885, y: 235 },
        base: f(
            'Quando for alvo de um efeito que exige Salvaguarda de Destreza para sofrer metade do dano, você não sofre dano se passar e só metade se falhar.',
            {
                etiquetas: ['Salv. DES: passa = 0 de dano, falha = metade'],
            },
        ),
    },
    {
        id: 'antecipar-movimentos',
        nome: 'Antecipar Movimentos',
        tipo: 'observacao',
        estagio: 3,
        custo: 4,
        requisitos: ['passo-antecipado'],
        pos: { x: 735, y: 345 },
        base: f(
            'Gaste 2 PP no momento em que uma criatura a até 1,5 m tentar se levantar, escalar, saltar ou usar a reação: você a impede fisicamente, sem gastar ação. Uma vez por rodada em cada criatura. O deslocamento dela cai a 0 até o início do próximo turno dela e os recursos e ações da tentativa são consumidos.',
        ),
    },
    {
        id: 'antevisao-especial',
        nome: 'Antevisão Especial',
        tipo: 'observacao',
        estagio: 3,
        custo: 5,
        requisitos: ['antevisao-sobrenatural'],
        pos: { x: 885, y: 345 },
        base: f('Jogadas de ataque (comum) feitas contra você por criaturas sem Haki da Observação recebem desvantagem.', {
            etiquetas: ['Ataques (comum) de quem não tem HdO: desvantagem'],
        }),
        dominada: f('Você faz Salvaguardas de Destreza com vantagem contra essas mesmas criaturas.', { efeitos: [ef('salv.des', 'vantagem')] }),
    },
    {
        id: 'antevisao-profetica',
        nome: 'Antevisão Profética',
        tipo: 'observacao',
        estagio: 3,
        custo: 5,
        requisitos: ['antecipar-movimentos', 'antevisao-especial'],
        pos: { x: 815, y: 455 },
        base: f(
            'Uma vez por rodada, ao realizar uma Técnica ou característica com a sua reação, execute outra (com requisito de reação) como parte da mesma reação. A nova não pode ser repetição da anterior nem causar dano. Só volta após um descanso longo.',
            {
                usos: { max: 1, descanso: 'longo' },
            },
        ),
        dominada: f('Passa a poder ser usada até 3 vezes; todos os usos voltam após um descanso longo.', { usos: { max: 3, descanso: 'longo' } }),
        avancada: f('Passa a poder ser usada até 5 vezes; todos os usos voltam após um descanso curto ou longo.', {
            usos: { max: 5, descanso: 'curto' },
        }),
    },
    {
        id: 'previsao-sobrenatural',
        nome: 'Previsão Sobrenatural',
        tipo: 'observacao',
        estagio: 2,
        custo: 2,
        requisitos: ['previsao'],
        pos: { x: 1090, y: 235 },
        base: f(
            'Quando nenhuma criatura, ambiente, estrutura ou objeto for afetado pela execução de uma Técnica sua, você acumula 1 dado de dano/cura extraordinário para uma Técnica posterior (até 5, até o fim do encontro). Esses dados só servem para atingir o valor máximo do efeito, nunca para ultrapassá-lo.',
        ),
        dominada: f('Você pode consumir esses dados para recuperar 1 PP por dado.'),
        avancada: f('Você pode consumir esses dados para recuperar 2 PP por dado.'),
    },
    {
        id: 'impeto-antecipado',
        nome: 'Ímpeto Antecipado',
        tipo: 'observacao',
        estagio: 3,
        custo: 5,
        requisitos: ['previsao-sobrenatural'],
        pos: { x: 1010, y: 345 },
        base: f(
            'Ao usar uma Técnica de Combate que cause dano direto a uma criatura e exija Ação Poderosa, faça uma jogada de ataque (comum) adicional contra o alvo como parte da mesma Ação Poderosa. Até 3 usos; voltam após um descanso longo (não acumula com "Ímpeto Desperto", das Akuma no Mi).',
            {
                usos: { max: 3, descanso: 'longo' },
            },
        ),
        dominada: f('Esta característica passa a não ter limite de uso.', { usos: undefined }),
    },
    {
        id: 'previsao-especial',
        nome: 'Previsão Especial',
        tipo: 'observacao',
        estagio: 3,
        custo: 5,
        requisitos: ['previsao-sobrenatural'],
        pos: { x: 1155, y: 345 },
        base: f(
            'Ao realizar uma jogada de ataque (comum), você ignora qualquer reação que seria ativada por esse ataque e a criatura alvo perde o uso da reação até o início do próximo turno dela.',
        ),
        dominada: f('Você pode escolher uma característica qualquer da Maestria "Profeta" ou "Imaculado", sem receber os possíveis PA dela.'),
    },
    {
        id: 'previsao-profetica',
        nome: 'Previsão Profética',
        tipo: 'observacao',
        estagio: 3,
        custo: 5,
        requisitos: ['impeto-antecipado', 'previsao-especial'],
        pos: { x: 1090, y: 455 },
        base: f(
            'Ao realizar uma Técnica ou característica com a sua ação bônus, execute outra (com requisito de ação bônus) como parte da mesma ação bônus. A nova não pode ser repetição da anterior nem causar dano. Só volta após um descanso longo.',
            {
                usos: { max: 1, descanso: 'longo' },
            },
        ),
        dominada: f('Passa a poder ser usada até 3 vezes; todos os usos voltam após um descanso longo.', { usos: { max: 3, descanso: 'longo' } }),
        avancada: f('Passa a poder ser usada até 5 vezes; todos os usos voltam após um descanso curto ou longo.', {
            usos: { max: 5, descanso: 'curto' },
        }),
    },
];

// ---------------------------------------------------------------------------------------------------------------------
// HAKI DO REI
// ---------------------------------------------------------------------------------------------------------------------
const REI: TalentoHaki[] = [
    {
        id: 'rei',
        nome: 'Rei',
        tipo: 'rei',
        estagio: 1,
        custo: 0,
        requisitos: [],
        pos: { x: 780, y: 120 },
        base: f(
            'Ao ser revelado que o personagem tem o Haki do Rei, ele recebe imediatamente, sem pré-requisitos: Presença Real (em estresse extremo, libera involuntariamente uma onda de vontade em 9 m, conforme "Desmaiando Inimigos"); Carisma do Conquistador (+2 em Vontade e o limite de características que aumentam esse atributo passa a ser 26, no mínimo); Ambição Crescente (+2 PA no 10º nível e +2 a cada nível depois; adquirido depois do 10º, recebe retroativamente todos); Espírito Selvagem (vantagem em Testes de Vontade contra animais, exceto lendários e abissais).',
            {
                efeitos: [ef('atributos.von', 'soma', 2)],
                etiquetas: ['Vontade +2 (limite 26)', 'Ambição Crescente: +2 PA por nível a partir do 10º'],
            },
        ),
    },
    {
        id: 'autoridade-do-rei',
        nome: 'Autoridade do Rei',
        tipo: 'rei',
        estagio: 2,
        custo: 3,
        requisitos: ['rei'],
        pos: { x: 570, y: 225 },
        base: f(
            'Com uma ação, você impõe sua vontade a uma criatura a até 18 m, que faz uma Salvaguarda de Vontade. Se falhar, você escolhe: "Amedrontado" até o fim do próximo turno dela ou inconsciente, conforme "Desmaiando Inimigos".',
            { acao: 'padrao' },
        ),
        dominada: f('Você pode usar este talento com uma ação bônus.', { acao: 'bonus' }),
        avancada: f('Você pode usar este talento como reação ao ser alvo de uma jogada de ataque (comum).', { acao: 'reacao' }),
    },
    {
        id: 'soberania-do-rei',
        nome: 'Soberania do Rei',
        tipo: 'rei',
        estagio: 2,
        custo: 3,
        requisitos: ['autoridade-do-rei'],
        pos: { x: 490, y: 335 },
        base: f(
            'Com uma ação, por até 1 minuto, você libera uma onda que amedronta ou desmaia as criaturas de sua escolha em 15 m, conforme "Desmaiando Inimigos". Quem passar na Salvaguarda e ainda for suscetível ao desmaio sofre efeitos colaterais: dentro da área, cada 1,5 m de deslocamento custa 1,5 m adicional. Desativar não requer ação.',
            { acao: 'padrao' },
        ),
        dominada: f('O alcance do talento aumenta para 30 m.'),
        avancada: f('O alcance do talento aumenta para 60 m.'),
    },
    {
        id: 'superacao-majestosa',
        nome: 'Superação Majestosa',
        tipo: 'rei',
        estagio: 2,
        custo: 6,
        requisitos: ['rei'],
        pos: { x: 698, y: 290 },
        base: f(
            'Com uma ação bônus, você recupera 1 uso de uma característica que tenha usos limitados por dia ou que volte após descanso curto ou longo (exceto este talento). Só volta após um descanso longo.',
            {
                acao: 'bonus',
                usos: { max: 1, descanso: 'longo' },
            },
        ),
        dominada: f('Você pode usar este talento duas vezes antes de um descanso longo.', { usos: { max: 2, descanso: 'longo' } }),
    },
    {
        id: 'imposicao-do-rei',
        nome: 'Imposição do Rei',
        tipo: 'rei',
        estagio: 2,
        custo: 4,
        requisitos: ['rei'],
        pos: { x: 858, y: 290 },
        base: f(
            'Ao acertar uma jogada de ataque (comum ou Técnicas), você pode derrotar instantaneamente criaturas com ND 2 ou inferior suscetíveis ao desmaio ("Desmaiando Inimigos"): ficam com 0 PV, como num colapso mental.',
        ),
        dominada: f('O ND máximo das criaturas afetadas aumenta para 4.'),
        avancada: f('O ND máximo das criaturas afetadas aumenta para 6.'),
    },
    {
        id: 'vontade-do-rei',
        nome: 'Vontade do Rei',
        tipo: 'rei',
        estagio: 2,
        custo: 6,
        requisitos: ['rei'],
        pos: { x: 1010, y: 225 },
        base: f(
            'Ao ser derrotado e cair inconsciente com 0 PV, após o seu 5º turno desacordado, você pode recuperar todos os PV e metade dos PP, voltando à batalha. Dois minutos depois, fica "Paralisado" por 1 hora e com 5 Níveis de Exaustão, recuperando 1 por descanso longo (com tempo dobrado) até não ter nenhum.',
        ),
        dominada: f('Você pode terminar os descansos longos no tempo normal.'),
        avancada: f('O período de inconsciência é reduzido para 2 turnos.'),
    },
    {
        id: 'presenca-esmagadora',
        nome: 'Presença Esmagadora',
        tipo: 'rei',
        estagio: 3,
        custo: 5,
        requisitos: ['soberania-do-rei', 'superacao-majestosa'],
        pos: { x: 560, y: 450 },
        base: f(
            'Qualquer criatura hostil sem Haki do Rei que comece o turno a até 3 m de você deve passar em uma Salvaguarda de Vontade ou sofrer 2d6 de dano Psíquico.',
        ),
        dominada: f('Você pode escolher uma característica qualquer da Maestria "Ambição Suprema" ou "Imaculado", sem receber os possíveis PA dela.'),
        avancada: f(
            'Ao realizar uma Técnica contra um único alvo, adicione ao dano dados extras iguais ao ND da criatura. Só volta após um descanso longo e não surte efeito em criaturas sem ND.',
            {
                usos: { max: 1, descanso: 'longo' },
            },
        ),
    },
    {
        id: 'armamento-do-rei',
        nome: 'Armamento do Rei',
        tipo: 'rei',
        estagio: 3,
        custo: 7,
        requisitos: ['imposicao-do-rei'],
        pos: { x: 840, y: 450 },
        base: f(
            'Você combina o Haki do Rei com o do Armamento. Uma vez por turno, ao fazer uma jogada de ataque (comum), gaste 3 PP para transformá-la em acerto crítico automático e fazer todos os dados de dano causarem o valor máximo.',
        ),
        dominada: f('De forma passiva, os PV perdidos pelo dano dos seus ataques não podem ser recuperados de nenhuma forma até o fim do encontro.'),
        avancada: f(
            'De forma passiva, condições causadas por você com duração predefinida não podem ser encerradas antecipadamente por Salvaguardas ou outras características.',
        ),
    },
    {
        id: 'emissao-de-autoridade',
        nome: 'Emissão de Autoridade',
        tipo: 'rei',
        estagio: 3,
        custo: 5,
        requisitos: ['imposicao-do-rei', 'vontade-do-rei'],
        pos: { x: 1040, y: 450 },
        base: f(
            'Com uma ação, escolha uma criatura a até 120 m que você veja ou sinta pelo Haki da Observação: ela faz uma Salvaguarda de Vontade CD 18. Se passar, tem desvantagem em uma jogada à sua escolha até o fim do próximo turno dela. Se falhar, no próximo turno dela o deslocamento é 0 e ela escolhe entre Ação, Ação Poderosa ou Ação Bônus (só uma delas).',
            {
                acao: 'padrao',
            },
        ),
    },
];

export const TALENTOS_HAKI: TalentoHaki[] = [...ARMAMENTO, ...OBSERVACAO, ...REI];
export const talentoPorId = (id: string | null | undefined): TalentoHaki | undefined => TALENTOS_HAKI.find((t) => t.id === id);
export const talentosDoTipo = (tipo: TipoHaki): TalentoHaki[] => TALENTOS_HAKI.filter((t) => t.tipo === tipo);

/** Quantas formas o talento tem (1 base, +1 dominada, +1 avançada). */
export const formasDoTalento = (t: TalentoHaki): number => 1 + (t.dominada ? 1 : 0) + (t.avancada ? 1 : 0);

// --- desenho das árvores ----------------------------------------------------------------------------------------------

export interface DesenhoDaArvore {
    largura: number;
    altura: number;
    /** Linhas que separam os estágios (da esquerda para a direita); a região abaixo de cada uma é daquele estágio. */
    treinado: [number, number][];
    perito: [number, number][];
    /** Rótulos das colunas (Sensorial, Ofensivo...) com a posição x. */
    colunas: { rotulo: string; x: number }[];
}

export const DESENHOS: Record<TipoHaki, DesenhoDaArvore> = {
    armamento: {
        largura: 1246,
        altura: 506,
        treinado: [
            [0, 215],
            [305, 215],
            [330, 172],
            [1246, 172],
        ],
        perito: [
            [0, 420],
            [430, 420],
            [460, 392],
            [1246, 392],
        ],
        colunas: [
            { rotulo: 'Ofensivo', x: 520 },
            { rotulo: 'Defensivo', x: 975 },
        ],
    },
    observacao: {
        largura: 1238,
        altura: 507,
        treinado: [
            [0, 205],
            [225, 205],
            [250, 172],
            [1238, 172],
        ],
        perito: [
            [0, 395],
            [640, 395],
            [685, 285],
            [1238, 285],
        ],
        colunas: [
            { rotulo: 'Sensorial', x: 300 },
            { rotulo: 'Precavido', x: 540 },
            { rotulo: 'Defensivo', x: 815 },
            { rotulo: 'Ofensivo', x: 1090 },
        ],
    },
    rei: {
        largura: 1165,
        altura: 507,
        treinado: [
            [0, 215],
            [475, 215],
            [515, 175],
            [1165, 175],
        ],
        perito: [
            [0, 420],
            [475, 420],
            [515, 392],
            [1165, 392],
        ],
        colunas: [],
    },
};

/** As cordas da árvore: de cada pré-requisito para o talento. */
export const arestasDoTipo = (tipo: TipoHaki): { de: string; para: string }[] =>
    talentosDoTipo(tipo).flatMap((t) => t.requisitos.map((r) => ({ de: r, para: t.id })));

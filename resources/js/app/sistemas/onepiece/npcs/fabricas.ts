// Fábricas dos textos que se repetem entre as fichas do catálogo. `s` é o sujeito do texto ("pirata" ou "marinheiro").
import type { AtaqueNpc, AtributoNpc, TecnicaNpc, TextoNpc, UsosNpc } from './tipos';

export const dia = (max: number): UsosNpc => ({ max, periodo: 'dia' });
export const recarga = (r = '5-6'): UsosNpc => ({ recarga: r });

const CCP = ['Contundente', 'Cortante', 'Perfurante'];
export { CCP };

// --- ataques ---
export const corpo = (nome: string, bonus: number, dano: string, tipoDano: string, arma = true, alcance = 1.5): AtaqueNpc => ({
    nome,
    tipo: 'corpo',
    arma,
    bonus,
    alcance,
    dano,
    tipoDano,
});
export const distancia = (nome: string, bonus: number, normal: number, maximo: number, dano: string, tipoDano: string): AtaqueNpc => ({
    nome,
    tipo: 'distancia',
    arma: true,
    bonus,
    alcance: [normal, maximo],
    dano,
    tipoDano,
});
export const desarmado = (bonus: number, dano: string): AtaqueNpc => corpo('Ataque Desarmado', bonus, dano, 'Contundente', false);
export const sabre = (bonus: number, dano: string): AtaqueNpc => corpo('Sabre', bonus, dano, 'Cortante');
export const katana = (bonus: number, dano: string): AtaqueNpc => corpo('Katana', bonus, dano, 'Cortante');
export const pistola = (bonus: number, dano: string, tipoDano = 'Contundente'): AtaqueNpc => distancia('Pistola', bonus, 9, 15, dano, tipoDano);
export const mosquete = (bonus: number, dano: string): AtaqueNpc => distancia('Mosquete', bonus, 18, 24, dano, 'Contundente');

// --- técnicas de combate ---
export const golpe = (
    nome: string,
    grau: number,
    pp: number,
    tipo: 'corpo' | 'distancia',
    bonus: number,
    alcance: number,
    dano: string,
    tipoDano: string[],
    extra: { usos?: UsosNpc; efeito?: string; critico?: number } = {},
): TecnicaNpc => ({ nome, grau, pp, modo: 'ataque', ataque: { tipo, bonus }, alcance, dano, tipoDano, ...extra });
export const cone = (
    nome: string,
    grau: number,
    pp: number,
    alcance: number,
    dano: string,
    tipoDano: string[],
    atributo: AtributoNpc,
    cd: number,
    usos?: UsosNpc,
): TecnicaNpc => ({
    nome,
    grau,
    pp,
    modo: 'area',
    alcance,
    area: { forma: 'cone' },
    dano,
    tipoDano,
    salvaguarda: { atributo, cd, metade: true },
    ...(usos ? { usos } : {}),
});
export const linha = (
    nome: string,
    grau: number,
    pp: number,
    modo: 'area' | 'alvo',
    comprimento: number,
    largura: number | undefined,
    dano: string,
    tipoDano: string[],
    atributo: AtributoNpc,
    cd: number,
): TecnicaNpc => ({
    nome,
    grau,
    pp,
    modo,
    alcance: comprimento,
    area: { forma: 'linha', ...(largura ? { largura } : {}) },
    dano,
    tipoDano,
    salvaguarda: { atributo, cd, metade: true },
});

// --- aspectos, reações e ações bônus recorrentes ---
const t = (nome: string, texto: string, mais: Partial<TextoNpc> = {}): TextoNpc => ({ nome, texto, ...mais });
const DADOS = ['', 'um dado extra', 'dois dados extras', 'três dados extras'];

export const asp = {
    evasao: (s: string) =>
        t(
            'Evasão',
            `Se o ${s} for alvo de um efeito que permita que ele realize uma Salvaguarda para sofrer apenas metade do dano, ele não recebe nenhum dano se for bem-sucedido na Salvaguarda e recebe apenas metade do dano se fracassar.`,
        ),
    bucaneiro: (s: string, n: 1 | 2 | 3) =>
        t('Bucaneiro', `Um ataque com arma ou desarmado causa ${DADOS[n]} de dano quando o ${s} atinge com ele (incluso no ataque).`),
    treino: (s: string, n: 1 | 2 | 3) =>
        t(
            'Treino de Combate',
            `Um ataque com arma ou desarmado causa ${n === 1 ? 'um dado extra' : n === 2 ? 'dois dados extra' : 'três dados extra'} de dano quando o ${s} atinge com ele (incluso no ataque).`,
        ),
    crueldade: (s: string, dano: string) =>
        t('Crueldade Inata', `Uma vez por turno, o ${s} pode causar ${dano} de dano extra a uma criatura que ele atinja, com um ataque.`),
    corpoResistente: (s: string) =>
        t(
            'Corpo Resistente',
            `O ${s} tem vantagem em Salvaguardas contra as condições “Amedrontado”, “Atordoado”, “Enfeitiçado”, “Envenenado”, “Paralisado” ou “Sonolento”.`,
        ),
    recuperacao: (s: string, pv: number) =>
        t('Recuperação', `O ${s} recupera ${pv} Pontos de Vida, no início de cada um dos seus turnos, se possuir 1 Ponto de Vida, no mínimo.`),
    reflexo: (s: string) =>
        t(
            'Reflexo',
            `O ${s} possui grande velocidade de reação, fazendo as jogadas de ataque contra ele terem desvantagem. Se ele for atingido por um ataque, esse traço é interrompido até o final do próximo turno dele. Esse traço também é interrompido enquanto o ${s} estiver incapacitado ou com deslocamento 0.`,
        ),
    reativo: (s: string) => t('Reativo', `O ${s} pode realizar uma reação em cada turno em um combate.`),
    impacto: (s: string, cd: number) =>
        t(
            'Impacto Atordoante',
            `Uma vez por rodada, ao causar dano Contundente em uma criatura, ela deve ser bem-sucedida em uma Salvaguarda de Constituição CD ${cd} ou ficará atordoada até o final do próximo turno do ${s}.`,
        ),
    especialista: (s: string) => t('Especialista em Armas', `O dado de dano de qualquer arma que o ${s} utiliza se torna o d12.`),
    movLivre: (s: string) =>
        t(
            'Movimentação Livre',
            `O ${s} ignora terreno difícil e efeitos não podem reduzir o deslocamento, empurrá-lo ou deixá-lo impedido. Ele pode gastar 1,5 metro do seu deslocamento para escapar de impedimentos ou de um agarrão.`,
        ),
    presenca: (s: string, quem: string) =>
        t(
            'Presença de Líder',
            `${quem}, que possa ver o ${s} e esteja a até 9 metros dele, quando realizar uma jogada de ataque ou Salvaguarda, pode adicionar um d8 a sua jogada. Uma criatura pode ser beneficiada por apenas uma Presença de Líder ao mesmo tempo. Esse efeito termina se o ${s} estiver incapacitado.`,
        ),
    lider: (s: string, nome: string) =>
        t(
            `${nome} (5/Dia)`,
            `Se o ${s} errar uma rolagem de ataque ou falhar em um Teste de Atributo ou Salvaguarda, o ${s} pode ganhar um bônus na rolagem igual ao número de aliados que ele possa ver a até 9 metros (bônus máximo de +10).`,
            { usos: dia(5) },
        ),
    resColossal: (s: string) =>
        t('Resistência Colossal', `O dano e outros efeitos de Técnicas de Combate de 4º grau ou menor são ignoradas pelo ${s}.`),
    investida: (dano: string) =>
        t(
            'Investida',
            `Se o marinheiro se mover, pelo menos, 6 metros em linha reta até um alvo e então atingi-lo com um ataque corpo a corpo no mesmo turno, o alvo sofre ${dano} de dano extra.`,
        ),
    taticas: () =>
        t(
            'Táticas Marciais',
            'O marinheiro tem vantagem nas jogadas de ataque (comum) contra uma criatura se, pelo menos, um dos aliados do marinheiro estiver a 1,5 metro da criatura e não estiver com a condição “Incapacitado”.',
        ),
    taticasAv: (dano: string) =>
        t(
            'Táticas Marciais Avançadas',
            `O marinheiro tem vantagem nas jogadas de ataque contra uma criatura se, pelo menos, um dos aliados do marinheiro estiver a 1,5 metro da criatura e não estiver com a condição “Incapacitado”. Além disso, uma vez por turno, o marinheiro pode causar ${dano} de dano extra a uma criatura que ele atinja, com um ataque corpo a corpo.`,
        ),
    justicaCega: () =>
        t(
            'Justiça Cega',
            'No início do seu turno, o marinheiro pode ganhar vantagem em todas as jogadas de ataque corpo a corpo que ele fizer durante seu turno, mas as jogadas de ataque contra ele têm vantagem até o início do próximo turno dele.',
        ),
};

export const bonus = {
    descuidado: (s: string) =>
        t(
            'Descuidado',
            `No início do seu turno, o ${s} pode ganhar vantagem em todas as jogadas de ataque que fizer durante seu turno, mas as jogadas de ataque contra ele têm vantagem até o início do próximo turno do ${s}.`,
        ),
    alvoNaMira: () =>
        t(
            'Alvo na Mira',
            'O pirata pode usar uma ação bônus para dobrar o alcance normal da sua arma de fogo, sem receber desvantagem pela distância máxima.',
        ),
    avanco: () =>
        t(
            'Avanço de Território',
            'Com uma ação bônus, o marinheiro pode se mover até metade do seu deslocamento até uma criatura hostil que ele possa ver.',
        ),
    passoRelampago: (s: string) =>
        t(
            'Passo Relâmpago',
            `O ${s} é capaz de se deslocar rapidamente para qualquer ponto dentro do seu campo de visão. O deslocamento feito usando esta habilidade não sofre reações como a característica “Ataque de Oportunidade” e a próxima jogada de ataque que ele fizer recebe vantagem.`,
            { pp: 4 },
        ),
    liberacao: (s: string) =>
        t(
            'Liberação Forçada',
            `O ${s} é capaz de desfazer quaisquer efeitos negativos que estejam afetando-o, no momento do uso dessa técnica, desde que os efeitos tenham duração restante de até 1 minuto.`,
            { pp: 9, usos: recarga() },
        ),
    passosPrecisos: () =>
        t(
            'Passos Precisos',
            'No início do seu turno, o pirata pode garantir que nenhuma criatura tenha vantagem em jogadas de ataque contra ele (comuns ou de Técnicas).',
        ),
    sovietico: () =>
        t(
            '“Ataque Soviético Nele!”',
            'O pirata ordena que todos os seus subordinados realizem uma jogada de ataque contra uma criatura que ele possa ver. As criaturas que recebem a ordem atacam imediatamente, sem precisar gastar nenhuma atividade para isso.',
            { usos: recarga() },
        ),
};

export const reacao = {
    ataqueOp: (s: string, comum = false) =>
        t(
            'Ataque de Oportunidade',
            `O ${s} pode realizar um ataque de oportunidade com uma jogada de ataque${comum ? ' (comum)' : ''} corpo a corpo quando um inimigo que ele possa ver se move para fora de seu alcance corpo a corpo, de forma voluntária.`,
        ),
    ataqueOpSup: () =>
        t(
            'Ataque de Oportunidade Superior',
            'Se um alvo sair do alcance da criatura, de forma voluntária, mesmo se seu movimento não provocar um ataque de oportunidade e outras reações, a criatura pode realizar uma jogada de ataque corpo-a-corpo contra a criatura. Caso o ataque acerte, o deslocamento da criatura se torna 0, até o final da rodada.',
        ),
    redirecionar: (s: string, tecnicas = false) =>
        t(
            'Redirecionar Ataque',
            `Quando uma criatura que o ${s} possa ver o escolhe como alvo de uma jogada de ataque${tecnicas ? ' (comum ou Técnicas)' : ''}, o ${s} pode puxar um aliado de ND menor a até 1,5 metro dele. Os dois trocam de lugar, e o aliado escolhido torna-se o alvo do ataque.`,
        ),
    retaliacao: (s: string) =>
        t(
            'Retaliação',
            `Uma vez por rodada, ao receber dano de um alvo que esteja a até 1,5 metro do ${s}, logo após a jogada de dano do alvo, o ${s} pode realizar uma jogada de ataque corpo a corpo contra essa criatura.`,
        ),
    aparar: (s: string) =>
        t(
            'Aparar',
            `O ${s} adiciona 5 à sua CR contra jogadas de ataque (comum ou Técnicas) que poderia atingi-lo. Para tanto, o ${s} deve poder ver o atacante e estar empunhando uma arma.`,
        ),
    defesaPoderosa: (s: string, pp: number, dados: number) =>
        t('Defesa Poderosa', `O ${s} se protege de golpes, reduzindo ${dados}d8 pontos de dano, até o início do próximo turno dele.`, { pp }),
    ordemCruel: (s: string) =>
        t(
            'Ordem Cruel',
            `Quando uma criatura que o ${s} possa ver o escolhe como alvo de uma jogada de ataque (comum ou Técnicas), o ${s} pode escolher um aliado de ND menor a até 6 metros dele. O aliado escolhido se move a até 1,5 metro do ${s}, jogando-se na frente do ataque e tornando-se o alvo.`,
        ),
};

export const lendarias = (s: string): { n: number; texto: string; opcoes: TextoNpc[] } => ({
    n: 5,
    texto: `O ${s} pode realizar 5 ações lendárias, escolhidas dentre as opções abaixo. Apenas uma ação lendária pode ser usada por vez e apenas no final do turno de outra criatura. O ${s} recupera as ações lendárias gastas no começo do turno dele.`,
    opcoes: [
        t('Movimento', `O ${s} se move a até metade do seu deslocamento.`),
        t(
            'Ataque Atordoante',
            `O ${s} pode realizar um ataque corpo a corpo com o efeito do aspecto “Impacto Atordoante”. Essa ação não impede que o ${s} use novamente esse aspecto no seu turno.`,
        ),
    ],
});

export { t as texto };
export type { AtaqueNpc };

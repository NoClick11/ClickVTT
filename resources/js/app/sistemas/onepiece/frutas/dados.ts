/**
 * Frutas prontas (Akuma no Mi) que o mestre entrega aos personagens. A fruta vira o perfil da Akuma da ficha (tipo, usuário, propriedades), as
 * Técnicas dela (que chegam por nível, como numa progressão) e as características (Manifestações de Poder, Estágio Desperto). Arquivo PURO.
 */
import type { TipoDoFruto } from '../akuma/dados.ts';
import type { TracoDados } from '../construtor/dados/tipos.ts';
import type { AtributoId, CategoriaDeAcao, ReacaoDeCombate, Tecnica, TesteDaTecnica } from '../regras.ts';

/** Técnica da fruta: entra na ficha quando o personagem chega ao `nivel` (`grau` vazio = Técnica Auxiliar). */
export interface TecnicaDaFruta {
    nivel: number;
    grau?: number;
    tecnica: Omit<Tecnica, 'builder' | 'origem'>;
}

export interface FrutaDados {
    id: string;
    nome: string;
    /** O nome popular do fruto ("Fruto do Fio"). */
    apelido: string;
    descricao: string;
    tipo: TipoDoFruto;
    usuario: 'simples' | 'avancado';
    propriedades: string[];
    tecnicas: TecnicaDaFruta[];
    /** Manifestações de Poder, Estágio Desperto...: cada uma vira uma característica (valem a partir do `nivelMin`). */
    tracos: TracoDados[];
}

const t = (
    nivel: number,
    grau: number | undefined,
    nome: string,
    custo: number,
    acao: CategoriaDeAcao,
    alcance: string,
    efeito: string,
    rolagem: string,
    tipoDano: string | undefined,
    descricao: string,
    extra: { teste?: TesteDaTecnica; reacao?: ReacaoDeCombate } = {},
): TecnicaDaFruta => ({
    nivel,
    grau,
    tecnica: { nome, custo, acao, alcance, efeito, rolagem, ...(tipoDano ? { tipoDano } : {}), descricao, ...extra },
});

const SALV = (atributo: AtributoId, extra: Partial<TesteDaTecnica> = {}): TesteDaTecnica => ({
    tipo: 'salvaguarda',
    atributo,
    aoPassar: 'metade',
    ...extra,
});

export const TO_ITO_NO_MI: FrutaDados = {
    id: 'ito-ito-no-mi',
    nome: 'Ito-Ito no Mi',
    apelido: 'Fruto do Fio',
    descricao:
        'Paramecia Avançado, Desperto. Fios finíssimos e afiados que cortam, perfuram, amarram e se erguem em gaiolas, ondas e clones. As Técnicas chegam por nível; as do Estágio Desperto (6º e 7º graus e as Auxiliares Despertas) pedem o estágio ligado. Propriedades: Criação e Manipulação.',
    tipo: 'paramecia',
    usuario: 'avancado',
    propriedades: ['criacao', 'manipulacao'],
    tecnicas: [
        t(
            1,
            1,
            'Goshikito',
            2,
            'poderosa',
            'Toque',
            '2d10 Cortante',
            '2d10',
            'cortante',
            'Cordas de Cinco Cores: cinco fios extremamente afiados saem dos dedos de uma mão num corte veloz, em jogada de ataque (Técnicas) corpo a corpo contra uma criatura. No 6º nível, ela pode ser usada como Técnica de 3º Grau (entra na lista como "Goshikito (3º Grau)"). Requisito: Ito-Ito no Mi. Ataque combinado: possível.',
            { teste: { tipo: 'ataque' } },
        ),
        t(
            1,
            undefined,
            'Sora no Michi',
            2,
            'bonus',
            'Pessoal',
            'Voo de 9 m',
            '',
            undefined,
            'Caminho do Céu: você prende os fios nas nuvens ou em estruturas elevadas e se impulsiona pelo ar como se voasse: 9 metros de deslocamento de voo. Duração: até o início do seu próximo turno. Requisito: Ito-Ito no Mi.',
        ),
        t(
            3,
            2,
            'Tamaito',
            6,
            'poderosa',
            'Até 15 m, Linha',
            '5d10 Perfurante',
            '5d10',
            'perfurante',
            'Fio Bala: aponta o dedo como uma pistola e dispara um único fio comprimido em altíssima velocidade, em jogada de ataque (Técnicas) à distância; o disparo é tão preciso que tem margem de acerto crítico 19-20. Requisito: Ito-Ito no Mi. Ataque combinado: possível.',
            { teste: { tipo: 'ataque' } },
        ),
        t(
            6,
            3,
            'Goshikito (3º Grau)',
            9,
            'poderosa',
            'Até 21 m, Linha',
            '8d10 Perfurante',
            '8d10',
            'perfurante',
            'Goshikito aprimorada (3º Grau): cinco feixes de fios disparados de cima para baixo perfuram o alvo à distância; o alvo faz Salvaguarda de Constituição ou recebe a condição "Sangramento". Requisito: Ito-Ito no Mi. Ataque combinado: possível.',
            { teste: { tipo: 'automatico' } },
        ),
        t(
            6,
            3,
            'Parasite',
            9,
            'poderosa',
            'Até 21 m, Linha',
            'Impedido e Incapacitado até 1 minuto',
            '',
            undefined,
            'Fio Parasita: fios microscópicos prendem à nuca e à espinha de até duas criaturas que você veja no alcance, tornando-as marionetes. Cada alvo faz Salvaguarda de Força ou fica "Impedido" e "Incapacitado" enquanto a técnica durar. Com a ação bônus, em cada turno seu, você força uma criatura presa a usar a reação para um ataque (comum) corpo a corpo contra outra criatura ao alcance dela. Ao fim de cada turno da criatura afetada, ela repete a Salvaguarda de Força para romper os fios. Duração: até 1 minuto, concentração. Requisito: Ito-Ito no Mi. Dano: nenhum. Ataque combinado: impossível.',
            { teste: SALV('for', { aoPassar: 'nada', aplica: { condicao: 'contido' } }) },
        ),
        t(
            6,
            undefined,
            'Kumo no Sugaki',
            5,
            'reacao',
            'Toque',
            'Reduz 5d8 do dano',
            '',
            undefined,
            'Teia de Aranha: ao receber uma jogada de ataque, ou ter de fazer uma Salvaguarda de Força ou Destreza, você libera fios da palma da mão e cria uma proteção como uma teia de aranha que reduz 5d8 do dano recebido por você e por toda criatura num cone de 12 m para trás de você. Duração: até o início do seu próximo turno. Requisito: Ito-Ito no Mi.',
            { reacao: { gatilho: 'ataque_declarado', alcance: 'si', reducao: { reserva: '5d8', unica: true } } },
        ),
        t(
            9,
            4,
            'Overheat',
            12,
            'poderosa',
            'Até 33 m, Linha',
            '11d10 Fogo',
            '11d10',
            'fogo',
            'Chicote Superaquecido: une diversos fios numa corda grossa que superaquece com o atrito até virar um chicote de fogo que atinge uma criatura em jogada de ataque (Técnicas) à distância. Requisito: Ito-Ito no Mi. Ataque combinado: possível.',
            { teste: { tipo: 'ataque' } },
        ),
        t(
            12,
            5,
            'Torikago',
            15,
            'poderosa',
            'Até 18 m de raio, Esfera',
            '6d6 Cortante',
            '6d6',
            'cortante',
            'Gaiola de Pássaros: uma quantidade colossal de fios se ergue ao céu e forma uma cúpula impenetrável e cortante (esfera de até 18 m de raio centrada em você) que se fecha lentamente; nenhuma criatura ou projétil comum entra ou sai. Toda criatura hostil dentro faz Salvaguarda de Destreza ao ativar e sempre que iniciar o turno ali, sofrendo 6d6 Cortante se falhar ou metade se passar. Você escolhe criaturas aliadas, em número igual ao seu modificador de Destreza (mín. 1), que não sofrem o dano. Duração: até 1 minuto, concentração. Requisito: Ito-Ito no Mi. Ataque combinado: impossível.',
            { teste: SALV('des') },
        ),
        t(
            12,
            undefined,
            'Black Knight',
            14,
            'bonus',
            'Toque',
            'Clone de fios (CR 16, 80 PV)',
            '',
            undefined,
            'Clone de Fios: você tece fios comprimidos até criar um clone perfeito, com a sua aparência e voz. Segue as regras de Lacaio, dura até 1 minuto, tem a sua iniciativa e usa a ação para "Atacar" (só 1 vez), "Ajuda", "Usar um Objeto" ou "Agarrão". Black Knight: CR 16 (15 + 1), 80 PV (50 + 30), deslocamento 9 m (ou voo de 9 m se usar Sora no Michi), atributos iguais aos seus; invulnerável a dano de Veneno e às condições Amedrontado, Enfeitiçado, Envenenado, Exausto e Paralisado. Goshikito do clone: corpo a corpo ou à distância (6 m), 9 para atingir, 18 (2d12 + 5) de dano Cortante. Requisito: Ito-Ito no Mi.',
        ),
        t(
            16,
            6,
            'Break White',
            18,
            'poderosa',
            'Até 39 m, Linha',
            '16d12 Contundente ou Cortante',
            '16d12',
            'contundente',
            'Ondas de Fios Brancos: transformando o chão e as estruturas em fios, você cria duas ondas gigantescas que se fecham sobre o alvo, em jogada de ataque (Técnicas) à distância. Se acertar, além do dano a criatura faz Salvaguarda de Força ou fica "Impedida" até o fim do próximo turno dela. Requisito: Ito-Ito no Mi, Estágio Desperto. Ataque combinado: possível.',
            { teste: { tipo: 'ataque' } },
        ),
        t(
            16,
            undefined,
            'Off White',
            16,
            'reacao',
            'Até 21 m, Linha',
            'Reduz 28d8 do dano; +1 na CR',
            '',
            undefined,
            'Escudo Branco: quando você ou uma criatura que você veja no alcance for alvo de ataque ou técnica, duas espessas paredes de fios brancos trançados emergem do solo e interceptam o golpe, reduzindo o dano em 28d8; a barreira também dá +1 na CR do protegido até o início do seu próximo turno. A reação automática vale para a proteção de si mesmo; proteger outra criatura fica por conta da mesa. Requisito: Ito-Ito no Mi, Estágio Desperto.',
            { reacao: { gatilho: 'ataque_declarado', alcance: 'si', reducao: { reserva: '28d8', unica: true } } },
        ),
        t(
            20,
            7,
            'God Thread',
            21,
            'poderosa',
            'Até 45 m, Linha',
            '18d12 Perfurante',
            '18d12',
            'perfurante',
            'Dezesseis Balas Sagradas do Assassino: no ápice do despertar, dezesseis feixes colossais de fios condensados são disparados para atravessar um único inimigo, em jogada de ataque (Técnicas) à distância com margem de acerto crítico 19-20. Se acertar, o alvo faz Salvaguarda de Constituição ou recebe "Sangramento" e "Estremecido" até o fim do próximo turno dele. Requisito: Ito-Ito no Mi, Estágio Desperto. Ataque combinado: possível.',
            { teste: { tipo: 'ataque' } },
        ),
        t(
            20,
            undefined,
            'Ever White',
            18,
            'bonus',
            'Até 12 m de raio, Esfera',
            '+5 dados de dano em quem pisa na área',
            '',
            undefined,
            'Mundo em Branco: você toca o chão e transforma edifícios, rochas e solo num raio de 12 m num mar revolto de fios brancos: terreno difícil para criaturas hostis. Sempre que executar uma Técnica de Combate da Ito-Ito no Mi contra um alvo que pise na área, ela recebe 5 dados de dano extra (do mesmo tipo) e o alvo tem desvantagem em Salvaguardas de Força ou Destreza contra os efeitos dela. Duração: até 1 minuto, concentração. Requisito: Ito-Ito no Mi, Estágio Desperto.',
        ),
    ],
    tracos: [
        {
            id: 'fios-imperceptiveis',
            nome: 'Fios Imperceptíveis',
            descricao:
                'Manifestação de Poder (passiva): seus fios são tão finos e afiados que são praticamente invisíveis a olho nu. Todas as jogadas de ataque (Técnicas) com a Ito-Ito no Mi recebem +2 para atingir e margem de acerto crítico 19-20, e o alcance de todas as técnicas em Linha aumenta em 6 metros. Criaturas têm desvantagem em Testes de Vontade (Percepção) para notar armadilhas ou fios estendidos no ambiente.',
            efeitos: [{ alvo: 'ataque', modo: 'soma', valor: 2 }],
            etiquetas: ['Ataques de Técnicas +2', 'Técnicas em Linha: +6 m de alcance'],
        },
        {
            id: 'costura-interna',
            nome: 'Costura Interna de Emergência',
            descricao:
                'Manifestação de Poder (reação): ao sofrer dano ou iniciar o turno sob a condição "Sangramento", você pode usar a reação para costurar os órgãos e estancar hemorragias internas com seus fios: encerra o "Sangramento" sobre si e recebe 4d10 Pontos de Vida Temporários, que duram até o início do seu próximo turno.',
            etiquetas: ['Reação: encerra Sangramento e 4d10 PV temporários'],
        },
        {
            id: 'mestre-dos-titeres',
            nome: 'Mestre dos Títeres',
            descricao:
                'Manifestação de Poder (inação, só no Estágio Desperto): o ambiente ao seu redor vira fios sob o seu comando. Uma vez por turno, sempre que uma criatura for atingida por uma jogada de ataque ou falhar na Salvaguarda de uma técnica da Ito-Ito no Mi, os fios do solo a amarram: o deslocamento dela cai a 0 e ela tem desvantagem na próxima Salvaguarda de Força ou Destreza, até o início do seu próximo turno.',
            etiquetas: ['Desperto: alvo atingido fica com deslocamento 0 e desvantagem em Salv. FOR/DES'],
        },
        {
            id: 'estagio-desperto',
            nome: 'Estágio Desperto',
            tipo: 'ativa',
            acao: 'bonus',
            interruptor: true,
            usos: { max: 3, descanso: 'longo' },
            descricao:
                'Com uma ação bônus você entra no Estágio Desperto (sair não gasta ação). Liberação Cansativa: consome 1 PP ao final de cada turno (sempre ao menos 1, mesmo que entre e saia no mesmo turno); ao chegar a 0 PP o estágio termina. Novo Patamar: dá as Técnicas de 6º e 7º grau e duas Auxiliares correspondentes, no 16º e 20º nível. Explosão de Poder: recupera 10 PP (uma vez, até descanso longo). Ímpeto Desperto: ao usar uma Técnica de Combate da fruta que cause dano direto e tenha "Ação Poderosa" como requisito, faz também uma jogada de ataque (comum) contra o alvo, na mesma ação poderosa (até 3 usos, voltam em descanso longo). Despertar Ambiental: Corpo Aprimorado (+10 no máximo de PP, +50 no máximo de PV e +1 na CR) e Transformação Sustentável (Técnica da fruta sem "Estágio Desperto" como requisito custa metade do grau a menos de PP, para baixo, mín. 1).',
            efeitos: [
                { alvo: 'pp.max', modo: 'soma', valor: 10 },
                { alvo: 'pv.max', modo: 'soma', valor: 50 },
                { alvo: 'ca', modo: 'soma', valor: 1 },
            ],
            etiquetas: ['Desperto: PP máx +10, PV máx +50, CR +1; −1 PP por turno'],
        },
    ],
};

export const FRUTAS: FrutaDados[] = [TO_ITO_NO_MI];
export const frutaPorId = (id: string | null | undefined): FrutaDados | undefined => FRUTAS.find((f) => f.id === id);

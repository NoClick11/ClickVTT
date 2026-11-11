/**
 * Catálogo e utilitários dos efeitos e condições visíveis no mapa e nas fichas.
 *
 * Ícones, cores e resumos estritamente mecânicos (estilo Foundry VTT) para exibição em tooltips.
 */

export const ICONE_PADRAO = '✦';

export const ICONES_STATUS: Record<string, { icone: string; cor: string }> = {
    agarrado: { icone: '✊', cor: '#f59e0b' },
    amedrontado: { icone: '😱', cor: '#a78bfa' },
    atordoado: { icone: '💫', cor: '#facc15' },
    bebado: { icone: '🍺', cor: '#eab308' },
    caido: { icone: '⬇️', cor: '#94a3b8' },
    cego: { icone: '🕶️', cor: '#64748b' },
    empoderado: { icone: '💪', cor: '#f59e0b' },
    enfeiticado: { icone: '💖', cor: '#f472b6' },
    enfraquecido: { icone: '🥀', cor: '#a855f7' },
    enfurecido: { icone: '😡', cor: '#ef4444' },
    envenenado: { icone: '☠️', cor: '#4ade80' },
    estremecido: { icone: '🫨', cor: '#cbd5e1' },
    impedido: { icone: '⛓️', cor: '#fb923c' },
    contido: { icone: '⛓️', cor: '#fb923c' },
    incapacitado: { icone: '🚫', cor: '#f87171' },
    inconsciente: { icone: '💤', cor: '#60a5fa' },
    invisivel: { icone: '👻', cor: '#e2e8f0' },
    letargico: { icone: '🥱', cor: '#a3a3a3' },
    paralisado: { icone: '⚡', cor: '#fde047' },
    petrificado: { icone: '🗿', cor: '#94a3b8' },
    queimado: { icone: '🔥', cor: '#fb923c' },
    sangramento: { icone: '🩸', cor: '#ef4444' },
    sonolento: { icone: '😪', cor: '#93c5fd' },
    sufocado: { icone: '🫧', cor: '#38bdf8' },
    surdo: { icone: '🔇', cor: '#94a3b8' },
};

export const iconeDoStatus = (id: string): { icone: string; cor: string } => ICONES_STATUS[id] ?? { icone: ICONE_PADRAO, cor: '#d4a843' };

export interface InfoStatusMecanico {
    id: string;
    nome: string;
    icone: string;
    cor: string;
    mecanica: string[];
}

/**
 * Resumo focado estritamente nas regras mecânicas da condição (penalidades, vantagens/desvantagens,
 * perda de deslocamento, dano e travas de ação).
 */
export const STATUS_MECANICOS: Record<string, { nome: string; mecanica: string[] }> = {
    agarrado: {
        nome: 'Agarrado',
        mecanica: ['Deslocamento torna-se 0', 'Não se beneficia de bônus de deslocamento'],
    },
    amedrontado: {
        nome: 'Amedrontado',
        mecanica: ['Desvantagem em testes de atributo e ataques enquanto a fonte estiver à vista', 'Não pode se aproximar voluntariamente da fonte'],
    },
    atordoado: {
        nome: 'Atordoado',
        mecanica: [
            'Incapacitado (sem ações/reações) e sem deslocamento',
            'Falha automática em Salvaguardas de FOR e DES',
            'Ataques contra têm vantagem',
            'Críticos recebem +2 dados de dano',
        ],
    },
    bebado: {
        nome: 'Bêbado',
        mecanica: ['Desvantagem em Salvaguardas e testes de Destreza (Acrobacia, Furtividade, Prestidigitação)'],
    },
    caido: {
        nome: 'Caído',
        mecanica: [
            'Deslocamento apenas rastejando (gasta metade para levantar)',
            'Desvantagem em suas jogadas de ataque',
            'Ataques a 1,5 m contra têm vantagem (além disso têm desvantagem)',
        ],
    },
    cego: {
        nome: 'Cego',
        mecanica: ['Falha automática em testes que exijam visão', 'Desvantagem em suas jogadas de ataque', 'Ataques contra têm vantagem'],
    },
    empoderado: {
        nome: 'Empoderado',
        mecanica: ['Ataque desarmado/corpo a corpo vira 1d12 + mod', 'Técnicas que errarem não gastam PP', 'Terreno difícil não reduz deslocamento'],
    },
    enfeiticado: {
        nome: 'Enfeitiçado',
        mecanica: ['Não pode atacar nem alvejar o conjurador com dano/efeitos nocivos', 'O conjurador tem vantagem em testes sociais contra ela'],
    },
    enfraquecido: {
        nome: 'Enfraquecido',
        mecanica: [
            'Deslocamento reduzido à metade (sem bônus) e incapaz de nadar',
            'Incapacitado e anula poderes de Akuma no Mi / MPs',
            'Desvantagem em testes de atributo e falha automática em Salvaguardas',
            'Ataques contra têm vantagem',
        ],
    },
    enfurecido: {
        nome: 'Enfurecido',
        mecanica: ['Desvantagem em ataques (obriga a atacar a fonte)', '+1d4 no dano de ataques corpo a corpo', 'Não pode manter concentração'],
    },
    envenenado: {
        nome: 'Envenenado',
        mecanica: ['Desvantagem em jogadas de ataque e em testes de atributo'],
    },
    estremecido: {
        nome: 'Estremecido',
        mecanica: [
            'Desvantagem em jogadas de ataque e bloqueia uso de Técnicas',
            'Deslocamento custa o dobro (+1,5 m por cada 1,5 m)',
            'Falha automática em concentração',
        ],
    },
    impedido: {
        nome: 'Impedido',
        mecanica: ['Deslocamento torna-se 0', 'Desvantagem em jogadas de ataque e em Salvaguardas de DES', 'Ataques contra têm vantagem'],
    },
    contido: {
        nome: 'Contido',
        mecanica: ['Deslocamento torna-se 0', 'Desvantagem em jogadas de ataque e em Salvaguardas de DES', 'Ataques contra têm vantagem'],
    },
    incapacitado: {
        nome: 'Incapacitado',
        mecanica: ['Não pode realizar ações, ações poderosas, ações bônus ou reações'],
    },
    inconsciente: {
        nome: 'Inconsciente',
        mecanica: [
            'Incapacitado, imóvel e caído (larga tudo)',
            'Falha automática em Salvaguardas de FOR e DES',
            'Ataques contra têm vantagem e acertos a 1,5 m são críticos',
        ],
    },
    invisivel: {
        nome: 'Invisível',
        mecanica: ['Vantagem em suas jogadas de ataque', 'Ataques contra sofrem desvantagem'],
    },
    letargico: {
        nome: 'Letárgico',
        mecanica: ['Apenas 1 ação, bônus ou poderosa por turno', 'Dano causado é reduzido pela metade', 'Não pode usar Técnicas'],
    },
    paralisado: {
        nome: 'Paralisado',
        mecanica: [
            'Incapacitado e sem se mover ou falar',
            'Falha automática em Salvaguardas de FOR e DES',
            'Ataques contra têm vantagem e acertos a 1,5 m são críticos (+2 dados)',
        ],
    },
    petrificado: {
        nome: 'Petrificado',
        mecanica: [
            'Incapacitado e sem se mover ou falar',
            'Resistência a todo dano; imune a veneno',
            'Falha automática em Salvaguardas de FOR e DES',
        ],
    },
    queimado: {
        nome: 'Queimado',
        mecanica: ['Sofre 1d6 de dano de Fogo ao atacar no turno', 'Não pode concentrar (desvantagem em testes de Concentração)'],
    },
    sangramento: {
        nome: 'Sangramento',
        mecanica: ['Sofre 1d6 de dano Cortante ao se mover voluntariamente no turno'],
    },
    sonolento: {
        nome: 'Sonolento',
        mecanica: ['Não pode usar reações', 'Máximo de 1 ataque corpo a corpo por turno', 'Desvantagem em testes de DES e SAB'],
    },
    sufocado: {
        nome: 'Sufocado',
        mecanica: ['Não consegue falar', 'Após 1+mod CON rodadas, Salvaguarda CON CD 10 (+2/rodada) ou fica Inconsciente'],
    },
    surdo: {
        nome: 'Surdo',
        mecanica: ['Falha automática em testes que exijam audição'],
    },
};

/** Retorna a informação e resumo estritamente mecânico do status/condição. */
export function infoDoStatus(id: string): InfoStatusMecanico {
    const { icone, cor } = iconeDoStatus(id);
    const dados = STATUS_MECANICOS[id];
    if (dados) {
        return {
            id,
            nome: dados.nome,
            icone,
            cor,
            mecanica: dados.mecanica,
        };
    }
    const nomeFormatado = id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
    return {
        id,
        nome: nomeFormatado,
        icone,
        cor,
        mecanica: ['Efeito ativo'],
    };
}

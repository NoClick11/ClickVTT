/**
 * Ícones dos efeitos (condições) que aparecem no token do mapa. A chave é o id da condição; um id sem ícone aqui
 * (condição nova, de outro sistema) usa o ícone padrão. Só aparência: as regras de cada condição ficam no módulo do sistema.
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
    queimado: { icone: '🔥', cor: '#fb923c' },
    sangramento: { icone: '🩸', cor: '#ef4444' },
    sonolento: { icone: '😪', cor: '#93c5fd' },
    sufocado: { icone: '🫧', cor: '#38bdf8' },
    surdo: { icone: '🔇', cor: '#94a3b8' },
};

export const iconeDoStatus = (id: string): { icone: string; cor: string } => ICONES_STATUS[id] ?? { icone: ICONE_PADRAO, cor: '#d4a843' };

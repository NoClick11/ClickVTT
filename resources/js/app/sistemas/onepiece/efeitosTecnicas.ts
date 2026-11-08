export interface EfeitoDaTecnica {
    audio: string;
    animacao: string;
    posicao: 'origem_para_alvo' | 'alvo' | 'pessoal';
    tamanho?: number;
    duracaoMs?: number;
}

/**
 * Mapeamento dos efeitos audiovisuais para as Técnicas do sistema One Piece.
 * Cada técnica dispara o som e a animação correspondente na ativação.
 */
const EFEITOS_AVENTUREIRO: Record<string, EfeitoDaTecnica> = {
    Whiplash: {
        audio: '/animacoes/aventureiro/whiplash.mp3',
        animacao: '/animacoes/aventureiro/whiplash.gif',
        posicao: 'origem_para_alvo',
        tamanho: 240,
        duracaoMs: 500,
    },
    'Power Pistol': {
        audio: '/animacoes/aventureiro/power_pistol.mp3',
        animacao: '/animacoes/aventureiro/power_pistol.gif',
        posicao: 'origem_para_alvo',
        tamanho: 240,
        duracaoMs: 450,
    },
    'Sonic Boom': {
        audio: '/animacoes/aventureiro/sonic_boom.mp3',
        animacao: '/animacoes/aventureiro/sonic_boom.gif',
        posicao: 'alvo',
        tamanho: 260,
        duracaoMs: 700,
    },
    'Fire Lash': {
        audio: '/animacoes/aventureiro/fire_lash.mp3',
        animacao: '/animacoes/aventureiro/fire_lash.gif',
        posicao: 'pessoal',
        tamanho: 200,
        duracaoMs: 650,
    },
    'Prison Whip': {
        audio: '/animacoes/aventureiro/prison_whip.mp3',
        animacao: '/animacoes/aventureiro/prison_whip.gif',
        posicao: 'alvo',
        tamanho: 260,
        duracaoMs: 650,
    },
    'Power Whip': {
        audio: '/animacoes/aventureiro/power_whip.mp3',
        animacao: '/animacoes/aventureiro/power_whip.gif',
        posicao: 'origem_para_alvo',
        tamanho: 240,
        duracaoMs: 550,
    },
    'Laço de Dominação': {
        audio: '/animacoes/aventureiro/laco_de_dominacao.mp3',
        animacao: '/animacoes/aventureiro/laco_de_dominacao.gif',
        posicao: 'origem_para_alvo',
        tamanho: 240,
        duracaoMs: 650,
    },
    'Nebula Storm': {
        audio: '/animacoes/aventureiro/nebula_storm.mp3',
        animacao: '/animacoes/aventureiro/nebula_storm.gif',
        posicao: 'pessoal',
        tamanho: 240,
        duracaoMs: 800,
    },
    'Círculo da Morte': {
        audio: '/animacoes/aventureiro/circulo_da_morte.mp3',
        animacao: '/animacoes/aventureiro/circulo_da_morte.gif',
        posicao: 'pessoal',
        tamanho: 280,
        duracaoMs: 800,
    },
    'Pain Whip': {
        audio: '/animacoes/aventureiro/pain_whip.mp3',
        animacao: '/animacoes/aventureiro/pain_whip.gif',
        posicao: 'origem_para_alvo',
        tamanho: 260,
        duracaoMs: 600,
    },
    'Fan Firing': {
        audio: '/animacoes/aventureiro/fan_firing.mp3',
        animacao: '/animacoes/aventureiro/fan_firing.gif',
        posicao: 'origem_para_alvo',
        tamanho: 240,
        duracaoMs: 550,
    },
    'Whip and Gun: Fan Firing': {
        audio: '/animacoes/aventureiro/fan_firing.mp3',
        animacao: '/animacoes/aventureiro/fan_firing.gif',
        posicao: 'origem_para_alvo',
        tamanho: 240,
        duracaoMs: 550,
    },
};

export function efeitoDaTecnica(nome: string): EfeitoDaTecnica | null {
    if (!nome) return null;
    if (EFEITOS_AVENTUREIRO[nome]) return EFEITOS_AVENTUREIRO[nome];
    const normalizado = nome.trim().toLowerCase();
    for (const [chave, efeito] of Object.entries(EFEITOS_AVENTUREIRO)) {
        if (chave.toLowerCase() === normalizado) return efeito;
    }
    return null;
}

/**
 * Toca o áudio da técnica apenas uma única vez na ativação.
 * Nunca toca em loop, garantindo que técnicas contínuas não fiquem repetindo o áudio.
 */
export function tocarAudioDaTecnica(audioUrl: string): void {
    try {
        const audio = new Audio(audioUrl);
        audio.volume = 0.75;
        audio.loop = false;
        void audio.play().catch(() => undefined);
    } catch {
        // Bloqueio de autoplay do navegador ou áudio desativado
    }
}

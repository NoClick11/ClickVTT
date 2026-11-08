/**
 * Utilitários para YouTube:
 * Extrai o ID do vídeo a partir de links comuns do YouTube (youtube.com/watch?v=, youtu.be/, shorts, embed).
 */
export function extrairYoutubeId(urlOuId: string): string | null {
    if (!urlOuId) return null;
    const limpo = urlOuId.trim();

    // Se já for diretamente um ID de 11 caracteres alfanuméricos
    if (/^[a-zA-Z0-9_-]{11}$/.test(limpo)) {
        return limpo;
    }

    // Padrões de URL do YouTube
    const padroes = [/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i, /[?&]v=([a-zA-Z0-9_-]{11})/i];

    for (const padrao of padroes) {
        const match = limpo.match(padrao);
        if (match && match[1]) return match[1];
    }

    return null;
}

// Declaração de tipos para a YouTube IFrame API
declare global {
    interface Window {
        onYouTubeIframeAPIReady?: () => void;
        YT?: {
            Player: new (
                elemento: HTMLElement | string,
                opcoes: {
                    videoId?: string;
                    playerVars?: Record<string, unknown>;
                    events?: {
                        onReady?: (event: { target: YTPlayer }) => void;
                        onStateChange?: (event: { data: number }) => void;
                        onError?: (event: { data: number }) => void;
                    };
                },
            ) => YTPlayer;
            PlayerState?: {
                UNSTARTED: number;
                ENDED: number;
                PLAYING: number;
                PAUSED: number;
                BUFFERING: number;
                CUED: number;
            };
        };
    }
}

export interface YTPlayer {
    playVideo: () => void;
    pauseVideo: () => void;
    stopVideo: () => void;
    seekTo: (seconds: number, allowSeekAhead: boolean) => void;
    setVolume: (volume: number) => void;
    getVolume: () => number;
    mute: () => void;
    unMute: () => void;
    isMuted: () => boolean;
    getPlayerState: () => number;
    getCurrentTime: () => number;
    getDuration: () => number;
    loadVideoById: (videoId: string, startSeconds?: number) => void;
    cueVideoById: (videoId: string, startSeconds?: number) => void;
    destroy: () => void;
}

let apiCarregando: Promise<void> | null = null;

/** Carrega o script da YouTube IFrame API de forma assíncrona uma única vez. */
export function carregarYouTubeIframeAPI(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    if (window.YT && window.YT.Player) return Promise.resolve();

    if (apiCarregando) return apiCarregando;

    apiCarregando = new Promise((resolve) => {
        const anterior = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (anterior) anterior();
            resolve();
        };

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        const primeiroScript = document.getElementsByTagName('script')[0];
        if (primeiroScript && primeiroScript.parentNode) {
            primeiroScript.parentNode.insertBefore(tag, primeiroScript);
        } else {
            document.head.appendChild(tag);
        }
    });

    return apiCarregando;
}

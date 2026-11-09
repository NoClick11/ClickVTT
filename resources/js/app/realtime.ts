/// <reference types="vite/client" />
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global {
    interface Window {
        Pusher: typeof Pusher;
    }
}
window.Pusher = Pusher;

function xsrf(): string {
    const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);

    return m ? decodeURIComponent(m[1]) : '';
}

export interface Conexao {
    echo: Echo<'reverb'>;
    socketId: () => string | undefined;
    aoReconectar: (cb: () => void) => void;
    fechar: () => void;
}

let echoAtivo: Echo<'reverb'> | null = null;

/** Socket ID da conexão ativa desta aba (para o servidor identificar a aba que originou a ação). */
export function socketIdAtual(): string | undefined {
    return echoAtivo?.socketId() || undefined;
}

/**
 * Conexão com o Reverb desta aba. Canais privados são autorizados pelo servidor com o acesso do
 * convite + X-Jogador (quem é esta aba). Host: VITE_REVERB_HOST (se não for localhost) ou o próprio endereço da página.
 */
export function conectar(mesaId: number, atorId: number): Conexao {
    const esquema = import.meta.env.VITE_REVERB_SCHEME || (location.protocol === 'https:' ? 'https' : 'http');
    const porta = Number(import.meta.env.VITE_REVERB_PORT || (esquema === 'https' ? 443 : 80));
    const hostConfig = (import.meta.env.VITE_REVERB_HOST ?? '').trim();
    const wsHost = !hostConfig || hostConfig === 'localhost' || hostConfig === '127.0.0.1' ? location.hostname : hostConfig;

    const echo = new Echo({
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY,
        wsHost,
        wsPort: porta,
        wssPort: porta,
        forceTLS: esquema === 'https',
        enabledTransports: ['ws', 'wss'],
        authorizer: (canal: { name: string }) => ({
            authorize: (socketId: string, callback: (erro: Error | null, dados?: { auth: string; channel_data?: string }) => void) => {
                fetch(route('jogo.broadcasting.auth', mesaId, false), {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-XSRF-TOKEN': xsrf(),
                        'X-Jogador': String(atorId),
                    },
                    body: JSON.stringify({ socket_id: socketId, channel_name: canal.name }),
                })
                    .then(async (r) => {
                        if (!r.ok) throw new Error(`Falha ao autorizar canal (${r.status})`);
                        callback(null, await r.json());
                    })
                    .catch((e) => callback(e instanceof Error ? e : new Error(String(e))));
            },
        }),
    });

    echoAtivo = echo;
    const ouvintesReconectar: Array<() => void> = [];
    let jaConectou = false;
    const pusher = (echo.connector as { pusher?: Pusher })?.pusher;
    pusher?.connection.bind('connected', () => {
        if (jaConectou) {
            for (const cb of ouvintesReconectar) cb();
        }
        jaConectou = true;
    });

    return {
        echo,
        socketId: () => echo.socketId() || undefined,
        aoReconectar: (cb: () => void) => {
            ouvintesReconectar.push(cb);
        },
        fechar: () => {
            if (echoAtivo === echo) echoAtivo = null;
            echo.disconnect();
        },
    };
}

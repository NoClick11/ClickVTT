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
    fechar: () => void;
}

/**
 * Conexão com o Reverb desta aba. Canais privados são autorizados pelo servidor com o acesso do
 * convite + X-Jogador (quem é esta aba). Host: VITE_REVERB_HOST ou o próprio endereço da página.
 */
export function conectar(mesaId: number, atorId: number): Conexao {
    const esquema = import.meta.env.VITE_REVERB_SCHEME ?? (location.protocol === 'https:' ? 'https' : 'http');
    const porta = Number(import.meta.env.VITE_REVERB_PORT ?? (esquema === 'https' ? 443 : 80));
    const echo = new Echo({
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY,
        wsHost: import.meta.env.VITE_REVERB_HOST || location.hostname,
        wsPort: porta,
        wssPort: porta,
        forceTLS: esquema === 'https',
        enabledTransports: ['ws', 'wss'],
        authEndpoint: route('jogo.broadcasting.auth', mesaId),
        auth: { headers: { 'X-Jogador': String(atorId), 'X-XSRF-TOKEN': xsrf(), Accept: 'application/json' } },
    });

    return { echo, fechar: () => echo.disconnect() };
}

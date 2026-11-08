<script setup lang="ts">
import { CircleAlert, ExternalLink, ListMusic, Loader2, Music, Pause, Play, Plus, Repeat, Square, Trash2, Volume2, VolumeX } from 'lucide-vue-next';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { carregarYouTubeIframeAPI, extrairYoutubeId, type YTPlayer } from '../nucleo/audio/youtube';
import type { EstadoMusicaTocando, ItemMusica, MusicaMesaDto } from '../tipos-mesa';

const props = defineProps<{
    musica?: MusicaMesaDto | null;
    mestre: boolean;
}>();

const emit = defineEmits<{
    atualizar: [dados: { tocando?: EstadoMusicaTocando | null; playlist?: ItemMusica[] }];
}>();

// Estado local da playlist e da faixa tocando
const playlist = ref<ItemMusica[]>(props.musica?.playlist ? [...props.musica.playlist] : []);
const tocando = ref<EstadoMusicaTocando | null>(props.musica?.tocando ?? null);

// Controle do formulário para adicionar vídeo/música
const novaUrl = ref('');
const novoTitulo = ref('');
const erroEntrada = ref('');
const carregandoAdicionar = ref(false);

// Controle de volume individual do usuário (salvo no localStorage)
const volumeIndividual = ref<number>(
    (() => {
        try {
            const v = localStorage.getItem('clickvtt.musica.volume');
            return v !== null ? Math.max(0, Math.min(100, Number(v))) : 50;
        } catch {
            return 50;
        }
    })(),
);
const mutado = ref(false);

// Player YouTube IFrame
const playerContainer = ref<HTMLDivElement | null>(null);
let ytPlayer: YTPlayer | null = null;
const playerPronto = ref(false);
const playerCarregando = ref(false);
const bloqueioNavegador = ref(false); // Quando o navegador bloqueia autoplay sem interação prévia

// Tempo atual de reprodução local (para a barrinha de progresso)
const tempoAtual = ref(0);
const duracao = ref(0);
let intervaloTempo: number | null = null;

// Sincroniza props que vêm do WebSocket / servidor
watch(
    () => props.musica,
    (m) => {
        if (!m) return;
        if (m.playlist) playlist.value = [...m.playlist];
        if (m.tocando !== undefined) {
            const anterior = tocando.value;
            tocando.value = m.tocando;
            sincronizarPlayer(anterior, m.tocando);
        }
    },
    { deep: true },
);

// Salva alteração de volume individual
watch(volumeIndividual, (v) => {
    try {
        localStorage.setItem('clickvtt.musica.volume', String(v));
    } catch {
        // ignora
    }
    if (ytPlayer && playerPronto.value) {
        if (mutado.value) {
            ytPlayer.setVolume(0);
        } else {
            ytPlayer.setVolume(v);
        }
    }
});

watch(mutado, (m) => {
    if (ytPlayer && playerPronto.value) {
        if (m) {
            ytPlayer.setVolume(0);
        } else {
            ytPlayer.setVolume(volumeIndividual.value);
        }
    }
});

// Inicialização da API do YouTube
onMounted(async () => {
    await carregarYouTubeIframeAPI();
    await nextTick();
    inicializarPlayer();

    intervaloTempo = window.setInterval(() => {
        if (ytPlayer && playerPronto.value && tocando.value?.tocando) {
            try {
                tempoAtual.value = ytPlayer.getCurrentTime() || 0;
                duracao.value = ytPlayer.getDuration() || 0;
            } catch {
                // ignora
            }
        }
    }, 500);
});

onBeforeUnmount(() => {
    if (intervaloTempo) clearInterval(intervaloTempo);
    if (ytPlayer) {
        try {
            ytPlayer.destroy();
        } catch {
            // ignora
        }
        ytPlayer = null;
    }
});

function inicializarPlayer() {
    if (!window.YT || !window.YT.Player || !playerContainer.value) return;

    try {
        ytPlayer = new window.YT.Player(playerContainer.value, {
            playerVars: {
                autoplay: 0,
                controls: 0,
                disablekb: 1,
                fs: 0,
                modestbranding: 1,
                playsinline: 1,
                rel: 0,
            },
            events: {
                onReady: (event) => {
                    playerPronto.value = true;
                    playerCarregando.value = false;
                    event.target.setVolume(mutado.value ? 0 : volumeIndividual.value);

                    // Se já havia música definida ao entrar na mesa, sincroniza
                    if (tocando.value) {
                        sincronizarPlayer(null, tocando.value);
                    }
                },
                onStateChange: (event) => {
                    if (!window.YT?.PlayerState) return;
                    // Quando a faixa termina
                    if (event.data === window.YT.PlayerState.ENDED) {
                        if (tocando.value?.loop) {
                            ytPlayer?.seekTo(0, true);
                            ytPlayer?.playVideo();
                        } else if (props.mestre) {
                            // Toca a próxima da playlist se for mestre
                            proximaFaixa();
                        }
                    }
                },
                onError: (event) => {
                    console.warn('Erro no player do YouTube:', event.data);
                },
            },
        });
    } catch (e) {
        console.warn('Falha ao inicializar player do YouTube:', e);
    }
}

function sincronizarPlayer(anterior: EstadoMusicaTocando | null, atual: EstadoMusicaTocando | null) {
    if (!ytPlayer || !playerPronto.value) return;

    if (!atual) {
        try {
            ytPlayer.stopVideo();
        } catch {
            // ignora
        }
        tempoAtual.value = 0;
        duracao.value = 0;
        return;
    }

    const videoIdMudou = !anterior || anterior.videoId !== atual.videoId;

    if (videoIdMudou) {
        try {
            ytPlayer.loadVideoById(atual.videoId, atual.tempo ?? 0);
            if (!atual.tocando) {
                ytPlayer.pauseVideo();
            }
        } catch {
            // ignora
        }
    } else {
        if (atual.tocando) {
            try {
                // Tenta dar play; se o navegador bloquear autoplay por falta de clique, exibe aviso
                const p = ytPlayer.playVideo();
                bloqueioNavegador.value = false;
            } catch {
                bloqueioNavegador.value = true;
            }
        } else {
            try {
                ytPlayer.pauseVideo();
            } catch {
                // ignora
            }
        }
    }
}

function desbloquearAudio() {
    bloqueioNavegador.value = false;
    if (ytPlayer && playerPronto.value && tocando.value?.tocando) {
        try {
            ytPlayer.playVideo();
        } catch {
            // ignora
        }
    }
}

// Ações do Mestre
async function adicionarMusica() {
    erroEntrada.value = '';
    const url = novaUrl.value.trim();
    if (!url) return;

    const videoId = extrairYoutubeId(url);
    if (!videoId) {
        erroEntrada.value = 'Link inválido. Cole uma URL do YouTube (ex: youtube.com/watch?v=... ou youtu.be/...)';
        return;
    }

    carregandoAdicionar.value = true;
    let titulo = novoTitulo.value.trim();

    // Se o título não foi preenchido, tenta buscar o título via oEmbed do YouTube
    if (!titulo) {
        try {
            const resp = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
            const json = await resp.json();
            if (json.title) titulo = json.title;
        } catch {
            // Fallback para nome padrão
        }
        if (!titulo) titulo = `Trilha ${playlist.value.length + 1}`;
    }

    const item: ItemMusica = {
        id: `${videoId}_${Date.now()}`,
        url,
        videoId,
        titulo,
    };

    const novaPlaylist = [...playlist.value, item];
    playlist.value = novaPlaylist;
    novaUrl.value = '';
    novoTitulo.value = '';
    carregandoAdicionar.value = false;

    // Se não havia nada tocando, já coloca para tocar
    if (!tocando.value) {
        tocarFaixa(item);
    } else {
        emit('atualizar', { playlist: novaPlaylist });
    }
}

function removerDaPlaylist(id: string) {
    if (!props.mestre) return;
    const novaPlaylist = playlist.value.filter((it) => it.id !== id);
    playlist.value = novaPlaylist;
    emit('atualizar', { playlist: novaPlaylist });
}

function tocarFaixa(item: ItemMusica) {
    if (!props.mestre) return;
    const novoTocando: EstadoMusicaTocando = {
        url: item.url,
        videoId: item.videoId,
        titulo: item.titulo,
        tocando: true,
        loop: tocando.value?.loop ?? true,
        tempo: 0,
    };
    tocando.value = novoTocando;
    sincronizarPlayer(null, novoTocando);
    emit('atualizar', { tocando: novoTocando, playlist: playlist.value });
}

function alternarPlayPause() {
    if (!props.mestre || !tocando.value) return;
    const novoTocando: EstadoMusicaTocando = {
        ...tocando.value,
        tocando: !tocando.value.tocando,
        tempo: ytPlayer?.getCurrentTime() || 0,
    };
    tocando.value = novoTocando;
    sincronizarPlayer(null, novoTocando);
    emit('atualizar', { tocando: novoTocando });
}

function alternarLoop() {
    if (!props.mestre || !tocando.value) return;
    const novoTocando: EstadoMusicaTocando = {
        ...tocando.value,
        loop: !tocando.value.loop,
    };
    tocando.value = novoTocando;
    emit('atualizar', { tocando: novoTocando });
}

function pararMusica() {
    if (!props.mestre) return;
    tocando.value = null;
    sincronizarPlayer(null, null);
    emit('atualizar', { tocando: null });
}

function proximaFaixa() {
    if (!props.mestre || !playlist.value.length) return;
    const indexAtual = playlist.value.findIndex((it) => it.videoId === tocando.value?.videoId);
    const proxima = playlist.value[(indexAtual + 1) % playlist.value.length];
    if (proxima) tocarFaixa(proxima);
}

function formatarSegundos(s: number): string {
    const mins = Math.floor(s / 60);
    const segs = Math.floor(s % 60);
    return `${mins}:${segs < 10 ? '0' : ''}${segs}`;
}

const porcentagemTempo = computed(() => {
    if (!duracao.value) return 0;
    return Math.min(100, Math.max(0, (tempoAtual.value / duracao.value) * 100));
});
</script>

<template>
    <div class="flex h-full select-none flex-col bg-preto-950 text-preto-100">
        <!-- Contêiner do IFrame oculto (YouTube) -->
        <div class="pointer-events-none absolute -left-[9999px] -top-[9999px] h-1 w-1 overflow-hidden opacity-0">
            <div ref="playerContainer" />
        </div>

        <!-- Banner de desbloqueio de áudio para o navegador se necessário -->
        <div
            v-if="bloqueioNavegador"
            class="flex items-center justify-between gap-2 border-b border-ouro-500/30 bg-ouro-500/10 p-2 text-xs text-ouro-300"
        >
            <div class="flex items-center gap-1.5">
                <CircleAlert class="size-4 shrink-0 text-ouro-400" />
                <span>O áudio da mesa foi pausado pelo seu navegador.</span>
            </div>
            <button
                type="button"
                @click="desbloquearAudio"
                class="rounded bg-ouro-500 px-2 py-1 font-semibold text-preto-950 transition hover:bg-ouro-400"
            >
                Ouvir
            </button>
        </div>

        <!-- Painel Superior: Faixa em reprodução -->
        <div class="border-b border-preto-800 bg-preto-900/60 p-3">
            <div class="mb-2 flex items-center justify-between">
                <div class="flex items-center gap-2 overflow-hidden">
                    <Music class="size-4 shrink-0" :class="tocando?.tocando ? 'animate-pulse text-ouro-400' : 'text-preto-400'" />
                    <span class="text-xs font-semibold uppercase tracking-wider text-preto-400">
                        {{ tocando ? (tocando.tocando ? 'Tocando Agora' : 'Pausado') : 'Nenhuma música' }}
                    </span>
                </div>
                <div v-if="mestre && tocando" class="flex items-center gap-1">
                    <button
                        type="button"
                        class="rounded p-1 text-preto-400 transition hover:bg-preto-800 hover:text-ouro-300"
                        :class="tocando.loop ? 'text-ouro-400' : ''"
                        :title="tocando.loop ? 'Repetir faixa (ligado)' : 'Repetir faixa (desligado)'"
                        @click="alternarLoop"
                    >
                        <Repeat class="size-3.5" />
                    </button>
                    <button
                        type="button"
                        class="hover:text-vermelho-400 rounded p-1 text-preto-400 transition hover:bg-preto-800"
                        title="Parar reprodução"
                        @click="pararMusica"
                    >
                        <Square class="size-3.5" />
                    </button>
                </div>
            </div>

            <!-- Título da música tocando -->
            <div class="mb-2">
                <p class="truncate text-sm font-medium text-preto-100" :title="tocando?.titulo ?? ''">
                    {{ tocando?.titulo ?? 'Adicione um link do YouTube para tocar' }}
                </p>
            </div>

            <!-- Barra de Progresso e Tempo -->
            <div v-if="tocando" class="mb-2.5">
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-preto-800">
                    <div class="h-full bg-ouro-500 transition-all duration-300" :style="{ width: `${porcentagemTempo}%` }" />
                </div>
                <div class="mt-1 flex justify-between font-mono text-[10px] text-preto-400">
                    <span>{{ formatarSegundos(tempoAtual) }}</span>
                    <span>{{ duracao ? formatarSegundos(duracao) : '--:--' }}</span>
                </div>
            </div>

            <!-- Controles do Mestre (Play / Pause) -->
            <div v-if="mestre && tocando" class="mb-2 flex items-center justify-center gap-2">
                <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-full bg-ouro-500 text-preto-950 transition hover:bg-ouro-400"
                    :title="tocando.tocando ? 'Pausar' : 'Tocar'"
                    @click="alternarPlayPause"
                >
                    <Pause v-if="tocando.tocando" class="size-4" />
                    <Play v-else class="ml-0.5 size-4" />
                </button>
            </div>

            <!-- Controle de Volume Individual do Jogador -->
            <div class="flex items-center gap-2 border-t border-preto-800/80 pt-1">
                <button
                    type="button"
                    class="text-preto-400 transition hover:text-ouro-300"
                    @click="mutado = !mutado"
                    :title="mutado ? 'Ativar som' : 'Mutar'"
                >
                    <VolumeX v-if="mutado || volumeIndividual === 0" class="text-vermelho-400 size-4" />
                    <Volume2 v-else class="size-4" />
                </button>
                <input
                    type="range"
                    min="0"
                    max="100"
                    v-model.number="volumeIndividual"
                    class="h-1 flex-1 cursor-pointer rounded-lg bg-preto-700 accent-ouro-500"
                    title="Volume pessoal"
                />
                <span class="w-7 text-right font-mono text-[11px] text-preto-400">
                    {{ mutado ? '0%' : `${volumeIndividual}%` }}
                </span>
            </div>
        </div>

        <!-- Formulário de Adicionar Música (Apenas Mestre) -->
        <div v-if="mestre" class="border-b border-preto-800 bg-preto-900/30 p-3">
            <form @submit.prevent="adicionarMusica" class="flex flex-col gap-2">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold text-ouro-300">Adicionar Trilha / Som</span>
                </div>
                <div class="flex flex-col gap-1.5">
                    <input
                        v-model="novaUrl"
                        type="text"
                        placeholder="Cole o link do YouTube..."
                        class="w-full rounded border border-preto-700 bg-preto-900 px-2.5 py-1.5 text-xs text-preto-100 placeholder-preto-500 focus:border-ouro-500 focus:outline-none"
                    />
                    <div class="flex gap-1.5">
                        <input
                            v-model="novoTitulo"
                            type="text"
                            placeholder="Nome / Rótulo (opcional)"
                            class="flex-1 rounded border border-preto-700 bg-preto-900 px-2.5 py-1.5 text-xs text-preto-100 placeholder-preto-500 focus:border-ouro-500 focus:outline-none"
                        />
                        <button
                            type="submit"
                            :disabled="carregandoAdicionar || !novaUrl.trim()"
                            class="flex items-center gap-1 rounded bg-ouro-500 px-3 py-1.5 text-xs font-semibold text-preto-950 transition hover:bg-ouro-400 disabled:opacity-50"
                        >
                            <Loader2 v-if="carregandoAdicionar" class="size-3.5 animate-spin" />
                            <Plus v-else class="size-3.5" />
                            <span>Adicionar</span>
                        </button>
                    </div>
                </div>
                <p v-if="erroEntrada" class="text-vermelho-400 text-[11px]">{{ erroEntrada }}</p>
            </form>
        </div>

        <!-- Lista / Playlist da Mesa -->
        <div class="flex-1 overflow-y-auto p-2">
            <div class="mb-1 flex items-center justify-between px-1.5 py-1">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-preto-400"> Playlist da Sessão ({{ playlist.length }}) </span>
            </div>

            <div v-if="!playlist.length" class="flex flex-col items-center justify-center p-6 text-center text-preto-400">
                <ListMusic class="mb-2 size-8 stroke-1 text-preto-500" />
                <p class="text-xs">Nenhuma música salva na playlist.</p>
                <p v-if="mestre" class="mt-1 text-[11px] text-preto-400">Cole um link do YouTube acima para tocar.</p>
            </div>

            <ul v-else class="flex flex-col gap-1">
                <li
                    v-for="faixa in playlist"
                    :key="faixa.id"
                    class="group flex items-center justify-between gap-2 rounded border p-2 transition"
                    :class="
                        tocando?.videoId === faixa.videoId
                            ? 'border-ouro-500/50 bg-ouro-500/10 text-ouro-200'
                            : 'border-preto-800 bg-preto-900/40 text-preto-300 hover:border-preto-700'
                    "
                >
                    <div class="flex min-w-0 flex-1 items-center gap-2">
                        <!-- Botão de Tocar direto na lista se for mestre -->
                        <button
                            v-if="mestre"
                            type="button"
                            class="shrink-0 rounded p-1 transition hover:text-ouro-400"
                            :title="tocando?.videoId === faixa.videoId && tocando?.tocando ? 'Pausar' : 'Tocar esta faixa'"
                            @click="tocando?.videoId === faixa.videoId ? alternarPlayPause() : tocarFaixa(faixa)"
                        >
                            <Pause v-if="tocando?.videoId === faixa.videoId && tocando?.tocando" class="size-4" />
                            <Play v-else class="size-4" />
                        </button>
                        <Music v-else class="size-3.5 shrink-0 text-preto-400" />

                        <div class="min-w-0 flex-1">
                            <p class="truncate text-xs font-medium" :title="faixa.titulo">
                                {{ faixa.titulo }}
                            </p>
                        </div>
                    </div>

                    <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <a
                            :href="faixa.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="rounded p-1 text-preto-400 transition hover:text-ouro-300"
                            title="Abrir no YouTube"
                        >
                            <ExternalLink class="size-3.5" />
                        </a>
                        <button
                            v-if="mestre"
                            type="button"
                            class="hover:text-vermelho-400 rounded p-1 text-preto-400 transition"
                            title="Remover da lista"
                            @click="removerDaPlaylist(faixa.id)"
                        >
                            <Trash2 class="size-3.5" />
                        </button>
                    </div>
                </li>
            </ul>
        </div>
    </div>
</template>

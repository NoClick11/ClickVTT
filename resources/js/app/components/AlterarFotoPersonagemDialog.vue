<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Camera, Circle, Copy, Image as ImageIcon, Link as LinkIcon, RefreshCw, Trash2, Upload, ZoomIn, ZoomOut } from 'lucide-vue-next';
import { computed, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps<{
    open: boolean;
    personagemNome: string;
    fotoAtual?: string | null;
    fotoTokenAtual?: string | null;
    ehNpc?: boolean;
    salvar: (dados: { arquivo?: Blob | File | null; arquivo_token?: Blob | File | null; url?: string | null; remover?: boolean }) => Promise<void>;
}>();

const emit = defineEmits<{ 'update:open': [boolean] }>();

type AbaFonte = 'arquivo' | 'url';
type AbaEnquadramento = 'ficha' | 'token';

const fonte = ref<AbaFonte>('arquivo');
const abaCorte = ref<AbaEnquadramento>('ficha');
const urlDigitada = ref('');
const erro = ref('');
const ocupado = ref(false);
const inputArquivo = ref<HTMLInputElement | null>(null);
const arrastandoArquivo = ref(false);

// Imagem carregada em memória para enquadrar
const imagemObj = ref<HTMLImageElement | null>(null);
const imagemCarregada = ref(false);
const removerFoto = ref(false);

// Estado de pan e zoom para a Ficha (4:3)
const cropFicha = ref({ x: 0, y: 0, zoom: 1 });
// Estado de pan e zoom para o Token (1:1 circular)
const cropToken = ref({ x: 0, y: 0, zoom: 1 });

// Estado de arraste com o mouse
const arrastandoPan = ref(false);
const pontoInicial = ref({ x: 0, y: 0 });
const offsetInicial = ref({ x: 0, y: 0 });

// Dimensões do viewport de enquadramento (em px na tela)
const VIEW_W = 360;
const VIEW_H = 270; // 4:3 perfeito

const corBordaToken = computed(() => (props.ehNpc ? '#d4a843' : '#0d0a12'));

watch(
    () => props.open,
    (aberto) => {
        if (!aberto) return;
        fonte.value = 'arquivo';
        abaCorte.value = 'ficha';
        urlDigitada.value = '';
        removerFoto.value = false;
        erro.value = '';
        ocupado.value = false;
        cropFicha.value = { x: 0, y: 0, zoom: 1 };
        cropToken.value = { x: 0, y: 0, zoom: 1 };

        if (props.fotoAtual) {
            carregarImagem(props.fotoAtual);
        } else {
            imagemObj.value = null;
            imagemCarregada.value = false;
        }
    },
    { immediate: true },
);

onBeforeUnmount(() => {
    limparImagem();
});

function limparImagem() {
    if (imagemObj.value?.src && imagemObj.value.src.startsWith('blob:')) {
        URL.revokeObjectURL(imagemObj.value.src);
    }
    imagemObj.value = null;
    imagemCarregada.value = false;
}

function carregarImagem(src: string) {
    erro.value = '';
    removerFoto.value = false;
    const img = new Image();
    if (src.startsWith('http://') || src.startsWith('https://')) {
        img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
        imagemObj.value = img;
        imagemCarregada.value = true;
        cropFicha.value = { x: 0, y: 0, zoom: 1 };
        cropToken.value = { x: 0, y: 0, zoom: 1 };
    };
    img.onerror = () => {
        erro.value = 'Não foi possível carregar a imagem. Verifique o link ou escolha outro arquivo.';
    };
    img.src = src;
}

function aoTrocarArquivo(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
        processarArquivo(input.files[0]);
    }
}

function aoSoltarArquivo(e: DragEvent) {
    arrastandoArquivo.value = false;
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        processarArquivo(e.dataTransfer.files[0]);
    }
}

function processarArquivo(file: File) {
    if (!file.type.startsWith('image/')) {
        erro.value = 'Selecione uma imagem válida (PNG, JPG, WEBP, GIF).';
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        erro.value = 'A imagem deve ter no máximo 10 MB.';
        return;
    }
    limparImagem();
    const url = URL.createObjectURL(file);
    carregarImagem(url);
}

function carregarUrl() {
    const u = urlDigitada.value.trim();
    if (!u) return;
    limparImagem();
    carregarImagem(u);
}

// --- Cálculos de transformação da imagem no viewport ----------------------
const estadoAtual = computed({
    get: () => (abaCorte.value === 'ficha' ? cropFicha.value : cropToken.value),
    set: (v) => {
        if (abaCorte.value === 'ficha') cropFicha.value = v;
        else cropToken.value = v;
    },
});

function calcularDimensoes(img: HTMLImageElement, zoom: number, ehToken: boolean) {
    const alvoW = ehToken ? 240 : VIEW_W;
    const alvoH = ehToken ? 240 : VIEW_H;
    const baseScale = Math.max(alvoW / img.naturalWidth, alvoH / img.naturalHeight);
    const scale = baseScale * zoom;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    return { w, h, baseScale };
}

const estiloImagem = computed(() => {
    if (!imagemObj.value) return {};
    const img = imagemObj.value;
    const { zoom, x, y } = estadoAtual.value;
    const ehToken = abaCorte.value === 'token';
    const { w, h } = calcularDimensoes(img, zoom, ehToken);

    const centroX = VIEW_W / 2 + x;
    const centroY = VIEW_H / 2 + y;

    return {
        width: `${w}px`,
        height: `${h}px`,
        left: `${centroX - w / 2}px`,
        top: `${centroY - h / 2}px`,
        position: 'absolute' as const,
        pointerEvents: 'none' as const,
        userSelect: 'none' as const,
        maxWidth: 'none',
    };
});

function iniciarArrasto(e: MouseEvent) {
    if (!imagemCarregada.value) return;
    arrastandoPan.value = true;
    pontoInicial.value = { x: e.clientX, y: e.clientY };
    offsetInicial.value = { x: estadoAtual.value.x, y: offsetInicial.value.y };
    window.addEventListener('mousemove', moverArrasto);
    window.addEventListener('mouseup', encerrarArrasto);
}

function moverArrasto(e: MouseEvent) {
    if (!arrastandoPan.value) return;
    const dx = e.clientX - pontoInicial.value.x;
    const dy = e.clientY - pontoInicial.value.y;
    estadoAtual.value = {
        ...estadoAtual.value,
        x: offsetInicial.value.x + dx,
        y: offsetInicial.value.y + dy,
    };
}

function encerrarArrasto() {
    arrastandoPan.value = false;
    window.removeEventListener('mousemove', moverArrasto);
    window.removeEventListener('mouseup', encerrarArrasto);
}

function aoRolarMouse(e: WheelEvent) {
    if (!imagemCarregada.value) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    definirZoom(estadoAtual.value.zoom + delta);
}

function definirZoom(novo: number) {
    const limitado = Math.max(1, Math.min(4, Math.round(novo * 100) / 100));
    estadoAtual.value = { ...estadoAtual.value, zoom: limitado };
}

function resetarEnquadramento() {
    estadoAtual.value = { x: 0, y: 0, zoom: 1 };
}

function copiarEnquadramentoFicha() {
    cropToken.value = { ...cropFicha.value };
}

function marcarRemocao() {
    limparImagem();
    removerFoto.value = true;
    erro.value = '';
}

// --- Geração dos Blobs de corte --------------------------------------------
function dataUrlParaBlob(dataUrl: string): Blob {
    const partes = dataUrl.split(',');
    const mime = partes[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(partes[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

function canvasParaBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
        try {
            let finalizado = false;
            // Fallback rápido via toDataURL se toBlob demorar
            const timer = setTimeout(() => {
                if (finalizado) return;
                finalizado = true;
                try {
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                    resolve(dataUrlParaBlob(dataUrl));
                } catch (e) {
                    reject(e);
                }
            }, 400);

            canvas.toBlob(
                (blob) => {
                    if (finalizado) return;
                    finalizado = true;
                    clearTimeout(timer);
                    if (blob) {
                        resolve(blob);
                    } else {
                        try {
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                            resolve(dataUrlParaBlob(dataUrl));
                        } catch (e) {
                            reject(e);
                        }
                    }
                },
                'image/jpeg',
                0.92,
            );
        } catch (err) {
            try {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                resolve(dataUrlParaBlob(dataUrl));
            } catch (fallbackErr) {
                reject(fallbackErr);
            }
        }
    });
}

async function gerarBlob(
    img: HTMLImageElement,
    crop: { x: number; y: number; zoom: number },
    targetW: number,
    targetH: number,
    ehToken: boolean,
): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível obter contexto 2D');

    // Cálculos relativos
    const viewRefW = ehToken ? 240 : VIEW_W;
    const viewRefH = ehToken ? 240 : VIEW_H;
    const ratio = targetW / viewRefW;

    const { w, h } = calcularDimensoes(img, crop.zoom, ehToken);
    const renderW = w * ratio;
    const renderH = h * ratio;
    const centroX = targetW / 2 + crop.x * ratio;
    const centroY = targetH / 2 + crop.y * ratio;
    const drawX = centroX - renderW / 2;
    const drawY = centroY - renderH / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(img, drawX, drawY, renderW, renderH);

    return canvasParaBlob(canvas);
}

function fechar() {
    ocupado.value = false;
    emit('update:open', false);
}

async function confirmar() {
    erro.value = '';
    ocupado.value = true;
    try {
        if (removerFoto.value) {
            await props.salvar({ remover: true });
        } else if (imagemObj.value && imagemCarregada.value) {
            // Gera o recorte da Ficha (proporção 4:3, 600x450)
            const blobFicha = await gerarBlob(imagemObj.value, cropFicha.value, 600, 450, false);
            // Gera o recorte do Token (1:1, 400x400)
            const blobToken = await gerarBlob(imagemObj.value, cropToken.value, 400, 400, true);

            await props.salvar({
                arquivo: blobFicha,
                arquivo_token: blobToken,
            });
        } else if (urlDigitada.value.trim()) {
            await props.salvar({ url: urlDigitada.value.trim() });
        } else if (!props.fotoAtual) {
            erro.value = 'Selecione ou insira uma imagem primeiro.';
            ocupado.value = false;
            return;
        }
        fechar();
    } catch (e: any) {
        console.error('Falha ao salvar foto do personagem:', e);
        const msg = e?.response?.data?.message || e?.message || '';
        if (msg.includes('tainted') || msg.includes('CORS') || msg.includes('SecurityError')) {
            erro.value = 'Esta imagem externa possui bloqueio de segurança (CORS). Baixe-a e selecione Enviar arquivo.';
        } else {
            erro.value = msg || 'Não foi possível salvar a imagem.';
        }
    } finally {
        ocupado.value = false;
    }
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="border-preto-800 bg-preto-950 p-5 text-preto-100 sm:max-w-xl">
            <DialogHeader class="pb-2">
                <DialogTitle class="flex items-center gap-2 text-ouro-300">
                    <Camera class="size-5" />
                    Enquadrar Foto: {{ personagemNome }}
                </DialogTitle>
                <DialogDescription class="text-xs text-preto-400">
                    Ajuste o enquadramento do retrato da ficha (4:3) e do token circular no mapa.
                </DialogDescription>
            </DialogHeader>

            <div class="space-y-3">
                <!-- Seletor de arquivo ou URL (se ainda não escolheu ou quer trocar) -->
                <div class="flex items-center justify-between gap-2 border-b border-preto-800 pb-2.5">
                    <div class="flex gap-1.5">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            class="h-7 border-preto-700 bg-preto-900/60 text-xs"
                            :class="{ 'border-ouro-400 text-ouro-300': fonte === 'arquivo' }"
                            @click="fonte = 'arquivo'"
                        >
                            <Upload class="mr-1 size-3.5" /> Enviar arquivo
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            class="h-7 border-preto-700 bg-preto-900/60 text-xs"
                            :class="{ 'border-ouro-400 text-ouro-300': fonte === 'url' }"
                            @click="fonte = 'url'"
                        >
                            <LinkIcon class="mr-1 size-3.5" /> Link da imagem
                        </Button>
                    </div>

                    <Button
                        v-if="(props.fotoAtual || imagemCarregada) && !removerFoto"
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="h-7 px-2 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300"
                        @click="marcarRemocao"
                    >
                        <Trash2 class="mr-1 size-3.5" /> Remover foto
                    </Button>
                </div>

                <!-- Entrada por Arquivo -->
                <div v-if="fonte === 'arquivo' && !imagemCarregada && !removerFoto" class="space-y-2">
                    <input
                        ref="inputArquivo"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        class="hidden"
                        @change="aoTrocarArquivo"
                    />
                    <div
                        class="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-preto-700 bg-preto-900/40 p-6 text-center transition hover:border-ouro-500/50 hover:bg-preto-900/80"
                        @click="inputArquivo?.click()"
                        @dragover.prevent="arrastandoArquivo = true"
                        @dragleave.prevent="arrastandoArquivo = false"
                        @drop.prevent="aoSoltarArquivo"
                    >
                        <Upload class="mb-2 size-8 text-ouro-400" />
                        <span class="text-sm font-medium text-preto-200">Clique ou arraste uma foto aqui</span>
                        <span class="mt-1 text-xs text-preto-400">PNG, JPG, WEBP ou GIF (máx. 10 MB)</span>
                    </div>
                </div>

                <!-- Entrada por Link -->
                <div v-else-if="fonte === 'url' && !imagemCarregada && !removerFoto" class="flex gap-2">
                    <input
                        v-model="urlDigitada"
                        type="url"
                        placeholder="https://exemplo.com/personagem.png"
                        class="flex-1 rounded border border-preto-700 bg-preto-900 px-2.5 py-1.5 text-xs text-preto-100 placeholder-preto-500 focus:border-ouro-400 focus:outline-none"
                        @keydown.enter.prevent="carregarUrl"
                    />
                    <Button type="button" size="sm" class="h-8 bg-ouro-500 text-xs text-preto-950 hover:bg-ouro-400" @click="carregarUrl">
                        Carregar
                    </Button>
                </div>

                <!-- Se marcou remoção -->
                <div v-if="removerFoto" class="flex flex-col items-center justify-center py-6 text-center text-preto-400">
                    <Trash2 class="mb-2 size-8 text-red-400" />
                    <p class="text-xs">A foto será removida e o personagem voltará a exibir a inicial com fundo colorido.</p>
                    <Button
                        type="button"
                        variant="link"
                        class="mt-1 text-xs text-ouro-400"
                        @click="
                            removerFoto = false;
                            if (props.fotoAtual) carregarImagem(props.fotoAtual);
                        "
                    >
                        Desfazer remoção
                    </Button>
                </div>

                <!-- Ferramenta de Enquadramento (Cropper) -->
                <div v-else-if="imagemCarregada" class="space-y-2.5">
                    <!-- Abas de enquadramento: Ficha vs Token -->
                    <div class="flex items-center justify-between">
                        <div class="flex rounded-md border border-preto-800 bg-preto-900 p-0.5 text-xs">
                            <button
                                type="button"
                                class="flex items-center gap-1.5 rounded px-3 py-1 font-medium transition"
                                :class="abaCorte === 'ficha' ? 'bg-ouro-500 text-preto-950 shadow' : 'text-preto-400 hover:text-preto-200'"
                                @click="abaCorte = 'ficha'"
                            >
                                <ImageIcon class="size-3.5" />
                                1. Ficha (4:3)
                            </button>
                            <button
                                type="button"
                                class="flex items-center gap-1.5 rounded px-3 py-1 font-medium transition"
                                :class="abaCorte === 'token' ? 'bg-ouro-500 text-preto-950 shadow' : 'text-preto-400 hover:text-preto-200'"
                                @click="abaCorte = 'token'"
                            >
                                <Circle class="size-3.5" />
                                2. Token do Mapa
                            </button>
                        </div>

                        <div class="flex items-center gap-2">
                            <Button
                                v-if="abaCorte === 'token'"
                                type="button"
                                variant="ghost"
                                size="sm"
                                class="h-6 gap-1 px-1.5 text-[11px] text-preto-400 hover:text-ouro-300"
                                title="Copiar enquadramento definido na ficha"
                                @click="copiarEnquadramentoFicha"
                            >
                                <Copy class="size-3" /> Igual à ficha
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                class="h-6 gap-1 px-1.5 text-[11px] text-preto-400 hover:text-ouro-300"
                                title="Recentralizar imagem"
                                @click="resetarEnquadramento"
                            >
                                <RefreshCw class="size-3" /> Centralizar
                            </Button>
                        </div>
                    </div>

                    <!-- Viewport de Arraste e Visualização -->
                    <div class="flex justify-center">
                        <div
                            class="relative cursor-grab select-none overflow-hidden rounded-lg border border-preto-800 bg-preto-900 shadow-inner active:cursor-grabbing"
                            :style="{ width: `${VIEW_W}px`, height: `${VIEW_H}px` }"
                            @mousedown="iniciarArrasto"
                            @wheel="aoRolarMouse"
                        >
                            <!-- Imagem sob transformação -->
                            <img v-if="imagemObj" :src="imagemObj.src" alt="Enquadramento" :style="estiloImagem" draggable="false" />

                            <!-- MÁSCARA 1: MODO FICHA (Retângulo 4:3) -->
                            <div
                                v-if="abaCorte === 'ficha'"
                                class="pointer-events-none absolute inset-0 border-2 border-ouro-400/90 shadow-[0_0_0_9999px_rgba(13,10,18,0.5)]"
                            >
                                <div class="absolute bottom-1 right-2 rounded bg-preto-950/80 px-1.5 py-0.5 text-[10px] text-ouro-300">
                                    Enquadramento da Ficha
                                </div>
                            </div>

                            <!-- MÁSCARA 2: MODO TOKEN (Círculo 1:1 com borda de token) -->
                            <div v-else class="pointer-events-none absolute inset-0 flex items-center justify-center bg-preto-950/60">
                                <!-- Círculo do Token com a borda de token e sombra externa recortada -->
                                <div
                                    class="relative size-[240px] rounded-full shadow-[0_0_0_9999px_rgba(13,10,18,0.7)]"
                                    :style="{
                                        border: `4px solid ${corBordaToken}`,
                                    }"
                                >
                                    <!-- Badge de identificação da borda -->
                                    <div
                                        class="absolute -top-3 left-1/2 -translate-x-1/2 rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-preto-950 shadow"
                                        :style="{ background: corBordaToken, color: props.ehNpc ? '#0d0a12' : '#ffffff' }"
                                    >
                                        {{ props.ehNpc ? 'Borda de NPC' : 'Borda de Jogador' }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Controles de Zoom -->
                    <div class="flex items-center justify-center gap-3 px-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            class="size-7 p-0 text-preto-400 hover:text-ouro-300"
                            @click="definirZoom(estadoAtual.zoom - 0.15)"
                        >
                            <ZoomOut class="size-4" />
                        </Button>
                        <input
                            type="range"
                            min="1"
                            max="4"
                            step="0.05"
                            :value="estadoAtual.zoom"
                            class="w-48 cursor-pointer accent-ouro-400"
                            @input="definirZoom(Number(($event.target as HTMLInputElement).value))"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            class="size-7 p-0 text-preto-400 hover:text-ouro-300"
                            @click="definirZoom(estadoAtual.zoom + 0.15)"
                        >
                            <ZoomIn class="size-4" />
                        </Button>
                        <span class="w-12 text-center font-mono text-xs text-preto-400"> {{ Math.round(estadoAtual.zoom * 100) }}% </span>
                    </div>

                    <p class="text-center text-[11px] text-preto-400">Arraste a imagem para enquadrar · Role o mouse para dar zoom</p>
                </div>

                <!-- Mensagem de erro -->
                <div v-if="erro" class="rounded border border-red-800/50 bg-red-950/60 p-2 text-xs text-red-300">
                    {{ erro }}
                </div>
            </div>

            <DialogFooter class="gap-2 border-t border-preto-800 pt-2 sm:gap-0">
                <Button
                    type="button"
                    variant="outline"
                    class="border-preto-700 bg-transparent text-preto-300 hover:bg-preto-900 hover:text-preto-100"
                    @click="fechar"
                >
                    Cancelar
                </Button>
                <Button
                    type="button"
                    class="bg-ouro-500 text-preto-950 hover:bg-ouro-400"
                    :disabled="ocupado || (!imagemCarregada && !removerFoto && !urlDigitada.trim())"
                    @click="confirmar"
                >
                    {{ ocupado ? 'Salvando...' : 'Salvar Enquadramento' }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>

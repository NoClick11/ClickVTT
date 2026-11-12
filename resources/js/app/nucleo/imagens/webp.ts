/**
 * Converte um arquivo de imagem (PNG, JPG, BMP, etc.) para WebP no navegador via Canvas.
 * - Mantém vídeos (.mp4, .webm) e GIFs intactos (para não perder animações).
 * - Se já for WebP, retorna o próprio arquivo.
 * - Redimensiona proporcionalmente se passar de maxDimensao (padrão 8192px) para proteger GPU/Canvas.
 * - Preserva transparência (canal alpha).
 */
export async function converterParaWebp(arquivo: File, opcoes: { qualidade?: number; maxDimensao?: number } = {}): Promise<File> {
    const { qualidade = 0.85, maxDimensao = 8192 } = opcoes;

    const nome = arquivo.name || 'imagem';
    const tipo = (arquivo.type || '').toLowerCase();
    const ext = nome.split('.').pop()?.toLowerCase() || '';

    // Vídeos e GIFs animados continuam em seu formato original
    const ehVideo = tipo.startsWith('video/') || ['mp4', 'webm'].includes(ext);
    const ehGif = tipo === 'image/gif' || ext === 'gif';
    if (ehVideo || ehGif) {
        return arquivo;
    }

    // Se já for WebP, não há necessidade de reconverter
    if (tipo === 'image/webp' || ext === 'webp') {
        return arquivo;
    }

    // Se não for imagem conhecida, retorna como está
    const formatosImagem = ['png', 'jpg', 'jpeg', 'bmp', 'svg', 'tiff', 'tif', 'avif'];
    const ehImagem = tipo.startsWith('image/') || formatosImagem.includes(ext);
    if (!ehImagem) {
        return arquivo;
    }

    try {
        const url = URL.createObjectURL(arquivo);
        try {
            const img = await carregarElementoImagem(url);
            let w = img.naturalWidth || img.width;
            let h = img.naturalHeight || img.height;

            if (!w || !h) {
                return arquivo;
            }

            // Limita a dimensão máxima mantendo a proporção para não estourar limites de memória
            if (w > maxDimensao || h > maxDimensao) {
                if (w >= h) {
                    h = Math.round((h * maxDimensao) / w);
                    w = maxDimensao;
                } else {
                    w = Math.round((w * maxDimensao) / h);
                    h = maxDimensao;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return arquivo;
            }

            ctx.drawImage(img, 0, 0, w, h);

            const blob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((b) => resolve(b), 'image/webp', qualidade);
            });

            if (!blob) {
                return arquivo;
            }

            const novoNome = nome.replace(/\.[^.]+$/, '') + '.webp';
            return new File([blob], novoNome, { type: 'image/webp', lastModified: Date.now() });
        } finally {
            URL.revokeObjectURL(url);
        }
    } catch (e) {
        console.warn('Falha ao converter imagem para WebP no cliente, usando original:', e);
        return arquivo;
    }
}

function carregarElementoImagem(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = url;
    });
}

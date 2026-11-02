import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { GifSprite } from 'pixi.js/gif';
import type { ObjetoDto } from './tipos';

/** Representa um objeto da cena no Pixi: imagem/vídeo/GIF (mapa), token (círculo), luz ou parede. */
export class ObjetoVisual {
    readonly container = new Container();
    dto: ObjetoDto;

    private fundo = new Graphics();
    private midia: Container | null = null;
    private video: HTMLVideoElement | null = null;
    private texturaVideo: Texture | null = null;
    private rotulo: Text | null = null;
    private arquivoCarregado: string | null = null;
    private destruido = false;

    constructor(dto: ObjetoDto) {
        this.dto = { ...dto };
        this.container.addChild(this.fundo);
        this.aplicar();
        void this.carregarMidia();
    }

    atualizar(dto: ObjetoDto): void {
        const arquivoMudou = dto.arquivo !== this.dto.arquivo || dto.arquivo_tipo !== this.dto.arquivo_tipo;
        this.dto = { ...dto };
        this.aplicar();
        if (arquivoMudou) void this.carregarMidia();
    }

    /** Atualiza só a geometria (arrasto local, sem tocar no resto). */
    definirGeometria(campos: Partial<Pick<ObjetoDto, 'x' | 'y' | 'largura' | 'altura'>>): void {
        Object.assign(this.dto, campos);
        this.aplicar();
    }

    contem(x: number, y: number): boolean {
        const { x: ox, y: oy, largura, altura } = this.dto;
        return x >= ox && x <= ox + largura && y >= oy && y <= oy + altura;
    }

    destruir(): void {
        this.destruido = true;
        this.liberarMidia();
        this.container.destroy({ children: true });
    }

    // -------------------------------------------------------------------------

    private get ehToken(): boolean {
        return this.dto.tipo === 'token';
    }

    private aplicar(): void {
        const { x, y, largura, altura, camada } = this.dto;
        this.container.position.set(x, y);
        // Objetos da camada do mestre aparecem esmaecidos: o jogador não os vê.
        this.container.alpha = camada === 'mestre' ? 0.6 : 1;
        this.desenharFundo();
        this.ajustarMidia();
        this.atualizarRotulo(largura, altura);
    }

    private desenharFundo(): void {
        const { largura, altura, camada, dados, nome } = this.dto;
        const g = this.fundo.clear();
        if (this.ehToken) {
            const r = Math.min(largura, altura) / 2;
            g.circle(largura / 2, altura / 2, r).fill({ color: corHex(dados?.cor), alpha: this.arquivoCarregado ? 0.001 : 1 });
            g.circle(largura / 2, altura / 2, r).stroke({ color: camada === 'mestre' ? 0xd4a843 : 0x0d0a12, width: 3, alpha: 0.9 });
        } else if (!this.arquivoCarregado) {
            // Mapa/imagem ainda carregando ou sem arquivo.
            g.rect(0, 0, largura, altura).fill({ color: 0x25212b, alpha: 0.6 }).stroke({ color: 0x4a4452, width: 2 });
        }
        void nome;
    }

    private atualizarRotulo(largura: number, altura: number): void {
        const precisa = this.ehToken && !this.arquivoCarregado;
        if (!precisa) {
            this.rotulo?.destroy();
            this.rotulo = null;
            return;
        }
        if (!this.rotulo) {
            this.rotulo = new Text({ text: '', style: { fontFamily: 'Georgia, serif', fontWeight: '700', fill: 0x0d0a12, fontSize: 28 } });
            this.rotulo.anchor.set(0.5);
            this.container.addChild(this.rotulo);
        }
        this.rotulo.text = (this.dto.nome ?? '?').trim().slice(0, 1).toUpperCase() || '?';
        this.rotulo.style.fontSize = Math.max(10, Math.min(largura, altura) * 0.5);
        this.rotulo.position.set(largura / 2, altura / 2);
    }

    private ajustarMidia(): void {
        const m = this.midia;
        if (!m) return;
        const { largura, altura } = this.dto;
        if (this.ehToken) {
            // Imagem do token recortada em círculo (cobre o círculo).
            const lado = Math.max(largura, altura);
            m.width = lado;
            m.height = lado;
            m.position.set((largura - lado) / 2, (altura - lado) / 2);
            const mascara = (m as Container & { __mascara?: Graphics }).__mascara ?? new Graphics();
            (m as Container & { __mascara?: Graphics }).__mascara = mascara;
            mascara.clear().circle(largura / 2, altura / 2, Math.min(largura, altura) / 2).fill(0xffffff);
            if (!mascara.parent) this.container.addChild(mascara);
            m.mask = mascara;
        } else {
            m.width = largura;
            m.height = altura;
            m.position.set(0, 0);
        }
    }

    private async carregarMidia(): Promise<void> {
        const { arquivo, arquivo_tipo: tipo } = this.dto;
        this.liberarMidia();
        this.arquivoCarregado = null;
        if (!arquivo) {
            this.aplicar();
            return;
        }
        let midia: Container | null = null;
        try {
            if (tipo === 'video') midia = await this.criarVideo(arquivo);
            else if (tipo === 'gif') midia = new GifSprite({ source: await Assets.load(arquivo), autoPlay: true, loop: true });
            else midia = new Sprite(await Assets.load<Texture>(arquivo));
        } catch (erro) {
            console.warn('Falha ao carregar mídia', arquivo, erro);
        }
        if (this.destruido || arquivo !== this.dto.arquivo) {
            midia?.destroy();
            return;
        }
        if (midia) {
            this.midia = midia;
            this.arquivoCarregado = arquivo;
            this.container.addChildAt(midia, 1);
        }
        this.aplicar();
    }

    private async criarVideo(url: string): Promise<Sprite> {
        const video = document.createElement('video');
        video.src = url;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.preload = 'auto';
        await new Promise<void>((ok, falha) => {
            video.addEventListener('loadeddata', () => ok(), { once: true });
            video.addEventListener('error', () => falha(new Error('vídeo inválido')), { once: true });
            video.load();
        });
        await video.play().catch(() => undefined);
        this.video = video;
        this.texturaVideo = Texture.from(video);

        return new Sprite(this.texturaVideo);
    }

    private liberarMidia(): void {
        if (this.video) {
            this.video.pause();
            this.video.removeAttribute('src');
            this.video.load();
            this.video = null;
        }
        this.texturaVideo?.destroy(true);
        this.texturaVideo = null;
        if (this.midia) {
            this.midia.mask = null;
            const mascara = (this.midia as Container & { __mascara?: Graphics }).__mascara;
            mascara?.destroy();
            this.midia.destroy();
            this.midia = null;
        }
    }
}

export function corHex(cor?: string): number {
    return cor && /^#[0-9a-f]{6}$/i.test(cor) ? parseInt(cor.slice(1), 16) : 0xd4a843;
}

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
    private marcador = new Graphics();
    private destruido = false;
    private enfase = true;

    constructor(dto: ObjetoDto, private mestre = false) {
        this.dto = { ...dto };
        this.container.addChild(this.fundo, this.marcador);
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

    /** Paredes ficam esmaecidas quando a camada de iluminação não está ativa. */
    definirEnfase(ativa: boolean): void {
        this.enfase = ativa;
        this.aplicar();
    }

    /** Clique em (x, y): retângulo para a maioria; segmento (com tolerância) para paredes. */
    acerta(x: number, y: number, tolerancia: number): boolean {
        const pts = this.dto.dados?.pontos;
        if (this.dto.tipo === 'parede' && pts?.length === 4) return distanciaAoSegmento(x, y, pts[0], pts[1], pts[2], pts[3]) <= tolerancia;
        if (this.dto.tipo === 'luz') {
            const { x: ox, y: oy, largura, altura } = this.dto;
            return Math.hypot(x - (ox + largura / 2), y - (oy + altura / 2)) <= Math.max(Math.min(largura, altura) / 2, tolerancia);
        }

        return this.contem(x, y);
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
        this.container.alpha = camada === 'mestre' ? 0.6 : this.dto.tipo === 'parede' && !this.enfase ? 0.25 : 1;
        this.desenharFundo();
        this.desenharMarcador();
        this.ajustarMidia();
        this.atualizarRotulo(largura, altura);
    }

    private desenharFundo(): void {
        const { largura, altura, camada, dados, nome } = this.dto;
        const g = this.fundo.clear();
        if (this.dto.tipo === 'luz') {
            this.desenharLuz(g);
        } else if (this.dto.tipo === 'parede') {
            this.desenharParede(g);
        } else if (this.ehToken && !this.arquivoCarregado) {
            // Sem imagem: círculo colorido com a inicial. Com imagem, ela ocupa o token inteiro.
            // Preenche o token inteiro (elipse): esticar o token estica o desenho, como a imagem.
            g.ellipse(largura / 2, altura / 2, largura / 2, altura / 2).fill({ color: corHex(dados?.cor), alpha: 1 });
            g.ellipse(largura / 2, altura / 2, largura / 2, altura / 2).stroke({ color: camada === 'mestre' ? 0xd4a843 : 0x0d0a12, width: 3, alpha: 0.9 });
        } else if (!this.arquivoCarregado) {
            // Mapa/imagem ainda carregando ou sem arquivo.
            g.rect(0, 0, largura, altura).fill({ color: 0x25212b, alpha: 0.6 }).stroke({ color: 0x4a4452, width: 2 });
        }
        void nome;
    }

    /** Brilho radial somado ao mapa (visível ao jogador). */
    private desenharLuz(g: Graphics): void {
        const { largura, altura, dados } = this.dto;
        const r = Math.min(largura, altura) / 2;
        const cor = corHex(dados?.cor ?? '#ffd27a');
        const aneis = 28;
        for (let i = 0; i < aneis; i++) g.circle(largura / 2, altura / 2, r * (1 - i / aneis)).fill({ color: cor, alpha: 0.045 });
        g.blendMode = 'add';
    }

    /** Parede, porta ou janela: só o mestre recebe estes objetos. */
    private desenharParede(g: Graphics): void {
        const pts = this.dto.dados?.pontos;
        if (!pts || pts.length !== 4) return;
        const tipo = this.dto.dados?.tipo ?? 'parede';
        const aberta = !!this.dto.dados?.aberta;
        const cor = tipo === 'porta' ? 0x38bdf8 : tipo === 'janela' ? 0x67e8f9 : 0xf4e0a0;
        const [ox, oy] = [this.dto.x, this.dto.y];
        const a = { x: pts[0] - ox, y: pts[1] - oy };
        const b = { x: pts[2] - ox, y: pts[3] - oy };
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: cor, width: tipo === 'janela' ? 6 : 9, alpha: tipo === 'porta' && aberta ? 0.35 : 0.95, cap: 'round' });
        g.circle(a.x, a.y, 7).fill(0x0d0a12).stroke({ color: cor, width: 2 });
        g.circle(b.x, b.y, 7).fill(0x0d0a12).stroke({ color: cor, width: 2 });
    }

    /** Luz: ponto de controle visível só ao mestre (o jogador vê apenas o brilho). */
    private desenharMarcador(): void {
        const g = this.marcador.clear();
        if (this.dto.tipo !== 'luz' || !this.mestre) return;
        g.circle(this.dto.largura / 2, this.dto.altura / 2, 9).fill(0x0d0a12).stroke({ color: corHex(this.dto.dados?.cor ?? '#ffd27a'), width: 3 });
        g.circle(this.dto.largura / 2, this.dto.altura / 2, 3).fill(0xffffff);
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

    /** A mídia preenche todo o objeto (estica, sem recortar): o que foi colocado dentro nunca é cortado. */
    private ajustarMidia(): void {
        const m = this.midia;
        if (!m) return;
        m.width = this.dto.largura;
        m.height = this.dto.altura;
        m.position.set(0, 0);
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
            this.midia.destroy();
            this.midia = null;
        }
    }
}

export function corHex(cor?: string): number {
    return cor && /^#[0-9a-f]{6}$/i.test(cor) ? parseInt(cor.slice(1), 16) : 0xd4a843;
}

function distanciaAoSegmento(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const comprimento2 = dx * dx + dy * dy;
    const t = comprimento2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / comprimento2));

    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

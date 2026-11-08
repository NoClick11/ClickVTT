import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { GifSprite } from 'pixi.js/gif';
import type { BarraDoToken } from '../nucleo/sistemas/tipos';
import { iconeDoStatus } from '../nucleo/status';
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
    private textoLivre: Text | null = null;
    private arquivoCarregado: string | null = null;
    private marcador = new Graphics();
    private iconesStatus = new Container();
    private statusDesenhado = '';
    private barras = new Container();
    private barrasDesenhadas = '';
    private mira = new Graphics();
    private miraLigada = false;
    private destruido = false;
    private enfase = true;
    /** Iluminação dinâmica ligada: a luz vem do mapa de luz (GPU), não do brilho desenhado aqui. */
    private luzDinamica = false;

    constructor(
        dto: ObjetoDto,
        private mestre = false,
    ) {
        this.dto = { ...dto };
        this.container.addChild(this.fundo, this.marcador, this.iconesStatus, this.barras, this.mira);
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

    definirLuzDinamica(ligada: boolean): void {
        if (this.luzDinamica === ligada) return;
        this.luzDinamica = ligada;
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

        if (this.dto.tipo === 'traco' && this.dto.dados?.pontos) {
            const p = this.dto.dados.pontos;
            const sx = this.dto.largura / (this.dto.dados.largura_original || this.dto.largura);
            const sy = this.dto.altura / (this.dto.dados.altura_original || this.dto.altura);
            const folga = tolerancia + (this.dto.dados.espessura ?? 4) / 2;
            for (let i = 0; i + 3 < p.length; i += 2) {
                if (
                    distanciaAoSegmento(
                        x,
                        y,
                        this.dto.x + p[i] * sx,
                        this.dto.y + p[i + 1] * sy,
                        this.dto.x + p[i + 2] * sx,
                        this.dto.y + p[i + 3] * sy,
                    ) <= folga
                )
                    return true;
            }

            return false;
        }

        return this.contem(x, y);
    }

    contem(x: number, y: number): boolean {
        const { x: ox, y: oy, largura, altura } = this.caixa();
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
        this.container.alpha = camada === 'mestre' ? 0.6 : this.dto.tipo === 'parede' && this.mestre && !this.enfase ? 0.25 : 1;
        this.desenharFundo();
        this.desenharMarcador();
        this.desenharStatus();
        this.desenharBarras();
        this.desenharMira();
        this.ajustarMidia();
        this.atualizarRotulo(largura, altura);
    }

    private desenharFundo(): void {
        const { largura, altura, camada, dados, nome } = this.dto;
        const g = this.fundo.clear();
        if (this.dto.tipo === 'traco') {
            this.desenharTraco(g);
        } else if (this.dto.tipo === 'texto') {
            this.desenharTexto();
        } else if (this.dto.tipo === 'luz') {
            this.desenharLuz(g);
        } else if (this.dto.tipo === 'parede') {
            this.desenharParede(g);
        } else if (this.dto.tipo === 'loot') {
            this.desenharLoot(g);
        } else if (this.ehToken && !this.arquivoCarregado) {
            // Sem imagem: círculo colorido com a inicial. Com imagem, ela ocupa o token inteiro.
            // Preenche o token inteiro (elipse): esticar o token estica o desenho, como a imagem.
            g.ellipse(largura / 2, altura / 2, largura / 2, altura / 2).fill({ color: corHex(dados?.cor), alpha: 1 });
            g.ellipse(largura / 2, altura / 2, largura / 2, altura / 2).stroke({
                color: camada === 'mestre' ? 0xd4a843 : 0x0d0a12,
                width: 3,
                alpha: 0.9,
            });
        } else if (!this.arquivoCarregado) {
            // Mapa/imagem ainda carregando ou sem arquivo.
            g.rect(0, 0, largura, altura).fill({ color: 0x25212b, alpha: 0.6 }).stroke({ color: 0x4a4452, width: 2 });
        }
        void nome;
    }

    /** Loot: um saco simples (corpo redondo, pescoço amarrado e a boca franzida no topo), numa cor só com contorno escuro. */
    private desenharLoot(g: Graphics): void {
        const { largura: w, altura: h } = this.dto;
        const s = Math.min(w, h);
        const ox = (w - s) / 2;
        const oy = (h - s) / 2;
        const px = (v: number) => ox + v * s;
        const py = (v: number) => oy + v * s;
        const cor = 0xb08850;
        const contorno = { color: 0x0d0a12, width: 3 };
        // boca franzida
        g.poly([px(0.36), py(0.16), px(0.5), py(0.28), px(0.64), py(0.16), px(0.6), py(0.34), px(0.4), py(0.34)])
            .fill(cor)
            .stroke(contorno);
        // corpo
        g.ellipse(px(0.5), py(0.64), s * 0.3, s * 0.27)
            .fill(cor)
            .stroke(contorno);
        // pescoço e laço
        g.poly([px(0.41), py(0.34), px(0.59), py(0.34), px(0.57), py(0.43), px(0.43), py(0.43)]).fill(cor);
        g.roundRect(px(0.4), py(0.37), s * 0.2, s * 0.05, s * 0.025)
            .fill(0xd4a843)
            .stroke({ color: 0x0d0a12, width: 2 });
    }

    /** Traço livre: pontos relativos ao objeto; esticar o objeto estica o desenho. */
    private desenharTraco(g: Graphics): void {
        const { dados, largura, altura } = this.dto;
        const pts = dados?.pontos;
        if (!pts || pts.length < 4) return;
        const sx = largura / (dados?.largura_original || largura);
        const sy = altura / (dados?.altura_original || altura);
        g.moveTo(pts[0] * sx, pts[1] * sy);
        for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i] * sx, pts[i + 1] * sy);
        g.stroke({ color: corHex(dados?.cor), width: dados?.espessura ?? 4, cap: 'round', join: 'round' });
    }

    /** Texto livre (não estica): o tamanho vem de `dados.tamanho`. */
    private desenharTexto(): void {
        const { dados } = this.dto;
        if (!this.textoLivre) {
            this.textoLivre = new Text({ text: '', style: { fontFamily: 'Georgia, serif', fontWeight: '700', fill: 0xffffff, fontSize: 28 } });
            this.container.addChild(this.textoLivre);
        }
        const t = this.textoLivre;
        t.text = dados?.texto ?? '';
        t.style.fontSize = dados?.tamanho ?? 28;
        t.style.fill = corHex(dados?.cor ?? '#ffffff');
        t.style.stroke = { color: 0x0d0a12, width: Math.max(2, (dados?.tamanho ?? 28) / 8) };
    }

    /** Caixa real em coordenadas do mundo (texto usa a medida do próprio texto). */
    caixa(): { x: number; y: number; largura: number; altura: number } {
        if (this.dto.tipo === 'texto' && this.textoLivre) {
            return { x: this.dto.x, y: this.dto.y, largura: this.textoLivre.width, altura: this.textoLivre.height };
        }
        const { x, y, largura, altura } = this.dto;

        return { x, y, largura, altura };
    }

    /** Brilho radial somado ao mapa (visível ao jogador). */
    private desenharLuz(g: Graphics): void {
        if (this.luzDinamica) return;
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
        if (!this.mestre) return this.desenharControle(g, pts, tipo, aberta);
        const cor = tipo === 'porta' ? 0x38bdf8 : tipo === 'janela' ? 0x67e8f9 : 0xf4e0a0;
        const [ox, oy] = [this.dto.x, this.dto.y];
        const a = { x: pts[0] - ox, y: pts[1] - oy };
        const b = { x: pts[2] - ox, y: pts[3] - oy };
        g.moveTo(a.x, a.y)
            .lineTo(b.x, b.y)
            .stroke({ color: cor, width: tipo === 'janela' ? 6 : 9, alpha: tipo === 'porta' && aberta ? 0.35 : 0.95, cap: 'round' });
        g.circle(a.x, a.y, 7).fill(0x0d0a12).stroke({ color: cor, width: 2 });
        g.circle(b.x, b.y, 7).fill(0x0d0a12).stroke({ color: cor, width: 2 });
    }

    /** Para o jogador a parede não aparece (só a sombra dela); porta e janela viram um controle pequeno em que se clica. */
    private desenharControle(g: Graphics, pts: number[], tipo: string, aberta: boolean): void {
        if (tipo !== 'porta' && tipo !== 'janela') return;
        const trancada = !!this.dto.dados?.trancada;
        const cor = trancada ? 0xf87171 : tipo === 'porta' ? 0x38bdf8 : 0x67e8f9;
        const cx = (pts[0] + pts[2]) / 2 - this.dto.x;
        const cy = (pts[1] + pts[3]) / 2 - this.dto.y;
        const r = 13;
        g.circle(cx, cy, r).fill({ color: 0x0d0a12, alpha: 0.88 }).stroke({ color: cor, width: 3 });
        // fechada: uma barra atravessada; aberta: a barra de pé (a passagem livre)
        if (aberta)
            g.moveTo(cx, cy - r * 0.55)
                .lineTo(cx, cy + r * 0.55)
                .stroke({ color: cor, width: 3, cap: 'round' });
        else
            g.moveTo(cx - r * 0.55, cy)
                .lineTo(cx + r * 0.55, cy)
                .stroke({ color: cor, width: 3, cap: 'round' });
        if (trancada) g.roundRect(cx - 4, cy - 3, 8, 7, 1.5).fill(cor);
    }

    /** Luz: ponto de controle visível só ao mestre (o jogador vê apenas o brilho). */
    private desenharMarcador(): void {
        const g = this.marcador.clear();
        if (this.dto.tipo !== 'luz' || !this.mestre) return;
        const apagada = this.dto.dados?.ativa === false;
        g.circle(this.dto.largura / 2, this.dto.altura / 2, 9)
            .fill(0x0d0a12)
            .stroke({ color: apagada ? 0x6b6577 : corHex(this.dto.dados?.cor ?? '#ffd27a'), width: 3 });
        g.circle(this.dto.largura / 2, this.dto.altura / 2, 3).fill(0xffffff);
    }

    /** Liga ou desliga a mira (o token é o alvo de quem joga). */
    definirAlvo(ligada: boolean): void {
        if (this.miraLigada === ligada) return;
        this.miraLigada = ligada;
        this.desenharMira();
    }

    /** Mira vermelha por fora do token: um anel com quatro tracinhos apontando para o centro. */
    private desenharMira(): void {
        const g = this.mira.clear();
        if (!this.miraLigada || !this.ehToken) return;
        const { largura, altura } = this.dto;
        const cx = largura / 2;
        const cy = altura / 2;
        const rx = largura / 2 + 6;
        const ry = altura / 2 + 6;
        const risco = Math.max(8, Math.min(largura, altura) * 0.22);
        g.ellipse(cx, cy, rx, ry).stroke({ color: 0xef4444, width: 3, alpha: 0.95 });
        for (const [dx, dy, ax, ay] of [
            [0, -1, 0, 1],
            [0, 1, 0, -1],
            [-1, 0, 1, 0],
            [1, 0, -1, 0],
        ] as const) {
            const x0 = cx + dx * rx;
            const y0 = cy + dy * ry;
            g.moveTo(x0 + dx * 6, y0 + dy * 6)
                .lineTo(x0 + ax * risco, y0 + ay * risco)
                .stroke({ color: 0xef4444, width: 3, alpha: 0.95, cap: 'round' });
        }
    }

    /**
     * Ícones dos efeitos ativos do personagem no canto superior do token, em fileira (até 4 e um "+N" para o resto).
     * Cada efeito tem o seu ícone (`nucleo/status.ts`). O tamanho acompanha o token, com mínimo legível.
     */
    private desenharStatus(): void {
        const ids = this.ehToken ? (this.dto.status ?? []) : [];
        const lado = Math.max(16, Math.min(30, Math.min(this.dto.largura, this.dto.altura) * 0.3));
        const chave = `${ids.join(',')}|${Math.round(lado)}|${Math.round(this.dto.largura)}`;
        if (chave === this.statusDesenhado) return;
        this.statusDesenhado = chave;
        for (const filho of this.iconesStatus.removeChildren()) filho.destroy({ children: true });
        const visiveis = ids.length > 4 ? ids.slice(0, 3) : ids;
        const itens =
            ids.length > 4
                ? [...visiveis.map((id) => ({ id, resto: 0 })), { id: '', resto: ids.length - 3 }]
                : visiveis.map((id) => ({ id, resto: 0 }));
        itens.forEach((it, i) => {
            const { icone, cor } = iconeDoStatus(it.id);
            const bolha = new Container();
            bolha.position.set(this.dto.largura - lado * 0.5 - i * (lado * 0.85), -lado * 0.25);
            const fundo = new Graphics()
                .circle(0, 0, lado / 2)
                .fill({ color: 0x0d0a12, alpha: 0.92 })
                .stroke({ color: it.resto ? 0xd4a843 : corHex(cor), width: 2 });
            const texto = new Text({
                text: it.resto ? `+${it.resto}` : icone,
                style: {
                    fontFamily: 'Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif',
                    fontSize: lado * (it.resto ? 0.5 : 0.62),
                    fill: 0xffffff,
                    fontWeight: '700',
                },
            });
            texto.anchor.set(0.5);
            bolha.addChild(fundo, texto);
            this.iconesStatus.addChild(bolha);
        });
    }

    /**
     * Vida, PP e CA sobre o token (como no Foundry e no Roll20): a barra de PV (verde, amarela, vermelha), a de PP (azul) e a CA num escudo. Só
     * existem para quem pode ver a ficha: o jogador vê as dele; o mestre, as de todos. Redesenha só quando os valores mudam.
     */
    private desenharBarras(): void {
        const dados = this.ehToken ? (this.dto.barras ?? []) : [];
        const lado = Math.round(this.dto.largura);
        const chave = `${lado}|${dados.map((b) => `${b.id}:${b.atual ?? ''}/${b.max ?? ''}/${b.valor ?? ''}`).join(',')}`;
        if (chave === this.barrasDesenhadas) return;
        this.barrasDesenhadas = chave;
        for (const filho of this.barras.removeChildren()) filho.destroy({ children: true });
        if (!dados.length) return;

        const largura = this.dto.largura;
        const altura = Math.max(13, Math.min(20, largura * 0.22));
        const estiloTexto = (tamanho: number) => ({
            fontFamily: 'sans-serif',
            fontSize: tamanho,
            fill: 0xffffff,
            fontWeight: '700' as const,
            stroke: { color: 0x0d0a12, width: Math.max(2, tamanho * 0.22) },
        });
        const texto = (t: string, tamanho: number, x: number, y: number) => {
            const obj = new Text({ text: t, style: estiloTexto(tamanho) });
            obj.anchor.set(0.5);
            obj.position.set(x, y);

            return obj;
        };
        // PP logo acima do token e PV acima dele; a CA num escudo sobre o canto esquerdo do token
        let y = -(altura + 1);
        const barra = (b: BarraDoToken, cor: number) => {
            const max = Math.max(1, b.max ?? 1);
            const atual = Math.max(0, b.atual ?? 0);
            const pct = Math.min(1, atual / max);
            const g = new Graphics().roundRect(0, y, largura, altura, altura * 0.35).fill({ color: 0x0d0a12, alpha: 0.88 });
            if (pct > 0) g.roundRect(1, y + 1, Math.max(altura * 0.5, (largura - 2) * pct), altura - 2, (altura - 2) * 0.35).fill(cor);
            this.barras.addChild(g, texto(`${atual}/${b.max ?? 0}`, altura * 0.78, largura / 2, y + altura / 2));
            y -= altura + 2;
        };
        const pp = dados.find((b) => b.id === 'pp');
        const pv = dados.find((b) => b.id === 'pv');
        const ca = dados.find((b) => b.id === 'ca');
        if (pp) barra(pp, 0x38bdf8);
        if (pv) {
            const pct = (pv.atual ?? 0) / Math.max(1, pv.max ?? 1);
            barra(pv, pct > 0.5 ? 0x22c55e : pct > 0.25 ? 0xeab308 : 0xef4444);
        }
        if (ca) {
            const r = altura * 0.95;
            const escudo = new Graphics()
                .circle(r * 0.35, r * 0.35, r)
                .fill({ color: 0x0d0a12, alpha: 0.95 })
                .stroke({ color: 0xd4a843, width: 2 });
            this.barras.addChild(escudo, texto(String(ca.valor ?? 0), altura * 0.82, r * 0.35, r * 0.35));
        }
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

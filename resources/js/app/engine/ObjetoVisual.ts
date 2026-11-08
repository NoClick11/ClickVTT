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
    private rotuloViagem: Text | null = null;
    private arquivoCarregado: string | null = null;
    private bordaToken = new Graphics();
    private mascaraToken: Graphics | null = null;
    private marcador = new Graphics();
    private iconesStatus = new Container();
    private statusDesenhado = '';
    private barras = new Container();
    private barrasDesenhadas = '';
    private mira = new Graphics();
    private caveira = new Container();
    private caveiraDesenhada = '';
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
        this.container.addChild(this.fundo, this.bordaToken, this.marcador, this.caveira, this.iconesStatus, this.barras, this.mira);
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
        if (this.dto.tipo === 'parede' && pts?.length === 4) {
            const tipo = this.dto.dados?.tipo;
            if (tipo === 'porta' || tipo === 'janela') {
                const cx = (pts[0] + pts[2]) / 2;
                const cy = (pts[1] + pts[3]) / 2;
                // Área circular expandida de clique no centro da porta/janela (ícone do controle r=30)
                if (Math.hypot(x - cx, y - cy) <= Math.max(34, tolerancia)) return true;
            }
            return distanciaAoSegmento(x, y, pts[0], pts[1], pts[2], pts[3]) <= tolerancia;
        }
        if (this.dto.tipo === 'luz') {
            const { x: ox, y: oy, largura, altura } = this.dto;
            return Math.hypot(x - (ox + largura / 2), y - (oy + altura / 2)) <= Math.max(Math.min(largura, altura) / 2, tolerancia);
        }
        if (this.dto.tipo === 'viagem') {
            const { x: ox, y: oy, largura, altura } = this.dto;
            const raio = Math.max(Math.min(largura, altura) / 2, 28);
            return Math.hypot(x - (ox + largura / 2), y - (oy + altura / 2)) <= Math.max(raio, tolerancia);
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
        this.container.alpha =
            this.ehToken && this.dto.morto ? 0.55 : camada === 'mestre' ? 0.6 : this.dto.tipo === 'parede' && this.mestre && !this.enfase ? 0.25 : 1;
        this.desenharFundo();
        this.desenharBordaToken();
        this.desenharMarcador();
        this.desenharCaveira();
        this.desenharStatus();
        this.desenharBarras();
        this.desenharMira();
        this.ajustarMidia();
        this.atualizarRotulo(largura, altura);
        this.atualizarRotuloViagem(largura, altura);
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
        } else if (this.dto.tipo === 'viagem') {
            this.desenharViagem(g);
        } else if (this.ehToken && !this.arquivoCarregado) {
            // Sem imagem: círculo colorido com a inicial.
            g.ellipse(largura / 2, altura / 2, largura / 2, altura / 2).fill({ color: corHex(dados?.cor), alpha: 1 });
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

    /** Ponto de viagem entre mapas: marcador de porta/passagem aberta entre mapas */
    private desenharViagem(g: Graphics): void {
        const { largura, altura, dados } = this.dto;
        const cx = largura / 2;
        const cy = altura / 2;
        const s = Math.min(largura, altura);
        const r = s * 0.44;
        const cor = corHex(dados?.cor ?? '#e2e8f0');

        // Fundo circular escuro minimalista
        g.circle(cx, cy, r).fill({ color: 0x09090b, alpha: 0.88 });
        g.circle(cx, cy, r).stroke({ color: cor, width: 2, alpha: 0.65 });

        // Desenho estilo "DoorOpen" (batente da porta + folha aberta em perspectiva)
        const pw = r * 0.95;
        const ph = r * 1.25;
        const x0 = cx - pw / 2;
        const y0 = cy - ph / 2;

        // Batente retangular da porta
        g.rect(x0, y0, pw, ph).stroke({ color: cor, width: 2.5, alpha: 0.85 });

        // Folha da porta aberta em perspectiva para a direita
        const xAbrir = x0 + pw * 0.62;
        g.poly([x0, y0, xAbrir, y0 + ph * 0.12, xAbrir, y0 + ph * 0.88, x0, y0 + ph])
            .fill({ color: cor, alpha: 0.25 })
            .stroke({ color: cor, width: 2 });

        // Maçaneta na folha da porta
        g.circle(x0 + (xAbrir - x0) * 0.8, y0 + ph * 0.52, Math.max(1.5, r * 0.055)).fill(0xffffff);

        // Degrau / soleira na base
        g.moveTo(x0 - 4, y0 + ph)
            .lineTo(x0 + pw + 4, y0 + ph)
            .stroke({ color: cor, width: 3, alpha: 0.95, cap: 'round' });
    }

    private atualizarRotuloViagem(largura: number, altura: number): void {
        if (this.dto.tipo !== 'viagem') {
            if (this.rotuloViagem) {
                this.rotuloViagem.destroy();
                this.rotuloViagem = null;
            }
            return;
        }

        const texto = (this.dto.nome || this.dto.dados?.destino_nome || 'Viagem').trim();
        if (!this.rotuloViagem) {
            this.rotuloViagem = new Text({
                text: '',
                style: {
                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontWeight: '700',
                    fontSize: 12,
                    fill: 0xffffff,
                    stroke: { color: 0x000000, width: 3 },
                    align: 'center',
                },
            });
            this.rotuloViagem.anchor.set(0.5, 0);
            this.container.addChild(this.rotuloViagem);
        }

        this.rotuloViagem.text = texto;
        this.rotuloViagem.position.set(largura / 2, altura + 4);
    }

    /** Parede, porta ou janela: no mestre desenha o segmento; no jogador ou mestre desenha o controle de porta/janela. */
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
        if (tipo === 'porta' || tipo === 'janela') {
            this.desenharControle(g, pts, tipo, aberta);
        }
    }

    /**
     * Controle visual de Porta ou Janela:
     * Botão redondo bem visível e grande com ícone intuitivo que muda conforme aberta/fechada e trancada.
     */
    private desenharControle(g: Graphics, pts: number[], tipo: string, aberta: boolean): void {
        if (tipo !== 'porta' && tipo !== 'janela') return;
        const trancada = !!this.dto.dados?.trancada;
        const cx = (pts[0] + pts[2]) / 2 - this.dto.x;
        const cy = (pts[1] + pts[3]) / 2 - this.dto.y;
        const r = 28;

        // Cores temáticas bem visíveis e contrastantes
        // Porta: Âmbar/Dourado quando fechada, Esmeralda quando aberta, Vermelho se trancada
        // Janela: Azul-ciano quando fechada, Esmeralda quando aberta, Vermelho se trancada
        const corTema = trancada ? 0xef4444 : aberta ? 0x22c55e : tipo === 'porta' ? 0xf59e0b : 0x06b6d4;
        const corBorda = trancada ? 0xf87171 : aberta ? 0x4ade80 : tipo === 'porta' ? 0xfbbf24 : 0x38bdf8;
        const corIcone = aberta ? 0x86efac : 0xffffff;

        // Brilho suave externo para destacar do mapa/escuro
        g.circle(cx, cy, r + 6).fill({ color: corTema, alpha: 0.32 });

        // Fundo circular escuro com borda destacada e espessa
        g.circle(cx, cy, r).fill({ color: 0x0f172a, alpha: 0.95 }).stroke({ color: corBorda, width: 3.5 });

        if (tipo === 'porta') {
            if (aberta) {
                // Porta aberta: batente e a folha da porta aberta em perspectiva/ângulo
                // Batente retangular da porta
                g.rect(cx - 12, cy - 16, 24, 32).stroke({ color: corIcone, width: 2.5, alpha: 0.85 });
                // Folha aberta em perspectiva para o lado direito
                g.poly([cx - 12, cy - 16, cx + 4, cy - 11, cx + 4, cy + 14, cx - 12, cy + 16])
                    .fill({ color: 0x15803d, alpha: 0.75 })
                    .stroke({ color: corBorda, width: 2.5 });
                // Maçaneta da folha aberta
                g.circle(cx - 2, cy + 2, 2).fill(0xffffff);
            } else {
                // Porta fechada: arco superior e porta de madeira sólida com maçaneta
                // Batente externo em arco
                g.roundRect(cx - 12, cy - 16, 24, 32, 5)
                    .fill({ color: trancada ? 0x7f1d1d : 0x78350f, alpha: 0.6 })
                    .stroke({ color: corBorda, width: 3 });
                // Divisória do meio dos painéis da porta
                g.moveTo(cx - 12, cy)
                    .lineTo(cx + 12, cy)
                    .stroke({ color: corBorda, width: 2, alpha: 0.75 });
                // Painel superior e inferior detalhados
                g.roundRect(cx - 9, cy - 13, 18, 10, 2).stroke({ color: corBorda, width: 1.5, alpha: 0.5 });
                g.roundRect(cx - 9, cy + 3, 18, 10, 2).stroke({ color: corBorda, width: 1.5, alpha: 0.5 });
                // Maçaneta dourada/branca bem evidente
                g.circle(cx + 6, cy + 3, 3)
                    .fill(0xffffff)
                    .stroke({ color: 0x0f172a, width: 1.5 });
            }
        } else {
            // JANELA
            // Moldura externa da janela
            g.roundRect(cx - 14, cy - 14, 28, 28, 4)
                .fill({ color: aberta ? 0x064e3b : 0x0c4a6e, alpha: 0.7 })
                .stroke({ color: corBorda, width: 3 });

            if (aberta) {
                // Janela aberta: duas folhas basculantes abertas para fora
                // Folha esquerda aberta
                g.poly([cx - 14, cy - 12, cx - 20, cy - 7, cx - 20, cy + 7, cx - 14, cy + 12]).stroke({ color: corBorda, width: 2.5 });
                // Folha direita aberta
                g.poly([cx + 14, cy - 12, cx + 20, cy - 7, cx + 20, cy + 7, cx + 14, cy + 12]).stroke({ color: corBorda, width: 2.5 });
                // Centro vazio aberto com cruz sutil
                g.moveTo(cx, cy - 9)
                    .lineTo(cx, cy + 9)
                    .stroke({ color: 0x86efac, width: 2, alpha: 0.8 });
            } else {
                // Janela fechada: vidros com cruz clássica de esquadria de 4 painéis
                // Linha vertical central
                g.moveTo(cx, cy - 12)
                    .lineTo(cx, cy + 12)
                    .stroke({ color: corIcone, width: 2.5 });
                // Linha horizontal central
                g.moveTo(cx - 12, cy)
                    .lineTo(cx + 12, cy)
                    .stroke({ color: corIcone, width: 2.5 });
                // Brilho no vidro (painel superior esquerdo)
                g.moveTo(cx - 9, cy - 4)
                    .lineTo(cx - 4, cy - 9)
                    .stroke({ color: 0xffffff, width: 2, alpha: 0.85 });
            }
        }

        // Se estiver trancada: cadeado de alerta maior no canto
        if (trancada) {
            const lx = cx + 13;
            const ly = cy + 13;
            // Arco do cadeado
            g.moveTo(lx - 4, ly - 4)
                .lineTo(lx - 4, ly - 8)
                .lineTo(lx + 4, ly - 8)
                .lineTo(lx + 4, ly - 4)
                .stroke({ color: 0xffffff, width: 2 });
            // Corpo do cadeado
            g.roundRect(lx - 6, ly - 4, 12, 10, 2)
                .fill(0xef4444)
                .stroke({ color: 0xffffff, width: 1.5 });
        }
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

    /** Token de NPC com 0 de vida: um X vermelho e uma caveira por cima (o token fica esmaecido). */
    private desenharCaveira(): void {
        const morto = this.ehToken && !!this.dto.morto;
        const lado = Math.round(Math.min(this.dto.largura, this.dto.altura));
        const chave = morto ? `1|${lado}` : '';
        if (chave === this.caveiraDesenhada) return;
        this.caveiraDesenhada = chave;
        for (const filho of this.caveira.removeChildren()) filho.destroy({ children: true });
        if (!morto) return;
        const { largura, altura } = this.dto;
        const m = lado * 0.18;
        const x = new Graphics()
            .moveTo(m, m)
            .lineTo(largura - m, altura - m)
            .moveTo(largura - m, m)
            .lineTo(m, altura - m)
            .stroke({ color: 0xef4444, width: Math.max(3, lado * 0.06), alpha: 0.85, cap: 'round' });
        const icone = new Text({
            text: '💀',
            style: { fontFamily: 'Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif', fontSize: lado * 0.5 },
        });
        icone.anchor.set(0.5);
        icone.position.set(largura / 2, altura / 2);
        this.caveira.addChild(x, icone);
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

    private desenharBordaToken(): void {
        this.bordaToken.clear();
        if (!this.ehToken) return;
        const { largura, altura, camada } = this.dto;
        const ehNpc = !!this.dto.npc || camada === 'mestre';
        // Jogadores: borda preta (0x0d0a12). NPCs: borda dourada (0xd4a843)
        const cor = ehNpc ? 0xd4a843 : 0x0d0a12;
        this.bordaToken.ellipse(largura / 2, altura / 2, largura / 2, altura / 2).stroke({ color: cor, width: 3.5, alpha: 0.95 });
    }

    /** A mídia preenche todo o objeto (estica, sem recortar): o que foi colocado dentro nunca é cortado. */
    private ajustarMidia(): void {
        const m = this.midia;
        if (!m) return;
        const { largura, altura } = this.dto;
        m.width = largura;
        m.height = altura;
        m.position.set(0, 0);

        if (this.ehToken) {
            if (!this.mascaraToken) {
                this.mascaraToken = new Graphics();
                this.container.addChild(this.mascaraToken);
            }
            this.mascaraToken
                .clear()
                .ellipse(largura / 2, altura / 2, largura / 2, altura / 2)
                .fill(0xffffff);
            m.mask = this.mascaraToken;
        } else if (m.mask) {
            m.mask = null;
            if (this.mascaraToken) {
                this.mascaraToken.destroy();
                this.mascaraToken = null;
            }
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
            const indexBorda = this.container.getChildIndex(this.bordaToken);
            this.container.addChildAt(midia, Math.max(1, indexBorda));
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
        if (this.mascaraToken) {
            this.mascaraToken.destroy();
            this.mascaraToken = null;
        }
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

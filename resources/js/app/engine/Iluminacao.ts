import { BlurFilter, ColorMatrixFilter, Container, Graphics, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';
import type { ObjetoDto, PaginaDto } from './tipos';
import { poligonoDeVisao, pontoNoPoligono, segmentosQueBloqueiam, type Cone, type Retangulo } from './visao';

/** Lado máximo (px) das texturas de luz: páginas enormes são desenhadas em resolução menor e ampliadas. */
const LADO_MAXIMO = 2560;
/** Lado máximo (px) da memória das áreas exploradas: é só uma lembrança esmaecida, e a imagem vai ao servidor. */
const LADO_MEMORIA = 384;
/** O mestre sempre enxerga o mapa: a escuridão dele nunca passa deste brilho. */
const BRILHO_MINIMO_DO_MESTRE = 0.55;
/** Brilho do que o jogador já viu mas não vê agora. */
const BRILHO_DA_MEMORIA = 0.28;

export interface EntradaIluminacao {
    pagina: PaginaDto;
    objetos: ObjetoDto[];
    mestre: boolean;
    /** Tokens do jogador (a visão deles revela o mapa). Vazio para o mestre. */
    meusTokens: ObjetoDto[];
}

export interface ResultadoIluminacao {
    /** Polígonos de linha de visão dos tokens do jogador com visão. Vazio = sem limite (mestre / sem token / visão desligada). */
    visao: number[][];
    /** O ponto do mapa está à vista do jogador agora (em linha reta E iluminado)? Serve para esconder tokens que ele não enxerga. */
    pontoVisivel: (x: number, y: number) => boolean;
}

/** Gradiente radial branco (centro cheio até `nucleo`, depois cai a zero na borda), feito uma vez e reaproveitado, tingido pela cor de cada luz. */
function radial(nucleo: number): Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    if (nucleo > 0.02) grad.addColorStop(Math.min(0.98, nucleo), 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);

    return Texture.from(c);
}

const corHex = (c: string | undefined, padrao = 0xffd27a) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? parseInt(c.slice(1), 16) : padrao);
const cinza = (v: number) => {
    const n = Math.round(Math.max(0, Math.min(1, v)) * 255);

    return (n << 16) | (n << 8) | n;
};
const grau = (g: number) => (g * Math.PI) / 180;

/**
 * Iluminação dinâmica, feita na placa de vídeo de quem está jogando (do servidor vem só a geometria das paredes):
 *  - mapa de luz: fundo na cor do ambiente + o brilho de cada luz (cor, intensidade, raio claro, cone) e a visão no escuro dos tokens do
 *    jogador, cada um recortado pelas paredes (cada parede barra ou não a luz, a visão e o corpo conforme sua configuração);
 *  - mapa de visão: o que os tokens do jogador enxergam em linha reta (a "névoa");
 *  - memória: tudo o que já foi visto e iluminado fica guardado numa imagem pequena e reaparece esmaecido.
 * Tudo vira textura e é multiplicado por cima do mapa (blend `multiply`). Só se recalcula quando algo muda (token solto, porta aberta, luz
 * editada...), nunca a cada quadro nem durante o arrasto.
 */
export class Iluminacao {
    readonly container = new Container();
    private sprite = new Sprite();
    private rtLuz: RenderTexture | null = null;
    private rtVisao: RenderTexture | null = null;
    private rtFinal: RenderTexture | null = null;
    private memoriaA: RenderTexture | null = null;
    private memoriaB: RenderTexture | null = null;
    private lado = { w: 0, h: 0 };
    private texturas = new Map<number, Texture>();
    private limiar = new ColorMatrixFilter();
    /** Imagem vinda do servidor, esperando as texturas existirem para ser desenhada na memória. */
    private memoriaPendente: HTMLImageElement | null = null;
    private limparPendente = false;

    constructor(
        private renderer: Renderer,
        private aoMudarMemoria: () => void,
    ) {
        this.sprite.blendMode = 'multiply';
        this.container.addChild(this.sprite);
        this.container.visible = false;
        this.container.eventMode = 'none';
        // quem tem qualquer brilho vira "explorado" (o mapa de memória é binário)
        this.limiar.matrix = [6, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 1, 0];
    }

    private textura(nucleo: number): Texture {
        const k = Math.round(Math.max(0, Math.min(1, nucleo)) * 20);
        let t = this.texturas.get(k);
        if (!t) this.texturas.set(k, (t = radial(k / 20)));

        return t;
    }

    /** Recalcula tudo. `null` = iluminação desligada nesta página. */
    atualizar(entrada: EntradaIluminacao | null): ResultadoIluminacao | null {
        if (!entrada?.pagina.iluminacao_ativa) {
            this.container.visible = false;

            return null;
        }
        const { pagina, objetos, mestre, meusTokens } = entrada;
        const tam = pagina.tamanho_quadrado;
        const W = pagina.colunas * tam;
        const H = pagina.linhas * tam;
        const limites: Retangulo = { x0: 0, y0: 0, x1: W, y1: H };
        const res = Math.min(1, LADO_MAXIMO / Math.max(W, H));
        const wr = Math.ceil(W * res);
        const hr = Math.ceil(H * res);
        const usarVisao = pagina.usar_visao && !mestre;
        const comVisao = meusTokens.filter((t) => t.dados?.visao_ativa !== false);
        const comMascara = usarVisao && meusTokens.length > 0;
        const comMemoria = comMascara && pagina.memoria_ativa;
        this.prepararTexturas(wr, hr, W, H, comMemoria);

        const paredesDeLuz = segmentosQueBloqueiam(objetos, 'luz');
        const paredesDeVisao = segmentosQueBloqueiam(objetos, 'visao');
        const ambiente = pagina.luz_ambiente / 100;

        // --- mapa de luz ---
        const luzes = new Container();
        luzes.scale.set(res);
        luzes.addChild(new Graphics().rect(0, 0, W, H).fill(cinza(mestre ? Math.max(ambiente, BRILHO_MINIMO_DO_MESTRE) : ambiente)));
        const recortar = (s: Sprite, poligono: number[]) => {
            if (poligono.length < 6) return;
            const mascara = new Graphics().poly(poligono).fill(0xffffff);
            luzes.addChild(mascara);
            s.mask = mascara;
        };
        const fontes: { cx: number; cy: number; raio: number; poligono: number[] }[] = [];
        for (const o of objetos) {
            if (o.tipo !== 'luz' || o.dados?.ativa === false) continue;
            const raio = o.dados?.raio ?? Math.min(o.largura, o.altura) / 2;
            if (!(raio > 0)) continue;
            const centro = { x: o.x + o.largura / 2, y: o.y + o.altura / 2 };
            const claro = Math.min(raio, Math.max(0, o.dados?.raio_claro ?? raio * 0.4));
            const s = new Sprite(this.textura(claro / raio));
            s.anchor.set(0.5);
            s.position.set(centro.x, centro.y);
            s.width = s.height = raio * 2;
            s.tint = corHex(o.dados?.cor);
            s.alpha = Math.max(0, Math.min(1, o.dados?.intensidade ?? 1));
            s.blendMode = 'add';
            luzes.addChild(s);
            const angulo = o.dados?.angulo ?? 360;
            const cone: Cone | null = angulo < 360 ? { direcao: grau(o.dados?.direcao ?? 0), abertura: grau(angulo) } : null;
            const poligono = poligonoDeVisao(centro, o.dados?.atravessa ? [] : paredesDeLuz, limites, raio, cone);
            recortar(s, poligono);
            fontes.push({ cx: centro.x, cy: centro.y, raio, poligono });
        }
        const discos: { cx: number; cy: number; raio: number }[] = [];
        const poligonosDeVisao: number[][] = [];
        for (const t of usarVisao ? comVisao : []) {
            const centro = { x: t.x + t.largura / 2, y: t.y + t.altura / 2 };
            const raio = (t.dados?.visao ?? pagina.visao_padrao) * tam;
            if (raio > 0) {
                const s = new Sprite(this.textura(0.8));
                s.anchor.set(0.5);
                s.position.set(centro.x, centro.y);
                s.width = s.height = raio * 2;
                s.blendMode = 'add';
                luzes.addChild(s);
                recortar(s, poligonoDeVisao(centro, paredesDeVisao, limites, raio));
                discos.push({ cx: centro.x, cy: centro.y, raio });
            }
            poligonosDeVisao.push(poligonoDeVisao(centro, paredesDeVisao, limites));
        }
        this.renderer.render({ container: luzes, target: this.rtLuz!, clear: true, clearColor: [0, 0, 0, 1] });
        luzes.destroy({ children: true });

        // --- névoa (linha de visão) e memória ---
        if (comMascara) {
            const visao = new Container();
            visao.scale.set(res);
            visao.addChild(new Graphics().rect(0, 0, W, H).fill(0x000000));
            for (const p of poligonosDeVisao) if (p.length >= 6) visao.addChild(new Graphics().poly(p).fill(0xffffff));
            visao.filters = [new BlurFilter({ strength: 2 * res, quality: 2 })];
            this.renderer.render({ container: visao, target: this.rtVisao!, clear: true, clearColor: [0, 0, 0, 1] });
            visao.destroy({ children: true });

            // brilho final = luz × visão (+ a memória esmaecida das áreas já vistas)
            const final = new Container();
            const a = new Sprite(this.rtLuz!);
            const b = new Sprite(this.rtVisao!);
            b.blendMode = 'multiply';
            final.addChild(a, b);
            if (comMemoria) {
                const m = new Sprite(this.memoriaA!);
                m.width = wr;
                m.height = hr;
                m.tint = cinza(BRILHO_DA_MEMORIA);
                m.blendMode = 'add';
                final.addChild(m);
            }
            this.renderer.render({ container: final, target: this.rtFinal!, clear: true, clearColor: [0, 0, 0, 1] });
            final.destroy({ children: true });
            if (comMemoria) this.acumularMemoria(wr, hr);
        }
        this.sprite.texture = comMascara ? this.rtFinal! : this.rtLuz!;
        this.sprite.scale.set(1 / res);
        this.container.visible = true;

        const iluminado = (x: number, y: number) =>
            ambiente > 0.08 ||
            discos.some((d) => Math.hypot(x - d.cx, y - d.cy) <= d.raio) ||
            fontes.some((f) => Math.hypot(x - f.cx, y - f.cy) <= f.raio && pontoNoPoligono(x, y, f.poligono));

        return {
            visao: usarVisao ? poligonosDeVisao : [],
            pontoVisivel: (x, y) => mestre || ((!comMascara || poligonosDeVisao.some((p) => pontoNoPoligono(x, y, p))) && iluminado(x, y)),
        };
    }

    /** O que está à vista agora (e já era lembrado) entra na memória: nunca sai de lá, só é apagado pelo mestre. */
    private acumularMemoria(wr: number, hr: number): void {
        const velha = this.memoriaA!;
        const nova = this.memoriaB!;
        const c = new Container();
        c.addChild(new Sprite(velha));
        const visto = new Sprite(this.rtFinal!);
        visto.width = velha.width;
        visto.height = velha.height;
        visto.blendMode = 'add';
        visto.filters = [this.limiar];
        c.addChild(visto);
        this.renderer.render({ container: c, target: nova, clear: true, clearColor: [0, 0, 0, 1] });
        c.destroy({ children: true });
        this.memoriaA = nova;
        this.memoriaB = velha;
        void wr;
        void hr;
        this.aoMudarMemoria();
    }

    private prepararTexturas(wr: number, hr: number, W: number, H: number, comMemoria: boolean): void {
        if (!this.rtLuz || this.lado.w !== wr || this.lado.h !== hr) {
            this.rtLuz?.destroy(true);
            this.rtVisao?.destroy(true);
            this.rtFinal?.destroy(true);
            this.rtLuz = RenderTexture.create({ width: wr, height: hr });
            this.rtVisao = RenderTexture.create({ width: wr, height: hr });
            this.rtFinal = RenderTexture.create({ width: wr, height: hr });
            this.lado = { w: wr, h: hr };
            this.limparMemoriaInterna();
        }
        if (comMemoria && !this.memoriaA) {
            const k = Math.min(1, LADO_MEMORIA / Math.max(W, H));
            const w = Math.max(8, Math.ceil(W * k));
            const h = Math.max(8, Math.ceil(H * k));
            this.memoriaA = RenderTexture.create({ width: w, height: h });
            this.memoriaB = RenderTexture.create({ width: w, height: h });
            for (const rt of [this.memoriaA, this.memoriaB])
                this.renderer.render({ container: new Container(), target: rt, clear: true, clearColor: [0, 0, 0, 1] });
        }
        if (this.memoriaA && this.limparPendente) {
            this.limparPendente = false;
            for (const rt of [this.memoriaA, this.memoriaB!])
                this.renderer.render({ container: new Container(), target: rt, clear: true, clearColor: [0, 0, 0, 1] });
        }
        if (this.memoriaA && this.memoriaPendente) {
            const s = new Sprite(Texture.from(this.memoriaPendente));
            s.width = this.memoriaA.width;
            s.height = this.memoriaA.height;
            const c = new Container();
            c.addChild(s);
            this.renderer.render({ container: c, target: this.memoriaA, clear: true, clearColor: [0, 0, 0, 1] });
            c.destroy({ children: true });
            this.memoriaPendente = null;
        }
    }

    private limparMemoriaInterna(): void {
        this.memoriaA?.destroy(true);
        this.memoriaB?.destroy(true);
        this.memoriaA = this.memoriaB = null;
    }

    /** Troca de página: a memória (e a imagem pendente) da anterior não vale aqui. */
    reiniciarMemoria(): void {
        this.memoriaPendente = null;
        this.limparPendente = false;
        this.limparMemoriaInterna();
    }

    /** Apaga a memória (o mestre mandou). Vale já; no próximo cálculo a névoa volta. */
    limparMemoria(): void {
        this.memoriaPendente = null;
        this.limparPendente = true;
    }

    /** Recebe a memória guardada no servidor (PNG em data URL) e a aplica no próximo cálculo. */
    async carregarMemoria(imagem: string | null): Promise<void> {
        if (!imagem) return;
        const img = new Image();
        await new Promise<void>((ok, erro) => {
            img.onload = () => ok();
            img.onerror = () => erro(new Error('memória inválida'));
            img.src = imagem;
        }).catch(() => undefined);
        if (img.naturalWidth) this.memoriaPendente = img;
    }

    /** A memória atual como PNG (data URL) para guardar no servidor; null se não há. */
    async exportarMemoria(): Promise<string | null> {
        if (!this.memoriaA) return null;

        return this.renderer.extract.base64({ target: this.memoriaA, format: 'png' });
    }

    destruir(): void {
        this.rtLuz?.destroy(true);
        this.rtVisao?.destroy(true);
        this.rtFinal?.destroy(true);
        this.limparMemoriaInterna();
        this.container.destroy({ children: true });
    }
}

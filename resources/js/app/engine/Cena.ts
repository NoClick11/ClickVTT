import { Application, Container, Graphics, Text } from 'pixi.js';
import { ObjetoVisual } from './ObjetoVisual';
import {
    CAMADAS,
    type AlcaRedimensionar,
    type Camada,
    type CamposGeometria,
    type CenaEventos,
    type EstiloPintura,
    type Ferramenta,
    type ObjetoDto,
    type PaginaDto,
} from './tipos';

const ESCALA_MIN = 0.05;
const ESCALA_MAX = 8;
const TAMANHO_ALCA = 8; // px na tela
const MARGEM_TOPO = 48; // altura da barra superior
const ALCAS: AlcaRedimensionar[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

type Modo = 'nenhum' | 'pan' | 'mover' | 'redimensionar' | 'regua' | 'desenhar' | 'pintar';

interface Opcoes {
    mestre: boolean;
    /** Id do JOGADOR desta aba (traços/textos dele). */
    jogadorId: number | null;
    /** Personagens que este jogador controla: só os tokens deles podem ser movidos. */
    personagensPermitidos: number[];
    eventos: CenaEventos;
}

/**
 * Cena do Pixi: viewport (zoom/pan), grade, camadas, seleção, mover/redimensionar e régua.
 * Não conhece Vue nem a API; avisa por `eventos` e recebe estado por set*().
 */
export class Cena {
    readonly app = new Application();
    private mundo = new Container();
    private fundoPagina = new Graphics();
    private grade = new Graphics();
    private camadas = new Map<Camada, Container>();
    private overlay = new Container();
    private selecaoG = new Graphics();
    private reguaG = new Graphics();
    private desenhoG = new Graphics();
    private reguaTexto = new Text({ text: '', style: { fontFamily: 'sans-serif', fontSize: 14, fill: 0xfaf0cf, fontWeight: '600', stroke: { color: 0x0d0a12, width: 4 } } });

    private visuais = new Map<number, ObjetoVisual>();
    private pagina: PaginaDto | null = null;
    private camadaAtiva: Camada = 'jogadores';
    private ferramenta: Ferramenta = 'selecionar';
    private selecionadoId: number | null = null;

    private modo: Modo = 'nenhum';
    private espaco = false;
    private inicioTela = { x: 0, y: 0 };
    private inicioMundo = { x: 0, y: 0 };
    private inicioObjeto: CamposGeometria = {};
    private alca: AlcaRedimensionar | null = null;
    private reguaInicio = { x: 0, y: 0 };
    private desenhoInicio = { x: 0, y: 0 };
    /** Destino encaixado no grid durante o redimensionamento (mostrado como contorno-guia). */
    private alvoEncaixe: CamposGeometria | null = null;
    private animacao: (() => void) | null = null;
    private estilo: EstiloPintura = { cor: '#ef4444', espessura: 4, tamanho: 28 };
    private tracoAtual: number[] = [];
    /** Faixa da direita coberta por painéis (ex.: chat): a vista se centraliza só na área livre. */
    private margemDireita = 0;
    private iniciou = false;
    private host!: HTMLElement;
    private pronto = false;
    private removerListeners: Array<() => void> = [];

    constructor(private opcoes: Opcoes) {}

    async iniciar(host: HTMLElement): Promise<void> {
        this.host = host;
        await this.app.init({
            resizeTo: host,
            background: 0x0d0a12,
            antialias: true,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
        });
        host.appendChild(this.app.canvas);
        this.app.canvas.style.touchAction = 'none';
        this.app.canvas.style.display = 'block';

        this.app.stage.addChild(this.mundo);
        this.mundo.addChild(this.fundoPagina);
        // Ordem de desenho: mapa < grade < mestre < jogadores < iluminação < overlay.
        for (const { id } of CAMADAS) {
            const c = new Container();
            c.label = id;
            this.camadas.set(id, c);
            this.mundo.addChild(c);
            if (id === 'mapa') this.mundo.addChild(this.grade);
        }
        this.overlay.addChild(this.selecaoG, this.reguaG, this.desenhoG, this.reguaTexto);
        this.reguaTexto.visible = false;
        this.mundo.addChild(this.overlay);

        this.ligarEventos();
        this.pronto = true;
        this.atualizarCursor();
        this.redesenharPagina();
    }

    destruir(): void {
        this.removerListeners.forEach((f) => f());
        this.removerListeners = [];
        this.visuais.forEach((v) => v.destruir());
        this.visuais.clear();
        this.pronto = false;
        this.app.destroy(true, { children: true });
    }

    // --- estado vindo do Vue ---------------------------------------------------

    setPagina(pagina: PaginaDto, ajustar = false): void {
        const trocou = this.pagina?.id !== pagina.id;
        this.pagina = pagina;
        this.redesenharPagina();
        if (trocou || ajustar) this.ajustarVista();
    }

    setObjetos(lista: ObjetoDto[]): void {
        if (!this.pronto) return;
        const ids = new Set<number>();
        for (const dto of lista) {
            ids.add(dto.id);
            const existente = this.visuais.get(dto.id);
            if (existente) {
                if (this.modo === 'nenhum' || this.selecionadoId !== dto.id) existente.atualizar(dto);
                this.moverParaCamada(existente, dto.camada);
            } else {
                const v = new ObjetoVisual(dto, this.opcoes.mestre);
                v.definirEnfase(this.camadaAtiva === 'iluminacao');
                this.visuais.set(dto.id, v);
                this.camadas.get(dto.camada)?.addChild(v.container);
            }
        }
        for (const [id, v] of this.visuais) {
            if (!ids.has(id)) {
                v.destruir();
                this.visuais.delete(id);
                if (this.selecionadoId === id) this.selecionar(null);
            }
        }
        this.ordenarCamadas();
        this.desenharSelecao();
    }

    setCamadaAtiva(camada: Camada): void {
        this.camadaAtiva = camada;
        for (const v of this.visuais.values()) v.definirEnfase(camada === 'iluminacao');
        const sel = this.selecionadoId ? this.visuais.get(this.selecionadoId) : null;
        if (sel && sel.dto.camada !== camada) this.selecionar(null);
        this.atualizarCursor();
    }

    setPersonagensPermitidos(ids: number[]): void {
        this.opcoes.personagensPermitidos = ids;
    }

    setMargemDireita(px: number): void {
        const delta = px - this.margemDireita;
        this.margemDireita = px;
        if (this.pronto && delta !== 0) {
            this.mundo.x -= delta / 2; // mantém o mapa centralizado na área visível sem perder zoom/pan
            this.aoMudarVista();
        }
    }

    setEstilo(estilo: EstiloPintura): void {
        this.estilo = { ...estilo };
    }

    setFerramenta(f: Ferramenta): void {
        this.ferramenta = f;
        this.limparRegua();
        this.desenhoG.clear();
        this.atualizarCursor();
    }

    selecionar(id: number | null): void {
        if (this.selecionadoId === id) return;
        this.selecionadoId = id;
        this.desenharSelecao();
        this.opcoes.eventos.selecionar(id);
    }

    // --- vista -----------------------------------------------------------------

    ajustarVista(): void {
        if (!this.pagina) return;
        const { largura, altura } = this.dimensoesPagina();
        const vw = this.app.screen.width - this.margemDireita;
        const vh = this.app.screen.height - MARGEM_TOPO; // a barra superior cobre o topo do canvas
        const escala = clamp(Math.min(vw / largura, vh / altura) * 0.92, ESCALA_MIN, ESCALA_MAX);
        this.mundo.scale.set(escala);
        this.mundo.position.set((vw - largura * escala) / 2, MARGEM_TOPO + (vh - altura * escala) / 2);
        this.aoMudarVista();
    }

    zoomPor(fator: number, centro?: { x: number; y: number }): void {
        const c = centro ?? { x: this.app.screen.width / 2, y: this.app.screen.height / 2 };
        const antes = this.paraMundo(c.x, c.y);
        const escala = clamp(this.mundo.scale.x * fator, ESCALA_MIN, ESCALA_MAX);
        this.mundo.scale.set(escala);
        this.mundo.position.set(c.x - antes.x * escala, c.y - antes.y * escala);
        this.aoMudarVista();
    }

    /** Centro da área visível em coordenadas do mundo (onde colocar novos objetos). */
    centroDaVista(): { x: number; y: number } {
        return this.paraMundo(this.app.screen.width / 2, this.app.screen.height / 2);
    }

    /** Centraliza a vista num objeto (mantém o zoom) e, opcionalmente, o seleciona. */
    focar(id: number, selecionar = false): void {
        const v = this.visuais.get(id);
        if (!v) return;
        const c = v.caixa();
        const livreW = this.app.screen.width - this.margemDireita;
        const livreH = this.app.screen.height - MARGEM_TOPO;
        const e = this.mundo.scale.x;
        this.mundo.position.set(livreW / 2 - (c.x + c.largura / 2) * e, MARGEM_TOPO + livreH / 2 - (c.y + c.altura / 2) * e);
        if (selecionar && this.podeInteragir(v)) this.selecionar(id);
        this.aoMudarVista();
    }

    get escala(): number {
        return this.mundo.scale.x;
    }

    // --- internos: página e grade ----------------------------------------------

    private dimensoesPagina(): { largura: number; altura: number } {
        const p = this.pagina;
        return p ? { largura: p.colunas * p.tamanho_quadrado, altura: p.linhas * p.tamanho_quadrado } : { largura: 1750, altura: 1750 };
    }

    private redesenharPagina(): void {
        if (!this.pronto || !this.pagina) return;
        const { largura, altura } = this.dimensoesPagina();
        this.fundoPagina.clear().rect(0, 0, largura, altura).fill(0x17141c);
        this.fundoPagina.rect(0, 0, largura, altura).stroke({ color: 0xd4a843, width: 2, alpha: 0.5, pixelLine: true });

        const g = this.grade.clear();
        if (this.pagina.grade_quadrada) {
            const t = this.pagina.tamanho_quadrado;
            for (let x = t; x < largura; x += t) g.moveTo(x, 0).lineTo(x, altura);
            for (let y = t; y < altura; y += t) g.moveTo(0, y).lineTo(largura, y);
            g.stroke({ color: 0xffffff, alpha: 0.14, pixelLine: true });
        }
        this.desenharSelecao();
    }

    private get snapAtivo(): boolean {
        return !!this.pagina?.grade_quadrada;
    }

    private snap(v: number): number {
        const t = this.pagina?.tamanho_quadrado ?? 70;
        return this.snapAtivo ? Math.round(v / t) * t : v;
    }

    private snapCentro(v: number): number {
        const t = this.pagina?.tamanho_quadrado ?? 70;
        return this.snapAtivo ? Math.floor(v / t) * t + t / 2 : v;
    }

    // --- camadas / hit-test ----------------------------------------------------

    private moverParaCamada(v: ObjetoVisual, camada: Camada): void {
        const destino = this.camadas.get(camada);
        if (destino && v.container.parent !== destino) destino.addChild(v.container);
    }

    private ordenarCamadas(): void {
        for (const c of this.camadas.values()) {
            c.children.sort((a, b) => {
                const va = [...this.visuais.values()].find((v) => v.container === a);
                const vb = [...this.visuais.values()].find((v) => v.container === b);

                return (va?.dto.z ?? 0) - (vb?.dto.z ?? 0) || (va?.dto.id ?? 0) - (vb?.dto.id ?? 0);
            });
        }
    }

    /** Mestre interage só com a camada ativa; jogador só com o próprio token. */
    private podeInteragir(v: ObjetoVisual): boolean {
        if (this.opcoes.mestre) return v.dto.camada === this.camadaAtiva;

        if (v.dto.camada !== 'jogadores') return false;
        if (v.dto.tipo === 'token') return v.dto.personagem_id !== null && this.opcoes.personagensPermitidos.includes(v.dto.personagem_id);

        return (v.dto.tipo === 'traco' || v.dto.tipo === 'texto') && v.dto.jogador_id !== null && v.dto.jogador_id === this.opcoes.jogadorId;
    }

    private objetoEm(x: number, y: number): ObjetoVisual | null {
        const tol = 10 / this.mundo.scale.x;
        const candidatos = [...this.visuais.values()].filter((v) => this.podeInteragir(v) && v.acerta(x, y, tol));
        candidatos.sort((a, b) => b.dto.z - a.dto.z || b.dto.id - a.dto.id);

        return candidatos[0] ?? null;
    }

    // --- seleção e alças -------------------------------------------------------

    private desenharSelecao(): void {
        const g = this.selecaoG.clear();
        const v = this.selecionadoId ? this.visuais.get(this.selecionadoId) : null;
        if (!v) return;
        const { x, y, largura, altura } = v.caixa();
        const pts = v.dto.dados?.pontos;
        if (v.dto.tipo === 'parede' && pts?.length === 4) {
            g.moveTo(pts[0], pts[1]).lineTo(pts[2], pts[3]).stroke({ color: 0xd4a843, width: 14, alpha: 0.35, cap: 'round' });
            return; // paredes não se movem nem se redimensionam: exclua e desenhe de novo
        }
        g.rect(x, y, largura, altura).stroke({ color: 0xd4a843, width: 1.5, alpha: 0.95, pixelLine: true });
        const guia = this.alvoEncaixe;
        if (guia && this.modo === 'redimensionar') {
            g.rect(guia.x!, guia.y!, guia.largura!, guia.altura!).fill({ color: 0xd4a843, alpha: 0.12 }).stroke({ color: 0xf4e0a0, width: 1.5, alpha: 0.9, pixelLine: true });
        }
        if (!this.opcoes.mestre || v.dto.tipo === 'texto') return;
        const s = TAMANHO_ALCA / this.mundo.scale.x;
        for (const a of this.alcasVisiveis(largura, altura)) {
            const p = this.posicaoAlca(a, x, y, largura, altura);
            g.rect(p.x - s / 2, p.y - s / 2, s, s).fill(0x0d0a12).stroke({ color: 0xd4a843, width: 1.5, pixelLine: true });
        }
    }

    /** Alças ficam FORA da borda (não cobrem a imagem); alças de aresta somem quando a aresta é curta na tela. */
    private posicaoAlca(a: AlcaRedimensionar, x: number, y: number, w: number, h: number): { x: number; y: number } {
        const fora = TAMANHO_ALCA / this.mundo.scale.x / 2 + 1 / this.mundo.scale.x;
        const cx = a.includes('w') ? x - fora : a.includes('e') ? x + w + fora : x + w / 2;
        const cy = a.includes('n') ? y - fora : a.includes('s') ? y + h + fora : y + h / 2;

        return { x: cx, y: cy };
    }

    private alcasVisiveis(w: number, h: number): AlcaRedimensionar[] {
        const e = this.mundo.scale.x;
        const larga = w * e >= 56;
        const alta = h * e >= 56;

        return ALCAS.filter((a) => (a === 'n' || a === 's' ? larga : a === 'e' || a === 'w' ? alta : true));
    }

    private alcaEm(px: number, py: number): AlcaRedimensionar | null {
        const v = this.selecionadoId ? this.visuais.get(this.selecionadoId) : null;
        if (!v || !this.opcoes.mestre || v.dto.tipo === 'parede' || v.dto.tipo === 'texto') return null;
        const tol = (TAMANHO_ALCA * 0.9) / this.mundo.scale.x;
        const { x, y, largura, altura } = v.dto;
        for (const a of this.alcasVisiveis(largura, altura)) {
            const p = this.posicaoAlca(a, x, y, largura, altura);
            if (Math.abs(px - p.x) <= tol && Math.abs(py - p.y) <= tol) return a;
        }

        return null;
    }

    /** `encaixar`: arestas nos quadrados (resultado final); sem isso, acompanha o mouse livremente. */
    private redimensionar(p: { x: number; y: number }, manterProporcao: boolean, encaixar: boolean): CamposGeometria {
        const { x, y, largura: w0, altura: h0 } = this.inicioObjeto as Required<CamposGeometria>;
        const a = this.alca!;
        const minimo = this.snapAtivo ? (this.pagina?.tamanho_quadrado ?? 70) : 10;
        const ajustar = (v: number) => (encaixar ? this.snap(v) : v);
        let esq = x;
        let dir = x + w0;
        let topo = y;
        let base = y + h0;
        if (a.includes('w')) esq = Math.min(ajustar(p.x), dir - minimo);
        if (a.includes('e')) dir = Math.max(ajustar(p.x), esq + minimo);
        if (a.includes('n')) topo = Math.min(ajustar(p.y), base - minimo);
        if (a.includes('s')) base = Math.max(ajustar(p.y), topo + minimo);

        if (manterProporcao && a.length === 2) {
            const razao = w0 / h0;
            const novaLargura = dir - esq;
            const novaAltura = novaLargura / razao;
            if (a.includes('n')) topo = base - novaAltura;
            else base = topo + novaAltura;
        }

        return { x: esq, y: topo, largura: dir - esq, altura: base - topo };
    }

    // --- régua -----------------------------------------------------------------

    private atualizarRegua(fim: { x: number; y: number }): void {
        const ini = this.reguaInicio;
        const p = this.pagina;
        const g = this.reguaG.clear();
        g.moveTo(ini.x, ini.y).lineTo(fim.x, fim.y).stroke({ color: 0xf4e0a0, width: 2, alpha: 0.95, pixelLine: true });
        g.circle(ini.x, ini.y, 4 / this.mundo.scale.x).fill(0xd4a843);
        g.circle(fim.x, fim.y, 4 / this.mundo.scale.x).fill(0xd4a843);
        const quadrados = Math.hypot(fim.x - ini.x, fim.y - ini.y) / (p?.tamanho_quadrado ?? 70);
        const valor = quadrados * (p?.distancia_quadrado ?? 1.5);
        this.reguaTexto.text = `${formatar(valor)} ${p?.unidade ?? 'm'}  ·  ${formatar(quadrados)} q`;
        this.reguaTexto.scale.set(1 / this.mundo.scale.x);
        this.reguaTexto.position.set((ini.x + fim.x) / 2 + 8 / this.mundo.scale.x, (ini.y + fim.y) / 2 - 22 / this.mundo.scale.x);
        this.reguaTexto.visible = true;
    }

    private limparRegua(): void {
        this.reguaG.clear();
        this.reguaTexto.visible = false;
    }

    // --- eventos do navegador --------------------------------------------------

    private paraMundo(sx: number, sy: number): { x: number; y: number } {
        return { x: (sx - this.mundo.x) / this.mundo.scale.x, y: (sy - this.mundo.y) / this.mundo.scale.y };
    }

    private posTela(e: MouseEvent | PointerEvent | WheelEvent): { x: number; y: number } {
        const r = this.app.canvas.getBoundingClientRect();

        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    private aoMudarVista(): void {
        this.desenharSelecao();
        this.opcoes.eventos.zoom(this.mundo.scale.x);
    }

    private ligarEventos(): void {
        const canvas = this.app.canvas;
        const ouvir = <K extends keyof HTMLElementEventMap>(alvo: HTMLElement, tipo: K, fn: (e: HTMLElementEventMap[K]) => void, opt?: AddEventListenerOptions) => {
            alvo.addEventListener(tipo, fn as EventListener, opt);
            this.removerListeners.push(() => alvo.removeEventListener(tipo, fn as EventListener));
        };
        const ouvirJanela = <K extends keyof WindowEventMap>(tipo: K, fn: (e: WindowEventMap[K]) => void) => {
            window.addEventListener(tipo, fn as EventListener);
            this.removerListeners.push(() => window.removeEventListener(tipo, fn as EventListener));
        };

        ouvir(canvas, 'contextmenu', (e) => e.preventDefault());
        ouvir(
            canvas,
            'wheel',
            (e) => {
                e.preventDefault();
                this.zoomPor(e.deltaY < 0 ? 1.1 : 1 / 1.1, this.posTela(e));
            },
            { passive: false },
        );
        ouvir(canvas, 'dblclick', (e) => {
            if (!this.opcoes.mestre) return;
            const t = this.posTela(e);
            const p = this.paraMundo(t.x, t.y);
            const alvo = this.objetoEm(p.x, p.y);
            if (alvo?.dto.tipo === 'parede' && alvo.dto.dados?.tipo === 'porta') this.opcoes.eventos.alternarPorta(alvo.dto.id);
        });
        ouvir(canvas, 'pointerdown', (e) => this.aoPressionar(e));
        ouvir(canvas, 'pointermove', (e) => this.aoMover(e));
        ouvir(canvas, 'pointerup', (e) => this.aoSoltar(e));
        ouvir(canvas, 'pointercancel', (e) => this.aoSoltar(e));

        const digitando = (e: KeyboardEvent) => ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
        ouvirJanela('keydown', (e) => {
            if (digitando(e)) return;
            if (e.code === 'Space') {
                this.espaco = true;
                this.atualizarCursor();
                e.preventDefault();
            }
            if (e.key === 'Escape') {
                this.limparRegua();
                this.selecionar(null);
            }
        });
        ouvirJanela('keyup', (e) => {
            if (e.code === 'Space') {
                this.espaco = false;
                this.atualizarCursor();
            }
        });
    }

    private aoPressionar(e: PointerEvent): void {
        this.animacao?.();
        this.app.canvas.setPointerCapture(e.pointerId);
        const tela = this.posTela(e);
        const p = this.paraMundo(tela.x, tela.y);
        this.inicioTela = tela;
        this.inicioMundo = p;
        this.iniciou = false;
        this.limparRegua();

        const emPan = e.button === 1 || e.button === 2 || this.espaco || this.ferramenta === 'mover';
        if (emPan) {
            this.modo = 'pan';
            this.atualizarCursor('grabbing');
            return;
        }
        if (e.button !== 0) return;

        if (this.ferramenta === 'regua') {
            this.modo = 'regua';
            this.reguaInicio = { x: this.snapCentro(p.x), y: this.snapCentro(p.y) };
            return;
        }
        if (this.ferramenta === 'pintar') {
            this.modo = 'pintar';
            this.tracoAtual = [p.x, p.y];
            return;
        }
        if (this.ferramenta === 'texto') {
            this.opcoes.eventos.criarTexto(p.x, p.y, tela);
            return;
        }
        if (this.ferramenta === 'parede' || this.ferramenta === 'porta' || this.ferramenta === 'janela') {
            if (!this.opcoes.mestre) return;
            this.modo = 'desenhar';
            this.desenhoInicio = { x: this.snap(p.x), y: this.snap(p.y) };
            return;
        }
        if (this.ferramenta === 'luz') {
            if (this.opcoes.mestre) this.opcoes.eventos.criarLuz(this.snapCentro(p.x), this.snapCentro(p.y));
            return;
        }

        // Ferramenta "selecionar": alça > objeto > vazio.
        const alca = this.alcaEm(p.x, p.y);
        const sel = this.selecionadoId ? this.visuais.get(this.selecionadoId) : null;
        if (alca && sel) {
            this.modo = 'redimensionar';
            this.alca = alca;
            this.inicioObjeto = { x: sel.dto.x, y: sel.dto.y, largura: sel.dto.largura, altura: sel.dto.altura };
            return;
        }
        const alvo = this.objetoEm(p.x, p.y);
        this.selecionar(alvo?.dto.id ?? null);
        if (alvo && alvo.dto.tipo !== 'parede') {
            this.modo = 'mover';
            this.inicioObjeto = { x: alvo.dto.x, y: alvo.dto.y };
        }
    }

    private aoMover(e: PointerEvent): void {
        const tela = this.posTela(e);
        const p = this.paraMundo(tela.x, tela.y);

        if (this.modo === 'pan') {
            this.mundo.position.set(this.mundo.x + (tela.x - this.inicioTela.x), this.mundo.y + (tela.y - this.inicioTela.y));
            this.inicioTela = tela;
            this.desenharSelecao();
            return;
        }
        if (this.modo === 'pintar') {
            const n = this.tracoAtual.length;
            const minimo = 2 / this.mundo.scale.x;
            if (Math.hypot(p.x - this.tracoAtual[n - 2], p.y - this.tracoAtual[n - 1]) >= minimo && n < 5000) this.tracoAtual.push(p.x, p.y);
            const g = this.desenhoG.clear();
            g.moveTo(this.tracoAtual[0], this.tracoAtual[1]);
            for (let i = 2; i < this.tracoAtual.length; i += 2) g.lineTo(this.tracoAtual[i], this.tracoAtual[i + 1]);
            g.stroke({ color: parseInt(this.estilo.cor.slice(1), 16), width: this.estilo.espessura, cap: 'round', join: 'round' });
            return;
        }
        if (this.modo === 'desenhar') {
            const fim = { x: this.snap(p.x), y: this.snap(p.y) };
            this.desenhoG.clear().moveTo(this.desenhoInicio.x, this.desenhoInicio.y).lineTo(fim.x, fim.y).stroke({ color: 0xf4e0a0, width: 8, alpha: 0.6, cap: 'round' });
            return;
        }
        if (this.modo === 'regua') {
            this.atualizarRegua({ x: this.snapCentro(p.x), y: this.snapCentro(p.y) });
            return;
        }
        const v = this.selecionadoId ? this.visuais.get(this.selecionadoId) : null;
        if (this.modo === 'mover' && v && v.dto.tipo !== 'parede') {
            // Só começa a arrastar após alguns px, para que um clique não mova o objeto.
            if (!this.iniciou && Math.hypot(tela.x - this.inicioTela.x, tela.y - this.inicioTela.y) < 3) return;
            this.iniciou = true;
            const campos = {
                x: this.snap((this.inicioObjeto.x ?? 0) + (p.x - this.inicioMundo.x)),
                y: this.snap((this.inicioObjeto.y ?? 0) + (p.y - this.inicioMundo.y)),
            };
            v.definirGeometria(campos);
            this.desenharSelecao();
            this.opcoes.eventos.alterar(v.dto.id, campos, false);
            return;
        }
        if (this.modo === 'redimensionar' && v && this.alca) {
            // Acompanha o mouse livremente; o encaixe no grid vem como guia e é aplicado (animado) ao soltar.
            const campos = this.redimensionar(p, e.shiftKey, false);
            this.alvoEncaixe = this.snapAtivo ? this.redimensionar(p, e.shiftKey, true) : null;
            v.definirGeometria(campos);
            this.desenharSelecao();
            this.opcoes.eventos.alterar(v.dto.id, campos, false);
            return;
        }
        // Cursor de alça ao passar por cima.
        const alca = this.modo === 'nenhum' ? this.alcaEm(p.x, p.y) : null;
        this.atualizarCursor(alca ? cursorDaAlca(alca) : undefined);
    }

    private aoSoltar(e: PointerEvent): void {
        if (this.app.canvas.hasPointerCapture(e.pointerId)) this.app.canvas.releasePointerCapture(e.pointerId);
        if (this.modo === 'pintar') {
            this.desenhoG.clear();
            const pts = this.tracoAtual;
            this.tracoAtual = [];
            if (pts.length < 4) pts.push(pts[0] + 0.5, pts[1] + 0.5); // clique simples vira um ponto
            const xs = pts.filter((_, i) => i % 2 === 0);
            const ys = pts.filter((_, i) => i % 2 === 1);
            const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
            const relativos = pts.map((v, i) => Math.round((v - (i % 2 === 0 ? minX : minY)) * 10) / 10);
            this.opcoes.eventos.criarTraco({
                x: minX, y: minY,
                largura: Math.max(1, Math.max(...xs) - minX),
                altura: Math.max(1, Math.max(...ys) - minY),
                pontos: relativos,
            });
        }
        if (this.modo === 'desenhar') {
            const tela = this.posTela(e);
            const p = this.paraMundo(tela.x, tela.y);
            const fim = { x: this.snap(p.x), y: this.snap(p.y) };
            this.desenhoG.clear();
            if (Math.hypot(fim.x - this.desenhoInicio.x, fim.y - this.desenhoInicio.y) * this.mundo.scale.x > 8) {
                const tipo = this.ferramenta === 'porta' ? 'porta' : this.ferramenta === 'janela' ? 'janela' : 'parede';
                this.opcoes.eventos.criarParede([this.desenhoInicio.x, this.desenhoInicio.y, fim.x, fim.y], tipo);
            }
        }
        const v = this.selecionadoId ? this.visuais.get(this.selecionadoId) : null;
        const modo = this.modo;
        this.modo = 'nenhum';
        this.alca = null;
        this.atualizarCursor();
        if (!v) return;
        if (modo === 'mover' && this.iniciou) {
            const { x, y } = v.dto;
            this.opcoes.eventos.alterar(v.dto.id, { x, y }, true);
        } else if (modo === 'redimensionar') {
            const alvo = this.alvoEncaixe;
            this.alvoEncaixe = null;
            const concluir = () => {
                const { x, y, largura, altura } = v.dto;
                this.opcoes.eventos.alterar(v.dto.id, { x, y, largura, altura }, true);
            };
            if (alvo) this.animarPara(v, alvo, concluir);
            else concluir();
        }
    }

    /** Desliza suavemente o objeto até o tamanho encaixado no grid (ease-out). */
    private animarPara(v: ObjetoVisual, alvo: CamposGeometria, fim: () => void): void {
        this.animacao?.();
        const de = { x: v.dto.x, y: v.dto.y, largura: v.dto.largura, altura: v.dto.altura };
        const duracao = 140;
        let decorrido = 0;
        const passo = (t: { deltaMS: number }) => {
            decorrido += t.deltaMS;
            const k = Math.min(1, decorrido / duracao);
            const e = 1 - Math.pow(1 - k, 3);
            v.definirGeometria({
                x: de.x + (alvo.x! - de.x) * e,
                y: de.y + (alvo.y! - de.y) * e,
                largura: de.largura + (alvo.largura! - de.largura) * e,
                altura: de.altura + (alvo.altura! - de.altura) * e,
            });
            this.desenharSelecao();
            if (k >= 1) encerrar();
        };
        const encerrar = () => {
            this.app.ticker.remove(passo);
            this.animacao = null;
            v.definirGeometria(alvo);
            this.desenharSelecao();
            fim();
        };
        this.animacao = encerrar; // outra ação interrompe e conclui na hora
        this.app.ticker.add(passo);
    }

    private atualizarCursor(forcado?: string): void {
        if (!this.pronto) return;
        const emPan = this.espaco || this.ferramenta === 'mover';
        const padrao = ['regua', 'luz', 'parede', 'porta', 'janela', 'pintar'].includes(this.ferramenta) ? 'crosshair' : this.ferramenta === 'texto' ? 'text' : emPan ? 'grab' : 'default';
        this.app.canvas.style.cursor = forcado ?? padrao;
    }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 7,5 / 10 (sem zeros inúteis), com vírgula decimal. */
function formatar(n: number): string {
    return (Math.round(n * 100) / 100).toString().replace('.', ',');
}

function cursorDaAlca(a: AlcaRedimensionar): string {
    return a === 'n' || a === 's' ? 'ns-resize' : a === 'e' || a === 'w' ? 'ew-resize' : a === 'nw' || a === 'se' ? 'nwse-resize' : 'nesw-resize';
}

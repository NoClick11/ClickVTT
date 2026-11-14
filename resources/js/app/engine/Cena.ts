import { Application, Assets, Container, Graphics, Text } from 'pixi.js';
import { GifSprite } from 'pixi.js/gif';
import { areaMedida, desenhoDaArea, tokensNaArea, type AreaDeEfeito } from '../nucleo/combate/area';
import { fatorParaMetros, limitar as limitarPasso, metros as metrosDe } from '../nucleo/combate/movimento';
import { Iluminacao } from './Iluminacao';
import { ObjetoVisual } from './ObjetoVisual';
import {
    CAMADAS,
    type AlcaRedimensionar,
    type Camada,
    type CamposGeometria,
    type CenaEventos,
    type EstiloPintura,
    type Ferramenta,
    type InfoMira,
    type ObjetoDto,
    type PaginaDto,
} from './tipos';
import { pontoAlcancavel, pontoNoPoligono, segmentosQueBloqueiam } from './visao';

const ESCALA_MIN = 0.05;
const ESCALA_MAX = 8;
const TAMANHO_ALCA = 8; // px na tela
const MARGEM_TOPO = 48; // altura da barra superior
const ALCAS: AlcaRedimensionar[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

type Modo = 'nenhum' | 'pan' | 'mover' | 'redimensionar' | 'rotacionar' | 'regua' | 'desenhar' | 'pintar' | 'laco';

interface AnimacaoToken {
    objetoId: number;
    de: { x: number; y: number };
    para: { x: number; y: number };
    decorrido: number;
    duracao: number;
    dtoFinal: ObjetoDto;
    aoConcluir?: () => void;
}

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
    /** Barras de vida e ícones de efeito de todos os tokens, acima das camadas de tokens (ver `ObjetoVisual.hud`). */
    private hudTokens = new Container();
    private iluminacao!: Iluminacao;
    private iluminacaoPendente = false;
    private animacoesTokens = new Map<number, AnimacaoToken>();
    private tickHandler: ((ticker: { deltaMS: number }) => void) | null = null;
    private temporizadorIluminacao: ReturnType<typeof setTimeout> | undefined;
    private temporizadorMemoria: ReturnType<typeof setTimeout> | undefined;
    private ultimaMemoria = '';
    private selecaoG = new Graphics();
    private reguaG = new Graphics();
    private gabaritoG = new Graphics();
    private zonasG = new Graphics();
    private desenhoG = new Graphics();
    private efeitosG = new Container();
    private pingsG = new Container();
    private textosG = new Container();
    private reguaTexto = new Text({
        text: '',
        style: { fontFamily: 'sans-serif', fontSize: 14, fill: 0xfaf0cf, fontWeight: '600', stroke: { color: 0x0d0a12, width: 4 } },
    });

    private visuais = new Map<number, ObjetoVisual>();
    private pagina: PaginaDto | null = null;
    private camadaAtiva: Camada = 'jogadores';
    private ferramenta: Ferramenta = 'selecionar';
    private selecionadoId: number | null = null;
    /** Os outros objetos da seleção em lote (além do principal). */
    private extras = new Set<number>();
    /** Onde cada objeto do grupo estava ao começar o arrasto em grupo. */
    private grupoInicio = new Map<number, { x: number; y: number }>();
    /** Começo do retângulo de seleção (laço), em coordenadas do mundo, e se o Shift estava apertado (soma à seleção). */
    private lacoInicio = { x: 0, y: 0 };
    private lacoSoma = false;
    /** O objeto que o arrasto do grupo segura (o encaixe na grade segue o dele). */
    private ancoraDoGrupo: number | null = null;
    private alvoId: number | null = null;
    private mirasJogadores = new Map<number, InfoMira[]>();
    /** Deslocamento do turno do token que se move agora (metros): a régua do arrasto mostra o gasto e, para o jogador, trava. */
    private movimento: { objetoId: number; usado: number; total: number; limitar: boolean } | null = null;
    /** Gabarito de área em uso (Técnica de área): a forma segue o cursor a partir do token de quem usa; um clique confirma. */
    private gabarito: { area: AreaDeEfeito; origem: number; excluir?: number[] } | null = null;
    /** Marcar o centro de uma esfera (Vigília): segue o cursor, limitada a `maximo` m do ponto `de`; um clique confirma. */
    private ponto: { de: { x: number; y: number }; maximo: number; raio: number } | null = null;
    private zonas: { id: string; x: number; y: number; raio: number; cor: string }[] = [];
    /** Tecla T apertada: o próximo clique em um token o mira (qualquer ferramenta). */
    private teclaMirar = false;

    private modo: Modo = 'nenhum';
    private espaco = false;
    private inicioTela = { x: 0, y: 0 };
    /** Onde o botão foi apertado (não muda durante o arrasto): distingue clique de arrasto no botão direito. */
    private pressTela = { x: 0, y: 0 };
    private eraArrasto = false;
    private inicioMundo = { x: 0, y: 0 };
    private inicioObjeto: CamposGeometria = {};
    private alca: AlcaRedimensionar | null = null;
    private reguaInicio = { x: 0, y: 0 };
    private desenhoInicio = { x: 0, y: 0 };
    /** Destino encaixado no grid durante o redimensionamento (mostrado como contorno-guia). */
    private alvoEncaixe: CamposGeometria | null = null;
    /** Destino do token durante o arrasto estilo Foundry (o token real fica parado até soltar). */
    private alvoMovimento: { x: number; y: number } | null = null;
    /** Destinos dos tokens em grupo durante o arrasto estilo Foundry. */
    private alvosGrupoMovimento = new Map<number, { x: number; y: number }>();
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

        this.iluminacao = new Iluminacao(this.app.renderer, () => this.agendarMemoria());
        this.app.stage.addChild(this.mundo);
        this.mundo.addChild(this.fundoPagina);
        // Ordem de desenho: mapa < grade < mestre < jogadores < iluminação < overlay.
        for (const { id } of CAMADAS) {
            const c = new Container();
            c.label = id;
            this.camadas.set(id, c);
            // Barras de vida e efeitos: acima de TODOS os tokens (mestre e jogadores), mas ainda sob a escuridão.
            if (id === 'iluminacao') this.mundo.addChild(this.hudTokens);
            if (id === 'iluminacao') this.mundo.addChild(this.iluminacao.container); // a escuridão cobre o jogo, não os controles do mestre
            this.mundo.addChild(c);
            if (id === 'mapa') this.mundo.addChild(this.grade);
        }
        this.overlay.addChild(
            this.zonasG,
            this.selecaoG,
            this.reguaG,
            this.gabaritoG,
            this.desenhoG,
            this.efeitosG,
            this.pingsG,
            this.textosG,
            this.reguaTexto,
        );
        this.reguaTexto.visible = false;
        this.mundo.addChild(this.overlay);

        this.ligarEventos();
        this.tickHandler = (ticker) => this.tick(ticker.deltaMS);
        this.app.ticker.add(this.tickHandler);
        this.pronto = true;
        this.atualizarCursor();
        this.redesenharPagina();
    }

    destruir(): void {
        if (this.tickHandler) this.app.ticker.remove(this.tickHandler);
        this.animacoesTokens.clear();
        clearTimeout(this.temporizadorIluminacao);
        clearTimeout(this.temporizadorMemoria);
        this.iluminacao.destruir();
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
        for (const v of this.visuais.values()) v.definirUnidade(pagina.unidade);
        this.redesenharPagina();
        this.desenharZonas();
        if (trocou || ajustar) this.ajustarVista();
        if (trocou) {
            this.iluminacao.reiniciarMemoria();
            this.ultimaMemoria = '';
            if (!this.opcoes.mestre && pagina.iluminacao_ativa) this.opcoes.eventos.pedirMemoria(pagina.id);
        }
        this.solicitarIluminacao();
    }

    setObjetos(lista: ObjetoDto[]): void {
        if (!this.pronto) return;
        const ids = new Set<number>();
        for (const dto of lista) {
            ids.add(dto.id);
            const existente = this.visuais.get(dto.id);
            if (existente) {
                const sendoArrastado = this.modo === 'mover' && (this.selecionadoId === dto.id || this.grupoInicio.has(dto.id));
                if (!sendoArrastado) {
                    const anim = this.animacoesTokens.get(dto.id);
                    if (anim && Math.hypot(anim.para.x - dto.x, anim.para.y - dto.y) <= 2) {
                        anim.dtoFinal = { ...dto, x: anim.para.x, y: anim.para.y };
                        existente.atualizar({ ...dto, x: existente.dto.x, y: existente.dto.y });
                    } else {
                        const mudouPosicao = dto.tipo === 'token' && Math.hypot(dto.x - existente.dto.x, dto.y - existente.dto.y) > 2;
                        const distancia = mudouPosicao ? Math.hypot(dto.x - existente.dto.x, dto.y - existente.dto.y) : 0;
                        if (mudouPosicao && distancia < 3000) {
                            this.deslizarTokenPara(existente, dto);
                        } else {
                            this.animacoesTokens.delete(dto.id);
                            existente.atualizar(dto);
                        }
                    }
                }
                this.moverParaCamada(existente, dto.camada);
            } else {
                const v = new ObjetoVisual(dto, this.opcoes.mestre);
                v.definirUnidade(this.pagina?.unidade);
                v.definirAlvo(dto.id === this.alvoId);
                v.definirMiras(this.mirasJogadores.get(dto.id) ?? []);
                v.definirEnfase(this.camadaAtiva === 'iluminacao');
                this.visuais.set(dto.id, v);
                this.camadas.get(dto.camada)?.addChild(v.container);
                this.hudTokens.addChild(v.hud);
            }
        }
        for (const [id, v] of this.visuais) {
            if (!ids.has(id)) {
                this.animacoesTokens.delete(id);
                v.destruir();
                this.visuais.delete(id);
                if (this.selecionadoId === id || this.extras.has(id)) this.definirSelecao(this.selecionadosIds().filter((x) => x !== id));
            }
        }
        this.ordenarCamadas();
        this.desenharSelecao();
        this.solicitarIluminacao();
    }

    setCamadaAtiva(camada: Camada): void {
        this.camadaAtiva = camada;
        for (const v of this.visuais.values()) v.definirEnfase(camada === 'iluminacao');
        const sel = this.selecionadoId ? this.visuais.get(this.selecionadoId) : null;
        if (sel && sel.dto.camada !== camada) this.selecionar(null);
        this.atualizarCursor();
    }

    /** O token do turno e o quanto já andou/pode andar (null = sem limite medido). */
    setMovimento(m: { objetoId: number; usado: number; total: number; limitar: boolean } | null): void {
        this.movimento = m;
    }

    /** Token mirado por quem joga (só local): ganha a mira desenhada por cima. */
    setAlvo(id: number | null): void {
        this.alvoId = id;
        for (const v of this.visuais.values()) v.definirAlvo(v.dto.id === id);
    }

    /** Miras ativas de todos os jogadores da mesa: desenhadas com suas respectivas cores nos tokens. */
    setMiras(miras: Record<number, InfoMira[]>): void {
        this.mirasJogadores.clear();
        for (const [k, lista] of Object.entries(miras)) {
            this.mirasJogadores.set(Number(k), lista);
        }
        for (const [id, v] of this.visuais) {
            v.definirMiras(this.mirasJogadores.get(id) ?? []);
        }
    }

    /** Liga o gabarito de área a partir do token `origem` (id do objeto), ou o desliga (`null`). */
    setGabarito(g: { area: AreaDeEfeito; origem: number; excluir?: number[] } | null): void {
        this.gabarito = g;
        this.gabaritoG.clear();
        this.reguaTexto.visible = false;
        for (const v of this.visuais.values()) v.definirAlvo(v.dto.id === this.alvoId);
        this.atualizarCursor();
    }

    /** Liga a marcação do centro de uma esfera (`de` e centro em pixels do mundo; `maximo` e `raio` em metros), ou a desliga (`null`). */
    setPonto(p: { de: { x: number; y: number }; maximo: number; raio: number } | null): void {
        this.ponto = p;
        this.gabaritoG.clear();
        this.reguaTexto.visible = false;
        this.atualizarCursor();
    }

    /** Esferas persistentes no mapa (Vigília): visíveis para todos, na cor de quem as marcou. */
    setZonas(zonas: { id: string; x: number; y: number; raio: number; cor: string }[]): void {
        this.zonas = zonas;
        this.desenharZonas();
    }

    private desenharZonas(): void {
        const g = this.zonasG.clear();
        const mpp = this.metrosPorPixel();
        for (const z of this.zonas) {
            const cor = Number.parseInt(z.cor.replace('#', ''), 16) || 0xfb923c;
            g.circle(z.x, z.y, z.raio / mpp)
                .fill({ color: cor, alpha: 0.14 })
                .stroke({ color: cor, width: 2, alpha: 0.9, pixelLine: true });
        }
    }

    /** O ponto sob o cursor, preso ao alcance máximo a partir de `de`. */
    private pontoLimitado(cursor: { x: number; y: number }): { x: number; y: number; metros: number } | null {
        if (!this.ponto) return null;
        const mpp = this.metrosPorPixel();
        const dx = cursor.x - this.ponto.de.x;
        const dy = cursor.y - this.ponto.de.y;
        const dist = Math.hypot(dx, dy) * mpp;
        const k = dist > this.ponto.maximo ? this.ponto.maximo / dist : 1;

        return { x: this.ponto.de.x + dx * k, y: this.ponto.de.y + dy * k, metros: Math.min(dist, this.ponto.maximo) };
    }

    private desenharPonto(cursor: { x: number; y: number }): void {
        const r = this.pontoLimitado(cursor);
        const g = this.gabaritoG.clear();
        if (!r || !this.ponto) return;
        const mpp = this.metrosPorPixel();
        const estilo = { color: 0xfb923c, width: 2, alpha: 0.95, pixelLine: true };
        g.circle(this.ponto.de.x, this.ponto.de.y, this.ponto.maximo / mpp).stroke({ ...estilo, alpha: 0.35 }); // o alcance
        g.circle(r.x, r.y, this.ponto.raio / mpp)
            .fill({ color: 0xfb923c, alpha: 0.22 })
            .stroke(estilo);
        this.reguaTexto.text = `${formatar(r.metros)} m (máx. ${formatar(this.ponto.maximo)} m) · esfera de ${formatar(this.ponto.raio)} m`;
        this.reguaTexto.scale.set(1 / this.mundo.scale.x);
        this.reguaTexto.position.set(cursor.x + 12 / this.mundo.scale.x, cursor.y - 24 / this.mundo.scale.x);
        this.reguaTexto.visible = true;
    }

    private confirmarPonto(cursor: { x: number; y: number }): void {
        const r = this.pontoLimitado(cursor);
        if (r) this.opcoes.eventos.ponto({ x: r.x, y: r.y });
    }

    private metrosPorPixel(): number {
        const p = this.pagina;

        return ((p?.distancia_quadrado ?? 1.5) * fatorParaMetros(p?.unidade)) / Math.max(1, p?.tamanho_quadrado ?? 100);
    }

    private origemDoGabarito(): { x: number; y: number } | null {
        const o = this.visuais.get(this.gabarito?.origem ?? -1)?.dto;

        return o ? { x: o.x + o.largura / 2, y: o.y + o.altura / 2 } : null;
    }

    /** Os tokens de personagem que a área atinge com o cursor onde está (e a medida da forma). */
    private alcancadosPeloGabarito(cursor: { x: number; y: number }) {
        const origem = this.origemDoGabarito();
        if (!origem || !this.gabarito) return null;
        const mpp = this.metrosPorPixel();
        const medida = areaMedida(this.gabarito.area, origem, cursor, mpp);
        const tokens = [...this.visuais.values()]
            .filter(
                (v) =>
                    v.dto.tipo === 'token' &&
                    v.dto.personagem_id !== null &&
                    v.dto.id !== this.gabarito!.origem &&
                    !this.gabarito!.excluir?.includes(v.dto.id),
            )
            .map((v) => ({
                id: v.dto.id,
                x: v.dto.x + v.dto.largura / 2,
                y: v.dto.y + v.dto.altura / 2,
                raio: Math.min(v.dto.largura, v.dto.altura) / 2,
            }));

        return { origem, medida, mpp, ids: tokensNaArea(medida, origem, tokens, mpp, this.gabarito.origem) };
    }

    private desenharGabarito(cursor: { x: number; y: number }): void {
        const r = this.alcancadosPeloGabarito(cursor);
        const g = this.gabaritoG.clear();
        if (!r) return;
        const { origem, medida, mpp, ids } = r;
        // o contorno é o mesmo que conta os tokens: a forma alargada pelo raio de um token (a de quem usa vale de referência)
        const o = this.visuais.get(this.gabarito?.origem ?? -1)?.dto;
        const raioPx = o ? Math.min(o.largura, o.altura) / 2 : 0;
        const d = desenhoDaArea(medida, origem, raioPx, mpp);
        const estilo = { color: 0xfb923c, width: 2, alpha: 0.95, pixelLine: true };
        const preencher = { color: 0xfb923c, alpha: 0.22 };
        if (d.tipo === 'circulo') g.circle(d.x, d.y, d.r).fill(preencher).stroke(estilo);
        else if (d.tipo === 'setor') g.moveTo(d.x, d.y).arc(d.x, d.y, d.r, d.de, d.ate).closePath().fill(preencher).stroke(estilo);
        else g.poly(d.pontos).fill(preencher).stroke(estilo);
        const dentro = new Set(ids);
        for (const v of this.visuais.values()) v.definirAlvo(dentro.has(v.dto.id) || v.dto.id === this.alvoId);
        const limite = this.gabarito?.area.metros === null && this.gabarito.area.maximo ? ` (máx. ${formatar(this.gabarito.area.maximo)} m)` : '';
        this.reguaTexto.text = `${formatar(medida.metros)} m${limite} · ${ids.length} alvo${ids.length === 1 ? '' : 's'}`;
        this.reguaTexto.scale.set(1 / this.mundo.scale.x);
        this.reguaTexto.position.set(cursor.x + 12 / this.mundo.scale.x, cursor.y - 24 / this.mundo.scale.x);
        this.reguaTexto.visible = true;
    }

    private confirmarGabarito(cursor: { x: number; y: number }): void {
        const r = this.alcancadosPeloGabarito(cursor);
        if (!r) return;
        // do mais perto de quem usa ao mais longe (o disparo em linha acerta primeiro o que está na frente)
        const perto = (id: number) => {
            const o = this.visuais.get(id)?.dto;

            return o ? Math.hypot(o.x + o.largura / 2 - r.origem.x, o.y + o.altura / 2 - r.origem.y) : Infinity;
        };
        const ids = [...r.ids]
            .sort((a, b) => perto(a) - perto(b))
            .map((id) => this.visuais.get(id)?.dto.personagem_id)
            .filter((x): x is number => typeof x === 'number');
        this.opcoes.eventos.gabarito(ids, { medida: r.medida, origem: r.origem, mpp: r.mpp });
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
        if (this.selecionadoId === id && this.extras.size === 0) return;
        this.definirSelecao(id === null ? [] : [id]);
    }

    /** Ids da seleção inteira (o principal primeiro). */
    private selecionadosIds(): number[] {
        return this.selecionadoId === null ? [] : [this.selecionadoId, ...this.extras];
    }

    /** Troca a seleção (vazia, um objeto ou vários), redesenha e avisa a tela. */
    private definirSelecao(ids: number[]): void {
        this.selecionadoId = ids[0] ?? null;
        this.extras = new Set(ids.slice(1));
        this.desenharSelecao();
        this.opcoes.eventos.selecao(ids);
        this.opcoes.eventos.selecionar(ids.length === 1 ? ids[0] : null);
    }

    /** Posição do objeto na tela (em pixels da viewport), para overlays em HTML sobre o canvas. */
    posicaoTelaObjeto(id: number): { x: number; y: number; largura: number; altura: number } | null {
        const v = this.visuais.get(id);
        if (!v || !this.app?.canvas) return null;
        const r = this.app.canvas.getBoundingClientRect();
        const sendoArrastado = this.modo === 'mover' && this.selecionadoId === id && this.alvoMovimento;
        const ox = sendoArrastado ? this.alvoMovimento!.x : v.container.x;
        const oy = sendoArrastado ? this.alvoMovimento!.y : v.container.y;
        const largura = v.dto.largura;
        const altura = v.dto.altura;
        const cx = ox * this.mundo.scale.x + this.mundo.x;
        const cy = oy * this.mundo.scale.y + this.mundo.y;

        return {
            x: r.left + cx,
            y: r.top + cy,
            largura: largura * this.mundo.scale.x,
            altura: altura * this.mundo.scale.y,
        };
    }

    /** Ctrl+A: seleciona tudo o que a pessoa pode mexer na camada ativa. */
    selecionarTodos(): void {
        this.definirSelecao([...this.visuais.values()].filter((v) => this.podeInteragir(v) && this.ferramenta !== 'mirar').map((v) => v.dto.id));
    }

    /** Objetos que o retângulo (mundo) toca e que a pessoa pode mexer. */
    private objetosNoLaco(a: { x: number; y: number }, b: { x: number; y: number }): number[] {
        const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
        const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];

        return [...this.visuais.values()]
            .filter((v) => {
                if (!this.podeInteragir(v)) return false;
                const c = v.caixa();
                const pts = v.dto.dados?.pontos;
                // parede: o segmento (pelo menos uma das pontas dentro, ou a caixa cruza)
                if (v.dto.tipo === 'parede' && pts?.length === 4) {
                    const dentro = (px: number, py: number) => px >= x0 && px <= x1 && py >= y0 && py <= y1;
                    return (
                        dentro(pts[0], pts[1]) ||
                        dentro(pts[2], pts[3]) ||
                        (Math.min(pts[0], pts[2]) <= x1 &&
                            Math.max(pts[0], pts[2]) >= x0 &&
                            Math.min(pts[1], pts[3]) <= y1 &&
                            Math.max(pts[1], pts[3]) >= y0)
                    );
                }

                return c.x <= x1 && c.x + c.largura >= x0 && c.y <= y1 && c.y + c.altura >= y0;
            })
            .map((v) => v.dto.id);
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
    /** Ponto do mundo sob uma posição da tela, em pixels relativos ao canvas. */
    pontoDoMundo(sx: number, sy: number): { x: number; y: number } {
        return this.paraMundo(sx, sy);
    }

    centroDaVista(): { x: number; y: number } {
        return this.paraMundo(this.app.screen.width / 2, this.app.screen.height / 2);
    }

    /** Reproduz uma animação visual temporária sobre o mapa no ponto (x, y) */
    async tocarEfeito(
        x: number,
        y: number,
        urlAnimacao: string,
        opcoes?: {
            largura?: number;
            altura?: number;
            duracaoMs?: number;
            rotacao?: number;
            ancoraX?: number;
            ancoraY?: number;
        },
    ): Promise<void> {
        try {
            let source: any;
            try {
                source = await Assets.load(urlAnimacao);
            } catch {
                await Assets.unload(urlAnimacao).catch(() => undefined);
                source = await Assets.load(urlAnimacao);
            }
            const sprite = new GifSprite({ source, autoPlay: true, loop: false });
            sprite.currentFrame = 0;
            sprite.play();
            sprite.anchor.set(opcoes?.ancoraX ?? 0.5, opcoes?.ancoraY ?? 0.5);
            sprite.position.set(x, y);
            const largura = opcoes?.largura ?? 180;
            const altura = opcoes?.altura ?? 180;
            sprite.width = largura;
            sprite.height = altura;
            if (opcoes?.rotacao !== undefined) {
                sprite.rotation = opcoes.rotacao;
            }
            this.efeitosG.addChild(sprite);
            const duracao = opcoes?.duracaoMs ?? 800;
            setTimeout(() => {
                this.efeitosG.removeChild(sprite);
                sprite.destroy();
            }, duracao);
        } catch (e) {
            console.warn('Falha ao reproduzir efeito visual:', e);
        }
    }

    /** Exibe um texto flutuante animado (Scrolling Combat Text) sobre um ponto do mapa (dano em vermelho, cura em verde). */
    mostrarTextoFlutuante(x: number, y: number, texto: string, tipo: 'dano' | 'cura'): void {
        const cor = tipo === 'dano' ? 0xef4444 : 0x22c55e;
        const txt = new Text({
            text: texto,
            style: {
                fontFamily: 'Georgia, serif',
                fontWeight: '900',
                fontSize: 28,
                fill: cor,
                stroke: { color: 0x000000, width: 5 },
            },
        });
        txt.anchor.set(0.5, 0.5);
        const jitterX = (Math.random() - 0.5) * 16;
        const startY = y - 20;
        txt.position.set(x + jitterX, startY);
        txt.scale.set(0.6);
        this.textosG.addChild(txt);

        let frame = 0;
        const totalFrames = 65; // ~1.1s a 60fps

        const animar = () => {
            frame++;
            const t = frame / totalFrames;

            // Pop de impacto inicial
            if (frame <= 8) {
                const p = frame / 8;
                txt.scale.set(0.6 + 0.65 * p);
            } else if (frame <= 16) {
                const p = (frame - 8) / 8;
                txt.scale.set(1.25 - 0.25 * p);
            } else {
                txt.scale.set(1.0);
            }

            // Sobe suavemente em Y com desaceleração
            txt.position.y = startY - 48 * Math.sin(t * (Math.PI / 2));

            // Fade out gradual na segunda metade
            if (t > 0.45) {
                txt.alpha = Math.max(0, 1 - (t - 0.45) / 0.55);
            }

            if (frame >= totalFrames) {
                this.app.ticker.remove(animar);
                this.textosG.removeChild(txt);
                txt.destroy();
            }
        };

        this.app.ticker.add(animar);
    }

    /** Desliza um token suavemente até uma posição de destino (usado para desfazer movimento / Ctrl+Z). */
    deslizarObjeto(id: number, destino: { x: number; y: number }): void {
        const v = this.visuais.get(id);
        if (!v) return;
        this.animacoesTokens.delete(id);
        this.deslizarTokenPara(v, { ...v.dto, x: destino.x, y: destino.y }, () => {
            if (this.selecionadoId === id) this.desenharSelecao();
            this.opcoes.eventos.vista?.();
        });
    }

    /** Centraliza suavemente a visão do mapa num ponto específico (x, y) do mundo, opcionalmente ajustando o zoom (escala). */
    centralizarEm(x: number, y: number, suave = true, escalaAlvo?: number): void {
        const livreW = this.app.screen.width - this.margemDireita;
        const livreH = this.app.screen.height - MARGEM_TOPO;
        const eFinal = escalaAlvo !== undefined ? clamp(escalaAlvo, ESCALA_MIN, ESCALA_MAX) : this.mundo.scale.x;
        const alvoX = livreW / 2 - x * eFinal;
        const alvoY = MARGEM_TOPO + livreH / 2 - y * eFinal;

        if (!suave) {
            this.mundo.scale.set(eFinal);
            this.mundo.position.set(alvoX, alvoY);
            this.aoMudarVista();
            return;
        }

        const iniX = this.mundo.x;
        const iniY = this.mundo.y;
        const iniE = this.mundo.scale.x;
        let decorrido = 0;
        const duracao = 650; // ms

        const animar = (ticker: { deltaMS: number }) => {
            decorrido += ticker.deltaMS;
            const t = Math.min(1, decorrido / duracao);
            // Curva easeOutCubic
            const f = 1 - Math.pow(1 - t, 3);
            const eAtual = iniE + (eFinal - iniE) * f;
            this.mundo.scale.set(eAtual);
            this.mundo.position.set(iniX + (alvoX - iniX) * f, iniY + (alvoY - iniY) * f);
            this.desenharSelecao();
            this.opcoes.eventos.zoom(eAtual);
            this.opcoes.eventos.vista?.();
            if (t >= 1) {
                this.app.ticker.remove(animar);
                this.aoMudarVista();
            }
        };

        this.app.ticker.add(animar);
    }

    /** Dispara a animação visual de ondas de ping no mapa estilo Foundry/Roll20. */
    tocarPing(x: number, y: number, corHexStr = '#f59e0b'): void {
        const cor = parseInt(corHexStr.replace('#', ''), 16) || 0xf59e0b;
        const pingCont = new Container();
        pingCont.position.set(x, y);

        const g = new Graphics();
        pingCont.addChild(g);
        this.pingsG.addChild(pingCont);

        let tempo = 0;
        const duracaoTotal = 1600; // ms

        const animar = (ticker: { deltaMS: number }) => {
            tempo += ticker.deltaMS;
            g.clear();

            // Ponto central brilhante fixo pulsando
            const pulsoPonto = 0.8 + 0.3 * Math.sin((tempo / 150) * Math.PI);
            g.circle(0, 0, 8 * pulsoPonto).fill(0xffffff);
            g.circle(0, 0, 12 * pulsoPonto).stroke({ color: cor, width: 3 });

            // 2 ondas concêntricas se expandindo sucessivamente
            for (let i = 0; i < 2; i++) {
                const atraso = i * 400; // 400ms de defasagem entre as ondas
                if (tempo >= atraso) {
                    const tOnda = ((tempo - atraso) % 900) / 900;
                    if (tempo - atraso < 1400) {
                        const raio = 8 + 65 * tOnda;
                        const alpha = Math.max(0, 1 - tOnda);
                        g.circle(0, 0, raio).stroke({ color: cor, width: 3.5, alpha });
                    }
                }
            }

            // Flechas ou anel externo de alerta
            const tGlobal = Math.min(1, tempo / duracaoTotal);
            if (tempo >= duracaoTotal) {
                this.app.ticker.remove(animar);
                this.pingsG.removeChild(pingCont);
                pingCont.destroy({ children: true });
            }
        };

        this.app.ticker.add(animar);
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
        const t = this.pagina?.tamanho_quadrado ?? 100;
        return this.snapAtivo ? Math.round(v / t) * t : v;
    }

    private snapCentro(v: number): number {
        const t = this.pagina?.tamanho_quadrado ?? 100;
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
        // as barras seguem a mesma ordem dos tokens (camada, depois z e id), para duas barras sobrepostas não trocarem de lugar
        const ordemDaCamada = new Map(CAMADAS.map((c, i) => [c.id as Camada, i]));
        const porHud = new Map([...this.visuais.values()].map((v) => [v.hud as Container, v]));
        this.hudTokens.children.sort((a, b) => {
            const va = porHud.get(a as Container);
            const vb = porHud.get(b as Container);

            return (
                (ordemDaCamada.get(va?.dto.camada as Camada) ?? 0) - (ordemDaCamada.get(vb?.dto.camada as Camada) ?? 0) ||
                (va?.dto.z ?? 0) - (vb?.dto.z ?? 0) ||
                (va?.dto.id ?? 0) - (vb?.dto.id ?? 0)
            );
        });
    }

    /** Mestre interage só com a camada ativa; jogador só com o próprio token. */
    private podeInteragir(v: ObjetoVisual): boolean {
        if (this.opcoes.mestre) return v.dto.camada === this.camadaAtiva;

        if (v.dto.camada !== 'jogadores') return false;
        if (v.dto.tipo === 'token') return v.dto.personagem_id !== null && this.opcoes.personagensPermitidos.includes(v.dto.personagem_id);

        return (v.dto.tipo === 'traco' || v.dto.tipo === 'texto') && v.dto.jogador_id !== null && v.dto.jogador_id === this.opcoes.jogadorId;
    }

    // --- loop e animação fluida de tokens e iluminação -----------------------------------------------------

    private tick(deltaMS: number): void {
        if (this.animacoesTokens.size > 0) {
            const tinhaSelecionadoAnimando = this.selecionadoId !== null && this.animacoesTokens.has(this.selecionadoId);
            for (const [id, anim] of this.animacoesTokens) {
                anim.decorrido += deltaMS;
                const t = Math.min(1, anim.decorrido / anim.duracao);
                // Easing cúbico suave estilo Foundry VTT
                const e = 1 - Math.pow(1 - t, 3);
                const x = anim.de.x + (anim.para.x - anim.de.x) * e;
                const y = anim.de.y + (anim.para.y - anim.de.y) * e;
                const v = this.visuais.get(id);
                if (v) {
                    v.definirGeometria({ x, y });
                    if (this.selecionadoId === id) this.desenharSelecao();
                }
                if (t >= 1) {
                    if (v) v.atualizar(anim.dtoFinal);
                    this.animacoesTokens.delete(id);
                    anim.aoConcluir?.();
                }
            }
            if (tinhaSelecionadoAnimando) {
                this.opcoes.eventos.vista?.();
            }
            this.iluminacaoPendente = true;
        }

        if (this.iluminacaoPendente) {
            this.iluminacaoPendente = false;
            this.atualizarIluminacao();
        }

        // Rotação suave no sentido horário das miras ativas nos tokens
        for (const v of this.visuais.values()) {
            if (v.temMiraAtiva) {
                v.atualizarMira(deltaMS);
            }
        }
    }

    private solicitarIluminacao(): void {
        this.iluminacaoPendente = true;
    }

    private deslizarTokenPara(v: ObjetoVisual, dto: ObjetoDto, aoConcluir?: () => void): void {
        const de = { x: v.dto.x, y: v.dto.y };
        const para = { x: dto.x, y: dto.y };
        const distancia = Math.hypot(para.x - de.x, para.y - de.y);

        // Movimento suave e perceptível estilo Foundry VTT: o token anda visivelmente pelo mapa
        const tamQuad = this.pagina?.tamanho_quadrado || 70;
        const passos = Math.max(1, distancia / tamQuad);
        const duracao = Math.min(850, Math.max(260, passos * 140));

        // Aplica outras mudanças de dados mantendo a posição inicial da animação
        v.atualizar({ ...dto, x: de.x, y: de.y });

        this.animacoesTokens.set(dto.id, {
            objetoId: dto.id,
            de,
            para,
            decorrido: 0,
            duracao,
            dtoFinal: { ...dto, x: para.x, y: para.y },
            aoConcluir,
        });
        this.iluminacaoPendente = true;
    }

    // --- iluminação dinâmica ------------------------------------------------------------------------------------------------

    private agendarIluminacao(atraso = 0): void {
        if (atraso <= 0) {
            this.solicitarIluminacao();
            return;
        }
        clearTimeout(this.temporizadorIluminacao);
        this.temporizadorIluminacao = setTimeout(() => this.solicitarIluminacao(), atraso);
    }

    /** Guarda a memória no servidor um pouco depois da última mudança (e só se for diferente da última enviada). */
    private agendarMemoria(): void {
        clearTimeout(this.temporizadorMemoria);
        this.temporizadorMemoria = setTimeout(async () => {
            const imagem = await this.iluminacao.exportarMemoria().catch(() => null);
            if (imagem && imagem !== this.ultimaMemoria) {
                this.ultimaMemoria = imagem;
                this.opcoes.eventos.memoria(imagem);
            }
        }, 2500);
    }

    /** A memória guardada no servidor chegou: passa a valer no próximo cálculo. */
    async carregarMemoria(imagem: string | null): Promise<void> {
        await this.iluminacao.carregarMemoria(imagem);
        this.ultimaMemoria = imagem ?? '';
        this.solicitarIluminacao();
    }

    /** O mestre apagou a memória: a névoa volta. */
    limparMemoria(): void {
        this.iluminacao.limparMemoria();
        this.ultimaMemoria = '';
        this.solicitarIluminacao();
    }

    /** Recalcula luz, visão e sombras (na GPU) e mostra só o que o jogador enxerga: controles de porta e janela, tokens e loot. */
    private atualizarIluminacao(): void {
        if (!this.pronto || !this.pagina) return;
        if (this.modo === 'redimensionar') return;
        const ativa = this.pagina.iluminacao_ativa;
        const dtos = [...this.visuais.values()].map((v) => v.dto);
        const meus = (o: ObjetoDto) => o.tipo === 'token' && o.personagem_id !== null && this.opcoes.personagensPermitidos.includes(o.personagem_id);
        const meusTokens = this.opcoes.mestre ? [] : dtos.filter((o) => meus(o) && o.camada === 'jogadores');
        const r = this.iluminacao.atualizar(ativa ? { pagina: this.pagina, objetos: dtos, mestre: this.opcoes.mestre, meusTokens } : null);
        for (const v of this.visuais.values()) {
            const o = v.dto;
            if (o.tipo === 'luz') v.definirLuzDinamica(ativa);
            if (this.opcoes.mestre) continue;
            if (o.tipo === 'parede') v.definirVisivel(this.controleVisivel(v, r?.visao ?? []));
            // O que o jogador não enxerga agora (fora da linha de visão ou no escuro) some: token e loot dos outros não aparecem na penumbra.
            else if ((o.tipo === 'token' && !meus(o)) || o.tipo === 'loot')
                v.definirVisivel(!r || r.pontoVisivel(o.x + o.largura / 2, o.y + o.altura / 2));
        }
    }

    /** O controle da porta/janela está à vista do jogador? (sem token com visão, vê todos) */
    private controleVisivel(v: ObjetoVisual, visao: number[][]): boolean {
        const tipo = v.dto.dados?.tipo;
        const p = v.dto.dados?.pontos;
        if ((tipo !== 'porta' && tipo !== 'janela') || !p || p.length !== 4) return false;
        if (!visao.length) return true;
        const mx = (p[0] + p[2]) / 2;
        const my = (p[1] + p[3]) / 2;
        // a porta fica sobre a parede: testa em volta do ponto médio, não exatamente na borda do polígono
        return visao.some((poli) =>
            [
                [0, 0],
                [4, 0],
                [-4, 0],
                [0, 4],
                [0, -4],
            ].some(([dx, dy]) => pontoNoPoligono(mx + dx, my + dy, poli)),
        );
    }

    /** Porta ou janela (visível) sob o ponto, para o jogador abrir ou fechar. */
    private portaEm(x: number, y: number): ObjetoVisual | null {
        const tol = 14 / this.mundo.scale.x;
        for (const v of this.visuais.values()) {
            const tipo = v.dto.dados?.tipo;
            if (v.dto.tipo === 'parede' && (tipo === 'porta' || tipo === 'janela') && v.container.visible && v.acerta(x, y, tol)) return v;
        }

        return null;
    }

    /** Loot aberto aos jogadores sob o ponto (o de cima vence). */
    private lootEm(x: number, y: number): ObjetoVisual | null {
        const tol = 6 / this.mundo.scale.x;
        const achados = [...this.visuais.values()].filter((v) => v.dto.tipo === 'loot' && v.dto.camada === 'jogadores' && v.acerta(x, y, tol));

        return achados.sort((a, b) => b.dto.z - a.dto.z || b.dto.id - a.dto.id)[0] ?? null;
    }

    /** Ponto de viagem sob o cursor. */
    private viagemEm(x: number, y: number): ObjetoVisual | null {
        const tol = 10 / this.mundo.scale.x;
        const achados = [...this.visuais.values()].filter((v) => v.dto.tipo === 'viagem' && v.container.visible && v.acerta(x, y, tol));

        return achados.sort((a, b) => b.dto.z - a.dto.z || b.dto.id - a.dto.id)[0] ?? null;
    }

    /** Objeto sob o ponto em QUALQUER camada (menos a iluminação); o de cima vence. Só o mestre mexe fora da camada ativa. */
    private objetoDeQualquerCamadaEm(x: number, y: number): ObjetoVisual | null {
        const tol = 10 / this.mundo.scale.x;
        const ordem = (v: ObjetoVisual) => CAMADAS.findIndex((c) => c.id === v.dto.camada);
        const candidatos = [...this.visuais.values()].filter(
            (v) => v.dto.camada !== 'iluminacao' && (this.opcoes.mestre || this.podeInteragir(v)) && v.acerta(x, y, tol),
        );
        candidatos.sort((a, b) => ordem(b) - ordem(a) || b.dto.z - a.dto.z || b.dto.id - a.dto.id);

        return candidatos[0] ?? null;
    }

    /** Verifica se o ponto clicado foi na barra de vida de um token ou próximo a ela (acima do topo do token). */
    private barraVidaEm(x: number, y: number): ObjetoVisual | null {
        const tol = 12 / this.mundo.scale.x;
        for (const v of this.visuais.values()) {
            if (v.dto.tipo !== 'token' || !this.podeInteragir(v)) continue;
            const barras = v.dto.barras ?? [];
            const temPv = barras.some((b) => b.id === 'pv');
            if (!temPv) continue;

            const ox = v.container.x;
            const oy = v.container.y;
            const largura = v.dto.largura;
            const altBarra = Math.max(13, Math.min(20, largura * 0.22));
            const numBarras = barras.filter((b) => b.id === 'pv' || b.id === 'pp').length;
            const alturaBarras = numBarras * (altBarra + 2) + 4;

            // Região da barra de vida: acima do token, entre y = oy - alturaBarras - tol e y = oy + 6
            // e horizontalmente entre ox - tol e ox + largura + tol
            if (x >= ox - tol && x <= ox + largura + tol && y >= oy - alturaBarras - tol && y <= oy + 6) {
                return v;
            }
        }
        return null;
    }

    /**
     * Verifica se o cursor está sobre um dos ícones de status de algum token visível no mapa.
     * Retorna o objeto visual, os ids do status sob o cursor e a posição central na tela.
     */
    private statusEm(x: number, y: number): { visual: ObjetoVisual; statusIds: string[]; tela: { x: number; y: number } } | null {
        if (!this.app?.canvas) return null;
        const tol = 3 / this.mundo.scale.x;
        const rect = this.app.canvas.getBoundingClientRect();
        for (const v of this.visuais.values()) {
            if (v.dto.tipo !== 'token' || (v.dto.camada === 'mestre' && !this.opcoes.mestre)) continue;
            const geometrias = v.geometriaDosStatus();
            if (!geometrias.length) continue;
            const vx = v.container.x;
            const vy = v.container.y;
            for (const g of geometrias) {
                const cx = vx + g.cx;
                const cy = vy + g.cy;
                const dist = Math.hypot(x - cx, y - cy);
                if (dist <= g.raio + tol) {
                    const statusIds = g.resto > 0 ? (v.dto.status ?? []).slice(3) : [g.id];
                    const telaX = rect.left + cx * this.mundo.scale.x + this.mundo.x;
                    const telaY = rect.top + cy * this.mundo.scale.y + this.mundo.y;
                    return { visual: v, statusIds, tela: { x: telaX, y: telaY } };
                }
            }
        }
        return null;
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
        // Seleção em lote: um contorno em cada objeto (sem alças: o grupo só se move e se apaga)
        if (this.extras.size > 0) {
            for (const id of this.selecionadosIds()) {
                const o = this.visuais.get(id);
                if (!o) continue;
                const pts = o.dto.dados?.pontos;
                if (o.dto.tipo === 'parede' && pts?.length === 4) {
                    g.moveTo(pts[0], pts[1]).lineTo(pts[2], pts[3]).stroke({ color: 0xd4a843, width: 14, alpha: 0.35, cap: 'round' });
                    continue;
                }
                const c = o.caixa();
                g.rect(c.x, c.y, c.largura, c.altura)
                    .fill({ color: 0xd4a843, alpha: 0.08 })
                    .stroke({ color: 0xd4a843, width: 1.5, alpha: 0.95, pixelLine: true });
            }

            return;
        }
        const { x, y, largura, altura } = v.caixa();
        const pts = v.dto.dados?.pontos;
        if (v.dto.tipo === 'parede' && pts?.length === 4) {
            g.moveTo(pts[0], pts[1]).lineTo(pts[2], pts[3]).stroke({ color: 0xd4a843, width: 14, alpha: 0.35, cap: 'round' });
            return; // paredes não se movem nem se redimensionam: exclua e desenhe de novo
        }
        const rot = v.dto.dados?.rotacao ?? 0;
        const rad = (rot * Math.PI) / 180;
        const cx = x + largura / 2;
        const cy = y + altura / 2;
        const hw = largura / 2;
        const hh = altura / 2;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // 4 cantos da caixa delimitadora rotacionada
        const p0 = { x: cx + (-hw * cos - -hh * sin), y: cy + (-hw * sin + -hh * cos) };
        const p1 = { x: cx + (hw * cos - -hh * sin), y: cy + (hw * sin + -hh * cos) };
        const p2 = { x: cx + (hw * cos - hh * sin), y: cy + (hw * sin + hh * cos) };
        const p3 = { x: cx + (-hw * cos - hh * sin), y: cy + (-hw * sin + hh * cos) };

        g.poly([p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p0.x, p0.y]).stroke({
            color: 0xd4a843,
            width: 1.5,
            alpha: 0.95,
            pixelLine: true,
        });

        const guia = this.alvoEncaixe;
        if (guia && this.modo === 'redimensionar') {
            g.rect(guia.x!, guia.y!, guia.largura!, guia.altura!)
                .fill({ color: 0xd4a843, alpha: 0.12 })
                .stroke({ color: 0xf4e0a0, width: 1.5, alpha: 0.9, pixelLine: true });
        }

        // Alça de rotação estilo Roll20 (no topo do token/imagem, perpendicular à borda superior)
        const podeRotacionar = (v.dto.tipo === 'token' || (this.opcoes.mestre && v.dto.tipo === 'imagem')) && this.podeInteragir(v);
        if (podeRotacionar) {
            const distHaste = 24 / this.mundo.scale.x;
            const stemBase = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
            const stemEnd = { x: stemBase.x + sin * distHaste, y: stemBase.y - cos * distHaste };
            const rAlca = 6.5 / this.mundo.scale.x;

            // Haste
            g.moveTo(stemBase.x, stemBase.y).lineTo(stemEnd.x, stemEnd.y).stroke({ color: 0xd4a843, width: 1.5, pixelLine: true });

            // Alça circular externa e miolo
            g.circle(stemEnd.x, stemEnd.y, rAlca).fill(0x0d0a12).stroke({ color: 0xd4a843, width: 2 });
            g.circle(stemEnd.x, stemEnd.y, rAlca * 0.45).fill(0xd4a843);
        }

        if (!this.opcoes.mestre || v.dto.tipo === 'texto') return;
        const s = TAMANHO_ALCA / this.mundo.scale.x;
        for (const a of this.alcasVisiveis(largura, altura)) {
            const p = this.posicaoAlca(a, x, y, largura, altura, rot);
            g.rect(p.x - s / 2, p.y - s / 2, s, s)
                .fill(0x0d0a12)
                .stroke({ color: 0xd4a843, width: 1.5, pixelLine: true });
        }
    }

    private posicaoAlcaRotacao(v: ObjetoVisual): { x: number; y: number } {
        const { x, y, largura, altura } = v.dto;
        const cx = x + largura / 2;
        const cy = y + altura / 2;
        const hh = altura / 2;
        const rot = v.dto.dados?.rotacao ?? 0;
        const rad = (rot * Math.PI) / 180;
        const sin = Math.sin(rad);
        const cos = Math.cos(rad);
        const distHaste = 24 / this.mundo.scale.x;

        return { x: cx + sin * (hh + distHaste), y: cy - cos * (hh + distHaste) };
    }

    private alcaRotacaoEm(px: number, py: number): boolean {
        const v = this.selecionadoId ? this.visuais.get(this.selecionadoId) : null;
        if (!v || !this.podeInteragir(v)) return false;
        if (v.dto.tipo !== 'token' && !(this.opcoes.mestre && v.dto.tipo === 'imagem')) return false;
        const p = this.posicaoAlcaRotacao(v);
        const tol = (TAMANHO_ALCA * 1.3) / this.mundo.scale.x;

        return Math.hypot(px - p.x, py - p.y) <= tol;
    }

    /** Alças ficam FORA da borda (não cobrem a imagem); alças de aresta somem quando a aresta é curta na tela. */
    private posicaoAlca(a: AlcaRedimensionar, x: number, y: number, w: number, h: number, rot = 0): { x: number; y: number } {
        const fora = TAMANHO_ALCA / this.mundo.scale.x / 2 + 1 / this.mundo.scale.x;
        const cx0 = a.includes('w') ? x - fora : a.includes('e') ? x + w + fora : x + w / 2;
        const cy0 = a.includes('n') ? y - fora : a.includes('s') ? y + h + fora : y + h / 2;
        if (!rot) return { x: cx0, y: cy0 };

        const cx = x + w / 2;
        const cy = y + h / 2;
        const rad = (rot * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = cx0 - cx;
        const dy = cy0 - cy;

        return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
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
        const rot = v.dto.dados?.rotacao ?? 0;
        for (const a of this.alcasVisiveis(largura, altura)) {
            const p = this.posicaoAlca(a, x, y, largura, altura, rot);
            if (Math.abs(px - p.x) <= tol && Math.abs(py - p.y) <= tol) return a;
        }

        return null;
    }

    /** `encaixar`: arestas nos quadrados (resultado final); sem isso, acompanha o mouse livremente. */
    private redimensionar(p: { x: number; y: number }, manterProporcao: boolean, encaixar: boolean): CamposGeometria {
        const { x, y, largura: w0, altura: h0 } = this.inicioObjeto as Required<CamposGeometria>;
        const a = this.alca!;
        const minimo = this.snapAtivo ? (this.pagina?.tamanho_quadrado ?? 100) : 10;
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
        const quadrados = Math.hypot(fim.x - ini.x, fim.y - ini.y) / (p?.tamanho_quadrado ?? 100);
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
        this.opcoes.eventos.vista?.();
    }

    private ligarEventos(): void {
        const canvas = this.app.canvas;
        const ouvir = <K extends keyof HTMLElementEventMap>(
            alvo: HTMLElement,
            tipo: K,
            fn: (e: HTMLElementEventMap[K]) => void,
            opt?: AddEventListenerOptions,
        ) => {
            alvo.addEventListener(tipo, fn as EventListener, opt);
            this.removerListeners.push(() => alvo.removeEventListener(tipo, fn as EventListener));
        };
        const ouvirJanela = <K extends keyof WindowEventMap>(tipo: K, fn: (e: WindowEventMap[K]) => void) => {
            window.addEventListener(tipo, fn as EventListener);
            this.removerListeners.push(() => window.removeEventListener(tipo, fn as EventListener));
        };

        ouvir(canvas, 'contextmenu', (e) => {
            e.preventDefault();
            this.aoContextMenu(e);
        });
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
            const t = this.posTela(e);
            const p = this.paraMundo(t.x, t.y);
            const alvo = this.objetoEm(p.x, p.y);
            if (alvo?.dto.tipo === 'token' && alvo.dto.personagem_id) return this.opcoes.eventos.abrirToken(alvo.dto.id);
            if (!this.opcoes.mestre) return;
            if (alvo?.dto.tipo === 'parede' && ['porta', 'janela'].includes(alvo.dto.dados?.tipo ?? ''))
                this.opcoes.eventos.alternarPorta(alvo.dto.id);
            else if (alvo?.dto.tipo === 'loot') this.opcoes.eventos.abrirLoot(alvo.dto.id);
            else if (alvo?.dto.tipo === 'viagem') this.opcoes.eventos.usarPontoViagem(alvo.dto.id);
        });
        ouvir(canvas, 'pointerdown', (e) => this.aoPressionar(e));
        ouvir(canvas, 'pointermove', (e) => this.aoMover(e));
        ouvir(canvas, 'pointerleave', () => {
            this.opcoes.eventos.hoverStatus?.(null);
        });
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
            if (e.code === 'KeyA' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.selecionarTodos();
            }
            if (e.code === 'KeyT' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                this.teclaMirar = true;
                this.atualizarCursor();
            }
            // Teclas E e R: rotacionam o token selecionado (como no Roll20)
            if ((e.code === 'KeyE' || e.code === 'KeyR') && !e.ctrlKey && !e.metaKey) {
                const sel = this.selecionadoId ? this.visuais.get(this.selecionadoId) : null;
                if (sel && (sel.dto.tipo === 'token' || (this.opcoes.mestre && sel.dto.tipo === 'imagem')) && this.podeInteragir(sel)) {
                    e.preventDefault();
                    const passo = e.altKey || e.shiftKey ? 15 : 45;
                    const direcao = e.code === 'KeyE' ? 1 : -1;
                    const atual = sel.dto.dados?.rotacao ?? 0;
                    let novo = Math.round((atual + direcao * passo) / passo) * passo;
                    novo = ((novo % 360) + 360) % 360;
                    const novosDados = { ...(sel.dto.dados ?? {}), rotacao: novo };
                    sel.definirDados(novosDados);
                    this.desenharSelecao();
                    this.opcoes.eventos.alterar(sel.dto.id, { dados: novosDados }, true);
                }
            }
            if (e.key === 'Escape') {
                if (this.gabarito) this.opcoes.eventos.gabarito(null, null);
                if (this.ponto) this.opcoes.eventos.ponto(null);
                this.limparRegua();
                this.selecionar(null);
            }
        });
        ouvirJanela('keyup', (e) => {
            if (e.code === 'Space') {
                this.espaco = false;
                this.atualizarCursor();
            }
            if (e.code === 'KeyT') {
                this.teclaMirar = false;
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
        this.pressTela = tela;
        this.inicioMundo = p;
        this.iniciou = false;
        this.eraArrasto = false;
        this.limparRegua();

        const emPan = e.button === 1 || e.button === 2 || this.espaco || this.ferramenta === 'mover';
        if (emPan) {
            this.modo = 'pan';
            this.atualizarCursor('grabbing');
            return;
        }
        if (e.button !== 0) return;
        if (this.gabarito) {
            this.confirmarGabarito(p);
            return;
        }
        if (this.ponto) {
            this.confirmarPonto(p);
            return;
        }

        if (this.ferramenta === 'regua') {
            this.modo = 'regua';
            this.reguaInicio = { x: this.snapCentro(p.x), y: this.snapCentro(p.y) };
            return;
        }
        // Mirar (ferramenta ou tecla T): o token de personagem sob o clique vira o alvo; clicar no vazio, com a ferramenta, limpa.
        if (this.ferramenta === 'mirar' || this.teclaMirar) {
            const token = this.tokenEm(p.x, p.y);
            if (token) this.opcoes.eventos.mirar(token.dto.id === this.alvoId ? null : token.dto.id);
            else if (this.ferramenta === 'mirar') this.opcoes.eventos.mirar(null);
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
        if (this.ferramenta === 'loot') {
            if (this.opcoes.mestre) this.opcoes.eventos.criarLoot(this.snapCentro(p.x), this.snapCentro(p.y));
            return;
        }
        if (this.ferramenta === 'luz') {
            if (this.opcoes.mestre) this.opcoes.eventos.criarLuz(this.snapCentro(p.x), this.snapCentro(p.y));
            return;
        }
        if (this.ferramenta === 'viagem') {
            if (this.opcoes.mestre) this.opcoes.eventos.criarViagem(this.snapCentro(p.x), this.snapCentro(p.y));
            return;
        }

        // Jogador: clicar numa porta ou janela à vista pede para abri-la ou fechá-la (o servidor recusa se estiver trancada).
        if (!this.opcoes.mestre) {
            const porta = this.portaEm(p.x, p.y);
            if (porta) {
                this.opcoes.eventos.alternarPorta(porta.dto.id);
                return;
            }
        }
        // Jogador: clicar num loot aberto (camada Jogadores) abre o conteúdo; ele não seleciona nem move o loot.
        if (!this.opcoes.mestre) {
            const loot = this.lootEm(p.x, p.y);
            if (loot) {
                this.opcoes.eventos.abrirLoot(loot.dto.id);
                return;
            }
        }

        // Clicar em ponto de viagem: tanto mestre quanto jogador (quando não estiver segurando ferramenta de edição)
        const viagem = this.viagemEm(p.x, p.y);
        if (viagem && (this.ferramenta === 'selecionar' || this.ferramenta === 'mover')) {
            // Se o mestre estiver com a camada ativa igual à camada da viagem e clicar sem arrastar, ele pode selecionar ou usar.
            // Para não impedir a seleção no mestre, se o mestre clicar numa viagem já selecionada ou se for jogador, aciona a viagem!
            // Mais simples e direto: se for jogador OU se clicar duas vezes/direto, usa o ponto de viagem.
            // Mas o jogador nunca mexe na ferramenta; mestre se quiser selecionar clica normalmente quando a ferramenta é selecionar e a camada é a mesma.
            if (!this.opcoes.mestre) {
                this.opcoes.eventos.usarPontoViagem(viagem.dto.id);
                return;
            }
        }

        // Ferramenta "selecionar": alça rotação > alça redimensionar > vida > objeto > vazio.
        const sel = this.selecionadoId ? this.visuais.get(this.selecionadoId) : null;
        if (sel && this.extras.size === 0 && this.alcaRotacaoEm(p.x, p.y)) {
            this.modo = 'rotacionar';
            this.atualizarCursor('crosshair');
            return;
        }

        const alca = this.alcaEm(p.x, p.y);
        if (alca && sel && this.extras.size === 0) {
            this.modo = 'redimensionar';
            this.alca = alca;
            this.inicioObjeto = { x: sel.dto.x, y: sel.dto.y, largura: sel.dto.largura, altura: sel.dto.altura };
            return;
        }

        // Clique na barra de vida de um token (ou próximo dela no topo): abre a edição rápida de vida
        const vidaToken = this.barraVidaEm(p.x, p.y);
        if (vidaToken) {
            this.selecionar(vidaToken.dto.id);
            this.opcoes.eventos.editarVida?.(vidaToken.dto.id);
            return;
        }

        const alvo = this.objetoEm(p.x, p.y);
        const emLote = this.extras.size > 0;
        // Shift+clique: soma ou tira o objeto da seleção (sem arrastar)
        if (e.shiftKey && alvo) {
            const ids = this.selecionadosIds();
            this.definirSelecao(ids.includes(alvo.dto.id) ? ids.filter((x) => x !== alvo.dto.id) : [...ids, alvo.dto.id]);
            return;
        }
        // Clique num objeto que já faz parte do lote: arrasta o grupo todo
        if (alvo && emLote && this.selecionadosIds().includes(alvo.dto.id)) {
            this.iniciarGrupo(alvo);
            return;
        }
        // Clique no vazio: começa o laço (o Shift mantém a seleção atual e soma o que o laço pegar)
        if (!alvo) {
            this.lacoSoma = e.shiftKey;
            this.lacoInicio = p;
            if (!e.shiftKey) this.selecionar(null);
            this.modo = 'laco';
            return;
        }
        this.selecionar(alvo.dto.id);
        if (alvo.dto.tipo !== 'parede') {
            this.animacoesTokens.delete(alvo.dto.id);
            this.modo = 'mover';
            this.inicioObjeto = { x: alvo.dto.x, y: alvo.dto.y };
        }
    }

    /** Começa o arrasto do grupo: lembra onde cada objeto (menos paredes) estava; o clicado é o principal. */
    private iniciarGrupo(ancora: ObjetoVisual): void {
        this.grupoInicio.clear();
        for (const id of this.selecionadosIds()) {
            const o = this.visuais.get(id);
            if (o && o.dto.tipo !== 'parede') {
                this.animacoesTokens.delete(id);
                this.grupoInicio.set(id, { x: o.dto.x, y: o.dto.y });
            }
        }
        this.modo = 'mover';
        this.inicioObjeto = { x: ancora.dto.x, y: ancora.dto.y };
        this.ancoraDoGrupo = ancora.dto.id;
    }

    private aoMover(e: PointerEvent): void {
        const tela = this.posTela(e);
        const p = this.paraMundo(tela.x, tela.y);
        if (this.gabarito && this.modo !== 'pan') {
            this.desenharGabarito(p);
            return;
        }
        if (this.ponto && this.modo !== 'pan') {
            this.desenharPonto(p);
            return;
        }

        if (this.modo === 'pan') {
            if (Math.hypot(tela.x - this.pressTela.x, tela.y - this.pressTela.y) > 6) {
                this.eraArrasto = true;
            }
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
            this.desenhoG
                .clear()
                .moveTo(this.desenhoInicio.x, this.desenhoInicio.y)
                .lineTo(fim.x, fim.y)
                .stroke({ color: 0xf4e0a0, width: 8, alpha: 0.6, cap: 'round' });
            return;
        }
        if (this.modo === 'regua') {
            this.atualizarRegua({ x: this.snapCentro(p.x), y: this.snapCentro(p.y) });
            return;
        }
        if (this.modo === 'laco') {
            const [x0, y0] = [Math.min(this.lacoInicio.x, p.x), Math.min(this.lacoInicio.y, p.y)];
            this.desenhoG
                .clear()
                .rect(x0, y0, Math.abs(p.x - this.lacoInicio.x), Math.abs(p.y - this.lacoInicio.y))
                .fill({ color: 0xd4a843, alpha: 0.12 })
                .stroke({ color: 0xf4e0a0, width: 1.5, alpha: 0.95, pixelLine: true });
            return;
        }
        // Arrasto do grupo: todos andam o mesmo tanto (o encaixe na grade segue o objeto que o mouse segura)
        if (this.modo === 'mover' && this.grupoInicio.size > 1 && this.ancoraDoGrupo !== null) {
            if (!this.iniciou && Math.hypot(tela.x - this.inicioTela.x, tela.y - this.inicioTela.y) < 3) return;
            this.iniciou = true;
            const base = this.grupoInicio.get(this.ancoraDoGrupo) ?? { x: 0, y: 0 };
            const dx = this.snap(base.x + (p.x - this.inicioMundo.x)) - base.x;
            const dy = this.snap(base.y + (p.y - this.inicioMundo.y)) - base.y;

            // Estilo Foundry VTT: durante o arrasto, tokens reais ficam fixos na posição inicial;
            // desenhamos a silhueta translúcida no destino. Ao soltar, todos deslizam continuamente.
            let temToken = false;
            this.alvosGrupoMovimento.clear();
            for (const [id, ini] of this.grupoInicio) {
                const o = this.visuais.get(id);
                if (!o) continue;
                const campos = { x: ini.x + dx, y: ini.y + dy };
                if (o.dto.tipo === 'token') {
                    temToken = true;
                    this.alvosGrupoMovimento.set(id, campos);
                } else {
                    o.definirGeometria(campos);
                    this.opcoes.eventos.alterar(id, campos, false);
                }
            }

            if (temToken) {
                this.desenharPreviewGrupo();
            } else {
                this.desenharSelecao();
                this.solicitarIluminacao();
            }
            return;
        }
        const v = this.selecionadoId ? this.visuais.get(this.selecionadoId) : null;
        if (this.modo === 'rotacionar' && v) {
            const cx = v.dto.x + v.dto.largura / 2;
            const cy = v.dto.y + v.dto.altura / 2;
            const rad = Math.atan2(p.y - cy, p.x - cx) + Math.PI / 2;
            let graus = (rad * 180) / Math.PI;
            graus = ((graus % 360) + 360) % 360;
            graus = e.altKey ? Math.round(graus) : Math.round(graus / 45) * 45;
            graus = graus % 360;
            if (graus !== (v.dto.dados?.rotacao ?? 0)) {
                const novosDados = { ...(v.dto.dados ?? {}), rotacao: graus };
                v.definirDados(novosDados);
                this.desenharSelecao();
                this.opcoes.eventos.alterar(v.dto.id, { dados: novosDados }, false);
            }
            return;
        }
        if (this.modo === 'mover' && v && v.dto.tipo !== 'parede') {
            // Só começa a arrastar após alguns px, para que um clique não mova o objeto.
            if (!this.iniciou && Math.hypot(tela.x - this.inicioTela.x, tela.y - this.inicioTela.y) < 3) return;
            this.iniciou = true;
            const campos = this.posicaoDoArrasto(v, p);

            // Se for token: estilo Foundry VTT!
            // O token real e sua iluminação/visão continuam na posição de origem até soltar.
            // Exibimos uma silhueta translúcida e régua apontando para o destino alvo.
            if (v.dto.tipo === 'token') {
                this.alvoMovimento = campos;
                this.desenharPreviewDestino(v, campos);
                this.opcoes.eventos.vista?.();
                return;
            }

            v.definirGeometria(campos);
            this.desenharSelecao();
            this.opcoes.eventos.alterar(v.dto.id, campos, false);
            this.solicitarIluminacao();
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
        // Cursor de alça ou cursor de ponteiro ao passar por cima de porta/janela ou viagem.
        const alca = this.modo === 'nenhum' ? this.alcaEm(p.x, p.y) : null;
        const sobreRotacao = this.modo === 'nenhum' && !alca && this.alcaRotacaoEm(p.x, p.y);
        const sobrePorta = this.modo === 'nenhum' && !alca && !sobreRotacao && !!this.portaEm(p.x, p.y);
        const sobreViagem = this.modo === 'nenhum' && !alca && !sobreRotacao && !sobrePorta && !!this.viagemEm(p.x, p.y);
        const stHover = this.modo === 'nenhum' && !alca && !sobreRotacao ? this.statusEm(p.x, p.y) : null;
        if (stHover) {
            this.opcoes.eventos.hoverStatus?.({
                tokenNome: stHover.visual.dto.nome ?? 'Personagem',
                statusIds: stHover.statusIds,
                tela: stHover.tela,
            });
        } else if (this.modo === 'nenhum') {
            this.opcoes.eventos.hoverStatus?.(null);
        }
        this.atualizarCursor(
            this.modo === 'rotacionar'
                ? 'crosshair'
                : alca
                  ? cursorDaAlca(alca)
                  : sobreRotacao
                    ? 'crosshair'
                    : sobrePorta || sobreViagem || stHover
                      ? 'pointer'
                      : undefined,
        );
    }

    /**
     * Onde o token fica durante o arrasto. No turno com deslocamento medido, a régua mostra o gasto (verde dentro do limite,
     * vermelho além) e, para o jogador, o token TRAVA onde o deslocamento acaba; o encaixe na grade só vale se couber.
     */
    private posicaoDoArrasto(v: ObjetoVisual, p: { x: number; y: number }): { x: number; y: number } {
        const ox = this.inicioObjeto.x ?? 0;
        const oy = this.inicioObjeto.y ?? 0;
        const livre = { x: ox + (p.x - this.inicioMundo.x), y: oy + (p.y - this.inicioMundo.y) };
        const encaixado = { x: this.snap(livre.x), y: this.snap(livre.y) };
        const m = this.movimento;
        const pagina = this.pagina;
        if (!m || !pagina || m.objetoId !== v.dto.id) return this.restringirPorParedes(v, ox, oy, encaixado);
        const restante = Math.max(0, m.total - m.usado);
        let final = encaixado;
        let travou = false;
        if (m.limitar) {
            const r = limitarPasso(ox, oy, encaixado.x, encaixado.y, restante, pagina);
            if (r.travou) {
                // o encaixe estourou: tenta o ponto livre limitado (sem grade), que fica exatamente no fim do deslocamento
                const livreLimitado = limitarPasso(ox, oy, livre.x, livre.y, restante, pagina);
                final = { x: livreLimitado.x, y: livreLimitado.y };
                travou = livreLimitado.travou;
            }
        }
        final = this.restringirPorParedes(v, ox, oy, final);
        this.desenharMovimento(v, { x: ox, y: oy }, final, m.usado, m.total, travou, !m.limitar);

        return final;
    }

    /**
     * Paredes (e portas e janelas fechadas) barram o movimento do jogador: o token para colado na parede, do lado de cá. O mestre atravessa.
     * Só antecipa o que o servidor vai decidir (ele recusa o que cruzar parede). O caminho é a reta do ponto de partida do arrasto.
     */
    private restringirPorParedes(v: ObjetoVisual, ox: number, oy: number, alvo: { x: number; y: number }): { x: number; y: number } {
        if (this.opcoes.mestre || v.dto.tipo !== 'token') return alvo;
        const paredes = segmentosQueBloqueiam(
            [...this.visuais.values()].map((o) => o.dto).filter((o) => o.tipo === 'parede'),
            'movimento',
        );
        if (!paredes.length) return alvo;
        const mx = v.dto.largura / 2;
        const my = v.dto.altura / 2;
        const livre = pontoAlcancavel(paredes, { x: ox + mx, y: oy + my }, { x: alvo.x + mx, y: alvo.y + my }, (p) => ({
            x: this.snap(p.x - mx) + mx,
            y: this.snap(p.y - my) + my,
        }));

        return { x: livre.x - mx, y: livre.y - my };
    }

    /** Desenha a silhueta translúcida no destino e a régua livre (estilo Foundry VTT) durante o arrasto do token. */
    private desenharPreviewDestino(v: ObjetoVisual, destino: { x: number; y: number }): void {
        const ox = this.inicioObjeto.x ?? v.dto.x;
        const oy = this.inicioObjeto.y ?? v.dto.y;
        const { largura, altura } = v.dto;

        // Se estiver em turno com movimento medido, a régua de gasto já é desenhada em posicaoDoArrasto
        if (!this.movimento || this.movimento.objetoId !== v.dto.id) {
            const pagina = this.pagina;
            const a = { x: ox + largura / 2, y: oy + altura / 2 };
            const b = { x: destino.x + largura / 2, y: destino.y + altura / 2 };
            const distPx = Math.hypot(b.x - a.x, b.y - a.y);
            const g = this.reguaG.clear();

            if (distPx > 4) {
                // Linha pontilhada suave conectando a posição original ao destino
                g.moveTo(a.x, a.y)
                    .lineTo(b.x, b.y)
                    .stroke({ color: 0xf4e0a0, width: 3 / this.mundo.scale.x, alpha: 0.85, cap: 'round' });
                g.circle(a.x, a.y, 4 / this.mundo.scale.x).fill(0xd4a843);
                g.circle(b.x, b.y, 4 / this.mundo.scale.x).fill(0x4ade80);

                if (pagina) {
                    const metros = metrosDe(b.x - a.x, b.y - a.y, pagina);
                    this.reguaTexto.text = `${formatar(metros)} ${pagina.unidade ?? 'm'}`;
                    this.reguaTexto.style.fill = 0xfaf0cf;
                    this.reguaTexto.scale.set(1 / this.mundo.scale.x);
                    this.reguaTexto.position.set((a.x + b.x) / 2 + 8 / this.mundo.scale.x, (a.y + b.y) / 2 - 22 / this.mundo.scale.x);
                    this.reguaTexto.visible = true;
                }
            } else {
                this.reguaTexto.visible = false;
            }
        }

        // Desenha a seleção atual + a silhueta no destino
        const selG = this.selecaoG.clear();
        // Borda dourada no token original fixo
        selG.rect(ox, oy, largura, altura).stroke({ color: 0xd4a843, width: 1.5, alpha: 0.8, pixelLine: true });

        // Silhueta fantasma translúcida do token no destino
        selG.rect(destino.x, destino.y, largura, altura)
            .fill({ color: 0xd4a843, alpha: 0.22 })
            .stroke({ color: 0x4ade80, width: 2 / this.mundo.scale.x, alpha: 0.95 });
    }

    /** Silhueta para múltiplos tokens sendo arrastados juntos. */
    private desenharPreviewGrupo(): void {
        const selG = this.selecaoG.clear();
        for (const [id, ini] of this.grupoInicio) {
            const o = this.visuais.get(id);
            if (!o) continue;
            const destino = this.alvosGrupoMovimento.get(id) ?? ini;
            // Original
            selG.rect(ini.x, ini.y, o.dto.largura, o.dto.altura).stroke({ color: 0xd4a843, width: 1.5, alpha: 0.6, pixelLine: true });
            // Silhueta no destino
            selG.rect(destino.x, destino.y, o.dto.largura, o.dto.altura)
                .fill({ color: 0xd4a843, alpha: 0.22 })
                .stroke({ color: 0x4ade80, width: 2 / this.mundo.scale.x, alpha: 0.95 });
        }
    }

    /** Régua do arrasto do token do turno: linha do ponto de partida até o token, com o gasto do turno. */
    private desenharMovimento(
        v: ObjetoVisual,
        ini: { x: number; y: number },
        fim: { x: number; y: number },
        usado: number,
        total: number,
        travou: boolean,
        livre: boolean,
    ): void {
        const pagina = this.pagina!;
        const { largura, altura } = v.dto;
        const a = { x: ini.x + largura / 2, y: ini.y + altura / 2 };
        const b = { x: fim.x + largura / 2, y: fim.y + altura / 2 };
        const andou = metrosDe(b.x - a.x, b.y - a.y, pagina);
        const restante = Math.max(0, total - usado);
        // trecho dentro do limite (verde) e o que passa dele (vermelho); o mestre pode passar
        const t = andou > 0 ? Math.min(1, restante / andou) : 1;
        const corte = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        const g = this.reguaG.clear();
        const esgotado = travou || restante <= 0.0001;
        g.moveTo(a.x, a.y)
            .lineTo(corte.x, corte.y)
            .stroke({ color: esgotado ? 0xef4444 : 0x4ade80, width: 4 / this.mundo.scale.x, alpha: 0.95, cap: 'round' });
        if (t < 1)
            g.moveTo(corte.x, corte.y)
                .lineTo(b.x, b.y)
                .stroke({ color: 0xef4444, width: 4 / this.mundo.scale.x, alpha: 0.95, cap: 'round' });
        g.circle(a.x, a.y, 5 / this.mundo.scale.x).fill(0x4ade80);
        g.circle(b.x, b.y, 5 / this.mundo.scale.x).fill(esgotado || t < 1 ? 0xef4444 : 0x4ade80);
        this.reguaTexto.text = `${formatar(andou)} m · ${esgotado ? (travou ? 'deslocamento esgotado' : 'sem deslocamento') : `restam ${formatar(restante - andou)} m`}${livre && t < 1 ? ' (além do limite)' : ''}`;
        this.reguaTexto.style.fill = esgotado || t < 1 ? 0xfca5a5 : 0xbbf7d0;
        this.reguaTexto.scale.set(1 / this.mundo.scale.x);
        this.reguaTexto.position.set((a.x + b.x) / 2 + 8 / this.mundo.scale.x, (a.y + b.y) / 2 - 22 / this.mundo.scale.x);
        this.reguaTexto.visible = true;
    }

    /** A visão e sombras se atualizam imediatamente ao soltar o token (sem atrasos artificiais). */
    private aoSoltar(e: PointerEvent): void {
        this.aoSoltarBase(e);
        this.atualizarIluminacao();
    }

    private aoContextMenu(e: MouseEvent): void {
        e.preventDefault();
        if (this.eraArrasto) {
            this.eraArrasto = false;
            return;
        }

        const tela = this.posTela(e);
        if (Math.hypot(tela.x - this.pressTela.x, tela.y - this.pressTela.y) > 6) {
            return;
        }

        const p = this.paraMundo(tela.x, tela.y);
        const alvo = this.opcoes.mestre ? this.objetoDeQualquerCamadaEm(p.x, p.y) : null;
        // Se for um objeto real da cena (e NÃO a imagem de fundo do mapa):
        if (alvo && !(alvo.dto.camada === 'mapa' && alvo.dto.tipo === 'imagem')) {
            this.opcoes.eventos.menuObjeto(alvo.dto.id, { x: e.clientX, y: e.clientY });
        } else {
            this.opcoes.eventos.menuPing?.({ x: p.x, y: p.y }, { x: e.clientX, y: e.clientY });
        }
    }

    private aoSoltarBase(e: PointerEvent): void {
        if (this.app.canvas.hasPointerCapture(e.pointerId)) this.app.canvas.releasePointerCapture(e.pointerId);
        if (this.modo === 'pan') {
            this.modo = 'nenhum';
            this.atualizarCursor();
        }
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
                x: minX,
                y: minY,
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
        if (this.modo === 'laco') {
            const tela = this.posTela(e);
            const fim = this.paraMundo(tela.x, tela.y);
            this.desenhoG.clear();
            const arrastou = Math.hypot(fim.x - this.lacoInicio.x, fim.y - this.lacoInicio.y) * this.mundo.scale.x > 4;
            if (arrastou) {
                const pegos = this.objetosNoLaco(this.lacoInicio, fim);
                this.definirSelecao(this.lacoSoma ? [...new Set([...this.selecionadosIds(), ...pegos])] : pegos);
            }
        }
        // Fim do arrasto em grupo: tokens deslizam suavemente até o destino (Foundry style) e salvam na hora
        if (this.modo === 'mover' && this.grupoInicio.size > 1 && this.iniciou) {
            for (const [id, ini] of this.grupoInicio) {
                const o = this.visuais.get(id);
                if (!o) continue;
                if (o.dto.tipo === 'token') {
                    const destino = this.alvosGrupoMovimento.get(id) ?? ini;
                    const dist = Math.hypot(destino.x - ini.x, destino.y - ini.y);
                    if (dist >= 2) {
                        this.deslizarTokenPara(o, { ...o.dto, x: destino.x, y: destino.y });
                    }
                    this.opcoes.eventos.alterar(id, { x: destino.x, y: destino.y }, true, { x: ini.x, y: ini.y });
                } else {
                    this.opcoes.eventos.alterar(id, { x: o.dto.x, y: o.dto.y }, true, { x: ini.x, y: ini.y });
                }
            }
        }
        const emGrupo = this.grupoInicio.size > 1;
        this.grupoInicio.clear();
        this.ancoraDoGrupo = null;
        this.alvosGrupoMovimento.clear();
        const v = this.selecionadoId ? this.visuais.get(this.selecionadoId) : null;
        const modo = this.modo;
        const alvoToken = this.alvoMovimento;
        this.alvoMovimento = null;
        if (modo === 'mover') {
            this.limparRegua();
            this.reguaTexto.style.fill = 0xfaf0cf;
        }
        this.modo = 'nenhum';
        this.alca = null;
        this.atualizarCursor();
        this.opcoes.eventos.vista?.();
        if (!v || emGrupo) return;
        if (modo === 'mover' && this.iniciou) {
            if (v.dto.tipo === 'token') {
                const destino = alvoToken ?? { x: v.dto.x, y: v.dto.y };
                const iniX = this.inicioObjeto.x ?? v.dto.x;
                const iniY = this.inicioObjeto.y ?? v.dto.y;
                const dist = Math.hypot(destino.x - iniX, destino.y - iniY);
                if (dist >= 2) {
                    // O token desliza continuamente do ponto inicial até o destino solto,
                    // atualizando luz, visão e sombras frame a frame sem nenhum delay
                    this.deslizarTokenPara(v, { ...v.dto, x: destino.x, y: destino.y });
                } else {
                    this.desenharSelecao();
                }
                this.opcoes.eventos.alterar(v.dto.id, { x: destino.x, y: destino.y }, true, { x: iniX, y: iniY });
            } else {
                const { x, y } = v.dto;
                this.opcoes.eventos.alterar(v.dto.id, { x, y }, true);
            }
        } else if (modo === 'rotacionar') {
            const rot = v.dto.dados?.rotacao ?? 0;
            const novosDados = { ...(v.dto.dados ?? {}), rotacao: rot };
            this.opcoes.eventos.alterar(v.dto.id, { dados: novosDados }, true);
            this.desenharSelecao();
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

    /** O token de personagem mais acima no ponto do mundo (qualquer jogador pode mirar qualquer token que enxerga). */
    private tokenEm(x: number, y: number): ObjetoVisual | null {
        let achado: ObjetoVisual | null = null;
        for (const v of this.visuais.values()) {
            if (v.dto.tipo !== 'token' || v.dto.personagem_id === null || !v.contem(x, y) || v.dto.morto) continue;
            if (!achado || v.dto.z >= achado.dto.z) achado = v;
        }

        return achado;
    }

    private atualizarCursor(forcado?: string): void {
        if (!this.pronto) return;
        const emPan = this.espaco || this.ferramenta === 'mover';
        const padrao =
            this.teclaMirar ||
            this.gabarito ||
            this.ponto ||
            ['mirar', 'regua', 'loot', 'viagem', 'luz', 'parede', 'porta', 'janela', 'pintar'].includes(this.ferramenta)
                ? 'crosshair'
                : this.ferramenta === 'texto'
                  ? 'text'
                  : emPan
                    ? 'grab'
                    : 'default';
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

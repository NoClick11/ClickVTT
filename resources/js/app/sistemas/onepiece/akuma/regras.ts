// Akuma no Mi (lógica pura, espelhada em app/Sistemas/OnePiece/Akuma.php): perfil do fruto, Aspecto Inato, MPs Especiais,
// Traços e Points da Zoan, Despertar e as características/técnicas que eles geram na ficha.
import type { TracoDados } from '../construtor/dados/tipos.ts';
import { caracteristicaDe } from '../construtor/regras.ts';
import { GRAUS } from '../criador/dados.ts';
import { ativaNoNivel, type Caracteristica, type FichaOnePiece, type Tecnica } from '../regras.ts';
import {
    ASPECTOS,
    BENEFICIOS_DE_USUARIO,
    DESPERTARES,
    ESTAGIO_DESPERTO,
    MP_ESPECIAIS,
    PROPRIEDADES,
    manifestacoesDoFruto,
    mpEspecialPorId,
    requisitoDoDespertar,
    type CategoriaDoFruto,
    type SubtipoZoan,
    type TipoDeDespertar,
    type TipoDoFruto,
} from './dados.ts';
import {
    CRIACAO_DE_POINTS,
    DESPERTAR_MITICA,
    DESPERTAR_ZOAN,
    FORCA_BESTIAL,
    FORMAS_ZOAN,
    MANTER_A_CONSCIENCIA,
    MODELOS_DE_POINT,
    PREDADOR,
    TRACOS_ANCESTRAIS,
    TRACOS_COMUNS,
    TRACOS_REPETIVEIS,
    limitesDeTracos,
    modeloDePointPorId,
    todosOsEspecificos,
    tracoPorId,
} from './zoan.ts';

export interface PointDaFicha {
    /** Posição do Point (1–5): define o nível em que vem e os limites de criação. */
    ponto: number;
    /** `custom` = criado pelo jogador (as técnicas e traços ficam nas listas); ou o id de um Modelo Especial. */
    modelo: string;
    /** Nº da Genialidade Inusitada que gerou este Point (Zoan Comum/Ancestral), se for o caso. */
    genialidade?: number;
}

export interface AkumaFicha {
    tipo: '' | TipoDoFruto;
    despertada: boolean;
    usuario: 'simples' | 'avancado';
    lista: Tecnica[];
    categoria: '' | CategoriaDoFruto;
    propriedades: string[];
    zoan: '' | SubtipoZoan;
    /** Zoan de animal carnívoro/predador: recebe o traço Predador e menos Traços Específicos. */
    predador: boolean;
    despertar: '' | TipoDeDespertar;
    /** Aspecto Inato: o padrão do tipo, o "Uso Alternativo" (Zoan Mítica) ou uma MP adicional criada no lugar. */
    aspecto: 'padrao' | 'uso-alternativo' | 'mp';
    mpEspeciais: string[];
    tracos: { comuns: string[]; especificos: string[]; ancestrais: string[] };
    points: PointDaFicha[];
    /** A fruta pronta que o mestre entregou (id do catálogo de frutas): as Técnicas dela chegam por nível. */
    fruta?: string;
}

export const akumaPadrao = (): AkumaFicha => ({
    tipo: '',
    despertada: false,
    usuario: 'simples',
    lista: [],
    categoria: '',
    propriedades: [],
    zoan: '',
    predador: false,
    despertar: '',
    aspecto: 'padrao',
    mpEspeciais: [],
    tracos: { comuns: [], especificos: [], ancestrais: [] },
    points: [],
    fruta: '',
});

type FichaDaAkuma = Pick<FichaOnePiece, 'nivel' | 'caracteristicas' | 'atributos'> & { akuma: Partial<AkumaFicha> };

export const normalizarAkuma = (f: { akuma?: Partial<AkumaFicha> }): AkumaFicha => {
    const base = akumaPadrao();
    const a = f.akuma ?? {};

    return {
        ...base,
        ...a,
        tracos: { ...base.tracos, ...(a.tracos ?? {}) },
        lista: a.lista ?? [],
        propriedades: a.propriedades ?? [],
        mpEspeciais: a.mpEspeciais ?? [],
        points: a.points ?? [],
    } as AkumaFicha;
};

/** Níveis em que a Zoan recebe um Point (1º, 3º, 6º, 9º e 12º). */
export const nivelDoPoint = (ponto: number): number => CRIACAO_DE_POINTS.find((p) => p.ponto === ponto)?.nivel ?? 99;

/** Points extras da Zoan Mítica desperta: "Point qualquer" no 16º e no 20º nível. */
export const pointsExtrasDaMitica = (nivel: number, desperto: boolean): number => (desperto ? (nivel >= 20 ? 2 : nivel >= 16 ? 1 : 0) : 0);

/** Quantas MPs criadas (não especiais) o personagem pode ter: as do tipo de usuário, menos as Especiais, mais a do aspecto alternativo. */
export function manifestacoesCriaveis(a: AkumaFicha): number {
    const total = manifestacoesDoFruto(a.tipo, a.zoan, a.usuario, a.despertada);

    return Math.max(0, total - a.mpEspeciais.length) + (a.aspecto === 'mp' ? 1 : 0);
}

/** A MP Especial está liberada para este fruto? (Logia; Categoria A ou S; Logia ou MP desperta.) */
export function mpEspecialLiberada(id: string, a: Pick<AkumaFicha, 'tipo' | 'categoria' | 'despertada'>): boolean {
    const m = mpEspecialPorId(id);
    if (!m) {
        return false;
    }
    if (m.restricao === 'logia') {
        return a.tipo === 'logia';
    }
    if (m.restricao === 'categoria') {
        return a.categoria === 'a' || a.categoria === 's';
    }
    if (m.restricao === 'logia-ou-desperto') {
        return a.tipo === 'logia' || a.despertada;
    }

    return true;
}

/** Requisito para despertar (valor de atributo pela categoria e propriedades), conferido contra os atributos da ficha. */
export function despertarAtendido(a: AkumaFicha, atributos: Record<string, number>): { ok: boolean; valor: number; atributos: string[] } | null {
    const req = requisitoDoDespertar(a.categoria, a.propriedades);
    if (!req) {
        return null;
    }

    return { ...req, ok: req.atributos.some((id) => (atributos[id] ?? 0) >= req.valor) };
}

/** Tudo que está fora das regras do perfil/traços/Points/MP Especiais da Akuma (o servidor confere o mesmo). */
export function problemasDaAkuma(f: FichaDaAkuma & { treinamento?: { aprendidos?: { id: string }[] } }): string[] {
    const a = normalizarAkuma(f);
    const p: string[] = [];
    const nivel = Number(f.nivel) || 1;
    if (!a.tipo) {
        return a.mpEspeciais.length || a.points.length || a.tracos.comuns.length ? ['Escolha o tipo da Akuma no Mi.'] : [];
    }
    for (const id of a.propriedades) {
        if (!PROPRIEDADES.some((x) => x.id === id)) p.push('Propriedade desconhecida.');
    }
    if (a.zoan && a.tipo !== 'zoan') p.push('Só Zoan tem Zoan Comum, Ancestral ou Mítica.');
    if (a.tipo === 'zoan' && !a.zoan && (a.tracos.comuns.length || a.points.length)) p.push('Escolha se a Zoan é Comum, Ancestral ou Mítica.');
    if (a.aspecto === 'uso-alternativo' && !(a.tipo === 'zoan' && a.zoan === 'mitica'))
        p.push('O "Uso Alternativo" no lugar do Vigor Animalesco é só das Zoan Míticas.');
    if (a.despertar && a.tipo === 'zoan') p.push('Zoan não tem tipo de despertar (Aprimorador/Transmutador/Holista).');
    // --- MPs Especiais
    if (new Set(a.mpEspeciais).size !== a.mpEspeciais.length) p.push('Uma MP Especial só pode ser escolhida uma vez.');
    for (const id of a.mpEspeciais) {
        if (!mpEspecialLiberada(id, a)) p.push(`${mpEspecialPorId(id)?.traco.nome ?? id}: não liberada para este fruto.`);
    }
    if (a.aspecto === 'mp' && a.mpEspeciais.length > manifestacoesDoFruto(a.tipo, a.zoan, a.usuario, a.despertada)) {
        p.push('A MP adicional do Aspecto Inato alternativo não pode ser uma MP Especial.');
    }
    if (a.mpEspeciais.length > manifestacoesDoFruto(a.tipo, a.zoan, a.usuario, a.despertada))
        p.push('Mais MPs Especiais do que Manifestações de Poder disponíveis.');
    if (a.tipo === 'zoan') {
        p.push(...problemasDaZoan(a, nivel, f.treinamento?.aprendidos?.filter((t) => t.id === 'genialidade-inusitada').length ?? 0));
    }

    return p;
}

function problemasDaZoan(a: AkumaFicha, nivel: number, genialidades: number): string[] {
    const p: string[] = [];
    if (!a.zoan) {
        return p;
    }
    const lim = limitesDeTracos(a.zoan, a.predador, a.despertada);
    const quantos = (lista: string[]) => new Map(lista.map((id) => [id, lista.filter((x) => x === id).length]));
    for (const [id, n] of quantos([...a.tracos.comuns, ...a.tracos.especificos])) {
        if (n > (TRACOS_REPETIVEIS[id] ?? 1))
            p.push(`${tracoPorId([...TRACOS_COMUNS, ...todosOsEspecificos()], id)?.nome ?? id}: escolhido vezes demais.`);
    }
    if (a.tracos.comuns.some((id) => !tracoPorId(TRACOS_COMUNS, id))) p.push('Traço Comum desconhecido.');
    if (a.tracos.especificos.some((id) => !tracoPorId(todosOsEspecificos(), id))) p.push('Traço Específico desconhecido.');
    if (a.tracos.ancestrais.some((id) => !tracoPorId(TRACOS_ANCESTRAIS, id))) p.push('Traço Ancestral desconhecido.');
    if (a.tracos.comuns.length > lim.comuns) p.push(`No máximo ${lim.comuns} Traços Comuns.`);
    if (new Set(a.tracos.ancestrais).size !== a.tracos.ancestrais.length) p.push('Um Traço Ancestral só pode ser escolhido uma vez.');
    const esp = a.tracos.especificos.length;
    const anc = a.tracos.ancestrais.length;
    if (a.zoan === 'comum' && anc) p.push('Zoan Comum não recebe Traços Ancestrais.');
    if (a.zoan === 'ancestral') {
        const trocas = Math.max(0, anc - lim.ancestrais);
        if (trocas > lim.troca) p.push(`Só dá para trocar até ${lim.troca} Traços Específicos por Ancestrais.`);
        if (esp > lim.especificos - trocas)
            p.push(`No máximo ${lim.especificos - trocas} Traços Específicos (com ${trocas} trocado(s) por Ancestrais).`);
    } else if (a.zoan === 'mitica') {
        // O Traço Específico ou Ancestral extra (despertar) vale para qualquer um dos dois.
        if (anc > lim.ancestrais + lim.extra) p.push(`No máximo ${lim.ancestrais + lim.extra} Traço(s) Ancestral(is).`);
        if (esp > lim.especificos + lim.extra) p.push(`No máximo ${lim.especificos + lim.extra} Traços Específicos.`);
        if (esp + anc > lim.especificos + lim.ancestrais + lim.extra)
            p.push(`No máximo ${lim.especificos + lim.ancestrais + lim.extra} Traços Específicos/Ancestrais juntos.`);
    } else if (esp > lim.especificos) {
        p.push(`No máximo ${lim.especificos} Traços Específicos.`);
    }
    // --- Points
    const pontos = a.points;
    const modelos = pontos.filter((x) => x.modelo !== 'custom').map((x) => x.modelo);
    if (new Set(modelos).size !== modelos.length) p.push('Cada Modelo Especial de Point só pode ser escolhido uma vez.');
    if (modelos.some((m) => !modeloDePointPorId(m))) p.push('Modelo de Point desconhecido.');
    const extras = a.zoan === 'mitica' ? pointsExtrasDaMitica(nivel, a.despertada) : 0;
    const porTier = new Map<number, number>();
    let delGenialidade = 0;
    for (const x of pontos) {
        if (!Number.isInteger(x.ponto) || x.ponto < 1 || x.ponto > 5) {
            p.push('Point fora de 1 a 5.');
            continue;
        }
        if (x.genialidade !== undefined) {
            delGenialidade++;
            if (x.genialidade < 1 || x.genialidade > Math.min(5, genialidades) || x.ponto !== x.genialidade || x.modelo !== 'custom') {
                p.push('Point da Genialidade Inusitada inválido (a nº N cria um Point próprio de posição N).');
            }
            continue;
        }
        if (nivel < nivelDoPoint(x.ponto) && !(extras > 0 && nivel >= 16)) p.push(`O ${x.ponto}º Point só vem no nível ${nivelDoPoint(x.ponto)}.`);
        porTier.set(x.ponto, (porTier.get(x.ponto) ?? 0) + 1);
    }
    let surplus = 0;
    for (const n of porTier.values()) surplus += Math.max(0, n - 1);
    if (a.zoan === 'mitica' && pontos.length - delGenialidade > 0 && surplus > extras)
        p.push('Pontos de posição repetida só valem como "Point qualquer" do 16º e 20º nível (Mítica desperta).');
    if (a.zoan !== 'mitica' && surplus > 0) p.push('Cada posição de Point (1º ao 5º) só pode ser usada uma vez.');
    const genUsadas = pontos.filter((x) => x.genialidade !== undefined).map((x) => x.genialidade);
    if (new Set(genUsadas).size !== genUsadas.length) p.push('Cada Genialidade Inusitada cria um único Point.');
    if (a.zoan !== 'comum' && a.zoan !== 'ancestral' && delGenialidade > 0)
        p.push('Em Zoan Mítica a Genialidade Inusitada cria Técnicas, não Points.');

    return p;
}

// --- geração das características e técnicas ---------------------------------------------------------------------------

const car = (traco: TracoDados, origem: string, nivel: number): Caracteristica => caracteristicaDe({ traco, origem, builder: 'akuma' }, nivel);

/** As características que o perfil da Akuma gera (Aspecto, usuário, MPs Especiais, Traços, Points, Despertar). */
export function caracteristicasDaAkuma(f: FichaDaAkuma): Caracteristica[] {
    const a = normalizarAkuma(f);
    const nivel = Number(f.nivel) || 1;
    if (!a.tipo) {
        return [];
    }
    const saida: Caracteristica[] = [];
    const aspecto = a.aspecto === 'mp' ? [] : a.aspecto === 'uso-alternativo' ? ASPECTOS['zoan-mitica-alternativo'] : ASPECTOS[a.tipo];
    for (const t of aspecto) saida.push(car(t, 'Akuma no Mi: Aspecto Inato', nivel));
    if (a.tipo !== 'zoan') {
        const u = a.usuario === 'avancado' ? 'avancado' : 'simples';
        for (const t of BENEFICIOS_DE_USUARIO[u]) saida.push(car(t, `Akuma no Mi: Usuário ${u === 'avancado' ? 'Avançado' : 'Simples'}`, nivel));
        if (a.despertada)
            for (const t of BENEFICIOS_DE_USUARIO[`${u}-desperto`])
                saida.push(car(t, `Akuma no Mi: Usuário ${u === 'avancado' ? 'Avançado' : 'Simples'} Desperto`, nivel));
    }
    for (const id of a.mpEspeciais) {
        const m = mpEspecialPorId(id);
        if (m) saida.push(car(m.traco, 'Akuma no Mi: MP Especial', nivel));
    }
    if (a.tipo === 'zoan' && a.zoan) {
        saida.push(car({ id: 'formas-zoan', nome: 'Formas da Zoan', descricao: FORMAS_ZOAN }, 'Akuma no Mi: Zoan', nivel));
        if (a.predador) saida.push(car(PREDADOR, 'Akuma no Mi: Zoan', nivel));
        for (const id of new Set(a.tracos.comuns)) {
            const t = tracoPorId(TRACOS_COMUNS, id);
            if (t) saida.push(car(vezes(t, a.tracos.comuns, id), 'Zoan: Traço Comum', nivel));
        }
        for (const id of new Set(a.tracos.especificos)) {
            const t = tracoPorId(todosOsEspecificos(), id);
            if (t) saida.push(car(vezes(t, a.tracos.especificos, id), 'Zoan: Traço Específico', nivel));
        }
        for (const id of a.tracos.ancestrais) {
            const t = tracoPorId(TRACOS_ANCESTRAIS, id);
            if (t) saida.push(car(t, 'Zoan: Traço Ancestral', nivel));
        }
        for (const x of a.points) {
            const m = modeloDePointPorId(x.modelo);
            if (m && nivel >= nivelDoPoint(x.ponto)) for (const t of m.tracos) saida.push(car(t, `${m.nome} (${x.ponto}º Point)`, nivel));
        }
    }
    if (a.despertada) {
        if (a.tipo === 'zoan') {
            for (const t of DESPERTAR_ZOAN) saida.push(car(t, 'Akuma no Mi: Estágio Desperto (Zoan)', nivel));
            saida.push(car(MANTER_A_CONSCIENCIA, 'Akuma no Mi: Estágio Desperto (Zoan)', nivel));
            for (const t of a.zoan === 'mitica' ? DESPERTAR_MITICA : [FORCA_BESTIAL])
                saida.push(car(t, 'Akuma no Mi: Estágio Desperto (Zoan)', nivel));
        } else {
            for (const t of ESTAGIO_DESPERTO) saida.push(car(t, 'Akuma no Mi: Estágio Desperto', nivel));
            if (a.despertar)
                for (const t of DESPERTARES[a.despertar])
                    saida.push(
                        car(
                            t,
                            `Akuma no Mi: ${a.despertar === 'holista' ? 'Despertar Holista' : a.despertar === 'aprimorador' ? 'Despertar Aprimorador' : 'Despertar Transmutador'}`,
                            nivel,
                        ),
                    );
        }
    }

    // o que é de um nível maior a ficha só recebe ao chegar nele (as características são refeitas ao subir de nível)
    return saida.filter((c) => ativaNoNivel(c, nivel));
}

/** Traços repetíveis (Especialidade Animal, Corpo Resistente) mostram quantas vezes foram escolhidos. */
function vezes(t: TracoDados, lista: string[], id: string): TracoDados {
    const n = lista.filter((x) => x === id).length;

    return n > 1 ? { ...t, nome: `${t.nome} (×${n})` } : t;
}

/** As Técnicas dos Modelos Especiais de Point (só valem quando o nível da técnica e do Point foram alcançados). */
export function tecnicasDosPoints(f: FichaDaAkuma): Tecnica[] {
    const a = normalizarAkuma(f);
    const nivel = Number(f.nivel) || 1;
    if (a.tipo !== 'zoan') {
        return [];
    }

    return a.points.flatMap((x) => {
        const m = modeloDePointPorId(x.modelo);
        if (!m?.tecnica) {
            return [];
        }
        const nivelDoGrau = GRAUS.find((g) => g.grau === m.tecnica!.grau)?.nivel ?? 99;
        if (nivel < Math.max(nivelDoGrau, nivelDoPoint(x.ponto))) {
            return [];
        }

        return [{ ...m.tecnica.dados, origem: `${m.nome} (${x.ponto}º Point · ${m.tecnica.grau}º grau)`, builder: 'akuma' as const }];
    });
}

/** Campos a gravar para refazer as características e técnicas geradas (mantém usos gastos e interruptores). */
export function camposDaAkuma(f: FichaOnePiece, patch: Partial<AkumaFicha> = {}): Record<string, unknown> {
    const ficha = { ...f, akuma: { ...normalizarAkuma(f), ...patch } } as FichaOnePiece & { akuma: AkumaFicha };
    const antigas = new Map((f.caracteristicas ?? []).filter((c) => c.builder === 'akuma').map((c) => [`${c.origem}|${c.nome}`, c]));
    const novas = caracteristicasDaAkuma(ficha).map((c) => {
        const antiga = antigas.get(`${c.origem}|${c.nome}`);
        if (antiga?.usos && c.usos) c.usos = { ...c.usos, atual: Math.min(c.usos.max, antiga.usos.atual) };
        if (antiga?.ativa !== undefined && c.tipo === 'ativa' && c.efeitos) c.ativa = antiga.ativa;

        return c;
    });
    const tecnicasAntigas = new Map((ficha.akuma.lista ?? []).filter((t) => t.builder === 'akuma').map((t) => [t.nome, t]));
    const tecnicas = tecnicasDosPoints(ficha).map((t) => ({
        ...t,
        ...(tecnicasAntigas.get(t.nome) ? { descricao: tecnicasAntigas.get(t.nome)!.descricao } : {}),
    }));

    const campos: Record<string, unknown> = {
        caracteristicas: [...(f.caracteristicas ?? []).filter((c) => c.builder !== 'akuma'), ...novas],
        'akuma.lista': [...(ficha.akuma.lista ?? []).filter((t) => t.builder !== 'akuma'), ...tecnicas],
    };
    for (const [k, v] of Object.entries(patch)) campos[`akuma.${k}`] = v;

    return campos;
}

export { MODELOS_DE_POINT, MP_ESPECIAIS };
export type { TipoDeDespertar };

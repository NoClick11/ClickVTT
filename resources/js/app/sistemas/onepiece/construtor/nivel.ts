/**
 * "Subir de nível": das escolhas do jogador (Habilidade Básica, Aumento no Valor de Atributo, PV) saem os campos da ficha.
 * Arquivo PURO (sem Vue). Só vale para fichas feitas pelo assistente com um estilo do catálogo (`estiloId`).
 *
 * Regras (livro): Habilidade Básica no 2º e no 3º nível (nunca repetida); AVA nos níveis do estilo (+2 em um atributo ou
 * +1 em dois; teto 20, 22 a partir do 12º e 24 a partir do 16º); regra opcional: trocar o AVA por uma HB, até 2 vezes;
 * Quebrador de Regras escolhe outra característica no 6º nível.
 */
import { camposDaAkuma } from '../akuma/regras.ts';
import { ATRIBUTOS, bonusProficiencia, usosMax, type AtributoId, type Caracteristica, type FichaOnePiece } from '../regras.ts';
import { dadoDoEstilo, estiloPorId, tecnicaDoEstilo, tecnicasDoEstiloNoNivel, tracosDoEstiloNoNivel } from './dados/estilos.ts';
import { aumentosDoAprimoramento, hbPorId, OPCOES_QUEBRADOR } from './dados/habilidades-basicas.ts';
import { maestriaPorId, NIVEIS_DE_MAESTRIA, problemasDaMaestria } from './dados/maestrias.ts';
import {
    atributosComAprimoramentoInato,
    caracteristicaDe,
    caracteristicasDaMaestria,
    caracteristicasDasHB,
    dadoDeVidaFinal,
    tecnicasDaMaestria,
    type DadoDeVida,
    type HBDaFicha,
} from './regras.ts';

export const NIVEL_MAXIMO = 20;
/** Quantas vezes a regra opcional deixa trocar um AVA por uma HB. */
export const TROCAS_DE_AVA = 2;

export interface EscolhasDoNivel {
    /** Habilidade Básica nova (2º/3º nível, troca de AVA ou 2ª do Quebrador de Regras no 6º). */
    hb?: { id: string; opcao?: string } | null;
    /** AVA: +2 em um atributo (`dois`) ou +1 em dois (`um`... cada um). */
    ava?: { tipo: 'dois' | 'um'; atributos: AtributoId[] } | null;
    /** Regra opcional: usar a Habilidade Básica no lugar do AVA deste nível. */
    trocarAva?: boolean;
    /** Traço de Maestria (9º, 13º, 17º): a Maestria (a mesma de antes, depois da 1ª vez) e o traço; `confirmou` = requisito adicional. */
    maestria?: { id: string; traco: string; confirmou?: boolean } | null;
    /** Haki Principal, escolhido ao despertar no 8º nível. */
    hakiPrincipal?: 'armamento' | 'observacao' | null;
    /** A opção escolhida na escolha de traços do estilo (Escolha Diabólica, no 2º e no 11º nível). */
    tracoEscolhido?: string | null;
    /** PV ganhos no nível (dado + CON); os efeitos de PV da ficha ficam à parte. */
    pvGanho: number;
}

export interface Pendencias {
    /** A HB do nível é obrigatória (2º e 3º). */
    hbObrigatoria: boolean;
    /** Quebrador de Regras: escolher a 2ª característica. */
    quebrador: boolean;
    /** Há AVA neste nível. */
    ava: boolean;
    /** Dá para trocar o AVA por uma HB (regra opcional) — restam trocas. */
    podeTrocar: boolean;
    /** Traço de Maestria neste nível. */
    maestria: boolean;
    /** O Haki desperta neste nível e o Haki Principal ainda não foi escolhido. */
    hakiPrincipal: boolean;
    /** Este nível pede uma escolha de traço do estilo (Escolha Diabólica). */
    escolhaDeTraco: boolean;
}

export const limiteDeAtributo = (nivel: number): number => (nivel >= 16 ? 24 : nivel >= 12 ? 22 : 20);

const hbsDe = (f: Pick<FichaOnePiece, 'habilidadesBasicas'>): HBDaFicha[] => f.habilidadesBasicas ?? [];

/** As HB que a ficha já tem (por id), para não repetir. */
export const hbsTidas = (f: Pick<FichaOnePiece, 'habilidadesBasicas'>): Set<string> => new Set(hbsDe(f).map((h) => h.id));

/** As trocas de AVA por HB já feitas: HB escolhidas em níveis em que o estilo dá AVA. */
export function trocasFeitas(f: Pick<FichaOnePiece, 'habilidadesBasicas' | 'estiloId'>): number {
    const ava = estiloPorId(f.estiloId)?.niveisAva ?? [];

    return hbsDe(f).filter((h) => ava.includes(h.nivel)).length;
}

export function pendenciasDoNivel(f: FichaOnePiece, novo: number): Pendencias {
    const estilo = estiloPorId(f.estiloId);
    const ava = !!estilo?.niveisAva.includes(novo);

    return {
        hbObrigatoria: novo === 2 || novo === 3,
        quebrador: novo === 6 && hbsDe(f).filter((h) => h.id === 'quebrador-de-regras').length === 1,
        ava,
        podeTrocar: ava && trocasFeitas(f) < TROCAS_DE_AVA,
        hakiPrincipal: novo === 8 && !f.haki?.principal,
        maestria: !!estilo && NIVEIS_DE_MAESTRIA.includes(novo) && (f.tracosDeMaestria ?? []).length < 3,
        escolhaDeTraco: !!estilo?.escolhaDeTracos?.niveis.includes(novo),
    };
}

/** Validação das escolhas; lista vazia = pode subir. */
export function problemasDoNivel(f: FichaOnePiece, esc: EscolhasDoNivel): string[] {
    const p: string[] = [];
    const novo = f.nivel + 1;
    if (!estiloPorId(f.estiloId)) return ['Esta ficha não foi feita com um estilo do catálogo: suba o nível à mão.'];
    if (novo > NIVEL_MAXIMO) return ['O nível máximo é o 20º.'];
    const pend = pendenciasDoNivel(f, novo);

    if (pend.hbObrigatoria && !esc.hb) p.push('Escolha a Habilidade Básica deste nível.');
    if (pend.quebrador && !esc.hb) p.push('Quebrador de Regras: escolha a segunda característica.');
    if (esc.trocarAva && !pend.podeTrocar) p.push('Não dá para trocar o AVA por uma Habilidade Básica agora.');
    if (pend.ava && esc.trocarAva && !esc.hb) p.push('Escolha a Habilidade Básica que entra no lugar do AVA.');
    if (!pend.hbObrigatoria && !pend.quebrador && !(pend.ava && esc.trocarAva) && esc.hb) p.push('Este nível não dá Habilidade Básica.');

    if (esc.hb) {
        const hb = hbPorId(esc.hb.id);
        if (!hb) p.push('Habilidade Básica desconhecida.');
        else if (pend.quebrador) {
            if (esc.hb.id !== 'quebrador-de-regras') p.push('No 6º nível o Quebrador de Regras escolhe outra característica dele.');
            const tidas = hbsDe(f)
                .filter((h) => h.id === 'quebrador-de-regras')
                .map((h) => h.opcao);
            if (!OPCOES_QUEBRADOR.some((o) => o.id === esc.hb!.opcao) || tidas.includes(esc.hb.opcao))
                p.push('Escolha uma característica do Quebrador de Regras diferente da primeira.');
        } else {
            if (hbsTidas(f).has(hb.id)) p.push(`${hb.nome} já foi escolhida: Habilidade Básica não se repete.`);
            if (hb.escolha === 'prodigio' && !['corpo', 'distancia'].includes(esc.hb.opcao ?? ''))
                p.push('Prodígio do Combate: escolha corpo a corpo ou à distância.');
            if (hb.escolha === 'quebrador' && !OPCOES_QUEBRADOR.some((o) => o.id === esc.hb!.opcao))
                p.push('Quebrador de Regras: escolha uma característica.');
            if (hb.escolha === 'aprimoramento' && !aumentosDoAprimoramento(esc.hb.opcao))
                p.push('Aprimoramento de Atributo: escolha +2 em um atributo ou +1 em dois.');
        }
    }

    if (pend.ava && !esc.trocarAva) {
        const a = esc.ava;
        const n = a?.tipo === 'dois' ? 1 : 2;
        if (!a || a.atributos.length !== n || new Set(a.atributos).size !== n)
            p.push(n === 1 ? 'AVA: escolha o atributo do +2.' : 'AVA: escolha dois atributos diferentes para o +1.');
        else
            for (const id of a.atributos)
                if ((f.atributos[id] ?? 10) + (a.tipo === 'dois' ? 2 : 1) > limiteDeAtributo(novo))
                    p.push(`${id.toUpperCase()} não pode passar de ${limiteDeAtributo(novo)} nesta etapa.`);
    }
    if (pend.maestria) {
        const m = maestriaPorId(esc.maestria?.id);
        const tidos = (f.tracosDeMaestria ?? []).map((x) => x.id);
        if (!esc.maestria || !m) p.push('Escolha a Maestria e o Traço de Maestria deste nível.');
        else {
            if (f.maestria && f.maestria !== m.id) p.push('Você só pode aprender uma Maestria.');
            if (!f.maestria) p.push(...problemasDaMaestria(m, f.atributos, !!esc.maestria.confirmou));
            if (!m.tracos.some((x) => x.id === esc.maestria!.traco)) p.push('Escolha um traço da Maestria.');
            else if (tidos.includes(esc.maestria.traco)) p.push('Esse Traço de Maestria já foi escolhido.');
        }
    } else if (esc.maestria) p.push('Este nível não dá Traço de Maestria.');
    if (pend.hakiPrincipal && !['armamento', 'observacao'].includes(esc.hakiPrincipal ?? ''))
        p.push('O Haki desperta agora: escolha o Haki Principal (Armamento ou Observação).');
    if (pend.escolhaDeTraco) {
        const ja = f.estiloEscolhas ?? [];
        const opcoes = estiloPorId(f.estiloId)?.escolhaDeTracos?.opcoes ?? [];
        if (!esc.tracoEscolhido || !opcoes.some((o) => o.id === esc.tracoEscolhido) || ja.includes(esc.tracoEscolhido))
            p.push(`${estiloPorId(f.estiloId)?.escolhaDeTracos?.nome ?? 'Escolha'}: escolha um traço que você ainda não tem.`);
    } else if (esc.tracoEscolhido) p.push('Este nível não pede escolha de traço do estilo.');
    if (!Number.isInteger(esc.pvGanho) || esc.pvGanho < 1) p.push('Informe os PV ganhos (mínimo 1).');

    return p;
}

/** PV ganhos pela média do dado de vida (arredondada para cima) + mod. de Constituição, no mínimo 1. */
export function pvPelaMedia(dado: DadoDeVida, modCon: number): number {
    return Math.max(1, Math.floor(Number(dado.slice(1)) / 2) + 1 + modCon);
}

/** Os campos da ficha ao subir de nível. Chame só depois de `problemasDoNivel` vazio. */
export function camposDoNivel(f: FichaOnePiece, esc: EscolhasDoNivel): Record<string, unknown> {
    const estilo = estiloPorId(f.estiloId)!;
    const novo = f.nivel + 1;
    const campos: Record<string, unknown> = { nivel: novo };

    // atributos: AVA e, se a HB nova for o Aprimoramento Inato, +1 (nunca acima de 20 por ele)
    const pend = pendenciasDoNivel(f, novo);
    let atrs = { ...f.atributos };
    if (pend.ava && !esc.trocarAva && esc.ava)
        for (const id of esc.ava.atributos) if (ATRIBUTOS.some((a) => a.id === id)) atrs[id] = (atrs[id] ?? 10) + (esc.ava.tipo === 'dois' ? 2 : 1);
    if (esc.hb?.opcao?.startsWith('inato-') || esc.hb?.opcao?.startsWith('ava:'))
        atrs = atributosComAprimoramentoInato(atrs, [{ id: esc.hb.id, nivel: novo, opcao: esc.hb.opcao }]);
    for (const a of ATRIBUTOS) if (atrs[a.id] !== f.atributos[a.id]) campos[`atributos.${a.id}`] = atrs[a.id];

    // Habilidades Básicas
    const hbs: HBDaFicha[] = [...hbsDe(f), ...(esc.hb ? [{ id: esc.hb.id, nivel: novo, ...(esc.hb.opcao ? { opcao: esc.hb.opcao } : {}) }] : [])];
    campos.habilidadesBasicas = hbs;
    const dadoDoCaminho = dadoDoEstilo(estilo, f.estiloCaminho);
    const dado = dadoDeVidaFinal(dadoDoCaminho, hbs, novo);
    campos['dadosVida.tipo'] = dado;
    campos['dadosVida.restantes'] = Math.min(novo, f.dadosVida.restantes + 1);

    // características: as das HB são refeitas; os usos que valem por nível ou por proficiência acompanham
    const profNova = bonusProficiencia({ ...f, nivel: novo });
    const profAntiga = bonusProficiencia(f);
    const feitas = caracteristicasDasHB(hbs, f.atributoPrimario, novo, dadoDoCaminho);
    const velhas = new Map((f.caracteristicas ?? []).filter((c) => c.hb).map((c) => [`${c.hb}|${c.nome}`, c]));
    const novasHB = feitas.map((c) => {
        const antiga = velhas.get(`${c.hb}|${c.nome}`);
        if (antiga?.usos && c.usos) c.usos = { ...c.usos, atual: Math.min(c.usos.max, antiga.usos.atual) };
        if (antiga?.ativa !== undefined && c.tipo === 'ativa') c.ativa = antiga.ativa;

        return c;
    });
    const ajustar = (c: Caracteristica): Caracteristica => {
        if (!c.usos) return c;
        if (c.usos.formula) {
            const max = usosMax(c, profNova, novo);

            return { ...c, usos: { ...c.usos, max, atual: Math.max(0, Math.min(max, c.usos.atual + (max - c.usos.max))) } };
        }
        if (c.usos.porNivel) return { ...c, usos: { ...c.usos, max: novo, atual: Math.min(novo, c.usos.atual + 1) } };
        if (c.usos.porProf && profNova !== profAntiga)
            return { ...c, usos: { ...c.usos, max: profNova, atual: Math.min(profNova, c.usos.atual + (profNova - profAntiga)) } };

        return c;
    };
    // Traço de Maestria
    const tracosM = [...(f.tracosDeMaestria ?? []), ...(pend.maestria && esc.maestria ? [{ id: esc.maestria.traco, nivel: novo }] : [])];
    const maestriaId = f.maestria || esc.maestria?.id || '';
    if (maestriaId) {
        campos.maestria = maestriaId;
        campos.tracosDeMaestria = tracosM;
    }
    // traços do estilo que passam a valer neste nível (os de nível maior não vêm na criação)
    const jaTem = new Set((f.caracteristicas ?? []).filter((c) => c.builder === 'estilo' && !c.hb).map((c) => c.nome));
    const escolhas = pend.escolhaDeTraco && esc.tracoEscolhido ? [...(f.estiloEscolhas ?? []), esc.tracoEscolhido] : (f.estiloEscolhas ?? []);
    if (pend.escolhaDeTraco) campos.estiloEscolhas = escolhas;
    const tracosDoNivel = tracosDoEstiloNoNivel(estilo, f.estiloCaminho, novo, escolhas).filter((t) => !jaTem.has(t.nome));
    const tracosNovos = tracosDoNivel.map((traco) => caracteristicaDe({ traco, origem: estilo.nome, builder: 'estilo' }, novo));
    // resistências que o traço do estilo dá (Invencibilidade) entram na lista da ficha, sem repetir
    const resistenciasNovas = tracosDoNivel.flatMap((t) => t.resistencias ?? []).filter((r) => !(f.resistencias ?? []).includes(r));
    if (resistenciasNovas.length) campos.resistencias = [...(f.resistencias ?? []), ...resistenciasNovas];
    campos.caracteristicas = [
        ...(f.caracteristicas ?? []).filter((c) => !c.hb && c.builder !== 'maestria').map(ajustar),
        ...tracosNovos,
        ...novasHB,
        ...caracteristicasDaMaestria(maestriaId, tracosM, novo),
    ];

    // Akuma no Mi: as características e as técnicas dos Points dependem do nível (Intangibilidade, Points, técnicas por grau)
    if (f.akuma?.tipo) {
        const feita = camposDaAkuma({ ...f, nivel: novo, caracteristicas: campos.caracteristicas as Caracteristica[] });
        campos.caracteristicas = feita.caracteristicas;
        campos['akuma.lista'] = feita['akuma.lista'];
    }

    // técnicas do estilo no novo nível
    const lista = f.tecnicas?.lista ?? [];
    campos['tecnicas.lista'] = [
        ...lista.filter((t) => t.builder !== 'estilo' && t.builder !== 'maestria'),
        ...tecnicasDaMaestria(maestriaId, tracosM),
        ...tecnicasDoEstiloNoNivel(estilo, f.estiloCaminho, novo).map((t) => {
            const antiga = lista.find((x) => x.builder === 'estilo' && x.nome === t.nome);

            const nova = tecnicaDoEstilo(t);

            // a que já existe segue como está (o jogador pode ter editado); o teste (ataque, Salvaguarda, condição) acompanha os dados do livro
            return antiga ? { ...antiga, ...(nova.teste ? { teste: nova.teste } : {}), ...(nova.duracao ? { duracao: nova.duracao } : {}) } : nova;
        }),
    ];

    if (pend.hakiPrincipal && esc.hakiPrincipal) campos['haki.principal'] = esc.hakiPrincipal;

    // PV e PP
    campos['pv.max'] = f.pv.max + esc.pvGanho;
    campos['pv.atual'] = f.pv.atual + esc.pvGanho;
    campos['pp.atual'] = f.pp.atual + (f.pp.porNivel ?? 4);

    return campos;
}

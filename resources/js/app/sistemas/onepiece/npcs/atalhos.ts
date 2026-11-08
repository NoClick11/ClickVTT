import type { Atalho, ContextoDeAtalhos } from '../../../nucleo/sistemas/tipos';
import type { UsoDeTecnica } from '../contexto';
import {
    COM_ACENTO,
    comSinalNpc,
    dadoDeAtaque,
    lerBonus,
    limiteDeUsos,
    margemDeCritico,
    PERICIA_ATRIBUTO,
    usoDaTecnica,
    usosDa,
    type NpcDados,
} from './ficha';
import { ATRIBUTOS_NPC, modificador, ROTULO_ATRIBUTO_NPC } from './tipos';

const modoDe = (e: MouseEvent) => (e.shiftKey ? 'vantagem' : e.ctrlKey || e.altKey ? 'desvantagem' : null);
const NOME_DA_PERICIA: Record<string, string> = {
    prestidigitacao: 'Prestidigitação',
    historia: 'História',
    investigacao: 'Investigação',
    sobrevivencia: 'Sobrevivência',
    atuacao: 'Atuação',
    enganacao: 'Enganação',
    intimidacao: 'Intimidação',
    persuasao: 'Persuasão',
    provocacao: 'Provocação',
    intuicao: 'Intuição',
    percepcao: 'Percepção',
    oficio: 'Ofício',
};
const nomeDaPericia = (id: string) => NOME_DA_PERICIA[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

/**
 * Os atalhos de um NPC (a barra de baixo, como as macros do Foundry): ataques, técnicas, salvaguardas, perícias e testes de atributo,
 * todos tirados da ficha de uma tela. Rodam pelo mesmo fluxo da ficha (alvo mirado, reação, dano, PP e usos por dia).
 */
export function atalhosDoNpc(ctx: ContextoDeAtalhos, npc: NpcDados): Atalho[] {
    const pp = Number((ctx.ficha.pp as { atual?: number } | undefined)?.atual ?? 0);
    const teste = (rotulo: string, bonus: number) => (e: MouseEvent) => {
        const m = modoDe(e);
        ctx.rolar(dadoDeAtaque(bonus, m), m ? `${rotulo} (${m})` : rotulo);
    };
    const atalhos: Atalho[] = [];

    for (const a of npc.ataques) {
        atalhos.push({
            id: `ataque:${a.nome}`,
            grupo: 'Ataques',
            rotulo: a.nome,
            detalhe: comSinalNpc(a.bonus),
            icone: a.tipo === 'distancia' ? 'arco' : 'espada',
            executar: (e) => {
                const m = modoDe(e);
                ctx.rolar(dadoDeAtaque(a.bonus, m), m ? `${a.nome} (${m})` : a.nome, undefined, undefined, { categoria: 'padrao' }, ctx.alvo, {
                    nome: a.nome,
                    dano: { expressao: a.dano, tipo: a.tipoDano },
                    semTecnica: true,
                    ataque: true,
                    margem: margemDeCritico(npc, a),
                });
            },
        });
    }

    for (const t of npc.tecnicas) {
        const limite = limiteDeUsos(t.usos);
        const esgotada = limite !== null && usosDa(npc, t.nome) >= limite;
        atalhos.push({
            id: `tecnica:${t.nome}`,
            grupo: 'Técnicas',
            rotulo: t.nome,
            icone: 'tecnica',
            bloqueio: pp < t.pp ? 'PP insuficientes' : esgotada ? 'Sem usos restantes' : null,
            executar: () => {
                // o uso (N/dia) é gravado junto com os PP gastos, no mesmo lote
                const extras = limite !== null ? { npc: { ...npc, usos: { ...(npc.usos ?? {}), [t.nome]: usosDa(npc, t.nome) + 1 } } } : {};
                ctx.usarTecnica(usoDaTecnica(npc, t, pp, t.tipoDano[0] ?? '', extras) satisfies UsoDeTecnica as never);
            },
        });
    }

    const salvas = lerBonus(npc.salvaguardas, (id) => id in COM_ACENTO);
    const porSigla = Object.fromEntries(Object.entries(COM_ACENTO).map(([nome, a]) => [a, nome]));
    for (const a of ATRIBUTOS_NPC) {
        const bonus = salvas[porSigla[a]] ?? modificador(npc.atributos[a]);
        atalhos.push({
            id: `salvaguarda:${a}`,
            grupo: 'Salvaguardas',
            rotulo: ROTULO_ATRIBUTO_NPC[a],
            detalhe: comSinalNpc(bonus),
            icone: 'salvaguarda',
            executar: teste(`Salvaguarda de ${ROTULO_ATRIBUTO_NPC[a]}`, bonus),
        });
    }

    for (const [id, bonus] of Object.entries(lerBonus(npc.pericias, (id) => id in PERICIA_ATRIBUTO))) {
        atalhos.push({
            id: `pericia:${id}`,
            grupo: 'Perícias',
            rotulo: nomeDaPericia(id),
            detalhe: comSinalNpc(bonus),
            icone: 'pericia',
            executar: teste(nomeDaPericia(id), bonus),
        });
    }

    for (const a of ATRIBUTOS_NPC) {
        const bonus = modificador(npc.atributos[a]);
        atalhos.push({
            id: `teste:${a}`,
            grupo: 'Testes',
            rotulo: ROTULO_ATRIBUTO_NPC[a],
            detalhe: comSinalNpc(bonus),
            icone: 'teste',
            executar: teste(`Teste de ${ROTULO_ATRIBUTO_NPC[a]}`, bonus),
        });
    }

    return atalhos;
}

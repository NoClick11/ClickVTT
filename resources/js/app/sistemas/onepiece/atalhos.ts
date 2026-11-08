import type { Atalho, ContextoDeAtalhos } from '../../nucleo/sistemas/tipos';
import { pilhasDeMunicao } from './itens/pilhas';
import { atalhosDoNpc } from './npcs/atalhos';
import { lerNpc } from './npcs/ficha';
import { analisar, armasAtivas, ATRIBUTOS, comSinal, modoDaRolagem, PERICIAS, type FichaOnePiece, type ItensPorId } from './regras';

/**
 * Os atalhos da barra de baixo. NPC: tudo da ficha de uma tela. Jogador: os ataques com arma (os mesmos da barra lateral da ficha), as
 * técnicas que ele fixou (o pino ao lado do "Usar") e as salvaguardas, perícias e testes.
 */
export function atalhos(ctx: ContextoDeAtalhos): Atalho[] {
    const npc = lerNpc(ctx.ficha);
    if (npc) return atalhosDoNpc(ctx, npc);

    const f = ctx.ficha as unknown as FichaOnePiece;
    const analise = analisar(f, ctx.itens as unknown as ItensPorId);
    const itens = ctx.itens as unknown as ItensPorId;
    const armas = armasAtivas(f, itens, analise.valores);
    const rolarArma = (e: MouseEvent, a: (typeof armas)[number], rotulo: string, municaoItemId?: number) => {
        const variavel = `arma.${a.itemId}.ataque`;
        const modo = e.shiftKey ? 'vantagem' : e.ctrlKey || e.altKey ? 'desvantagem' : modoDaRolagem(analise.efeitos, variavel);
        const dados = modo === 'vantagem' ? '2d20kh1' : modo === 'desvantagem' ? '2d20kl1' : '1d20';
        ctx.rolar(
            `${dados}+@${variavel}`,
            modo ? `${rotulo} (${modo})` : rotulo,
            undefined,
            undefined,
            { categoria: 'padrao' },
            ctx.alvo,
            undefined,
            municaoItemId,
        );
    };
    const saida: Atalho[] = armas.map((a) => ({
        id: `arma:${a.itemId}`,
        grupo: 'Ataques',
        rotulo: a.nome,
        detalhe: a.municao ? undefined : comSinal(a.ataque ?? 0),
        icone: a.municao ? 'arma-de-fogo' : a.distancia ? 'arco' : 'espada',
        executar: (e) => rolarArma(e, a, a.nome),
        // arma por munição: a janelinha lista as munições do inventário que servem a ela
        ...(a.municao
            ? {
                  opcoes: {
                      titulo: `Munição para ${a.nome}`,
                      vazio: 'Nenhuma munição no inventário serve a esta arma.',
                      lista: pilhasDeMunicao(f.inventario, itens, a.catalogoId).map((p) => ({
                          id: String(p.itemId),
                          rotulo: p.nome,
                          detalhe: `${p.qtd} un.${p.dano ? ' · ' + p.dano : ''}`,
                          executar: (e: MouseEvent) => rolarArma(e, a, `${a.nome} (${p.nome})`, p.itemId),
                      })),
                  },
              }
            : {}),
    }));

    // Ataque Desarmado: sempre presente para jogadores nos atalhos diretos
    saida.unshift({
        id: 'arma:desarmado',
        grupo: 'Ataques',
        rotulo: 'Desarmado',
        detalhe: comSinal(analise.valores['ataque.desarmado'] ?? 0),
        icone: 'espada',
        executar: (e) => {
            const variavel = 'ataque.desarmado';
            const modo = e.shiftKey ? 'vantagem' : e.ctrlKey || e.altKey ? 'desvantagem' : modoDaRolagem(analise.efeitos, variavel);
            const dados = modo === 'vantagem' ? '2d20kh1' : modo === 'desvantagem' ? '2d20kl1' : '1d20';
            ctx.rolar(
                `${dados}+@${variavel}`,
                modo ? `Ataque Desarmado (${modo})` : 'Ataque Desarmado',
                undefined,
                undefined,
                { categoria: 'padrao' },
                ctx.alvo,
            );
        },
    });

    const tecnicas = [...(f.tecnicas?.lista ?? []), ...(f.akuma?.lista ?? [])];
    for (const nome of ctx.fixados) {
        const t = tecnicas.find((x) => x.nome === nome);
        if (!t) continue;
        saida.push({
            id: `tecnica:${nome}`,
            grupo: 'Técnicas',
            rotulo: nome,
            icone: 'tecnica',
            bloqueio: (f.pp?.atual ?? 0) < t.custo ? 'PP insuficientes' : null,
            executar: () => {
                const motivo = ctx.usarTecnicaPorNome(nome);
                if (motivo) ctx.avisar(motivo);
            },
        });
    }

    // Salvaguardas, perícias e testes de atributo: as mesmas variáveis de rolagem da ficha (`@salv.for`, `@pericia.percepcao`, `@teste.for`)
    const teste = (grupo: string, icone: Atalho['icone'], variavel: string, rotulo: string, nomeDoAtalho = rotulo): Atalho => ({
        id: `${grupo}:${variavel}`,
        grupo,
        rotulo: nomeDoAtalho,
        detalhe: comSinal(analise.valores[variavel] ?? 0),
        icone,
        executar: (e) => {
            const modo = e.shiftKey ? 'vantagem' : e.ctrlKey || e.altKey ? 'desvantagem' : modoDaRolagem(analise.efeitos, variavel);
            const dados = modo === 'vantagem' ? '2d20kh1' : modo === 'desvantagem' ? '2d20kl1' : '1d20';
            ctx.rolar(`${dados}+@${variavel}`, modo ? `${rotulo} (${modo})` : rotulo);
        },
    });
    for (const a of ATRIBUTOS) saida.push(teste('Salvaguardas', 'salvaguarda', `salv.${a.id}`, `Resistência de ${a.nome}`, a.sigla));
    // o Ofício só vale com uma Profissão (a ficha dá o nome a ele); as demais perícias estão sempre à mão
    for (const p of PERICIAS.filter((x) => x.id !== 'oficio')) saida.push(teste('Perícias', 'pericia', `pericia.${p.id}`, p.nome));
    saida.push(teste('Testes', 'teste', 'iniciativa', 'Iniciativa'));
    for (const a of ATRIBUTOS) saida.push(teste('Testes', 'teste', `teste.${a.id}`, `Teste de ${a.nome}`, a.sigla));

    return saida;
}

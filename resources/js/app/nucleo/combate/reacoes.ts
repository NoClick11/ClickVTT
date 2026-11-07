/**
 * Janela de reação de um ataque (tipos e regras puras que a tela usa; quem decide é o servidor, `Pipeline`). Arquivo PURO.
 */

/** Uma reação que o personagem pode usar agora (já sem as que ele não pode pagar). */
export interface OpcaoDeReacao {
    id: string;
    rotulo: string;
    descricao: string;
    /** Custo em PP ou usos (o sistema define). */
    custo: { pp?: number; uso?: number };
    /** Cura (valor ou dados) aplicada a quem foi atacado. */
    cura: string | null;
    /** Bônus na defesa de quem foi atacado (pode ser de outro jogador: o efeito é redirecionado). */
    defesa: number;
}

/** O que o modal de reação mostra: o ataque (quem, contra quem, os números) e as opções do personagem. */
export interface OfertaDeReacao {
    evento_id: number;
    personagem_id: number;
    personagem: string;
    titulo: string;
    contexto: { atacante: string; alvo: string; alvo_id: number; rotulo: string; total: number; defesa: number };
    opcoes: OpcaoDeReacao[];
}

/** Resumo público da janela: quem ataca, quem é o alvo, quem ainda não respondeu e o resultado. */
export interface ResumoEvento {
    id: number;
    estado: 'aguardando' | 'resolvido';
    atacante: string;
    alvo: string;
    aguardando: string[];
    resultado: { acerto: boolean; critico: boolean; falha: boolean; defesa: number; base: number; mods: { fonte: string; valor: number }[] } | null;
}

/** Texto curto do custo de uma opção (`2 PP`, `1 uso`, ou vazio). */
export function textoDoCusto(c: OpcaoDeReacao['custo']): string {
    return [c.pp ? `${c.pp} PP` : '', c.uso ? `${c.uso} uso` : ''].filter(Boolean).join(' · ');
}

/** O efeito da opção em palavras (`+3 na defesa`, `cura 1d8`), para o jogador escolher sabendo o que acontece. */
export function textoDoEfeito(o: OpcaoDeReacao): string {
    return [o.defesa ? `${o.defesa > 0 ? '+' : ''}${o.defesa} na defesa` : '', o.cura ? `cura ${o.cura}` : ''].filter(Boolean).join(' · ');
}

/** Com a defesa de partida e o ataque, a opção muda o resultado? (+defesa que faz o ataque errar) — dica de qual escolher. */
export function viraOErro(o: OpcaoDeReacao, total: number, defesa: number): boolean {
    return total >= defesa && total < defesa + o.defesa;
}

/** Atualiza (ou insere) o resumo de uma janela na lista; janela resolvida sai da lista de abertas. */
export function comResumo(lista: ResumoEvento[], r: ResumoEvento): ResumoEvento[] {
    const resto = lista.filter((x) => x.id !== r.id);

    return r.estado === 'aguardando' ? [...resto, r] : resto;
}

/** Tira as ofertas de uma janela (ela fechou ou o personagem já respondeu). */
export const semOfertasDe = (lista: OfertaDeReacao[], eventoId: number, personagemId?: number): OfertaDeReacao[] =>
    lista.filter((o) => !(o.evento_id === eventoId && (personagemId === undefined || o.personagem_id === personagemId)));

import type { Component } from 'vue';
import type { ItemDto } from '../../tipos-mesa';
import type { ModoEfeito } from '../efeitos/efeitos';
import type { FormatoResumo } from '../efeitos/resumo';

/** Dados mínimos do personagem que toda ficha recebe; o resto vem do módulo do sistema. */
export interface PersonagemFicha {
    id: number;
    nome: string;
    cor: string;
    /** Quem joga com ele (vazio = NPC). */
    jogadores?: unknown[];
    /** NPC aliado dos jogadores (público). */
    aliado?: boolean;
}

/** Valores da ficha: o formato é definido (e validado) pelo módulo do sistema. */
export type DadosFicha = Record<string, unknown>;

/**
 * Contrato de um módulo de sistema no front. Cada sistema é uma pasta em `app/sistemas/<nome>` cujo
 * `index.ts` exporta um `modulo`; o núcleo nunca importa um sistema diretamente, só o registro.
 *
 * `Ficha` (layout definido pelo sistema) recebe as props `{ personagem, ficha, itens, mestre }` (`itens` = itens da
 * mesa que o jogador pode ver; `mestre` = quem vê os controles de criar/entregar itens) e se comunica só por eventos:
 *  - `salvar(campos)`: edição campo a campo, `{ 'pv.atual': 30 }`; vários campos = um lote atômico;
 *  - `rolar(expressao, rotulo, aoRolar?)`: expressão de rolagem (pode usar `@variaveis` do sistema) e o nome da rolagem;
 *    `aoRolar(total)` (opcional) recebe o total sorteado pelo servidor, para a ficha aplicar o efeito (ex.: curar);
 *  - `editorItem(itemId, aoSalvar?)`: o mestre abre o editor de itens (`null` = novo item); `aoSalvar` recebe o item
 *    salvo (ex.: para já entregá-lo ao personagem).
 * A ficha NUNCA fala com a API: quem salva, rola, edita itens e sincroniza é a mesa.
 */
/** Abre o editor de itens do mestre (`null` = novo item); `aoSalvar` recebe o item salvo. */
export type AbrirEditorItem = (itemId: number | null, aoSalvar?: (item: ItemDto) => void) => void;

/** Alvo que um efeito pode ter neste sistema, com os modos que fazem sentido nele (numéricos e/ou de rolagem). */
export interface AlvoEfeito {
    /** Chave do valor calculado (`ca`, `pericia.*`...): a mesma que o servidor aceita em `alvosDeEfeito()`. */
    id: string;
    rotulo: string;
    modos: ModoEfeito[];
}

/** Valor da ficha que uma fórmula de efeito pode usar (`@mod.sab`), com o nome que o mestre vê no seletor. */
export interface VariavelEfeito {
    id: string;
    rotulo: string;
    /** Agrupa as opções no seletor (ex.: "Modificador de atributo"). */
    grupo?: string;
}

/**
 * Uma informação que o token mostra sobre o personagem (como no Foundry e no Roll20): `pv` e `pp` são barras (atual/max), `ca` é um valor.
 * O mapa só desenha; quem decide o que existe é o módulo do sistema (`resumoDoToken`).
 */
export interface BarraDoToken {
    id: 'pv' | 'pp' | 'ca';
    rotulo: string;
    /** Barras: o valor atual e o máximo. */
    atual?: number;
    max?: number;
    /** Valores soltos (CA). */
    valor?: number;
}

export interface ModuloSistema {
    /** Igual ao `slug` do sistema no servidor (ex.: `dnd-5e`). */
    slug: string;
    Ficha: Component;
    /** Alvos de efeito do sistema (formulário do mestre); devem ser os mesmos de `alvosDeEfeito()` no servidor. */
    alvosDeEfeito: AlvoEfeito[];
    /** Como o sistema escreve os efeitos nas etiquetas (alvos pelo nome, variáveis pela sigla); sem isso aparecem os ids. */
    formatoDeResumo?: FormatoResumo;
    /**
     * Quando o mestre arrasta um item para a janela da ficha: os campos a salvar para a ficha receber o item (o formato
     * do inventário é do sistema), ou `null` se não dá. Função pura sobre a ficha atual.
     */
    entregarItem?: (ficha: Record<string, unknown>, itemId: number) => Record<string, unknown> | null;
    /**
     * Variáveis que uma fórmula pode usar num efeito deste `alvo`. Depende do alvo porque nem todo valor existe
     * quando o efeito é calculado (ex.: os efeitos sobre atributos rodam antes de haver modificadores).
     */
    variaveisDeEfeito: (alvo: string) => VariavelEfeito[];
    /**
     * Editor dos `dados` do item que só o sistema entende (armadura, arma...). Recebe `modelValue` (os dados atuais
     * ou `null`) e emite `update:modelValue` com os novos dados (`null` = item comum).
     */
    EditorDadosItem?: Component;
    /**
     * Assistente de criação do personagem (opcional). Recebe `open`, `personagem`, `ficha`, `criacao`, e as funções
     * `salvar(campos, criacao)` e `rolarAtributos()`; emite `update:open` e `concluido`. A ficha avisa que o jogador quer
     * abrir o assistente emitindo `construtor`.
     */
    Construtor?: Component;
    /**
     * Catálogo de itens do sistema (opcional, só o mestre): recebe `open`, `itens` (os da mesa) e `adicionar(item)`, que cria o item
     * na mesa; emite `update:open`. A loja usará o mesmo catálogo.
     */
    CatalogoDeItens?: Component;
    /** Loja do jogador (painel flutuante, opcional): catálogo do sistema para comprar e arrastar para a ficha. */
    Loja?: Component;
    /** Categorias, raridades e moeda da loja do sistema (alimenta o editor de itens do catálogo). */
    dadosDaLoja?: { categorias: { id: string; nome: string; grupo: string }[]; raridades: { id: string; nome: string }[]; moeda: string };
    /**
     * As informações que aparecem sobre o token do personagem (vida, CA, PP...), calculadas da ficha. A mesa só chama isto para as fichas que
     * este jogador pode ver (as dele; o mestre vê todas), então um jogador nunca vê a vida de outro.
     */
    resumoDoToken?: (ficha: Record<string, unknown>, itens: Record<number, ItemDto>) => BarraDoToken[];
    /** Condições do sistema (id, nome, descrição), oferecidas no painel do alvo mirado. */
    condicoes?: { id: string; nome: string; descricao: string }[];
    /** Atributos do sistema (id e sigla), para a salvaguarda do alvo ao aplicar condições. */
    atributos?: { id: string; sigla: string }[];
}

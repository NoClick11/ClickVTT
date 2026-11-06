import type { Component } from 'vue';
import type { ItemDto } from '../../tipos-mesa';
import type { ModoEfeito } from '../efeitos/efeitos';

/** Dados mínimos do personagem que toda ficha recebe; o resto vem do módulo do sistema. */
export interface PersonagemFicha {
    id: number;
    nome: string;
    cor: string;
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
 *  - `rolar(expressao, rotulo)`: expressão de rolagem (pode usar `@variaveis` do sistema) e o nome da rolagem;
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

export interface ModuloSistema {
    /** Igual ao `slug` do sistema no servidor (ex.: `dnd-5e`). */
    slug: string;
    Ficha: Component;
    /** Alvos de efeito do sistema (formulário do mestre); devem ser os mesmos de `alvosDeEfeito()` no servidor. */
    alvosDeEfeito: AlvoEfeito[];
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
}

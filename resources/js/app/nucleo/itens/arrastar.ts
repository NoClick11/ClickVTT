/** Arrastar um item do catálogo (aba Itens) para a janela de uma ficha: o tipo de dado que viaja no arrastar. */
export const MIME_ITEM = 'application/x-clickvtt-item';

/** Há um item sendo arrastado? (`dragover` não deixa ler o conteúdo, só os tipos.) */
export const arrastandoItem = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes(MIME_ITEM);

/** O item que foi solto (só vale no `drop`). */
export const itemSolto = (e: DragEvent): number | null => {
    const id = Number(e.dataTransfer?.getData(MIME_ITEM));

    return Number.isInteger(id) && id > 0 ? id : null;
};

/** Arrastar um personagem do painel Personagens para o mapa (cria o token dele onde soltar). */
export const MIME_PERSONAGEM = 'application/x-clickvtt-personagem';
export const arrastandoPersonagem = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes(MIME_PERSONAGEM);
export const personagemSolto = (e: DragEvent): number | null => {
    const id = Number(e.dataTransfer?.getData(MIME_PERSONAGEM));

    return Number.isInteger(id) && id > 0 ? id : null;
};

/** Arrastar um item da loja (id do catálogo) para a janela da ficha de um personagem: compra e entrega. */
export const MIME_LOJA = 'application/x-clickvtt-loja';
export const arrastandoDaLoja = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes(MIME_LOJA);
export const itemDaLojaSolto = (e: DragEvent): string | null => e.dataTransfer?.getData(MIME_LOJA) || null;

/** Arrastar um item do catálogo (aba Itens) para a janela de uma ficha: o tipo de dado que viaja no arrastar. */
export const MIME_ITEM = 'application/x-clickvtt-item';

/** Há um item sendo arrastado? (`dragover` não deixa ler o conteúdo, só os tipos.) */
export const arrastandoItem = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes(MIME_ITEM);

/** O item que foi solto (só vale no `drop`). */
export const itemSolto = (e: DragEvent): number | null => {
    const id = Number(e.dataTransfer?.getData(MIME_ITEM));

    return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * Qual munição serve a cada arma por munição (pelo nome e pela descrição do Cap. 8): a pistola e o mosquete usam munição esférica, perfurante
 * e de kairoseki ("para armas de disparo, como pistolas e mosquetes"); o canhão, bola de chumbo e bola explosiva ("canhões ou bazucas");
 * o arco, flecha; a zarabatana, dardo. A Escopeta e a Metralhadora gastam 10 esféricas e 20 perfurantes por disparo e causam dano em área com
 * Salvaguarda (outra mecânica): não entram aqui. Arma por munição sem item do catálogo (criada à mão) aceita qualquer munição do catálogo.
 * Espelha `app/Sistemas/OnePiece/Municoes.php` (conferido contra `dados/municoes.json` por teste). Arquivo PURO.
 */
export const MUNICOES_DA_ARMA: Record<string, string[]> = {
    pistola: ['municao-esferica', 'municao-perfurante', 'municao-de-kairoseki'],
    mosquete: ['municao-esferica', 'municao-perfurante', 'municao-de-kairoseki'],
    canhao: ['bola-de-chumbo', 'bola-explosiva'],
    arco: ['flecha'],
    zarabatana: ['dardo'],
};

/** Todas as munições que alguma arma aceita (para a arma sem item do catálogo). */
export const TODAS_AS_MUNICOES: string[] = [...new Set(Object.values(MUNICOES_DA_ARMA).flat())];

/** As munições (ids do catálogo) que a arma aceita; `armaCatalogoId` vazio = arma criada à mão, que aceita qualquer munição do catálogo. */
export const municoesDaArma = (armaCatalogoId: string | null | undefined): string[] =>
    armaCatalogoId && armaCatalogoId in MUNICOES_DA_ARMA ? MUNICOES_DA_ARMA[armaCatalogoId] : armaCatalogoId ? [] : TODAS_AS_MUNICOES;

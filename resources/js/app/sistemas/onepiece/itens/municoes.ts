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

// --- munição que uma Técnica gasta ----------------------------------------------------------------------------------------------
// As Técnicas de arma de fogo trazem no Requisito "N munições (tipo)": usar a Técnica gasta N unidades desse tipo do inventário.
export type TipoDeMunicaoDaTecnica = 'qualquer' | 'esferica' | 'perfurante';
export interface CustoDeMunicao {
    quantidade: number;
    tipo: TipoDeMunicaoDaTecnica;
}

/** Lê "Requisito: arma favorita, 8 munições (qualquer)" da descrição da Técnica; null = não gasta munição. Espelha `Municoes::custoDaTecnica`. */
export function custoDeMunicaoDaTecnica(descricao: string): CustoDeMunicao | null {
    const m = /Requisito:[^.]*?(\d+)\s+muni[çc](?:ão|ões)\s*\((qualquer|esférica|perfurante)\)/i.exec(descricao);
    if (!m) return null;
    const tipo = m[2].toLowerCase();

    return { quantidade: Number(m[1]), tipo: tipo === 'esférica' ? 'esferica' : (tipo as TipoDeMunicaoDaTecnica) };
}

/**
 * Os ids de munição que servem a um tipo, na ordem em que são gastas: o tipo pedido; "qualquer" gasta esférica, perfurante e depois as outras
 * (a de Kairoseki nunca é gasta sem o jogador escolher, ela é cara e tem efeito). `aceitas` = o que a arma equipada aceita.
 */
export function municoesParaGastar(tipo: TipoDeMunicaoDaTecnica, aceitas: string[]): string[] {
    const ordem = ['municao-esferica', 'municao-perfurante'];
    if (tipo === 'esferica') return aceitas.filter((id) => id === 'municao-esferica');
    if (tipo === 'perfurante') return aceitas.filter((id) => id === 'municao-perfurante');

    return [...ordem.filter((id) => aceitas.includes(id)), ...aceitas.filter((id) => !ordem.includes(id) && id !== 'municao-de-kairoseki')];
}

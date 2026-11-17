/**
 * Tipos de dano oferecidos nos seletores. O servidor compara o tipo do dano com `resistencias`, `imunidades` e `vulnerabilidades`
 * (sem maiúsculas e acentos, `Dano::contem`), então escolher da lista evita erro de digitação que anularia a defesa.
 */
const TIPOS_DE_DANO_FISICO = ['contundente', 'cortante', 'perfurante'] as const;

export const TIPOS_DE_DANO_ONE_PIECE = [...TIPOS_DE_DANO_FISICO, 'fogo', 'elétrico', 'gelo', 'veneno', 'ácido', 'psíquico', 'energia'] as const;

export const TIPOS_DE_DANO_DND = [
    ...TIPOS_DE_DANO_FISICO,
    'ácido',
    'elétrico',
    'energia',
    'fogo',
    'frio',
    'necrótico',
    'psíquico',
    'radiante',
    'trovejante',
    'veneno',
] as const;

/** Opções do seletor: a lista do sistema mais o valor atual, se vier de um dado antigo escrito à mão (para não sumir nem ser apagado). */
export function opcoesDeTipos(base: readonly string[], atuais: readonly string[]): string[] {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const extras = atuais.filter((a) => a.trim() && !base.some((b) => norm(b) === norm(a)));
    return [...base, ...extras];
}

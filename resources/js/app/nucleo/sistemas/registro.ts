import type { ModuloSistema } from './tipos';

/**
 * Descobre os módulos em `app/sistemas/<nome>/index.ts` (cada um exporta `modulo`). Só os `index.ts` — leves — são
 * carregados de imediato; as fichas e demais telas pesadas de cada sistema ficam em `defineAsyncComponent`.
 * Para instalar um sistema novo basta criar a pasta: este arquivo não muda.
 */
const encontrados = import.meta.glob<{ modulo: ModuloSistema }>('../../sistemas/*/index.ts', { eager: true });

const modulos = new Map<string, ModuloSistema>();
for (const [caminho, arquivo] of Object.entries(encontrados)) {
    const modulo = arquivo.modulo;
    if (!modulo?.slug) throw new Error(`${caminho} precisa exportar \`modulo\` com um slug.`);
    if (modulos.has(modulo.slug)) throw new Error(`Slug de sistema duplicado: ${modulo.slug}.`);
    modulos.set(modulo.slug, modulo);
}

/** Módulo do sistema pelo slug, ou null quando o sistema ainda não tem módulo (o chamador mostra um fallback). */
export function moduloDoSistema(slug: string | null | undefined): ModuloSistema | null {
    return (slug && modulos.get(slug)) || null;
}

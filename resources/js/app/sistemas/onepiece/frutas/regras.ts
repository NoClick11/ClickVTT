/**
 * Entregar uma fruta pronta a um personagem: o perfil da Akuma (tipo, usuário, propriedades), as Técnicas dela por nível e as características
 * (marcadas `builder: 'fruta'`, que o resto da Akuma não apaga). Ao subir de nível, `camposDaFrutaNoNivel` traz as que ficaram liberadas.
 * Arquivo PURO: o mestre salva os campos pela ficha como qualquer outra mudança.
 */
import { camposDaAkuma, normalizarAkuma } from '../akuma/regras.ts';
import { caracteristicaDe } from '../construtor/regras.ts';
import { ativaNoNivel, type Caracteristica, type FichaOnePiece, type Tecnica } from '../regras.ts';
import { frutaPorId, type FrutaDados } from './dados.ts';

const rotuloDoGrau = (grau?: number) => (grau ? `${grau}º Grau` : 'Auxiliar');

/** As Técnicas da fruta já liberadas neste nível (as de nível maior chegam ao subir). */
export function tecnicasDaFruta(fruta: FrutaDados, nivel: number): Tecnica[] {
    return fruta.tecnicas
        .filter((x) => nivel >= x.nivel)
        .map((x) => ({ ...x.tecnica, origem: `${fruta.nome}: ${rotuloDoGrau(x.grau)}`, builder: 'fruta' as const }));
}

/** As características da fruta que valem neste nível, mantendo os usos gastos e os interruptores das que a ficha já tinha. */
export function caracteristicasDaFruta(fruta: FrutaDados, nivel: number, antigas: Caracteristica[] = []): Caracteristica[] {
    const velhas = new Map(antigas.filter((c) => c.builder === 'fruta').map((c) => [c.nome, c]));

    return fruta.tracos
        .filter((tr) => ativaNoNivel(tr, nivel))
        .map((tr) => {
            const c = caracteristicaDe({ traco: tr, origem: `Akuma no Mi: ${fruta.nome}`, builder: 'fruta' }, nivel);
            const antiga = velhas.get(c.nome);
            if (antiga?.usos && c.usos) c.usos = { ...c.usos, atual: Math.min(c.usos.max, antiga.usos.atual) };
            if (antiga?.ativa !== undefined && c.tipo === 'ativa' && c.ativa !== undefined) c.ativa = antiga.ativa;

            return c;
        });
}

/**
 * Os campos da ficha ao entregar a fruta (`id`) ou tirá-la (`null`). Refaz o perfil da Akuma (tipo, usuário e propriedades da fruta) e troca as
 * Técnicas e características dela pelas deste nível; o resto da ficha fica como está.
 */
export function camposDaFruta(f: FichaOnePiece, id: string | null, nivel = f.nivel): Record<string, unknown> {
    const fruta = frutaPorId(id);
    const campos = fruta
        ? camposDaAkuma(f, { tipo: fruta.tipo, usuario: fruta.usuario, propriedades: fruta.propriedades, fruta: fruta.id })
        : camposDaAkuma(f, { fruta: '' });
    const caracteristicas = ((campos.caracteristicas as Caracteristica[]) ?? f.caracteristicas ?? []).filter((c) => c.builder !== 'fruta');
    const lista = ((campos['akuma.lista'] as Tecnica[]) ?? f.akuma?.lista ?? []).filter((t) => t.builder !== 'fruta');
    campos.caracteristicas = fruta ? [...caracteristicas, ...caracteristicasDaFruta(fruta, nivel, f.caracteristicas)] : caracteristicas;
    campos['akuma.lista'] = fruta ? [...lista, ...tecnicasDaFruta(fruta, nivel)] : lista;
    campos.fruta = fruta ? fruta.nome : '';

    return campos;
}

/** Ao subir de nível: as Técnicas e características da fruta do personagem deste novo nível (vazio se não tem fruta pronta). */
export function camposDaFrutaNoNivel(
    f: FichaOnePiece,
    novoNivel: number,
    base: { caracteristicas?: Caracteristica[]; lista?: Tecnica[] },
): Record<string, unknown> {
    const fruta = frutaPorId(normalizarAkuma(f).fruta);
    if (!fruta) return {};
    const caracteristicas = (base.caracteristicas ?? f.caracteristicas ?? []).filter((c) => c.builder !== 'fruta');
    const lista = (base.lista ?? f.akuma?.lista ?? []).filter((t) => t.builder !== 'fruta');

    return {
        fruta: fruta.nome,
        caracteristicas: [...caracteristicas, ...caracteristicasDaFruta(fruta, novoNivel, f.caracteristicas)],
        'akuma.lista': [...lista, ...tecnicasDaFruta(fruta, novoNivel)],
    };
}

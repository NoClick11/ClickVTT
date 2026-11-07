// Gera tests/e2e/ficha-atirador.json: os campos que o assistente de criação grava para um Atirador Sniper de nível 20 (Quick Draw com duração).
// Rode de novo quando os dados do estilo mudarem: node --experimental-strip-types tests/e2e/gerar-ficha.mjs
import fs from 'node:fs';
import { camposDaCriacao, escolhasIniciais } from '../../resources/js/app/sistemas/onepiece/construtor/regras.ts';

const base = { for: 15, des: 14, con: 13, sab: 12, pre: 10, von: 8 };
const e = {
    ...escolhasIniciais(),
    atributos: { metodo: 'padrao', base },
    ajuste: { tipo: 'dois', atributos: ['for', 'des'] },
    estilo: { id: 'atirador', nome: 'Atirador', dado: 'd8', caminho: 'sniper', armaFavorita: 'Mosquete', hbInata: 'mira-treinada', pericias: ['acrobacia', 'percepcao', 'sorte'] },
    especies: ['humano'],
    variantes: [null],
};
const { campos } = camposDaCriacao(e, { nivel: 20 });
fs.writeFileSync(new URL('./ficha-atirador.json', import.meta.url), JSON.stringify({ nivel: 20, campos }, null, 2) + '\n');
console.log('ficha-atirador.json gerada:', Object.keys(campos).length, 'campos');

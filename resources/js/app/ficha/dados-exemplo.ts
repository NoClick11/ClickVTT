import type { FichaDnd5e } from './dnd5e';

/** Dados de exemplo só para mostrar o layout (ainda não há persistência nem cálculo real). */
export function fichaExemplo(nome: string): FichaDnd5e {
    return {
        nome,
        classe: 'Clérigo',
        subclasse: 'Domínio da Luz',
        nivel: 5,
        especie: 'Humano',
        antecedente: 'Acólito',
        alinhamento: 'Leal e Bom',
        xp: { atual: 6500, proximo: 14000 },
        inspiracao: true,
        atributos: { for: 12, des: 14, con: 15, int: 10, sab: 17, car: 13 },
        salvaguardas: ['sab', 'car'],
        pericias: { intuicao: 1, medicina: 1, percepcao: 1, religiao: 1, persuasao: 0, historia: 0 },
        bonusProficiencia: 3,
        ca: 18,
        iniciativa: 2,
        deslocamento: '9 m',
        pv: { atual: 38, max: 44, temp: 5 },
        dadosVida: { restantes: 4, max: 5, tipo: 'd8' },
        morte: { sucessos: 1, falhas: 0 },
        exaustao: 0,
        sentidos: ['Percepção passiva 16'],
        idiomas: ['Comum', 'Celestial'],
        resistencias: ['Radiante'],
        imunidades: [],
        vulnerabilidades: [],
        proficienciasArmas: ['Armas simples'],
        proficienciasArmaduras: ['Armaduras leves', 'Armaduras médias', 'Escudos'],
        ferramentas: [{ nome: 'Kit de herbalismo', prof: 1, atributo: 'int' }],
        carga: { atual: 36, max: 90 },
        moedas: { pl: 0, po: 125, pe: 0, pp: 14, pc: 32 },
        inventario: [
            {
                secao: 'Armas',
                itens: [
                    { nome: 'Maça', qtd: 1, peso: 2, equipado: true, detalhe: '1d6+1 contundente' },
                    { nome: 'Besta leve', qtd: 1, peso: 2.5, detalhe: '1d8 perfurante · 24/96 m' },
                ],
            },
            {
                secao: 'Equipamento',
                itens: [
                    { nome: 'Cota de malha', qtd: 1, peso: 27, equipado: true, detalhe: 'CA 16' },
                    { nome: 'Escudo', qtd: 1, peso: 3, equipado: true, detalhe: '+2 CA' },
                    { nome: 'Símbolo sagrado', qtd: 1, peso: 0.5, equipado: true },
                ],
            },
            { secao: 'Consumíveis', itens: [{ nome: 'Poção de cura', qtd: 2, peso: 0.25, detalhe: '2d4+2 PV' }, { nome: 'Rações', qtd: 5, peso: 1 }] },
            { secao: 'Itens', itens: [{ nome: 'Mochila', qtd: 1, peso: 2.5 }, { nome: 'Corda de cânhamo (15 m)', qtd: 1, peso: 5 }] },
        ],
        caracteristicas: [
            { nome: 'Canalizar Divindade', origem: 'Clérigo 2', tipo: 'ativa', usos: { atual: 1, max: 2 } },
            { nome: 'Expulsar Mortos-vivos', origem: 'Clérigo 2', tipo: 'ativa' },
            { nome: 'Clarão Protetor', origem: 'Domínio da Luz 1', tipo: 'ativa', usos: { atual: 2, max: 3 } },
            { nome: 'Lançamento de Magias', origem: 'Clérigo 1', tipo: 'passiva' },
            { nome: 'Cantrip Bônus', origem: 'Domínio da Luz 1', tipo: 'passiva' },
            { nome: 'Acólito: Abrigo dos Fiéis', origem: 'Antecedente', tipo: 'passiva' },
        ],
        magias: {
            atributo: 'sab',
            cd: 14,
            ataque: 6,
            preparadas: { atual: 7, max: 8 },
            espacos: [
                { nivel: 1, usados: 2, total: 4 },
                { nivel: 2, usados: 1, total: 3 },
                { nivel: 3, usados: 0, total: 2 },
            ],
            lista: [
                { nivel: 0, magias: [{ nome: 'Luz', escola: 'Evocação', preparada: true }, { nome: 'Chama Sagrada', escola: 'Evocação', preparada: true }, { nome: 'Taumaturgia', escola: 'Transmutação', preparada: true }] },
                { nivel: 1, magias: [{ nome: 'Curar Ferimentos', escola: 'Evocação', preparada: true }, { nome: 'Bênção', escola: 'Encantamento', preparada: true }, { nome: 'Fogo das Fadas', escola: 'Evocação', preparada: false }] },
                { nivel: 2, magias: [{ nome: 'Arma Espiritual', escola: 'Evocação', preparada: true }, { nome: 'Restauração Menor', escola: 'Abjuração', preparada: true }] },
                { nivel: 3, magias: [{ nome: 'Bola de Fogo (Domínio)', escola: 'Evocação', preparada: true }, { nome: 'Dissipar Magia', escola: 'Abjuração', preparada: false }] },
            ],
        },
        biografia: {
            personalidade: 'Falo com calma, mesmo no meio do caos. Sempre ofereço uma prece antes de qualquer batalha.',
            ideais: 'Esperança. A luz sempre encontra um caminho, por menor que seja a fresta.',
            vinculos: 'Devo minha vida ao templo que me acolheu quando criança e voltarei para protegê-lo.',
            defeitos: 'Confio demais em quem diz compartilhar a minha fé.',
            aparencia: 'Cabelos grisalhos presos em trança, cicatriz no queixo, vestes brancas com detalhes dourados.',
            texto: 'Nascida numa vila ribeirinha, cresceu entre as paredes do templo do Sol Nascente. ',
        },
    };
}

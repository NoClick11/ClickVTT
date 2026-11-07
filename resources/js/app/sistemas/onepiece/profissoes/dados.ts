/**
 * Profissões (cap. 4): as 20 ocupações, "Não ter profissão" e as graduações. Arquivo PURO (sem Vue): o Node o executa direto
 * nos testes. O que o PHP precisa (perícias, ferramenta) está espelhado em `app/Sistemas/OnePiece/dados/profissoes.json` e
 * conferido por teste; textos e características ficam só aqui.
 *
 * Os textos aceitam modelos que a graduação resolve ("Aperfeiçoamento Profissional"): `{cd:16}` (CD − 1/2/3),
 * `{bellys:250000}` (desconto de 10/20/50%) e `{dado:6}` (d6 → d8 → d10 → d12).
 */
import type { TracoDados } from '../construtor/dados/tipos.ts';

export interface Graduacao {
    id: 0 | 1 | 2 | 3;
    nome: string;
    /** Desconto em Bellys (%). */
    desconto: number;
    /** Redução na CD. */
    reducaoCd: number;
}

export const GRADUACOES: Graduacao[] = [
    { id: 0, nome: 'Profissional', desconto: 0, reducaoCd: 0 },
    { id: 1, nome: 'Especialista', desconto: 10, reducaoCd: 1 },
    { id: 2, nome: 'Mestre', desconto: 20, reducaoCd: 2 },
    { id: 3, nome: 'Grão-Mestre', desconto: 50, reducaoCd: 3 },
];

export interface Profissao {
    id: string;
    nome: string;
    resumo: string;
    /** Perícias de 1º nível: escolhe 2 destas. */
    pericias: string[];
    /** A ferramenta cuja proficiência a profissão dá. */
    ferramenta: string;
    /** Itens iniciais da profissão do 1º nível (o mestre entrega; o jogador não cria itens). */
    itens: string[];
    /** Exemplos de Testes de Atributo ligados à profissão (4.3). */
    testes: string[];
    tracos: TracoDados[];
}

const t = (id: string, nome: string, descricao: string, extra: Partial<TracoDados> = {}): TracoDados => ({ id, nome, descricao, ...extra });
const longo = (max: number) => ({ max, descanso: 'longo' as const });

export const PROFISSOES: Profissao[] = [
    {
        id: 'adestrador',
        nome: 'Adestrador',
        resumo: 'Lida com todo tipo de criatura e compreende os animais; tem um Animal Vinculado.',
        pericias: ['acrobacia', 'atuacao', 'intuicao', 'percepcao', 'persuasao', 'sobrevivencia'],
        ferramenta: 'Ferramentas de Adestrador',
        itens: [
            '1 mochila pequena',
            '30 rações para animais',
            'livros de veterinária, nutrição animal e treinamento animal',
            'chicote',
            'apito',
            '1 kit médico',
            '3 kits de primeiros socorros',
        ],
        testes: ['Intimidar uma fera', 'Prestar primeiros socorros em um animal', 'Identificar a causa de um comportamento estranho em criaturas'],
        tracos: [
            t(
                'vinculo-animal',
                'Vínculo Animal',
                'Você escolhe um único animal como companheiro, seu "Animal Vinculado" (tabela: Águia/Falcão, Crocodilo/Leão/Lobo/Macaco, Cachorro/Cobra/Gato/Raposa, Cavalo, Coruja/Pombo/Morcego, Gorila/Panda/Touro/Urso; outro animal só com aprovação do Narrador). Você o monta sem penalidades se ele tiver a sua categoria de tamanho ou maior, e faz Salvaguardas de Destreza para se manter montado com vantagem, mesmo sem sela. Se ele morrer, pode ser substituído por um novo da tabela (ou trocado, com aprovação). Enquanto o tiver, seus gastos de alimentação e hospedagem são dobrados. O animal recupera todos os PV em um descanso longo; Salvaguardas e Testes de Sabedoria, Vontade e Presença são os do adestrador; os de Força, Destreza e Constituição vêm da tabela mais o Bônus de Proficiência do adestrador; tem a mesma CR do adestrador e metade do PV máximo (para baixo). Ataques: modificador do atributo primário (à escolha) + proficiência do adestrador; dano base 1d4 + esse modificador (Perfurante, Cortante ou Contundente). Tem a mesma iniciativa, desloca-se no turno do adestrador e age com Atacar (2 ataques), Disparada, Esconder e Procurar; com o adestrador inconsciente, fica de guarda.',
                { etiquetas: ['Animal Vinculado (companheiro)'] },
            ),
            t(
                'treinamento-animal',
                'Treinamento Animal',
                'A cada nível par, escolha duas das opções (repetíveis) para o Animal Vinculado, até 6 treinamentos por animal: Poder Bruto (dano sobe um passo: 1 → 1d4 → 1d6 → 1d8 → 1d10 → 1d12 → 2d6 opcional); Super Nutrição (uma categoria de tamanho acima, até Enorme); Treino de Velocidade (+3 m de deslocamento terrestre e de nado, máx. 18 m; ou +1,5 m de voo, máx. 15 m); Melhorar Potencial (2 Traços Comuns ou 1 Específico das Zoan, sem o requisito de forma, coerentes com o animal e aprovados pelo Narrador). Os treinamentos não passam para um animal novo.',
            ),
            t(
                'adestrar-animais',
                'Adestrar Animais',
                'Ao adestrar um animal selvagem, o Narrador pode pedir um Teste de Sabedoria contra CD 10 + o ND do alvo. O animal fica ao seu lado por 24 horas, podendo ser montado e usando habilidades conforme ordenado; se receber dano, for forçado a se ferir ou a atacar seus companheiros, ele se liberta (pode fugir ou ficar hostil). Só um animal adestrado por vez (o Animal Vinculado não conta). O mesmo teste serve para comunicar, afugentar ou acalmar o animal; um animal acalmado volta a ser hostil se ele ou o grupo forem atacados ou ameaçados.',
            ),
        ],
    },
    {
        id: 'arqueologo',
        nome: 'Arqueólogo',
        resumo: 'Estuda línguas, povos e estruturas antigas; acha tesouros e decifra Poneglyphs.',
        pericias: ['historia', 'intuicao', 'investigacao', 'percepcao', 'persuasao', 'sobrevivencia'],
        ferramenta: 'Ferramentas de Arqueólogo',
        itens: [
            '1 mochila pequena',
            '1 lanterna',
            '1 corda',
            '1 tenda',
            'livros de história, geografia e culturas antigas',
            '1 chicote',
            '1 porta-mapas',
            '1 caderno e caneta',
            '1 kit de escalada',
        ],
        testes: [
            'Decifrar ou transcrever uma língua antiga',
            'Lembrar a cultura ou o local de uma civilização',
            'Identificar ou restaurar artefatos',
        ],
        tracos: [
            t(
                'explorador-atento',
                'Explorador Atento',
                'Guia: em Testes de Atributo ou Salvaguardas ligados à exploração de locais e ruínas você tem vantagem; se passar, todas as criaturas que presenciarem ou que você instruir têm sucesso automático nos mesmos testes feitos depois dos seus. Salvador: quando uma criatura falhar numa Salvaguarda contra perigos do ambiente ou armadilhas, use a reação para reduzir o dano pela metade ou anular os efeitos (o Narrador pode exigir corda ou chicote); volta após um descanso curto ou longo. Solucionador: com suas ferramentas, diante de enigmas, puzzles, fechaduras ou barreiras, use um método infalível para decifrá-los; só de novo depois de resolver 3 outras situações sem ele (se o Narrador der ao menos uma dica generosa, o uso não conta).',
                { usos: { max: 1, descanso: 'curto' } },
            ),
            t(
                'encontrar-tesouro',
                'Encontrar Tesouro',
                'Em calabouços, ruínas ou cidades antigas, no início de uma exploração o Narrador pode pedir um Teste de Sabedoria: no sucesso você acha pistas de um tesouro escondido. Ao achar a câmara, role 1d8 na tabela "Tesouros Perdidos" (1, 3, 5 e 7: Joias e Ouro; 2: Dial; 4: Arma Meito; 6: Equipamento Engenhado; 8: Akuma no Mi) e, para artefatos, 1d10 para a subdivisão (Dials: Axe, Breath, Eisen, Flame, Flash, Frozen, Impact, Jet, Reject, Thunder; Meito: Wazamono, Ryo, Ô, Saijo Ô; Engenhado: Burn Bazooka, Burn Blade, Cool Shooter, Cutter Shell, Eisen Whip, Flash Gun, Heat Javelin, Jet Ski, Jet Gauntlet, Kabuto; Akuma no Mi: Categorias C, B, A e S). Joias e Ouro valem seu nível × ฿ 500.000.000. Dials: role o d10 duas vezes e receba os dois. Testando a Sorte: em tesouros que não sejam Joias e Ouro ou Dial, role a subdivisão duas vezes e escolha. Akuma no Mi: Teste de Sabedoria para identificar o poder (CD 15 frutos historicamente relevantes, 20 obscuros, 25 desconhecidos; sem sucesso automático).',
                {
                    acoes: [
                        { rotulo: 'Tesouro (d8)', tipo: 'rolar', rolagem: '1d8' },
                        { rotulo: 'Subdivisão (d10)', tipo: 'rolar', rolagem: '1d10' },
                    ],
                },
            ),
            t(
                'conhecimento-proibido',
                'Conhecimento Proibido',
                'Você interpreta os Poneglyphs parcialmente e, com dedicação ou mais estudos, os decifra por completo. Decifrar exige Teste de Sabedoria: Históricos CD 20, Instrutivos CD 25, Caminho CD 30 (são 4, levam a Laugh Tale). Ao falhar, após 3 dias de estudo você repete o teste, e a CD cai 5 a cada nova tentativa. Conhecer o Século Vazio é crime: o Narrador pode decidir que você ainda não tem o conhecimento e introduzi-lo depois.',
            ),
        ],
    },
    {
        id: 'botanico',
        nome: 'Botânico',
        resumo: 'Compreende e manipula plantas: Pop Green, Vivre Card, resina, compostos e herbalismo.',
        pericias: ['historia', 'intuicao', 'investigacao', 'natureza', 'percepcao', 'sobrevivencia'],
        ferramenta: 'Ferramentas de Botânico',
        itens: [
            '1 mochila pequena',
            '1 lupa de análise',
            'ferramentas de coleta de plantas',
            'livros de botânica e ecossistemas',
            '5 frascos de armazenamento',
            '1 pequeno estilete de poda',
        ],
        testes: [
            'Identificar espécies raras ou tóxicas',
            'Descobrir propriedades medicinais ou venenosas',
            'Analisar se um ecossistema é seguro ou hostil',
        ],
        tracos: [
            t(
                'manipulacao-de-plantas',
                'Manipulação de Plantas',
                'Cultivar Pop Green: você cultiva e usa sementes Pop Green (Guia do Narrador); a cada 10 sementes novas que produzir, escolhe qual tipo germina no início do próximo dia. Criar Vivre Card: você coleta a semente da Vivre Tree (1 mês para amadurecer até formar uma cavidade onde se põe unha, pele ou cabelo; 1 semana de nutrição para dar o fruto, que traz uma Vivre Card): à prova d\'água e de fogo, mas pode rasgar; cada fragmento aponta para o dono, reflete a força vital (consome-se se debilitado, volta se ele se recupera, desintegra se morrer). Revestir com Resina: com a resina das árvores Yarukiman Mangrove você reveste pessoas, objetos ou navios; navios revestidos navegam submersos (oxigênio para 1 semana, suportam 10.000 m), sem penalidade de velocidade por peso, impulsionados pelas correntes; a bolha tem resistência a Contundente e vulnerabilidade a Cortante e Perfurante; usuários de Akuma no Mi revestidos não ficam "Enfraquecido" submersos; se estourar, 20d10 Contundente a cada 10 m abaixo do nível do mar; só estável a menos de 1 km das raízes ou totalmente submerso; PV da bolha: Grande ou menor 50, Enorme ou maior 100, navios Pequenos a Grandes 150, Enormes e Colossais 300.',
            ),
            t(
                'geomante',
                'Geomante',
                'Após 3 horas reunindo folhas, sementes, musgo e outros materiais, faça um Teste de Sabedoria CD {cd:17} para criar compostos de uso único (o tipo depende do terreno; usar exige ação bônus): Pasta Curativa (Florestas Verdes): recupera 2 × seu nível em PV. Incenso do Predador (Cavernas): afasta animais em 1 km por 10 h. Pedra-Fumaça (Montanhas): nuvem cinzenta que bloqueia a visão por 10 min numa esfera de 6 m. Líquido Aromático (Pântanos): atrai animais por 10 h. Areia Refrescante (Desertos): anula calor do ambiente por 10 h (até 4 criaturas). Essência do Calor (Tundra): anula frio do ambiente por 10 h (até 4 criaturas). Resina Obsidiana (Áreas Vulcânicas): barreira rochosa de até 1,5 m × 3 m por 1 hora.',
                { acoes: [{ rotulo: 'Teste de Sabedoria', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof' }] },
            ),
            t(
                'herbalismo',
                'Herbalismo',
                'Com um Kit de Herbalismo você identifica plantas, coleta com segurança seus componentes úteis e os usa em remédios, poções e antídotos. Proficiência em testes específicos: Investigação (pistas em ambientes naturais: pegadas, plantas alteradas por envenenamento, doenças ou rastros), Medicina (ervas para sangramento, ferimentos, doenças e envenenamentos) e Sobrevivência (plantas comestíveis, curativas ou perigosas; água potável).',
            ),
        ],
    },
    {
        id: 'cacador-de-recompensas',
        nome: 'Caçador de Recompensas',
        resumo: 'Rastreia alvos e negocia com todo tipo de organização.',
        pericias: ['furtividade', 'intimidacao', 'investigacao', 'percepcao', 'persuasao', 'sobrevivencia'],
        ferramenta: 'Ferramentas de Caçador de Recompensas',
        itens: [
            '1 mochila pequena',
            'livros de comportamento e temas diversos',
            '3 kits de primeiros socorros',
            '2 cordas',
            '2 pares de algemas',
            '1 bússola ou log pose à escolha',
        ],
        testes: [
            'Achar pistas ou pegadas numa floresta',
            'Negociar com agentes do governo ou da Marinha',
            'Lembrar informações sobre crimes ou segurança pública',
        ],
        tracos: [
            t(
                'encontrar-um-alvo',
                'Encontrar um Alvo',
                'Faça um Teste de Sabedoria para reunir informações e localizar o alvo; o primeiro teste pode ser feito ao tomar ciência dele (cartaz, missão). Se falhar, novos testes a cada 2 dias ou com informação relevante nova; a CD cai 2 a cada novo teste. CD por tipo de alvo: Pessoa Comum {cd:12}; Figura Pública {cd:14} (informação superficial, distorcida ou falsa); Criminoso Procurado {cd:16}; Identidade Oculta {cd:25}; Entidade {cd:30}. Custo: a cada teste, ฿ 5.000 a ฿ 25.000 (definido pelo Narrador) em subornos e pagamentos.',
                { acoes: [{ rotulo: 'Teste de Sabedoria', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof' }] },
            ),
            t(
                'alvo-marcado',
                'Alvo Marcado',
                'Ao passar no teste de "Encontrar um Alvo" você pode marcar o alvo (até 3 criaturas; se desistir de uma, tem 3 dias para marcá-la de novo sem testes). Marca do Caçador: você sempre sabe onde o alvo está e tem vantagem em Furtividade para se esconder dele. Passos Longos: na perseguição, terreno difícil do solo e da natureza não afeta seu deslocamento. Dificultar Detecção: o alvo tem desvantagem em testes de Sabedoria ou Vontade para localizar você.',
            ),
            t(
                'contratos-clandestinos',
                'Contratos Clandestinos',
                'Com contatos na região (inclusive membros corruptos da Marinha e do Governo Mundial) você negocia recompensas "por debaixo dos panos": 70% a 90% do valor original por criminosos capturados vivos, pagando uma propina. O Narrador pode pedir um Teste de Sabedoria para saber se você conhece alguém ou conquista um novo contato. O Governo Mundial divulga cartazes ("Vivo ou Morto"); entregue morto, o valor pode cair até 40%.',
            ),
        ],
    },
    {
        id: 'carpinteiro',
        nome: 'Carpinteiro',
        resumo: 'Mantém, repara e melhora a embarcação; constrói estruturas com rapidez.',
        pericias: ['acrobacia', 'atletismo', 'historia', 'investigacao', 'persuasao', 'prestidigitacao'],
        ferramenta: 'Ferramentas de Carpinteiro',
        itens: ['1 mochila pequena', 'livros de marcenaria', '10 plantas de construção', '1 serrote', '1 martelo', '1 kit de construção'],
        testes: [
            'Trabalhos de marcenaria para criar ou reforçar objetos',
            'Replicar perfeitamente uma peça de madeira',
            'Compreender mecanismos de engenharia',
        ],
        tracos: [
            t(
                'trabalho-em-madeira',
                'Trabalho em Madeira',
                'Você constrói embarcações de qualquer porte, seus cômodos e componentes (tempo, valores e peças no Cap. 14). Eficiência: reduz em 40% os custos adicionais de construção e reparo de embarcações definidos pelo Narrador (não os de regra). Eficácia: embarcações construídas por você ganham +12 nós (24 km/h) e +3 em CR. Corpo Preparado: trabalhando na construção ou reparo de uma embarcação, seus dias ainda contam para treinamentos.',
            ),
            t(
                'conserto-em-madeira',
                'Conserto em Madeira',
                'Tabela "Navio Danificado": Normal (99% ou menos dos PV): 1d6 dias e ฿ {bellys:15000}; Danificado (80% ou menos): 2d6 dias e ฿ {bellys:100000}; Muito Danificado (50% ou menos): 4d6 dias e ฿ {bellys:300000}; Irreparável (5% ou menos): sem reparo. Custo por PV recuperado conforme a madeira: Cedro ฿ {bellys:40000}, Carvalho ฿ {bellys:100000}, Cerejeira ฿ {bellys:190000}, Adam ฿ {bellys:500000}.',
            ),
            t(
                'confeccao-rapida',
                'Confecção Rápida',
                'Com madeira disponível, uma ação (6 s) constrói 1,5 m² de estrutura (Chão, Escada, Parede, Ponte), com CR 10 e 10 PV por 1,5 m². Paredes dão cobertura (Cap. 12); pontes permitem deslocar-se e disparar sem Salvaguardas para evitar quedas. Custo: ฿ {bellys:22000} em tábuas por 1,5 m² (ou madeira equivalente) e 1d4 kits de construção.',
            ),
            t(
                'reparo-emergencial',
                'Reparo Emergencial / Reforçar Estruturas',
                'Mesmo em batalha, com materiais ao alcance: Teste de Sabedoria CD {cd:15} (falha: tente de novo após 5 minutos). Em 1 minuto o navio recebe uma segunda barra de PV paralelos de 30d10 + 50 que não se recupera de nenhuma forma, é consumida antes dos PV normais e some após 2d6 dias; um novo reparo substitui o anterior. Custo: 1d4 kits de construção.',
                {
                    acoes: [
                        { rotulo: 'Teste de Sabedoria', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof' },
                        { rotulo: 'PV paralelos', tipo: 'rolar', rolagem: '30d10+50' },
                    ],
                },
            ),
        ],
    },
    {
        id: 'cientista',
        nome: 'Cientista',
        resumo: 'Genialidade técnica: Fator Linhagem, ciência avançada e Centelha de Mother Flame.',
        pericias: ['investigacao', 'intuicao', 'medicina', 'percepcao', 'prestidigitacao', 'natureza'],
        ferramenta: 'Ferramentas de Cientista',
        itens: [
            '1 mochila pequena',
            '1 kit médico',
            '1 kit de pesquisa',
            '1 kit de primeiros socorros',
            '1 kit de chaves',
            '1 kit de construção',
            'livros científicos diversos',
            '1 mini computador',
        ],
        testes: [
            'Compreender fenômenos naturais complexos',
            'Analisar substâncias desconhecidas',
            'Deduzir o funcionamento de tecnologias avançadas',
        ],
        tracos: [
            t(
                'fator-linhagem',
                'Fator Linhagem',
                'Requisitos de qualquer criação: cápsula de recriação genética (฿ {bellys:1500000000} em materiais, 1 mês de construção, cubo de 3 m, construída por um engenheiro), laboratório adequado e energia constante (1 bateria grande por dia). Green Blood: Teste de Sabedoria CD {cd:17} para decifrar o Fator Linhagem de um usuário de Akuma no Mi e sintetizar o sangue que dá os mesmos poderes (efeitos no Guia do Narrador); ฿ {bellys:200000000} por frasco, 12 h na cápsula. Akuma no Mi Artificial: recria uma Zoan (sem o despertar), Teste de Sabedoria CD {cd:17}; ฿ {bellys:2500000000} por fruto, 1 mês. Clonagem: Teste de Sabedoria CD {cd:15}; 6 meses + 1 mês por ano de envelhecimento; amostras pequenas ฿ {bellys:1000000000} + ฿ {bellys:100000000} por mês, corpo morto completo metade do custo e do tempo; membros ou órgãos: 1 mês e ฿ {bellys:100000000}. Melhoria Genética: os benefícios do "Heat" lunariano com o dano trocado (exceto Psíquico, Energia, Trovejante e Verdadeiro), com tratamento mensal de 1 hora e ฿ {bellys:1000000} por sessão; 3 meses seguidos dão o benefício, 1 ano ininterrupto o torna permanente (interromper zera o progresso). Alternativa: +4 × nível de PV máximos e proficiência em uma perícia (exceto Haki, Sobrenatural e Sorte); não vale os dois. Objeto Usuário: funde uma Zoan a um objeto ou arma (฿ {bellys:500000000}, 1 mês na cápsula).',
            ),
            t(
                'ciencia-avancada',
                'Ciência Avançada',
                'Criar Raid Suit (฿ {bellys:1000000000}, 1 semana): só para quem passou 1 ano de Melhoria Genética e nível 11 ou mais (regras no Guia do Narrador). Ciborguização: próteses ou dispositivos feitos com um engenheiro e implantados por um médico dão uma habilidade de "Corpo Robótico" do estilo Ciborgue; melhorias menores: Sentidos Aprimorados (proficiência em Percepção por visão ou audição; pode usar CON no lugar de outros atributos), Disparador (Técnica "Laser", se já usa uma Técnica de 3º grau: 3º grau, 5 PP, até 18 m × 1,5 m em Linha, Salvaguarda de Destreza, 6d6 de Energia, Ação Poderosa) e Olho Gravador (reproduz holograficamente cenas, vozes ou textos vistos a 1 m). Sem o estilo Ciborgue, até 3 modificações; cada uma a mais custa 2 pontos de Presença. Custo ฿ {bellys:10000000}, 1 semana. Centelha de Mother Flame: fonte de energia que recarrega até 10 baterias grandes por dia, numa câmara blindada de 5 cômodos (฿ {bellys:50000000000}, 1 mês, construída por um engenheiro). Capacidade Genial (opcional): qualquer criação, limitada só pelo tempo e custo do Narrador.',
            ),
        ],
    },
    {
        id: 'contrabandista',
        nome: 'Contrabandista',
        resumo: 'Mestre da circulação proibida: itens do mercado negro, rotas e proteção do submundo.',
        pericias: ['enganacao', 'furtividade', 'intimidacao', 'intuicao', 'persuasao', 'provocacao'],
        ferramenta: 'Ferramentas de Contrabandista',
        itens: [
            '1 mochila pequena',
            '1 capa ou casaco com bolsos falsos',
            '1 kit de falsificação',
            '1 registro codificado de contatos',
            '1 mapa de rotas clandestinas',
        ],
        testes: ['Achar rotas alternativas ou passagens secretas', 'Ocultar contrabando de inspeções', 'Avaliar o risco de uma negociação ilegal'],
        tracos: [
            t(
                'aquisicao-sombria',
                'Aquisição Sombria',
                'Conexões com o mercado negro dão acesso a praticamente qualquer item (a critério do Narrador): Akuma no Mi disponível, Armas Meito, Raid Suit, objetos usuários de Akuma no Mi, medicamentos, maquinários complexos, Madeira Adam, Eternal Pose, equipamentos de kairoseki, venenos. O preço costuma ter acréscimo de 20% a 50% (ou uma missão/outro item). O encontro é marcado numa ilha próxima; a espera média é de 1 semana.',
            ),
            t(
                'membro-do-submundo',
                'Membro do Submundo',
                'Em cada ilha ou local novo, Teste de Sabedoria CD {cd:16} para identificar atividades ilegais, rotas alternativas, contrabandistas locais, autoridades disfarçadas ou movimentação suspeita. Em momentos difíceis, apoio do submundo: Abrigo (3 dias: esconderijo seguro e impossível de rastrear por até 1 semana, com comida e estilo de vida "modesto"); Transporte (2 dias: você ou até 5 pessoas levados com segurança a uma localidade acessível); Sequestro (5 dias: uma criatura de ND 1 ou menos capturada e levada ao ponto que escolher); Cobertura (1 hora, em áreas como cidades, vilas ou centros comerciais: um grupo surge para ajudar na fuga ou distrair, interrompendo o encontro por no mínimo 30 minutos). Cada serviço custa ฿ {bellys:50000000} a ฿ {bellys:100000000}, pago em até 1 mês (ou um favor/missão); sem pagar, vêm consequências graves.',
                { acoes: [{ rotulo: 'Teste de Sabedoria', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof' }] },
            ),
            t(
                'coiote',
                'Coiote',
                'Conduzindo pessoas por rotas perigosas: num encontro ou exploração, criaturas que não lutam (em geral PdN) a até 6 m de você ficam imunes a dano, desde que você não esteja "Incapacitado". Quando uma delas falha em um Teste de Atributo ou Salvaguarda, use a reação para garantir o sucesso a ela, assumindo você as consequências da falha (dano ou efeito definido pelo Narrador).',
                { acao: 'reacao' },
            ),
        ],
    },
    {
        id: 'cozinheiro',
        nome: 'Cozinheiro',
        resumo: 'Refeições do Chef: nutrição excepcional, descanso pleno e Dados Calóricos.',
        pericias: ['atuacao', 'intuicao', 'persuasao', 'prestidigitacao', 'provocacao', 'sobrevivencia'],
        ferramenta: 'Ferramentas de Cozinheiro',
        itens: ['1 mochila pequena', 'livros gastronômicos, receitas e nutrição', '1 kit de cozinha', '3 kits de temperos', '1 roupa de gala'],
        testes: ['Achar alimentos em locais escassos', 'Ver se um alimento está estragado ou envenenado', 'Identificar ingredientes pelo aroma'],
        tracos: [
            t(
                'refeicao-do-chef',
                'Refeição do Chef',
                'Quem consome ao menos uma Refeição do Chef tem, até o fim do próximo descanso longo: Alimento Medicinal (no descanso longo recupera 1 Nível de Exaustão adicional; com doença, o tempo de sobrevivência sem tratamento é dobrado enquanto continuar comendo as refeições); Descanso Pleno (no descanso curto, ao gastar Dados de Vida recupera outros iguais ao Bônus de Proficiência; ao subir de nível, resultado 1 a 3 no dado de vida é rolado de novo); Nutrição Superior (uma vez por dia, uma ação para recuperar PV igual ao dobro do nível; cura por dados é maximizada). Custo: 1d4 kits de temperos e ฿ {bellys:3000} em alimentos por prato.',
            ),
            t(
                'preparo-perfeito',
                'Preparo Perfeito',
                'Fora de encontros de combate, quem comer ao menos uma Refeição do Chef escolhe um benefício: recuperar 1 Nível de Exaustão; vantagem em Salvaguardas de Constituição por 1 minuto; ou recuperar 5 × seu modificador de Constituição em PV. Cada criatura se beneficia um número de vezes igual ao seu mod. de Constituição (mínimo 1, máximo 3); os usos voltam no descanso longo.',
            ),
            t(
                'alimento-energetico',
                'Alimento Energético',
                'Uma Refeição do Chef pode guardar Dados Calóricos (sempre {dado:6}): 1, mais 1 a cada 2 níveis (no 10º, 6). Cada dado rolado é gasto e recupera PP da criatura igual ao resultado; infunda uma nova refeição com todos os dados após um descanso longo. Dividem-se igualmente entre quem comer (você decide quem fica com os restantes) e ficam disponíveis até o próximo descanso longo de cada um; em combate custam uma ação e o resultado é pela metade. O máximo de PP recuperado por nutrição entre descansos longos é 2 × o nível de cada criatura.',
                {
                    usos: { formula: '1+floor(@nivel/2)', descanso: 'longo' },
                    acoes: [{ rotulo: 'Rolar 1 Dado Calórico', tipo: 'recuperar', recurso: 'pp', rolagem: '1{dado:6}', usa: true }],
                },
            ),
        ],
    },
    {
        id: 'engenheiro',
        nome: 'Engenheiro',
        resumo: 'Une conhecimento técnico e trabalho manual: submarinos, máquinas, armas de grande porte e robôs.',
        pericias: ['historia', 'intuicao', 'investigacao', 'percepcao', 'prestidigitacao', 'sobrevivencia'],
        ferramenta: 'Ferramentas de Engenheiro',
        itens: [
            '1 mochila pequena',
            'livros de engenharia mecânica, física e computação',
            '1 martelo',
            '1 kit de chaves',
            '1 kit de construção',
            '1 mini computador',
        ],
        testes: ['Melhorias mecânicas em navios', 'Interagir com sistemas de segurança avançados', 'Compreender estruturas complexas de engenharia'],
        tracos: [
            t(
                'engenharia-naval',
                'Engenharia Naval',
                'Criar Submarino (Cap. 14): você constrói submarinos, seus cômodos e componentes. Eficiência: −40% nos custos adicionais de construção e reparo de submarinos definidos pelo Narrador. Eficácia: +6 nós (12 km/h) nos submarinos que construir. Corpo Preparado: trabalhando na construção ou reparo de um submarino, seus dias contam para treinamentos.',
            ),
            t(
                'engenharia-avancada',
                'Engenharia Avançada',
                'Mecanismos sofisticados (custos, materiais e tempo no Cap. 14): Canhão de Energia (canhão frontal que concentra e dispara energia massiva), Cômodos Engenhados (sala de máquinas, gerador de energia), Criar Mini Submarino (até 2 criaturas Pequenas ou Médias, ou 1 Grande), Motores (mais velocidade, mesmo sem corrente), Propulsão a Jato (percorre grandes distâncias num instante, longo preparo), Revestir Casco com Kairoseki (imune a encontros com rei dos mares nos Testes de Navegação, ignora danos irreparáveis, +1 CR do navio). Criar Arma de Grande Porte: armas robustas contra embarcações, muralhas e castelos.',
            ),
            t(
                'conserto-avancado',
                'Conserto Avançado',
                'Tabela "Construção Avançada Danificada": Normal (99% ou menos): 2d6 dias, ฿ {bellys:150000}; Danificado (70% ou menos): 4d6 dias, ฿ {bellys:1000000}; Muito Danificado (30% ou menos): 8d6 dias, ฿ {bellys:3000000}. Custo por PV recuperado: Aço ฿ {bellys:550000}, Aço Temperado ฿ {bellys:750000}.',
            ),
            t(
                'construir-robo',
                'Construir Robô',
                'Um robô (40 dias, ฿ {bellys:500000000}, manutenção mensal ฿ {bellys:2000000}) obedece só ao criador e age na iniciativa dele; só um robô ativo por vez. Dar uma ordem custa a ação bônus do engenheiro e dura até a tarefa acabar ou a ordem de parar (sem ação). Ordens: Atacar; Defender (a até 1,5 m, metade do dano da criatura protegida vai para o robô; com a reação e 10 PP do robô, ele recebe todo o dano); Movimentação; Parar. Protocolos com o engenheiro inconsciente: Vingança, Salvar, Proteger (passam a ser controlados pelo jogador). Robô: ND 10, 10.000 XP, 40 PP, CR 18, PV 651, proficiência +4, CD 17, desloca 12 m e nada 12 m, FOR 20 DES 19 CON 19 SAB/PRE/VON 10, Atletismo +9, Percepção +4, Salvaguardas FOR +9 e CON +8, invulnerável a Psíquico e Veneno e às condições Amedrontado, Bêbado, Enfeitiçado, Envenenado, Exaustão, Paralisado, Queimado, Sangramento e Sonolento; Absorção de Eletricidade (dano Elétrico o cura) e Natureza Robótica. Ataque Desarmado +9 (2d12+5 Contundente, 2 por turno) e Soco Biônico (4º grau, 7 PP, recarga 5-6: 9d10 Contundente). Não recupera PV em descansos (só conserto) e recupera PP após 24 h inativo. A 0 PV, Teste de Sabedoria CD 14 do engenheiro para salvar as partes vitais (robô volta com 1 PV).',
            ),
        ],
    },
    {
        id: 'espiao',
        nome: 'Espião',
        resumo: 'Coleta informações, infiltra e manipula em silêncio: identidades falsas, código secreto e dispositivo.',
        pericias: ['enganacao', 'furtividade', 'intuicao', 'investigacao', 'percepcao', 'prestidigitacao'],
        ferramenta: 'Ferramentas de Espião',
        itens: [
            '1 mochila pequena',
            '1 óculos com lente ampliadora',
            '1 aparelho de escuta',
            '1 caderno criptografado',
            '1 kit de disfarce',
            '1 kit para abrir cadeados',
            '1 kit de falsificação',
            '1 mini câmera',
        ],
        testes: ['Perceber comportamentos suspeitos', 'Vigiar alvos sem ser notado', 'Infiltrar-se em ambientes restritos'],
        tracos: [
            t(
                'infiltrador',
                'Infiltrador',
                'Com um Teste de Sabedoria CD {cd:16} você cria identidades falsas (7 dias de pesquisa e ฿ {bellys:250000}); não pode ser de alguém que exista. Exige roupas e documentos convincentes. Você também faz uma máscara facial ultrafina da aparência de quem observou por 2 horas; a criatura desconfiada faz Teste de Sabedoria (Percepção) CD 19 para vê-la como falsa; se tirar 20 no d20 na confecção, o disfarce é perfeito (só desmascarado por dano à máscara ou informação externa). Custo: 1d4 caixas de maquiagem por disfarce.',
                { acoes: [{ rotulo: 'Teste de Sabedoria', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof' }] },
            ),
            t(
                'linguagem-de-espiao',
                'Linguagem de Espião',
                'Você esconde mensagens na fala comum (pausas ritmadas, gestos das mãos, microexpressões, tom de voz, tiques voluntários); só quem tem esta característica as entende. No início do dia você instrui um aliado a interpretar uma mensagem curta, válida até o fim do dia. Para quem não conhece, Teste de Presença (Atuação) CD {cd:14}: no sucesso a criatura entende sem suspeitar.',
            ),
            t(
                'dispositivo-de-espiao',
                'Dispositivo de Espião',
                'Um objeto especial (construído, achado, recebido ou roubado) que só espiões ou quem o estudou por meses opera; você ativa qualquer função com uma ação bônus. Sempre se disfarça de objeto comum e tem até 3 funções: Alterador de Voz (imita voz ouvida nas últimas 24 h), Aparelho de Comunicação (Den-Den Mushi a até 5 km), Asa Delta Oculta (como o item asa delta), Chave Mestra (abre fechadura em 1 minuto), Escuta Direcional (conversas a até 30 m, através de paredes), Gancho Portátil (gancho de até 15 m que puxa você), Microcâmera (1 hora de vídeo ou 20 fotos), Mini Radar (movimento em 6 m).',
                { acao: 'bonus' },
            ),
        ],
    },
    {
        id: 'farmaceutico',
        nome: 'Farmacêutico',
        resumo: 'Cria drogas, estimulantes e antídotos; controla doenças e domina venenos.',
        pericias: ['historia', 'intuicao', 'investigacao', 'medicina', 'natureza', 'percepcao'],
        ferramenta: 'Ferramentas de Farmacêutico',
        itens: [
            '1 mochila pequena',
            '1 kit médico',
            '1 kit de pesquisa',
            '1 kit de primeiros socorros',
            '1 kit de herbalismo',
            '1 kit de venenos',
            'livros de farmácia e biologia química',
            '1 conjunto de reagentes básicos',
        ],
        testes: [
            'Identificar substâncias ou reagentes',
            'Criar compostos como analgésicos ou estimulantes',
            'Diferenciar toxinas naturais de artificiais',
        ],
        tracos: [
            t(
                'drogas-especiais',
                'Drogas Especiais',
                'Feitas em laboratório adequado. Rompante Lunar (฿ {bellys:250000}, 7 dias, 1 pílula): o Mink manifesta o Sulong por até 1 minuto sem lua cheia; depois sofre 2 Níveis de Exaustão por 2 horas (+2 a cada nova dose). Remédio Milagroso da Tribo Mink (฿ {bellys:500000}, 12 dias, 1 dose): recupera todos os PV e PP por 5 minutos, depois cai inconsciente com 0 PV e 0 PP e faz Salvaguarda de Constituição CD 17 (falha = morte). Rumble Ball (฿ {bellys:100000}, 5 dias, 3 pílulas): usuário de Zoan recebe por 1 minuto os benefícios do treinamento "Controle Corporal" e mais 2 Points; 3 entre descansos longos forçam o despertar do fruto por 5 minutos. Energy Steroids (฿ {bellys:1000000}, 7 dias, 1 pílula): recupera 10 × nível em PV e nível em PP, e todo dano causado tem +1d6 até o fim de um descanso curto ou longo; role 1d8: 4 ou menos, −1 de Constituição por 1 mês; 1, −2 permanentes. Antídoto Universal (฿ {bellys:300000}, 1 hora, 1 dose): com amostra do sangue ou do veneno, neutraliza o agente no próximo descanso longo (36 h) da criatura.',
            ),
            t(
                'controle-de-doencas',
                'Controle de Doenças',
                'Diante de doença ou veneno, Teste de Sabedoria CD {cd:16} para analisar a composição; no sucesso, após 3d6 dias você manipula o agente: Criar Cura (Teste de Sabedoria CD {cd:15}, 2 horas: 5 doses de antídoto, cura ou vacina; em encontros interrompe as condições e efeitos, fora deles cura totalmente após 1d4 horas); Criar Cura em Massa (CD {cd:18}, 5 horas: 1 dose que libera fumaça com os mesmos efeitos numa esfera de 9 m; fora de encontros, 1d12 horas).',
                { acoes: [{ rotulo: 'Teste de Sabedoria', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof' }] },
            ),
            t(
                'toxicologia',
                'Toxicologia',
                'Com um kit de venenos você cria, identifica, trata e aplica venenos. Proficiência em testes específicos: Investigação/Percepção (vantagem ao examinar locais, objetos ou corpos em busca de envenenamento), Medicina (diagnosticar e tratar intoxicados), Sobrevivência (reconhecer plantas, animais e substâncias venenosas) e Prestidigitação (aplicar ou manipular venenos sem contaminação).',
            ),
        ],
    },
    {
        id: 'ferreiro',
        nome: 'Ferreiro',
        resumo: 'Forja armas e equipamentos; lâminas com Pontos de Forja.',
        pericias: ['atletismo', 'historia', 'intuicao', 'investigacao', 'percepcao', 'prestidigitacao'],
        ferramenta: 'Ferramentas de Ferreiro',
        itens: [
            '1 mochila pequena',
            'livros de metalurgia e armas',
            '1 martelo de forja pequeno',
            'ferramentas de metal',
            '1 pedra de amolar',
            '1 bigorna pequena',
            '1 molde simples',
        ],
        testes: ['Avaliar a integridade de uma arma', 'Detectar defeitos em metais', 'Estimar fusão ou resistência de ligas'],
        tracos: [
            t(
                'forjar-equipamentos',
                'Forjar Equipamentos',
                'Você cria qualquer arma ou equipamento do Cap. 8 (custo e materiais a critério do Narrador) com um Teste de Força, Destreza ou Sabedoria CD {cd:16}.',
                { acoes: [{ rotulo: 'Teste (Força, Destreza ou Sabedoria)', tipo: 'rolar', rolagem: '1d20+@mod.for+@prof' }] },
            ),
            t(
                'laminas',
                'Lâminas',
                'Forjar é um processo espiritual: você recebe 1 Ponto de Forja (PF) a cada 10 anos de vida, 1 a cada 10 lâminas comuns produzidas e 2 a cada graduação alcançada. Ao aprimorar uma lâmina atribui uma maldição (Yoto) e ela ganha as propriedades das armas lendárias (Meito): Wazamono 2 PF, Ryo Wazamono 4 PF, Ô Wazamono 6 PF, Saijo Ô Wazamono 10 PF. Anos Regressos: recomenda-se iniciar com 2 a 4 PF. PF também melhoram qualquer equipamento: Expertise (1 PF, troca a expertise da arma), Supremacia (2 PF, uma expertise adicional, máx. 2), Densidade (1 PF, ignora resistência a Contundente, Cortante ou Perfurante), Dureza (1 PF, indestrutível e nunca perde o fio), Balanço (2 PF, ignora invulnerabilidade ao tipo, se já ignora a resistência), Fio (2 PF, dano sobe um passo: 1 → 1d4 → 1d6 → 1d8 → 1d10 → 1d12 → 2d6 → 3d6). Custo: 1 lingote de metal e ฿ {bellys:20000} ou 20% do valor de compra (o maior).',
                { etiquetas: ['Pontos de Forja (PF): 1 por 10 anos, 1 por 10 lâminas, 2 por graduação'] },
            ),
            t(
                'aprimorar-consertar',
                'Aprimorar/Consertar Equipamento',
                'Com um Teste de Força, Destreza ou Sabedoria CD {cd:16} você faz aprimoramentos em armas sem modificação (uma por item): revestir 1 arma ou 10 munições com Kairoseki; criar 20 munições de 1d12 Contundente ou Perfurante; ampliar as duas distâncias de armas à distância em 6 m; ou +3 no ataque (comum ou Técnicas), que cai 1 a cada 3 encontros até acabar (então a arma deixa de ser modificada). Se o d20 for 1, o equipamento quebra e não tem conserto; alternativamente você conserta uma arma ainda não destruída. Custo: 1 lingote e ฿ {bellys:20000} ou 20% do valor (o maior).',
            ),
        ],
    },
    {
        id: 'informante',
        nome: 'Informante',
        resumo: 'Obtém, analisa e guarda informações; chantagem, tripulantes e arquivos.',
        pericias: ['enganacao', 'furtividade', 'investigacao', 'intuicao', 'percepcao', 'persuasao'],
        ferramenta: 'Ferramentas de Informante',
        itens: [
            '1 mochila pequena',
            '1 caderno codificado',
            '1 mapa da cidade ou região de operação',
            'ferramentas de comunicação discreta (sinalizadores, apitos, espelhos)',
        ],
        testes: [
            'Recordar informações públicas e acontecimentos recentes',
            'Avaliar o valor real de mercadorias',
            'Buscar a localização de itens ou pessoas',
        ],
        tracos: [
            t(
                'chantagem',
                'Chantagem',
                'Teste de Sabedoria CD {cd:17} com contatos e investigações (definidas pelo Narrador) para descobrir algo comprometedor. Se achar, o alvo pode reagir com Vista Grossa (ignora pequenas infrações), Cooperação Parcial (ajuda em tarefas menores sem risco à vida) ou Cooperação Total (ajuda mesmo em perigo). O Narrador não revela a reação nem se o alvo só finge colaborar; forçar demais pode virar o alvo contra você, e ele pode não ter nada a esconder.',
                { acoes: [{ rotulo: 'Teste de Sabedoria', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof' }] },
            ),
            t(
                'buscar-tripulante',
                'Buscar Tripulante',
                'Ao chegar numa ilha, nos 3 primeiros dias você pode achar um voluntário com domínio na profissão desejada, com um Teste de Sabedoria na tabela "Busca de Tripulantes" (CD: Adestrador 14, Botânico 17, Caçador de Recompensas 14, Carpinteiro 14, Cientista 20, Contrabandista 16, Cozinheiro 14, Engenheiro 17, Espião 20, Farmacêutico 18, Ferreiro 15, Inventor 19, Jornalista 16, Médico 16, Músico 16, Navegador 14, Psiquiatra 16, Timoneiro 14; arqueólogos e outros informantes não). Ficando mais de 2 semanas, repita com vantagem no último dia. Os recrutados são confiáveis, pois passam por uma investigação sua que revela antecedentes relevantes.',
            ),
            t(
                'sempre-informado',
                'Sempre Informado',
                'Você se lembra com precisão de tudo o que viu ou ouviu nos últimos 30 dias. Identifica figuras importantes com um Teste de Sabedoria CD {cd:14}, reconhecendo feitos e habilidades de conhecimento público. Com seu domínio de mercados, culturas e recursos regionais, negocia 40% de desconto em qualquer compra que intermedeie.',
            ),
            t(
                'analisar-e-buscar',
                'Analisar e Buscar Informações',
                'Consultando seus arquivos, Teste de Sabedoria CD {cd:15} para obter quase qualquer informação (localização aproximada de um pirata, se uma notícia é verdadeira, se uma figura esteve num evento, quem está numa ilha, informações secretas do Governo Mundial, perfil de pessoas públicas e infames). Para acontecimentos recentes, CD {cd:17} para novas informações num intervalo de até 5 dias.',
                { acoes: [{ rotulo: 'Teste de Sabedoria', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof' }] },
            ),
        ],
    },
    {
        id: 'inventor',
        nome: 'Inventor',
        resumo: 'Cria dispositivos, mecanismos e engenhocas com dials para superar qualquer desafio.',
        pericias: ['historia', 'investigacao', 'intuicao', 'natureza', 'prestidigitacao', 'percepcao'],
        ferramenta: 'Ferramentas de Inventor',
        itens: ['1 mochila pequena', '1 kit de chaves', '1 kit de construção', 'livros de engenharia criativa', '1 caixa com peças diversas'],
        testes: ['Improvisar dispositivos com materiais limitados', 'Entender o funcionamento de máquinas desconhecidas', 'Fazer engenharia reversa'],
        tracos: [
            t(
                'criar-engenhoca',
                'Criar Engenhoca',
                'Teste de Sabedoria; em falha, compre materiais de 10% do custo total antes de tentar de novo. Tabela "Engenhocas com Dial" (dials, custo, tempo, CD): Cool Shooter (Water, Cool, Frozen ×2) ฿ {bellys:450000}, 2 dias, CD {cd:18}; Clima-Tact (Heat, Breath, Spark, Cool) ฿ {bellys:90000}, 5 dias, CD {cd:14}; Perfect Clima-Tact ฿ {bellys:180000}, 10 dias, CD {cd:15}; Sorcery Clima-Tact (Flame, Jet, Thunder, Frozen) ฿ {bellys:300000}, 15 dias, CD {cd:18}; Burn Bazooka (Breath ×2, Flame) ฿ {bellys:500000}, 2 dias, CD {cd:17}; Eisen Whip (Eisen) ฿ {bellys:180000}, 2 dias, CD {cd:16}; Burn Blade (Flame) ฿ {bellys:150000}, 8 h, CD {cd:17}; Flash Gun (Flash) ฿ {bellys:150000}, 8 h, CD {cd:17}; Jet Board/Jet Gauntlet (Jet) ฿ {bellys:80000}, 8 h, CD {cd:17}; Heat Javelin (Heat) ฿ {bellys:120000}, 2 dias, CD {cd:17}; Kabuto (Breath) ฿ {bellys:70000}, 3 dias, CD {cd:15}; Jet Ski (Jet ×2) ฿ {bellys:47000}, 8 h, CD {cd:16}; Cutter Shell (Axe ×2) ฿ {bellys:250000}, 1 dia, CD {cd:17}; Milky Arrow (Milk) ฿ {bellys:3000}, 30 min, CD {cd:15}. Alternativamente você projeta uma tecnologia nova com os mesmos efeitos (um sabre de luz no lugar da Burn Blade): o custo final é 100 vezes maior.',
                { acoes: [{ rotulo: 'Teste de Sabedoria', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof' }] },
            ),
            t(
                'engenhocas-avancadas',
                'Engenhocas Avançadas',
                'Teste de Sabedoria CD {cd:18} (falha: materiais de 10% do custo). Bubble Gun (฿ {bellys:6000000}, 3 dias): arma que consome uma munição de kairoseki por disparo (ataque comum) e envolve numa bolha uma criatura a até 3 m; usuário de Akuma no Mi fica "Enfraquecido" e não rompe a bolha, flutuando por até 5 minutos. Bubble Shield (฿ {bellys:3500000}, 5 dias): manopla que, como reação ao ser alvo de ataque (comum ou Técnicas) ou Salvaguarda, gasta 5 munições de kairoseki e reduz a 0 todo dano ou efeito vindo de poderes de Akuma no Mi. GP Flower (฿ {bellys:250000}, 1 dia): munição que, disparada ao alto, faz qualquer arma de pólvora falhar por 10 minutos numa esfera de 50 m (só flores). Disparador de Pop Green (฿ {bellys:90000}, 1 dia): propriedades de mosquete, só dispara Pop Greens. Invenção Improvisada (opcional): dispositivo improvisado com os recursos à volta, Teste de Sabedoria de CD do Narrador.',
            ),
        ],
    },
    {
        id: 'jornalista',
        nome: 'Jornalista',
        resumo: 'Registra, investiga e transmite informação; influencia nações com a imprensa.',
        pericias: ['enganacao', 'historia', 'investigacao', 'intuicao', 'percepcao', 'persuasao'],
        ferramenta: 'Ferramentas de Jornalista',
        itens: [
            '1 mochila pequena',
            '1 caderno de anotações',
            '1 máquina fotográfica portátil',
            '1 gravador de voz',
            '1 livro de técnicas de entrevista',
        ],
        testes: ['Investigar eventos recentes', 'Extrair informações de testemunhas', 'Analisar a credibilidade de fontes'],
        tracos: [
            t(
                'pesquisa-jornalistica',
                'Pesquisa Jornalística',
                'Interpretar Fatos: com acesso a informações, fotos ou gravações, você preenche lacunas como se presenciasse o evento; o Narrador dá uma suposição mais ou menos próxima da realidade conforme um Teste de Sabedoria (CD dele, que pode ocultar o resultado); novas informações permitem repetir. Apurar a Verdade: após 5 minutos com alguém, Teste de Sabedoria (Intuição) CD {cd:17} para saber se mente, omite ou está emocionalmente instável (20 natural: também a emoção predominante e uma motivação imediata). Registro Impecável: seus Testes de Sabedoria (Investigação) com base em suas anotações, fotos, vídeos ou gravações têm vantagem, e você nunca esquece o que registrou. Coletor de Provas: examinando um local por 10 minutos, Teste de Sabedoria (Investigação) CD {cd:15} para achar 1 evidência relevante ou descobrir que uma anterior é falsa (20 natural: também uma pista oculta). Rede de Informações: uma vez por descanso longo, uma informação, boato, documento simples ou dica útil.',
                { usos: longo(1), acoes: [{ rotulo: 'Teste de Sabedoria', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof' }] },
            ),
            t(
                'poder-da-imprensa',
                'Poder da Imprensa',
                'Fake News: você divulga informações verdadeiras ou desinformação em escala global, que o mundo conhece no dia seguinte (localização falsa, falsa morte, promoção ou renúncia fictícia); notícias falsas podem ser desmentidas em 1d6 dias; mesmo as verdadeiras podem ser negadas se contrariarem o Governo Mundial. Manipular Narrativas: após 10 minutos, Teste de Presença (Persuasão ou Enganação) CD {cd:15}; no sucesso uma pequena comunidade acredita na versão, que se espalha pela ilha ou região a cada dia. Pressão da Imprensa: pressão massiva sobre uma figura conhecida (uma pauta por vez, 1d6 semanas), que precisa se posicionar; você se beneficia da instabilidade e das decisões precipitadas.',
            ),
        ],
    },
    {
        id: 'medico',
        nome: 'Médico',
        resumo: 'Cuida de ferimentos e doenças; Dados Curativos, paramedicina e cirurgia.',
        pericias: ['intuicao', 'investigacao', 'medicina', 'percepcao', 'prestidigitacao', 'sobrevivencia'],
        ferramenta: 'Ferramentas de Médico',
        itens: ['1 mochila pequena', 'livros de anatomia, medicina e bioquímica', '1 kit médico', '3 kits de primeiros socorros'],
        testes: ['Cirurgias, ferimentos graves e próteses', 'Diagnosticar doenças e prescrever remédios', 'Criar antídotos ou medicamentos'],
        tracos: [
            t(
                'tratar-ferimentos',
                'Tratar Ferimentos',
                'Você tem 2 Dados Curativos por nível (sempre {dado:6}; no 10º, 20). Cada dado rolado é consumido e recupera PV igual ao resultado; todos voltam após um descanso longo. Para usar, esteja a até 1,5 m da criatura e gaste uma ação bônus escolhendo quantos dados rolar. O máximo de PV recuperado por tratamento médico entre descansos longos é 20 × o nível de cada criatura. Podem ser usados a qualquer momento, mas em combate o valor dos dados é pela metade. Custo: 1d4 kits médico.',
                {
                    usos: { formula: '2*@nivel', descanso: 'longo' },
                    acao: 'bonus',
                    acoes: [{ rotulo: 'Rolar 1 Dado Curativo', tipo: 'rolar', rolagem: '1{dado:6}', usa: true, acao: 'bonus' }],
                },
            ),
            t(
                'especialista-em-cura',
                'Especialista em Cura',
                'Qualquer cura que você aplique fora das características da profissão é potencializada: o resultado de cura por dados não pode ser menor que metade do máximo possível e os dados sobem um passo (1d4 → 1d6 → 1d8 → 1d10 → 1d12 → 2d8); curas de valor fixo aumentam em 50% (50 PV viram 75).',
                { etiquetas: ['Curas: dados +1 passo, mínimo ½ do máximo, fixas +50%'] },
            ),
            t(
                'paramedicina',
                'Paramedicina',
                'Com uma ação bônus, Teste de Sabedoria CD {cd:18} para tratar uma criatura inconsciente com 0 PV ou morta há menos de 3 minutos (quantas tentativas quiser nesse tempo). Falha: remove qualquer condição não sustentada por meios sobrenaturais e a criatura recebe 50 PV temporários que a protegem de novos danos, sem despertá-la nem revivê-la. Sucesso: além disso recupera metade dos PV totais (para baixo) e volta à vida se morta, ficando consciente por 1 minuto; depois volta a cair inconsciente com 1 PV e só acorda após um descanso curto ou longo. O sucesso só vale uma vez por criatura (depois, só os efeitos da falha) até ela completar um descanso longo. Custo: 1d4 kits de primeiros socorros.',
                { acao: 'bonus', acoes: [{ rotulo: 'Teste de Sabedoria', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof', acao: 'bonus' }] },
            ),
            t(
                'tratamentos',
                'Tratamentos',
                'Tratar Doenças: após 1 minuto analisando o paciente, uma ação para medicar; a criatura fica sem sintomas por 24 horas (depois, tratamento adequado). Em doenças com tratamento específico (Cap. 10) o Narrador pode pedir Teste de Sabedoria CD {cd:18}; doenças não especificadas levam 1d4 + 1 dias, ฿ {bellys:30000}, CD {cd:16}; a CD cai pelo mod. de Constituição do paciente e sobe 1 por dia sem tratar. Inspeção Médica: uma semana em contato direto, sem Exaustão e com mais da metade dos PV, dá vantagem em Salvaguardas contra Envenenado, Letárgico, Queimado, Sangramento e doenças; 3 dias sem contato a perdem. Cirurgia (local esterilizado): para reverter Danos Brutais (Cap. 12), Teste de Sabedoria conforme a tabela — Grave: Costela Quebrada 2 h CD {cd:16}, Hemorragia Interna 3 h CD {cd:16}, Membro Deslocado 1 h CD {cd:13} (฿ {bellys:75000}); Crítico: Crânio Fraturado 4 h CD {cd:15}, Corte Profundo 2 h CD {cd:15}, Membro Quebrado 3 h CD {cd:16} (฿ {bellys:100000}); Mortal: Fratura Exposta 9 h CD {cd:17}, Órgão Perfurado 10 h CD {cd:17}, Membro Decepado 12 h CD {cd:18} (฿ {bellys:125000}). A CD cai pelo mod. de Constituição do paciente e sobe 1 por dia sem tratar. Custo: 1d4 kits médico.',
            ),
        ],
    },
    {
        id: 'musico',
        nome: 'Músico',
        resumo: 'Transforma dificuldade em motivação: Alma de Artista e Repertório Encantador.',
        pericias: ['atuacao', 'enganacao', 'furtividade', 'intimidacao', 'persuasao', 'prestidigitacao', 'provocacao'],
        ferramenta: 'Instrumento musical',
        itens: ['1 mochila pequena', 'livros de canto, de instrumentos e partituras', '1 instrumento musical à sua escolha'],
        testes: ['Impressionar multidões', 'Conquistar interesses românticos', 'Inspirar felicidade e motivação nos companheiros'],
        tracos: [
            t(
                'alma-de-artista',
                'Alma de Artista',
                'Você é proficiente em qualquer instrumento musical e tem uma linda voz; vantagem em Testes de Vontade (Percepção) ligados à audição. Quando uma criatura passa numa Salvaguarda contra uma canção sua, você pode fazê-la repetir o teste (até 3 usos; todos voltam no descanso longo).',
                { usos: longo(3), acoes: [{ rotulo: 'Fazer repetir a Salvaguarda', tipo: 'gastar', usa: true, acao: 'livre' }] },
            ),
            t(
                'repertorio-encantador',
                'Repertório Encantador',
                'Você inicia uma música com uma ação e uma ação bônus, e as mantém com uma ação bônus no início de cada turno seu; só uma música por vez (sem duração, é instantânea). Alcance de 15 m, afetando criaturas à sua escolha (ou todas no alcance) que o vejam e ouçam e falhem numa Salvaguarda de Presença CD 8 + proficiência + mod. de Presença; voluntários podem aceitar os efeitos. Música da Paz: ignora, por até 1 minuto, qualquer motivo de hostilidade (ou fica indiferente às criaturas escolhidas até ser atacada, ferida ou ver um aliado ferido). Música da Sedução: enfeitiça um humanoide por 1 hora (vantagem na salvaguarda se você ou seus companheiros o enfrentam; acaba se causarem dano a ele ou a um aliado dele; ao fim, ele sabe do feitiço). Música do Herói: criatura voluntária fica imune a "Amedrontado" por até 1 minuto. Música de Ninar: role 30d10, uma reserva de PV; criaturas em ordem crescente de PV atuais com PV iguais ou menores que o restante da reserva caem inconscientes (até sofrerem dano ou serem sacudidas) e abatem a reserva; a primeira maior que o restante para o efeito. Música da Distração: até 1 minuto; imunes a feitiço passam; em combate contra vocês, vantagem na salvaguarda; em falha, desvantagem em Vontade (Percepção) para notar qualquer coisa além de você. Música da Dança Irresistível: por 1 minuto, em falha você designa uma direção e a criatura deve se mover nela no próximo turno (provocando ataques de oportunidade; sem perigo óbvio; acaba com dano); depois repete a salvaguarda. Música do Desrespeito: insulta uma criatura, que passa em uma Salvaguarda ou fica "Enfurecido".',
                { acao: 'padrao', acoes: [{ rotulo: 'Música de Ninar (30d10)', tipo: 'rolar', rolagem: '30d10' }] },
            ),
        ],
    },
    {
        id: 'navegador',
        nome: 'Navegador',
        resumo: 'Conduz o navio ao destino: Testes de Navegação, previsão e mapas.',
        pericias: ['enganacao', 'intuicao', 'investigacao', 'percepcao', 'persuasao', 'sobrevivencia'],
        ferramenta: 'Ferramentas de Navegador',
        itens: [
            '1 mochila pequena',
            'livros de astronomia, geografia e navegação',
            '1 bússola à escolha (bússola, log pose, log pose de 3 agulhas)',
            '1 compasso',
            '1 balestilha',
            '1 astrolábio',
        ],
        testes: ['Calcular rotas marítimas', 'Prever tempestades ou mudanças climáticas', 'Orientar-se em nevoeiro ou de noite sem instrumentos'],
        tracos: [
            t(
                'navegacao',
                'Navegação',
                'Testes de Navegação ocorrem em viagens em alto-mar: o Narrador pede um Teste de Sabedoria contra perigos climáticos ou encontros hostis (CD e frequência pelo mar, Guia do Narrador). Sem navegador ou timoneiro, usa-se a Vontade do Capitão com desvantagem. Para você são testes da sua profissão, com: Dos Males, o Menor (ao falhar, role 2d10 em vez de 1 e escolha); Cortina Climática (ao falhar com "Animal Alado", "Ataque Pirata", "Frota da Marinha" ou "Rei dos Mares", Teste de Sabedoria na CD do mar para despistar); Preparo Infalível (uma vez por viagem, troca uma falha por sucesso).',
            ),
            t(
                'previsao-maritima',
                'Previsão Marítima',
                'Antes de uma viagem, Teste de Sabedoria na CD do mar: no sucesso a partida adia 1d4 dias, mas todos os Testes de Navegação da viagem têm vantagem. CD: Blues {cd:12}; Grand Line (Paradise) {cd:16}; Grand Line (Novo Mundo) {cd:18}; outros mares {cd:14}.',
                { acoes: [{ rotulo: 'Teste de Sabedoria', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof' }] },
            ),
            t(
                'mente-afiada',
                'Mente Afiada',
                'Você sempre sabe onde é o Norte e quantas horas faltam para o nascer ou pôr do sol, e se lembra com precisão de qualquer mapa, caminho ou paisagem visto nos últimos 30 dias.',
            ),
            t(
                'criar-mapa',
                'Criar Mapa',
                'Teste de Sabedoria na CD do mar para criar um mapa cartográfico da região: com um mapa válido da área, a viagem dura metade e todos os Testes de Navegação são bem-sucedidos. CD: Blues {cd:10}; Grand Line (Paradise) {cd:14}; Grand Line (Novo Mundo) {cd:16}; outros mares {cd:12}.',
                { acoes: [{ rotulo: 'Teste de Sabedoria', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof' }] },
            ),
        ],
    },
    {
        id: 'psiquiatra',
        nome: 'Psiquiatra',
        resumo: 'Especialista na mente: perspicácia, táticas mentais e aprimoramento de personalidade.',
        pericias: ['intuicao', 'investigacao', 'medicina', 'percepcao', 'persuasao', 'provocacao'],
        ferramenta: 'Ferramentas de Psiquiatra',
        itens: ['1 mochila pequena', 'livros de psicologia, psiquiatria e comportamento humano', '1 caderno para anotações clínicas', '1 kit médico'],
        testes: ['Interpretar comportamentos e emoções', 'Diagnosticar transtornos psicológicos', 'Estabilizar indivíduos em crise'],
        tracos: [
            t(
                'perspicacia-psicologica',
                'Perspicácia Psicológica',
                'Após 5 minutos de conversa ou análise, Teste de Sabedoria (Intuição) CD {cd:16} para identificar (a critério do Narrador): estado emocional atual; gatilhos, traumas, compulsões ou instabilidade; fragilidades como medo, vício, insegurança, dependência emocional ou pressão psicológica. Análise Comportamental: observando um grupo por 5 minutos, no sucesso você descobre a hierarquia interna e quem teme quem, se alguém mente ou age de forma suspeita, quem é mais influenciável e quem controla, e a intenção predominante (atacar, fugir, enganar, negociar, recrutar...).',
                { acoes: [{ rotulo: 'Intuição (Sabedoria)', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof' }] },
            ),
            t(
                'taticas-mentais',
                'Táticas Mentais',
                'Diagnosticando: a cada 1 minuto ouvindo uma criatura ou percebendo algo relevante dela, anote e acumule 1 Ponto Mental (até 3 por criatura; depois só após um descanso longo; perde os pontos após 2 horas sem interagir). Gaste 1 (nunca mais de 1 ao mesmo tempo) para +5 em Testes de Presença relacionados à criatura. Testes de Presença ligados à sua profissão podem usar Sabedoria. Terapia de Crise: com uma ação bônus, encerra numa criatura a até 15 m que o ouça e entenda uma condição entre Amedrontado, Empoderado, Enfeitiçado e Enfurecido. Discurso Desmotivacional: após analisar uma criatura, Teste de Sabedoria (Intuição) CD {cd:17}: no sucesso, uma criatura a até 15 m tem desvantagem em todos os Testes de Atributo por até 5 minutos, com −1 cumulativo a cada falha no período; só de novo após 24 horas. Xadrez Mental: após ouvir uma criatura por 5 minutos, Teste de Sabedoria (Intuição) de CD do Narrador para prever as próximas ações dela (em fracasso, a informação pode ser imprecisa ou falsa).',
                { acoes: [{ rotulo: 'Discurso Desmotivacional (Intuição)', tipo: 'rolar', rolagem: '1d20+@mod.sab+@prof' }] },
            ),
            t(
                'aprimorar-personalidade',
                'Aprimorar Personalidade',
                'Dedicando a primeira hora de cada dia a consultas com seus companheiros por 1 semana seguida, eles recebem 1 Singularidade Suave adicional e deixam de sofrer as penalidades dos Defeitos das Singularidades (Cap. 5) por 24 horas; o benefício continua enquanto as consultas continuarem (sem contato por mais de 3 dias, ele acaba). A Singularidade e os Defeitos anulados não podem ser ligados a pessoas ou fatores externos nem a limitações físicas ou condições externas. Depois de um período prolongado, o Narrador pode torná-lo permanente. Você também fica imune a esses Defeitos e recebe 1 Singularidade Suave adicional, com as mesmas restrições.',
            ),
        ],
    },
    {
        id: 'timoneiro',
        nome: 'Timoneiro',
        resumo: 'Conduz embarcações com maestria: combate naval, condução, controle e desastres naturais.',
        pericias: ['atletismo', 'atuacao', 'intuicao', 'percepcao', 'persuasao', 'prestidigitacao'],
        ferramenta: 'Ferramentas de Timoneiro',
        itens: [
            '1 mochila pequena',
            'livros de navegação e comportamento humano',
            '1 bússola à escolha (bússola, log pose, log pose de 3 agulhas)',
            '10 cordas',
            '1 tambor',
        ],
        testes: ['Conduzir veículos terrestres turbulentos', 'Executar manobras de combate em alto-mar', 'Estabilizar a embarcação após colisões'],
        tracos: [
            t(
                'combate-naval',
                'Combate (Condutor dos Mares)',
                'Investida: com a Ação de Combate da embarcação você atinge um navio ou estrutura a até 1,5 m com uma colisão controlada; Teste de Força ou Sabedoria igual ou superior à CR do alvo é sucesso (Cap. 14) e seu navio sofre só 3d10. Ritmo de Combate: com ao menos 1 canhão em operação, a embarcação faz 3 ataques adicionais, mais 2 por categoria de tamanho acima de Pequeno (com mais de 1 canhão, você escolhe qual). Estabilidade Absoluta: com o timoneiro entre o efetivo da navegação, o dano de colisão é sempre pela metade. Dados de Manobra: 2 por nível (sempre {dado:10}; no 10º, 20); quando o navio sofre dano, você rola e consome dados para reduzi-lo pelo resultado; todos voltam após um descanso longo.',
                {
                    usos: { formula: '2*@nivel', descanso: 'longo' },
                    acoes: [{ rotulo: 'Rolar 1 Dado de Manobra', tipo: 'rolar', rolagem: '1{dado:10}', usa: true }],
                },
            ),
            t(
                'conducao',
                'Condução (Condutor dos Mares)',
                'Manobras Ampliadas: as embarcações que você conduz executam até 6 Ações de Manobra em vez de 1. Eficiência da Tripulação: com o timoneiro no efetivo de navegação, a tripulação mínima cai em 10 (mínimo 1; tabela "Efetivo de Acordo com o Tamanho do Navio", Cap. 13). Ajudante Entendido: ao auxiliar um carpinteiro na construção, o tempo total cai pela metade. Forçando Limites: as embarcações que você conduz ignoram a redução de velocidade causada por dano (Cap. 14).',
            ),
            t(
                'controle',
                'Controle',
                'Cavalgar Correntes: fora de corrente de nível 0, você move o navio como se a corrente fosse de nível 2 a seu favor. Direção Absoluta: sofre só metade da redução de velocidade das correntes e mantém o controle da direção, mesmo em nível 3. Impulso: gastando 3 Ações de Manobra, o navio se move como em corrente de nível 3 a favor até o início do próximo turno do navio, com controle total. Surf Naval: gastando 4 Ações de Manobra, o navio se move de forma imprevisível por 1 minuto e todos os ataques contra ele têm desvantagem.',
            ),
            t(
                'manobrar-desastres',
                'Manobrar Desastres Naturais',
                'Testes de Desastre Natural contam como testes da sua profissão, com: Resiliência Náutica (ao falhar, dano pela metade; ao passar, nenhum dano); Reação Instintiva (se o resultado for "Maremoto", "Redemoinho" ou "Tufão", você manobra e sofre os efeitos de "Chuva"; uma vez por viagem); Controle Sob Pressão (uma vez por viagem, trata uma falha em Teste de Desastre Natural como sucesso).',
            ),
        ],
    },
];

/** "Não ter profissão" (4.5): em vez de uma profissão, 4 características e a incapacidade de aprender profissões. */
export const SEM_PROFISSAO: { nome: string; descricao: string; tracos: TracoDados[] } = {
    nome: 'Não ter profissão',
    descricao:
        'Você se dedica totalmente ao Estilo de Combate e a ajudar os companheiros nas tarefas deles. Fica incapaz de aprender qualquer profissão e não tem a perícia Ofício.',
    tracos: [
        t(
            'ajudante-perfeito',
            'Ajudante Perfeito',
            'Quando uma criatura faz um Teste de Atributo relacionado a qualquer profissão, você pode ajudá-la e dar +5 na jogada (em combate, exige a ação "Ajudar"). Até 3 usos; todos voltam no descanso longo.',
            { usos: longo(3), acoes: [{ rotulo: 'Ajudar (+5)', tipo: 'gastar', usa: true }] },
        ),
        t('foco', 'Foco', 'Você é proficiente em 2 perícias à sua escolha, exceto Haki, Sobrenatural e Sorte (escolhidas no assistente).'),
        t(
            'parceiro-de-treino',
            'Parceiro de Treino',
            'Você reduz pela metade (50%, para cima) o tempo de treinamento de uma criatura, desde que o treinamento não exija tutor. Nesse período, você não usa dias para os seus próprios treinamentos.',
        ),
        t(
            'tempo-livre',
            'Tempo Livre',
            'Por não dedicar tempo ao estudo de uma profissão, você pode assumir até 5 funções do navio (Cap. 13) sem ser impedido de treinar ou de ajudar nos treinamentos dos companheiros.',
        ),
    ],
};

export const profissaoPorId = (id: string | null | undefined): Profissao | undefined => PROFISSOES.find((p) => p.id === id);
export const graduacaoPorId = (id: number): Graduacao => GRADUACOES[Math.max(0, Math.min(3, id))];

/** Níveis em que dá para aprender uma profissão nova ou subir a graduação (Avanço Planejado). */
export const NIVEIS_DE_PROFISSAO = [5, 10, 15, 20];

/** Perícias que o Foco não aceita. */
export const FOCO_EXCLUI = ['haki', 'sobrenatural', 'sorte', 'oficio'];

/** Os benefícios acumulativos das graduações (4.2). */
export const BENEFICIOS_DA_GRADUACAO: Record<1 | 2 | 3, TracoDados> = {
    1: t(
        'especialista',
        'Graduação: Especialista',
        'Suas habilidades passam a ser amplamente reconhecidas e você é identificado pela Profissão em que investiu. Você pode escolher ter vantagem em qualquer Teste de Atributo relacionado à sua profissão, 3 vezes; todos os usos voltam ao final de um descanso longo.',
        {
            usos: longo(3),
            acoes: [{ rotulo: 'Vantagem no teste da profissão', tipo: 'gastar', usa: true, acao: 'livre' }],
        },
    ),
    2: t(
        'mestre',
        'Graduação: Mestre',
        'Você já se destaca no meio, e outros profissionais reconhecem suas capacidades. Sempre que fizer um Teste de Atributo relacionado à sua profissão, você trata qualquer resultado de 9 ou menos no d20 como 10.',
        { etiquetas: ['Teste da profissão: d20 de 9 ou menos conta 10'] },
    ),
    3: t(
        'grao-mestre',
        'Graduação: Grão-Mestre',
        'Você está entre os melhores da sua área, com potencial de referência mundial. Ao falhar em um Teste de Atributo relacionado à sua profissão, pode considerá-lo bem-sucedido. 3 usos; você recupera 1 uso ao final de cada descanso longo.',
        {
            usos: longo(3),
            acoes: [{ rotulo: 'Falha vira sucesso', tipo: 'gastar', usa: true, acao: 'livre' }],
        },
    ),
};

// Montarias e veículos (cap. 8.6) e despesas de estilo de vida (cap. 8.5).
import type { CategoriaId, ItemDoCatalogo } from './tipos.ts';

const v = (
    id: string,
    nome: string,
    categoria: CategoriaId,
    preco: number,
    peso: number,
    descricao: string,
    extra: Partial<ItemDoCatalogo> = {},
): ItemDoCatalogo => ({
    id,
    nome,
    categoria,
    tipo: 'item',
    raridade: 'comum',
    preco,
    peso,
    descricao,
    equipavel: false,
    loja: true,
    ...extra,
});

export const REGRAS_DE_MONTARIAS =
    'Um animal que puxe uma carruagem, carroça, biga, trenó ou vagão transporta até cinco vezes a sua capacidade de carga básica (incluindo o peso do veículo); vários animais somam as capacidades. Selas específicas são necessárias para montar criaturas voadoras ou aquáticas. Se você for proficiente com o tipo de veículo (terrestre ou aquático), adiciona o Bônus de Proficiência aos Testes para controlá-lo em situações difíceis. Barcos de quilha e a remo servem em lagos e rios, não vencem correntezas muito fortes e podem ser puxados por animais de tração pelas margens (um barco a remo pesa cerca de 45 kg por terra). Montarias voadoras ou aquáticas geralmente não estão à venda: exigem proteger um ovo e criar a criatura, ou negociar com a montaria.';

export const BARCOS: ItemDoCatalogo[] = [
    v('bote', 'Bote', 'barcos', 160000, 0, 'Deslocamento: correnteza. Capacidade de carga: 210 kg.', { pesoTexto: 'Carga: 210 kg' }),
    v('barco', 'Barco', 'barcos', 200000, 0, 'Deslocamento: correnteza. Capacidade de carga: 240 kg.', { pesoTexto: 'Carga: 240 kg' }),
    v(
        'barco-a-remo',
        'Barco a Remo',
        'barcos',
        240000,
        45,
        'Deslocamento: correnteza + 2 nós (4 km/h). Capacidade de carga: 220 kg. Pesa cerca de 45 kg, caso seja transportado por terra.',
        { pesoTexto: 'Carga: 220 kg' },
    ),
];

export const MONTARIAS: ItemDoCatalogo[] = [
    v('burro-ou-mula', 'Burro ou Mula', 'montarias', 300000, 0, 'Deslocamento: 12 m. Capacidade de carga: 210 kg.', { pesoTexto: 'Carga: 210 kg' }),
    v('camelo', 'Camelo', 'montarias', 1000000, 0, 'Deslocamento: 15 m. Capacidade de carga: 240 kg.', { pesoTexto: 'Carga: 240 kg' }),
    v('cavalo-de-montaria', 'Cavalo de Montaria', 'montarias', 2000000, 0, 'Deslocamento: 18 m. Capacidade de carga: 220 kg.', {
        pesoTexto: 'Carga: 220 kg',
    }),
    v('cavalo-pesado', 'Cavalo Pesado', 'montarias', 1000000, 0, 'Deslocamento: 12 m. Capacidade de carga: 270 kg.', { pesoTexto: 'Carga: 270 kg' }),
    v('elefante', 'Elefante', 'montarias', 6000000, 0, 'Deslocamento: 12 m. Capacidade de carga: 660 kg.', { pesoTexto: 'Carga: 660 kg' }),
];

export const ARREIOS: ItemDoCatalogo[] = [
    v('alforje', 'Alforje', 'arreios', 15000, 4, 'Bolsa de carga para montarias.'),
    v('carroca', 'Carroça', 'arreios', 30000, 100, 'Veículo de tração.'),
    v('carruagem', 'Carruagem', 'arreios', 80000, 300, 'Veículo de tração.'),
    v('freio-e-redea', 'Freio e Rédea', 'arreios', 10000, 0.5, 'Arreio para controlar a montaria.'),
    v('treno', 'Trenó', 'arreios', 2000, 150, 'Veículo de tração para neve.'),
];

const SELA =
    'Uma sela militar fixa o cavaleiro com mais firmeza à montaria, concedendo vantagem em quaisquer Testes realizados para manter-se montado. Selas específicas são necessárias para montar criaturas voadoras ou aquáticas.';
export const SELAS: ItemDoCatalogo[] = [
    v('sela-compacta', 'Sela Compacta', 'selas', 100, 7.5, `Sela compacta. ${SELA}`),
    v('sela-exotica', 'Sela Exótica', 'selas', 6000, 20, `Sela exótica. ${SELA}`),
    v('sela-militar', 'Sela Militar', 'selas', 2000, 15, `Sela militar. ${SELA}`),
    v('sela-de-viagem', 'Sela de Viagem', 'selas', 1000, 12.5, `Sela de viagem. ${SELA}`),
];

const vida = (id: string, nome: string, preco: number | null, texto: string, precoTexto?: string): ItemDoCatalogo => ({
    id: `vida-${id}`,
    nome: `Estilo de vida ${nome}`,
    categoria: 'estilo-de-vida',
    tipo: 'servico',
    raridade: 'comum',
    preco,
    ...(precoTexto ? { precoTexto } : {}),
    unidade: 'dia',
    peso: 0,
    descricao: texto,
    equipavel: false,
    loja: preco !== null,
});

export const REGRA_DO_ESTILO_DE_VIDA =
    'O estilo de vida cobre acomodações, alimentação, bebidas, outras necessidades básicas (quando não estiver embarcado) e a manutenção do equipamento. No início de cada semana ou mês (à sua escolha), escolha um estilo de vida e pague o valor (os preços são por dia: para 30 dias, multiplique por 30). Ele pode variar de um período para outro. Um estilo elevado facilita contatos com pessoas influentes, mas atrai ladrões; uma vida desleixada passa despercebida ao crime organizado, mas raramente oferece boas conexões.';

export const ESTILOS_DE_VIDA: ItemDoCatalogo[] = [
    vida(
        'miseravel',
        'Miserável',
        null,
        'Você vive em condições desumanas. Sem sequer um teto, abriga-se onde for possível: esgueirando-se em celeiros, aconchegando-se em barris vazios ou dependendo da generosidade de pessoas em melhores condições. Violência, doenças e fome o seguem onde quer que vá, e outros miseráveis cobiçam suas armas e equipamentos. Você está abaixo da maioria das pessoas.',
        'Sem custo (–)',
    ),
    vida(
        'esqualido',
        'Esquálido',
        2000,
        'Você vive em um estábulo com goteiras, uma cabana com piso enlameado fora da cidade ou em uma pensão infestada de vermes na pior região urbana. Tem algum abrigo contra climas mais incômodos, mas vive cercado por desespero e violência, doenças, fome e degradação. As proteções legais são escassas e a maioria das pessoas nesse estilo de vida sofreu grandes perdas.',
    ),
    vida(
        'pobre',
        'Pobre',
        5000,
        'Sobreviver sem os confortos típicos de uma comunidade estável: alimentação simples, roupas surradas, alojamentos humildes e condições instáveis (um quarto em um cortiço ou a sala comum acima de uma loja ou bar). Conta com algumas proteções legais, mas ainda enfrenta violência, crime e doença. Comum entre trabalhadores não qualificados, vendedores ambulantes, traficantes, ladrões e mercenários.',
    ),
    vida(
        'modesto',
        'Modesto',
        10000,
        'Mantém você afastado das favelas e garante a manutenção do seu equipamento. Você reside em uma área mais antiga da cidade, alugando um quarto em uma pensão, estalagem ou templo. Não passa fome nem sede, e as condições são limpas, ainda que simples. Inclui marinheiros de baixa patente com suas famílias, trabalhadores, estudantes e pequenos comerciantes.',
    ),
    vida(
        'confortavel',
        'Confortável',
        20000,
        'Poder comprar roupas de boa qualidade e manter seu equipamento com facilidade. Você vive em uma pequena casa de campo em um bairro de classe média ou em um quarto privativo em um belo hotel. Associado a mercadores, artesãos qualificados e oficiais da Marinha.',
    ),
    vida(
        'rico',
        'Rico',
        70000,
        'Uma vida luxuosa, sem implicar status nobre: como um comerciante próspero, um servidor favorecido da realeza ou o proprietário de pequenas empresas. Mora em uma casa espaçosa em uma boa região da cidade ou em uma suíte confortável de um hotel de renome, com provavelmente uma pequena equipe de funcionários.',
    ),
    vida(
        'aristocratico',
        'Aristocrático',
        100000,
        'Uma vida de fartura e sofisticação: circula entre os grupos mais poderosos, com excelente moradia, janta nos restaurantes mais requintados, veste roupas dos melhores alfaiates e é servido por empregados. Recebe convites para a alta sociedade e passa as noites com políticos, líderes militares e nobres. Quanto maior a riqueza, maior o risco de ser envolvido em intrigas políticas.',
        '฿ 100.000 ou mais',
    ),
];

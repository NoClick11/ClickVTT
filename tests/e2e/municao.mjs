// Ponta a ponta da munição, no navegador (Playwright), contra a mesa fixa "E2E Quick Draw (não apagar)":
//   npm run e2e:municao        (app em http://localhost:8000 com o Vite; variáveis: APP_URL, CONTAINER, CHROME_PATH, MOSTRAR=1)
// Cobre: escolher a munição ao atacar com o Mosquete, Kairoseki (Enfraquecido), Técnica de arma de fogo gastando a munição do Requisito,
// Bola Explosiva (Salvaguarda em área) e o mestre entregando um item do catálogo. Confere o que o SERVIDOR decidiu (php artisan e2e:estado).
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const APP = process.env.APP_URL ?? 'http://localhost:8000';
const CONTAINER = process.env.CONTAINER ?? 'clickvtt-laravel.test-1';
const artisan = (cmd) => JSON.parse(execSync(`docker exec ${CONTAINER} php artisan ${cmd}`, { encoding: 'utf8' }).trim().split('\n').pop());
const achar = () => {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    const base = path.join(os.homedir(), '.cache/ms-playwright');
    return path.join(
        base,
        fs
            .readdirSync(base)
            .filter((d) => d.startsWith('chromium-'))
            .sort()
            .pop(),
        'chrome-linux64/chrome',
    );
};

let falhas = 0;
const confere = (ok, texto, detalhe = '') => {
    console.log(`${ok ? '  ✔' : '  ✖'} ${texto}${!ok && detalhe ? `  → ${detalhe}` : ''}`);
    if (!ok) falhas++;
};
const etapa = (t) => console.log(`\n${t}`);

// Posições na tela (janela 1500×950, zoom inicial): o Atirador no centro; Perto, Fruta (colada a ele) e Aliado à direita.
const TELA = { perto: [865, 575], fruta: [865, 608], aliado: [831, 575] };

const mesa = artisan('e2e:preparar-mesa');
const navegador = await chromium.launch({ executablePath: achar(), args: ['--no-sandbox'], headless: !process.env.MOSTRAR });
const erros = [];
const paginas = {};
const entrar = async (quem) => {
    const page = await navegador.newPage({ viewport: { width: 1500, height: 950 }, extraHTTPHeaders: { 'X-E2E': '1' } });
    page.on('pageerror', (e) => erros.push(`${quem}: ${e.message.slice(0, 160)}`));
    await page.goto(`${APP}/convite/${mesa.token}`);
    await page.waitForLoadState('networkidle');
    await page.getByText(quem, { exact: true }).first().click();
    const botao = page.getByRole('button', { name: /entrar/i });
    if (await botao.count()) await botao.first().click();
    await page.waitForURL(/\/jogo\//, { timeout: 15000 });
    await page.waitForTimeout(2500);
    paginas[quem] = page;

    return page;
};
const abrirAba = async (page, nome) => {
    const aba = page.getByRole('tab', { name: nome, exact: true });
    await aba.click();
    if ((await aba.getAttribute('aria-selected')) !== 'true') await aba.click();
    await page.waitForTimeout(300);
};
const textoDoChat = async (page) =>
    (
        await page
            .locator('ol[aria-live="polite"]')
            .innerText()
            .catch(() => '')
    ).replace(/\s+/g, ' ');
const mirar = async (page, [x, y]) => {
    await page.getByRole('button', { name: /^Mirar/ }).click();
    await page.mouse.click(x, y);
    await page.waitForTimeout(500);
};
const abrirFicha = async (page) => {
    await abrirAba(page, 'Personagens');
    await page.getByLabel('Abrir a ficha de AtiradorE2E').click();
    await page.waitForTimeout(1200);
};
const abaChat = (page) => abrirAba(page, 'Chat');

try {
    const jogador = await entrar('JogadorE2E');
    const mestre = await entrar('MestreE2E');

    etapa('1. Mosquete: o clique abre a lista de munições que servem a ele (só as do nome certo)');
    await mirar(jogador, TELA.fruta);
    await abrirFicha(jogador);
    await jogador.getByRole('button', { name: /^Atacar com Mosquete/ }).click();
    await jogador.waitForTimeout(400);
    const lista = jogador.getByRole('list', { name: 'Munição para Mosquete' });
    const textoLista = (await lista.innerText()).replace(/\s+/g, ' ');
    confere(/Munição Esférica.*×5/.test(textoLista), 'lista a Munição Esférica ×5', textoLista);
    confere(/Munição Perfurante.*×3/.test(textoLista), 'lista a Munição Perfurante ×3');
    confere(/Munição de Kairoseki.*×2/.test(textoLista), 'lista a Munição de Kairoseki ×2');
    confere(!/Flecha|Bola/.test(textoLista), 'não lista flecha nem bola (outras armas)', textoLista);

    etapa('2. Kairoseki na Fruta (usuária de Akuma no Mi): gasta 1 unidade e o card oferece o Enfraquecido');
    await lista.getByRole('button', { name: /Kairoseki/ }).click();
    await jogador.waitForTimeout(1500);
    await abaChat(jogador);
    let s = artisan('e2e:estado');
    confere(s.qtds['municao-de-kairoseki'] === 1, 'servidor: Kairoseki 2 → 1', String(s.qtds['municao-de-kairoseki']));
    let chat = await textoDoChat(jogador);
    const acertou = /Acerta|Crítico/.test(chat);
    if (acertou) {
        const botaoKairoseki = jogador.getByRole('button', { name: /Aplicar Enfraquecido/ });
        confere((await botaoKairoseki.count()) === 1, 'o card mostra "Aplicar Enfraquecido (Kairoseki)"');
        await botaoKairoseki.click();
        await jogador.waitForTimeout(1500);
        s = artisan('e2e:estado');
        confere(s.condicoes.fruta.includes('enfraquecido'), 'servidor: a Fruta recebeu Enfraquecido', JSON.stringify(s.condicoes));
        confere(s.duracoes_fruta.enfraquecido?.turnos === 1, 'servidor: dura até o fim do próximo turno dela (1)', JSON.stringify(s.duracoes_fruta));
        confere(
            (await jogador.getByRole('button', { name: /Aplicar Enfraquecido/ }).count()) === 0,
            'o botão some depois de usado (uma vez por ataque)',
        );
        confere(/Kairoseki/.test(await textoDoChat(jogador)), 'o chat avisa o efeito');
    } else console.log('  (o ataque errou: rode de novo para ver o efeito)');

    etapa('3. Kairoseki no Perto (não usa Akuma no Mi): o servidor recusa o efeito');
    await mirar(jogador, TELA.perto);
    await abrirFicha(jogador);
    await jogador.getByRole('button', { name: /^Atacar com Mosquete/ }).click();
    await jogador
        .getByRole('list', { name: 'Munição para Mosquete' })
        .getByRole('button', { name: /Kairoseki/ })
        .click();
    await jogador.waitForTimeout(1500);
    await abaChat(jogador);
    s = artisan('e2e:estado');
    confere((s.qtds['municao-de-kairoseki'] ?? 0) === 0, 'servidor: Kairoseki 1 → 0');
    if (
        /Acerta|Crítico/.test((await textoDoChat(jogador)).split('Kairoseki').pop() ?? '') ||
        (await jogador.getByRole('button', { name: /Aplicar Enfraquecido/ }).count())
    ) {
        await jogador
            .getByRole('button', { name: /Aplicar Enfraquecido/ })
            .first()
            .click();
        await jogador.waitForTimeout(1200);
        confere(!artisan('e2e:estado').condicoes.perto.includes('enfraquecido'), 'servidor: o Perto NÃO ficou Enfraquecido');
    }
    await abrirFicha(jogador);
    await jogador.getByRole('button', { name: /^Atacar com Mosquete/ }).click();
    confere(
        (await jogador
            .getByRole('list', { name: 'Munição para Mosquete' })
            .getByRole('button', { name: /Kairoseki/ })
            .count()) === 0,
        'sem unidades, a Kairoseki sai da lista',
    );
    await jogador.getByLabel('Fechar ficha').click();

    etapa('4. Técnica de arma de fogo: "Shooting Stars" (20 munições) sem munição suficiente fica bloqueada');
    await abrirFicha(jogador);
    await jogador.getByText('Técnicas', { exact: true }).first().click();
    await jogador.waitForTimeout(500);
    const estrelas = jogador.getByRole('button', { name: /^Usar Shooting Stars/ });
    confere(await estrelas.isDisabled(), 'o botão Usar de Shooting Stars está desabilitado');
    confere(
        /Faltam munições/.test((await estrelas.getAttribute('title')) ?? ''),
        'o motivo diz que faltam munições',
        (await estrelas.getAttribute('title')) ?? '',
    );

    etapa('5. "Stunning Shot" (2 munições esféricas): marca a linha no mapa e gasta 2 esféricas + 10 PP');
    const antes = artisan('e2e:estado');
    await jogador.getByRole('button', { name: /^Usar Stunning Shot/ }).click();
    await jogador.waitForTimeout(1200);
    await jogador.mouse.move(TELA.perto[0] + 20, TELA.perto[1]);
    await jogador.waitForTimeout(300);
    await jogador.mouse.click(TELA.perto[0] + 20, TELA.perto[1]);
    await jogador.waitForTimeout(2000);
    s = artisan('e2e:estado');
    confere(s.qtds['municao-esferica'] === antes.qtds['municao-esferica'] - 2, 'servidor: esféricas 5 → 3', String(s.qtds['municao-esferica']));
    confere(s.pp === antes.pp - 10, 'servidor: PP 80 → 70', String(s.pp));
    confere(s.qtds['municao-perfurante'] === 3, 'servidor: as perfurantes ficaram intactas');

    etapa('6. Munição insuficiente do tipo pedido: "Death Shower" (12 perfurantes) fica bloqueada com 3');
    await abrirFicha(jogador);
    await jogador.getByText('Técnicas', { exact: true }).first().click();
    await jogador.waitForTimeout(500);
    confere(await jogador.getByRole('button', { name: /^Usar Death Shower/ }).isDisabled(), 'Death Shower (12 perfurantes) bloqueada com 3');
    await jogador.getByLabel('Fechar ficha').click();

    etapa('7. Bola Explosiva: equipa o Canhão, atira no Perto e explode em volta dele');
    await abrirFicha(jogador);
    await jogador.getByText('Inventário', { exact: true }).first().click();
    await jogador.waitForTimeout(500);
    await jogador.getByRole('button', { name: 'Canhão: não equipado' }).click();
    await jogador.waitForTimeout(800);
    confere(artisan('e2e:estado').qtds.canhao === 1, 'o Canhão está no inventário (equipado agora)');
    await jogador.getByLabel('Fechar ficha').click();
    await mirar(jogador, TELA.perto);
    await abrirFicha(jogador);
    await jogador.getByRole('button', { name: /^Atacar com Canhão/ }).click();
    const listaCanhao = jogador.getByRole('list', { name: 'Munição para Canhão' });
    const textoCanhao = (await listaCanhao.innerText()).replace(/\s+/g, ' ');
    confere(
        /Bola Explosiva.*×2/.test(textoCanhao) && !/Esférica|Flecha|Kairoseki/.test(textoCanhao),
        'o Canhão lista só a Bola Explosiva (×2)',
        textoCanhao,
    );
    await listaCanhao.getByRole('button', { name: /Bola Explosiva/ }).click();
    await jogador.waitForTimeout(1500);
    await abaChat(jogador);
    s = artisan('e2e:estado');
    confere(s.qtds['bola-explosiva'] === 1, 'servidor: Bola Explosiva 2 → 1', String(s.qtds['bola-explosiva']));
    const explodir = jogador.getByRole('button', { name: /^Explodir/ });
    if (/Acerta|Crítico/.test(await textoDoChat(jogador)) && (await explodir.count())) {
        await explodir.click();
        await jogador.waitForTimeout(800);
        await jogador.mouse.move(TELA.perto[0], TELA.perto[1]);
        await jogador.mouse.click(TELA.perto[0], TELA.perto[1]);
        await jogador.waitForTimeout(2000);
        s = artisan('e2e:estado');
        const card = s.cards.find((c) => c.nome === 'Bola Explosiva');
        confere(!!card, 'servidor: abriu o card "Bola Explosiva"', JSON.stringify(s.cards.map((c) => c.nome)));
        confere(card?.cd === 16 && card?.dano === '3d6', 'a CD é 16 e o dano 3d6 (do livro, não a do atirador)', JSON.stringify(card));
        const alvos = [...(card?.alvos ?? [])].sort().join(',');
        confere(
            alvos === 'AliadoE2E,FrutaE2E,PertoE2E',
            'a explosão pega o Perto e quem está colado (Fruta, Aliado), sem o Oculto da camada do Mestre',
            alvos,
        );
        confere((await jogador.getByRole('button', { name: /^Explodir/ }).count()) === 0, 'o botão Explodir some depois de usado');
        // o mestre rola a Salvaguarda de cada NPC: o dano de Fogo sai sozinho no fim
        await mestre.reload();
        await mestre.waitForTimeout(2500);
        await abaChat(mestre);
        const pvAntes = artisan('e2e:estado');
        for (let i = 0; i < 3; i++) {
            await mestre
                .getByRole('button', { name: /^Rolar DES/ })
                .first()
                .click();
            await mestre.waitForTimeout(900);
        }
        const depois = artisan('e2e:estado');
        confere(depois.cards.find((c) => c.nome === 'Bola Explosiva')?.estado === 'resolvido', 'servidor: a Salvaguarda coletiva foi resolvida');
        confere(
            depois.pv.perto < pvAntes.pv.perto && depois.pv_fruta < pvAntes.pv_fruta,
            'servidor: o Perto e a Fruta levaram dano de Fogo (3d6 ou metade)',
            `${pvAntes.pv.perto}→${depois.pv.perto}, ${pvAntes.pv_fruta}→${depois.pv_fruta}`,
        );
        confere(depois.pv.oculto === 400, 'servidor: o Oculto (camada do Mestre) não levou dano');
    } else console.log('  (o ataque errou: rode de novo para ver a explosão)');

    etapa('8. O mestre entrega um item do catálogo (Daito) ao Atirador pelo botão "Dar", sem cobrar');
    await abrirAba(mestre, 'Itens');
    await mestre.getByRole('button', { name: 'Catálogo', exact: true }).first().click();
    await mestre.waitForTimeout(800);
    // um `npm run build` com a mesa aberta muda o hash do manifest: em desenvolvimento isso NÃO pode recarregar a página inteira na próxima ação
    const manifesto = path.join(process.cwd(), 'public/build/manifest.json');
    const manifestoOriginal = fs.existsSync(manifesto) ? fs.readFileSync(manifesto, 'utf8') : null;
    await mestre.evaluate(() => (window.__marca = 'viva'));
    if (manifestoOriginal !== null) fs.writeFileSync(manifesto, `${manifestoOriginal}\n`);
    await mestre.getByLabel('Personagem que recebe').selectOption({ label: 'AtiradorE2E' });
    await mestre
        .getByRole('searchbox')
        .or(mestre.getByPlaceholder(/buscar/i))
        .first()
        .fill('Daito');
    await mestre.waitForTimeout(500);
    await mestre.getByLabel('Quantidade a entregar').fill('2');
    await mestre.getByRole('button', { name: /^Dar$/ }).first().click();
    await mestre.waitForTimeout(1500);
    confere((await mestre.getByText(/entregue a AtiradorE2E/).count()) > 0, 'a janela confirma "entregue a AtiradorE2E"');
    if (manifestoOriginal !== null) fs.writeFileSync(manifesto, manifestoOriginal);
    confere((await mestre.evaluate(() => window.__marca)) === 'viva', 'dar um item não recarrega a página inteira (nem com um build novo por baixo)');
    s = artisan('e2e:estado');
    confere(s.qtds.daito === 2, 'servidor: o Atirador recebeu 2 Daito', JSON.stringify(s.qtds));
    await mestre.keyboard.press('Escape');
    await mestre.waitForTimeout(500);

    etapa('9. O mestre cria uma munição e uma arma por munição à mão e as entrega');
    const criarItem = async (nome, aoPreencher) => {
        await abrirAba(mestre, 'Itens');
        await mestre.getByRole('button', { name: /Novo item/ }).click();
        await mestre.waitForTimeout(600);
        await mestre.getByLabel('Nome do item').fill(nome);
        await aoPreencher();
        await mestre.getByRole('button', { name: 'Criar', exact: true }).click();
        await mestre.waitForTimeout(1200);
    };
    await criarItem('Bala Trovão', async () => {
        await mestre.getByRole('radio', { name: 'Munição', exact: true }).click();
        await mestre.getByLabel('Dado de dano da munição, ex.: 1d8').fill('2d6');
        await mestre.getByLabel('Tipo de dano da munição').fill('Trovão');
        await mestre.getByLabel('Efeito especial da munição').fill('Estrondo ensurdecedor');
    });
    await criarItem('Rifle do Mestre', async () => {
        await mestre.getByRole('radio', { name: 'Arma', exact: true }).click();
        await mestre.getByLabel(/Dano pela munição/).check();
    });
    await abrirAba(mestre, 'Personagens');
    await mestre.getByLabel('Abrir a ficha de AtiradorE2E').click();
    await mestre.waitForTimeout(1200);
    await mestre
        .getByRole('tab', { name: 'Editar', exact: true })
        .or(mestre.getByText('Editar', { exact: true }))
        .first()
        .click();
    await mestre.getByText('Inventário', { exact: true }).first().click();
    await mestre.waitForTimeout(500);
    for (const nome of ['Bala Trovão', 'Rifle do Mestre']) {
        await mestre.getByLabel('Item da mesa').selectOption({ label: nome });
        await mestre.getByRole('button', { name: 'Entregar', exact: true }).click();
        await mestre.waitForTimeout(800);
    }
    await mestre
        .getByRole('tab', { name: 'Jogar', exact: true })
        .or(mestre.getByText('Jogar', { exact: true }))
        .first()
        .click();
    s = artisan('e2e:estado');
    confere(
        Object.keys(s.qtds).some((k) => k.startsWith('#')) && Object.keys(s.qtds).filter((k) => k.startsWith('#')).length === 2,
        'servidor: o Atirador tem os 2 itens criados à mão',
        JSON.stringify(s.qtds),
    );
    await mestre.getByLabel('Fechar ficha').click();

    etapa('10. O jogador equipa o Rifle e atira com a Bala Trovão (a munição criada à mão), que dá o dano 2d6 de Trovão');
    // nova rodada: os ataques do turno do Atirador já foram gastos (limite por Ação); o mestre passa os 6 turnos até a vez dele
    for (let i = 0; i < 6; i++) {
        await mestre
            .getByRole('button', { name: /pr[óo]ximo/i })
            .first()
            .click();
        await mestre.waitForTimeout(1000);
    }
    await jogador.reload();
    await jogador.waitForTimeout(2500);
    await mirar(jogador, TELA.perto);
    await abrirFicha(jogador);
    await jogador.getByText('Inventário', { exact: true }).first().click();
    await jogador.waitForTimeout(500);
    await jogador.getByRole('button', { name: 'Rifle do Mestre: não equipado' }).click();
    await jogador.waitForTimeout(800);
    await jogador.getByText('Detalhes', { exact: true }).first().click();
    await jogador.waitForTimeout(500);
    await jogador.getByRole('button', { name: /^Atacar com Rifle do Mestre/ }).click();
    const listaRifle = jogador.getByRole('list', { name: 'Munição para Rifle do Mestre' });
    const textoRifle = (await listaRifle.innerText()).replace(/\s+/g, ' ');
    confere(/Bala Trovão.*2d6.*Trovão/.test(textoRifle), 'o Rifle criado à mão lista a Bala Trovão (2d6 Trovão)', textoRifle);
    confere(/Munição Esférica/.test(textoRifle), 'e também as munições do catálogo (arma sem item do catálogo aceita qualquer uma)');
    await listaRifle.getByRole('button', { name: /Bala Trovão/ }).click();
    await jogador.waitForTimeout(1500);
    await abaChat(jogador);
    chat = await textoDoChat(jogador);
    confere(/Rifle do Mestre \(Bala Trovão\)/.test(chat), 'o card leva o nome da arma e da munição');
    confere(/Estrondo ensurdecedor/.test(chat) || /Falha crítica/.test(chat), 'o card lembra o efeito especial da munição');
    s = artisan('e2e:estado');
    confere(
        Object.entries(s.qtds)
            .filter(([k]) => k.startsWith('#'))
            .some(([, v]) => v === 0 || v === undefined) || Object.entries(s.qtds).filter(([k]) => k.startsWith('#')).length === 1,
        'servidor: a Bala Trovão foi gasta (era 1 unidade)',
        JSON.stringify(s.qtds),
    );

    etapa('11. Aba Características: as que se usam ficam na frente e só o mestre mexe nas bolinhas de uso');
    await abrirFicha(jogador);
    await jogador.getByText('Características', { exact: true }).first().click();
    await jogador.waitForTimeout(600);
    const nomesDoGrupo = async (page, titulo) =>
        page.locator(`section[aria-label="${titulo}"] > ul > li`).evaluateAll((lis) =>
            lis.map(
                (li) =>
                    li
                        .querySelector('span.block')
                        ?.textContent?.trim()
                        .split(/\s{2,}/)[0] ?? '',
            ),
        );
    const ativas = await nomesDoGrupo(jogador, 'Ativas');
    const comUso = ['Franco Atirador: Carga de Adrenalina', 'Franco Atirador: Alvo Travado'];
    confere(
        ativas.slice(0, 3).filter((n) => comUso.some((c) => n.startsWith(c))).length === 2,
        'em Ativas, as que têm usos vêm primeiro',
        ativas.slice(0, 4).join(' | '),
    );
    const passivas = await nomesDoGrupo(jogador, 'Passivas');
    confere(
        passivas.slice(0, 5).some((n) => n.startsWith('Emissário da Morte')),
        'em Passivas, as com usos e efeitos vêm primeiro',
        passivas.slice(0, 6).join(' | '),
    );
    const bolinha = jogador.getByLabel('Uso 1').first();
    confere(await bolinha.isDisabled(), 'para o jogador, a bolinha de uso está desabilitada');
    await bolinha.click({ force: true }).catch(() => {});
    await jogador.waitForTimeout(600);
    confere((await bolinha.getAttribute('aria-pressed')) === 'true', 'clicar nela não gasta nem altera o uso');
    await jogador.getByLabel('Fechar ficha').click();
    await abrirAba(mestre, 'Personagens');
    await mestre.getByLabel('Abrir a ficha de AtiradorE2E').click();
    await mestre.waitForTimeout(1200);
    await mestre.getByText('Características', { exact: true }).first().click();
    await mestre.waitForTimeout(600);
    confere(await mestre.getByLabel('Uso 1').first().isEnabled(), 'para o mestre, a bolinha de uso continua habilitada');
    await mestre.getByLabel('Fechar ficha').click();

    etapa('12. O Ferreiro (de outro jogador) aprimora a arma do Atirador: revestir com Kairoseki e ampliar o alcance');
    const outro = await entrar('OutroE2E');
    const abrirFichaDe = async (page, nome) => {
        await abrirAba(page, 'Personagens');
        await page.getByLabel(`Abrir a ficha de ${nome}`).click();
        await page.waitForTimeout(1200);
    };
    await abrirFichaDe(outro, 'FerreiroE2E');
    await outro.getByText('Profissões', { exact: true }).first().click();
    await outro.waitForTimeout(600);
    const bloco = outro.getByLabel('Aprimorar ou consertar equipamento');
    await bloco.scrollIntoViewIfNeeded();
    await bloco.getByLabel('Dono do equipamento').selectOption({ label: 'AtiradorE2E' });
    await outro.waitForTimeout(800);
    const armasDoAtirador = (await bloco.getByLabel('Equipamento a aprimorar').locator('option').allInnerTexts()).join(' | ');
    confere(
        /Mosquete/.test(armasDoAtirador) && /Canhão/.test(armasDoAtirador),
        'o Ferreiro vê as armas do inventário do Atirador (de outra pessoa)',
        armasDoAtirador,
    );
    const antes12 = artisan('e2e:estado');
    await bloco.getByLabel('Aprimoramento').selectOption('kairoseki-arma');
    await bloco.getByLabel('Equipamento a aprimorar').selectOption({ label: 'Mosquete' });
    await bloco.getByRole('button', { name: 'Aprimorar', exact: true }).click();
    await outro.waitForTimeout(1800);
    s = artisan('e2e:estado');
    const quebrou = (await outro.getByText(/tira 1 natural/).count()) > 0; // 1 natural (5%): a regra do livro quebra a arma sem conserto
    if (quebrou)
        confere(
            !s.armas_atirador.some((a) => a.nome === 'Mosquete'),
            'servidor: 1 natural, o Mosquete quebrou e saiu do inventário (regra do livro; rode de novo para ver o revestimento)',
        );
    else
        confere(
            s.armas_atirador.some((a) => a.nome === 'Mosquete' && a.melhoria === 'kairoseki'),
            'servidor: o Mosquete do Atirador ficou revestido de Kairoseki',
            JSON.stringify(s.armas_atirador),
        );
    confere(
        s.ferreiro.lingotes === antes12.ferreiro.lingotes - 1 && s.ferreiro.belly < antes12.ferreiro.belly,
        'servidor: o Ferreiro gastou 1 lingote e dinheiro',
        JSON.stringify(s.ferreiro),
    );
    confere((await outro.getByText(/Gastou 1 lingote/).count()) > 0, 'a ficha do Ferreiro mostra o resultado');
    const sobraram = (await bloco.getByLabel('Equipamento a aprimorar').locator('option').allInnerTexts()).join(' | ');
    confere(!/Mosquete/.test(sobraram), 'o Mosquete já aprimorado (ou quebrado) sai da lista (uma melhoria por arma)', sobraram);
    await bloco.getByLabel('Aprimoramento').selectOption('alcance');
    await bloco.getByLabel('Equipamento a aprimorar').selectOption({ label: 'Canhão' });
    const alcanceAntes = s.armas_atirador.find((a) => a.nome === 'Canhão')?.alcanceMaximo;
    await bloco.getByRole('button', { name: 'Aprimorar', exact: true }).click();
    await outro.waitForTimeout(1800);
    s = artisan('e2e:estado');
    const canhao = s.armas_atirador.find((a) => a.nome === 'Canhão');
    if (!canhao) console.log('  (1 natural: o Canhão quebrou; rode de novo para ver o alcance ampliado)');
    else
        confere(
            canhao?.alcanceMaximo === alcanceAntes + 6 && canhao?.melhoria === 'alcance',
            'servidor: o alcance máximo do Canhão subiu 6 m',
            JSON.stringify(canhao),
        );
    await outro.getByLabel('Fechar ficha').click();

    etapa('13. Enfraquecido bloqueia as Técnicas da aba Akuma no Mi');
    await abrirFichaDe(outro, 'FerreiroE2E');
    await outro.getByText('Akuma no Mi', { exact: true }).first().click();
    await outro.waitForTimeout(600);
    const pulso = outro.getByRole('button', { name: /^Usar Pulso da Fruta/ });
    confere(await pulso.isEnabled(), 'sem a condição, "Usar Pulso da Fruta" está habilitado');
    await outro.getByLabel('Fechar ficha').click();
    await mirar(mestre, [731, 575]);
    await mestre.locator('select', { hasText: 'Aplicar efeito' }).first().selectOption({ label: 'Enfraquecido' });
    await mestre.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await mestre.waitForTimeout(1500);
    s = artisan('e2e:estado');
    confere(s.ferreiro.condicoes.includes('enfraquecido'), 'servidor: o Ferreiro recebeu Enfraquecido', JSON.stringify(s.ferreiro.condicoes));
    await abrirFichaDe(outro, 'FerreiroE2E');
    await outro.getByText('Akuma no Mi', { exact: true }).first().click();
    await outro.waitForTimeout(600);
    const bloqueado = outro.getByRole('button', { name: /^Usar Pulso da Fruta/ });
    confere(await bloqueado.isDisabled(), 'com Enfraquecido, "Usar Pulso da Fruta" fica desabilitado');
    confere(
        /Enfraquecido/.test((await bloqueado.getAttribute('title')) ?? ''),
        'o motivo diz "Enfraquecido"',
        (await bloqueado.getAttribute('title')) ?? '',
    );
} catch (e) {
    falhas++;
    console.log(`\n  ✖ o roteiro parou: ${e.message.split('\n')[0]}`);
    for (const [quem, page] of Object.entries(paginas))
        await page.screenshot({ path: path.join(os.tmpdir(), `e2e-falha-${quem}.png`) }).catch(() => {});
    console.log(`  (capturas em ${os.tmpdir()}/e2e-falha-*.png)`);
} finally {
    confere(erros.length === 0, 'nenhum erro de JavaScript na página', erros.join(' | '));
    await navegador.close();
}
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);

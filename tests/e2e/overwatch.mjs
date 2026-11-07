// Ponta a ponta do Overwatch (Atirador, Sniper 4º grau): a Vigília marca uma esfera no mapa (visível a todos), dispara um ataque quando uma criatura
// age ou se move nela, gasta 1 munição por ataque, a Salvaguarda de Constituição encerra o turno de quem falha e a Ação bônus move a esfera.
//   npm run e2e:overwatch      (app em http://localhost:8000 com o Vite; variáveis: APP_URL, CONTAINER, CHROME_PATH, MOSTRAR=1)
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
// janela 1500×950: o Atirador no centro; Perto 9 m à direita, Fruta colada a ele (abaixo), Aliado 1,5 m antes dele
const TELA = { atirador: [665, 575], perto: [865, 575], fruta: [865, 608] };

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
const abrirFichaDe = async (page, nome) => {
    await abrirAba(page, 'Personagens');
    await page.getByLabel(`Abrir a ficha de ${nome}`).click();
    await page.waitForTimeout(1200);
};
const abrirFichaTecnicas = async (page) => {
    await abrirAba(page, 'Personagens');
    await page.getByLabel('Abrir a ficha de AtiradorE2E').click();
    await page.waitForTimeout(1200);
    await page.getByText('Técnicas', { exact: true }).first().click();
    await page.waitForTimeout(500);
};
/** Uma ação do jogo feita pelo mestre direto na API (a mesma que a interface chama), na página dele. */
const api = (page, metodo, caminho, corpo) =>
    page.evaluate(
        async ([m, url, b]) => {
            const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) ?? [])[1] ?? '');
            const r = await fetch(url, {
                method: m,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': xsrf,
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-Jogador': String(window.__jogadorId),
                },
                body: b ? JSON.stringify(b) : undefined,
            });
            return r.status;
        },
        [metodo, `/jogo/${mesa.mesa}/${caminho}`, corpo],
    );

try {
    const jogador = await entrar('JogadorE2E');
    const mestre = await entrar('MestreE2E');
    await mestre.evaluate(() => (window.__jogadorId = Number(location.pathname.split('/').pop())));
    await jogador.evaluate(() => (window.__jogadorId = Number(location.pathname.split('/').pop())));

    etapa('1. O jogador usa o Overwatch: a ficha fecha e a esfera de 3 m segue o cursor, presa ao alcance do mosquete');
    await abrirFichaTecnicas(jogador);
    await jogador.getByRole('button', { name: /^Usar Overwatch/ }).click();
    await jogador.waitForTimeout(1200);
    confere((await jogador.getByText('Ficha · AtiradorE2E').count()) === 0, 'a ficha fechou sozinha para marcar a esfera');
    await jogador.mouse.move(TELA.perto[0], TELA.perto[1]);
    await jogador.waitForTimeout(400);
    await jogador.screenshot({ path: path.join(os.tmpdir(), 'e2e-overwatch-gabarito.png') });
    await jogador.mouse.click(TELA.perto[0], TELA.perto[1]);
    await jogador.waitForTimeout(2000);
    let s = artisan('e2e:estado');
    confere(s.vigia.length === 1 && s.vigia[0].rodadas === 10, 'servidor: 1 Vigília ativa por 10 rodadas', JSON.stringify(s.vigia));
    confere(s.vigia[0]?.zona.raio === 3, 'servidor: a esfera tem 3 m de raio', JSON.stringify(s.vigia));
    confere(s.pp === 72, 'servidor: PP 80 → 72', String(s.pp));
    confere(s.acoes_atirador.poderosa === 1, 'servidor: gastou a Ação poderosa', JSON.stringify(s.acoes_atirador));
    await mestre.waitForTimeout(500);
    await mestre.screenshot({ path: path.join(os.tmpdir(), 'e2e-overwatch-mestre.png') });
    await jogador.screenshot({ path: path.join(os.tmpdir(), 'e2e-overwatch-jogador.png') });
    console.log(`  (capturas: ${os.tmpdir()}/e2e-overwatch-*.png: a esfera aparece para o jogador e o mestre)`);

    etapa('2. Com a Vigília ativa o Atirador ataca nos turnos dos outros, quantas vezes o mestre mandar, sem gastar a Ação');
    const proximo = async () => {
        await mestre.getByLabel('Próximo turno').click();
        await mestre.waitForTimeout(1200);
    };
    await mirar(jogador, TELA.perto);
    await proximo(); // vez do Perto: não é o turno do Atirador
    s = artisan('e2e:estado');
    confere(s.atual === 'b', 'servidor: é a vez do Perto', String(s.atual));
    const gastasAntes = JSON.stringify(s.acoes_atirador);
    for (const n of [1, 2]) {
        await abrirFichaDe(jogador, 'AtiradorE2E');
        const botao = jogador.getByRole('button', { name: /^Atacar com Mosquete/ });
        confere(await botao.isEnabled(), `o botão de atacar com o Mosquete está habilitado no turno do Perto (ataque ${n})`);
        await botao.click();
        await jogador
            .getByRole('list', { name: 'Munição para Mosquete' })
            .getByRole('button', { name: /Esférica/ })
            .click();
        await jogador.waitForTimeout(1500);
        await jogador.getByLabel('Fechar ficha').click();
    }
    s = artisan('e2e:estado');
    confere(
        s.qtds['municao-esferica'] === 3,
        'servidor: 2 munições esféricas gastas pelo jogador na escolha dele (5 → 3)',
        String(s.qtds['municao-esferica']),
    );
    confere(JSON.stringify(s.acoes_atirador) === gastasAntes, 'servidor: nenhuma Ação do Atirador foi gasta', JSON.stringify(s.acoes_atirador));
    confere(s.vigia.length === 1, 'a Vigília continua ativa (atacar não a encerra)');
    confere(s.vigia_cards.length === 0, 'nada é disparado sozinho: o mestre comanda os ataques');

    etapa('3. Na vez do Atirador: a Ação bônus move a esfera até 6 m (só uma vez por turno)');
    for (let i = 0; i < 8 && artisan('e2e:estado').atual !== 'a'; i++) await proximo();
    confere(artisan('e2e:estado').atual === 'a', 'servidor: de volta à vez do Atirador');
    s = artisan('e2e:estado');
    confere(s.vigia.length === 1, 'a Vigília segue ativa (o Atirador ainda não agiu nem andou)', JSON.stringify(s.vigia));
    await abrirFichaTecnicas(jogador);
    await jogador.getByRole('button', { name: 'mover esfera' }).click();
    await jogador.waitForTimeout(800);
    await jogador.mouse.move(TELA.perto[0] - 300, TELA.perto[1]); // além de 6 m: o ponto fica preso em 6 m do centro atual
    await jogador.mouse.click(TELA.perto[0] - 300, TELA.perto[1]);
    await jogador.waitForTimeout(1500);
    const antes = s.vigia[0].zona;
    s = artisan('e2e:estado');
    const andou = ((s.vigia[0].zona.x - antes.x) ** 2 + (s.vigia[0].zona.y - antes.y) ** 2) ** 0.5 / (70 / 1.5);
    confere(andou > 5.5 && andou <= 6.05, `servidor: a esfera andou ${andou.toFixed(1)} m (limite 6 m)`);
    confere(s.acoes_atirador.bonus === 1, 'servidor: gastou a Ação bônus', JSON.stringify(s.acoes_atirador));
    await abrirFichaTecnicas(jogador);
    await jogador.getByRole('button', { name: 'mover esfera' }).click();
    await jogador.waitForTimeout(500);
    await jogador.mouse.click(TELA.perto[0], TELA.perto[1]);
    await jogador.waitForTimeout(1200);
    confere(
        JSON.stringify(artisan('e2e:estado').vigia[0].zona) === JSON.stringify(s.vigia[0].zona),
        'uma segunda Ação bônus no turno é recusada: a esfera não mexe',
    );

    etapa('4. Qualquer outra atividade do Atirador encerra a Vigília');
    await jogador.evaluate(() => (window.__jogadorId = Number(location.pathname.split('/').pop())));
    await api(jogador, 'POST', 'combate/acao', { personagem_id: mesa.atirador, categoria: 'padrao' });
    await jogador.waitForTimeout(1200);
    confere(artisan('e2e:estado').vigia.length === 0, 'servidor: a Vigília acabou quando o Atirador usou uma Ação');
    await abrirAba(jogador, 'Chat');
    confere(/Overwatch foi encerrada/.test(await textoDoChat(jogador)), 'o chat avisa que a Vigília foi encerrada');

    etapa('5. Sem a Vigília, fora do turno o ataque volta a ser bloqueado');
    await proximo(); // vez do Perto
    await abrirFichaDe(jogador, 'AtiradorE2E');
    const bloqueado = jogador.getByRole('button', { name: /^Atacar com Mosquete/ });
    confere(await bloqueado.isDisabled(), 'o botão de atacar fica desabilitado de novo fora do turno');
    confere(
        /seu turno/i.test((await bloqueado.getAttribute('title')) ?? ''),
        'o motivo diz que não é o turno dele',
        (await bloqueado.getAttribute('title')) ?? '',
    );
} catch (e) {
    falhas++;
    console.log(`\n  ✖ o roteiro parou: ${e.message.split('\n')[0]}`);
    for (const [quem, page] of Object.entries(paginas))
        await page.screenshot({ path: path.join(os.tmpdir(), `e2e-falha-${quem}.png`) }).catch(() => {});
} finally {
    confere(erros.length === 0, 'nenhum erro de JavaScript na página', erros.join(' | '));
    await navegador.close();
}
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);

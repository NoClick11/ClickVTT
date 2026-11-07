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

    etapa('2. O Perto (dentro da esfera) se move: aparece o card "pode atacar"; o jogador clica e o servidor gasta 1 munição e rola o ataque');
    const proximo = async () => {
        await mestre.getByLabel('Próximo turno').click();
        await mestre.waitForTimeout(1200);
    };
    await proximo(); // vez do Perto
    await mestre.mouse.move(TELA.perto[0], TELA.perto[1]);
    await mestre.mouse.down();
    await mestre.mouse.move(TELA.perto[0], TELA.perto[1] - 18, { steps: 5 });
    await mestre.mouse.up();
    await mestre.waitForTimeout(1500);
    s = artisan('e2e:estado');
    confere(
        s.vigia_cards.some((c) => c.alvo === 'PertoE2E' && c.motivo === 'se move' && c.estado === 'pendente'),
        'servidor: mover o Perto dentro da esfera abriu um card "se move"',
        JSON.stringify(s.vigia_cards),
    );
    await abrirAba(jogador, 'Chat');
    await jogador.waitForTimeout(800);
    const atacar = jogador.getByRole('button', { name: /^Atacar PertoE2E/ });
    confere((await atacar.count()) === 1, 'o card "Atacar PertoE2E" aparece no chat do jogador');
    confere(/se move dentro da esfera/.test(await textoDoChat(jogador)), 'o card diz que a criatura se move dentro da esfera');
    const municaoAntes = s.qtds['municao-esferica'];
    await atacar.click();
    await jogador.waitForTimeout(1800);
    s = artisan('e2e:estado');
    confere(
        s.qtds['municao-esferica'] === municaoAntes - 1,
        'servidor: 1 munição esférica gasta no ataque',
        `${municaoAntes} → ${s.qtds['municao-esferica']}`,
    );
    const chat = await textoDoChat(jogador);
    const acertou = /Acerta|Crítico/.test(chat);
    confere(acertou || /Erra|Falha crítica/.test(chat), `o card mostra o resultado do ataque (${acertou ? 'acerto' : 'erro'})`);
    if (acertou) {
        confere(s.pv.perto < 400, 'servidor: o dano da arma com a munição foi aplicado ao Perto', String(s.pv.perto));
        confere(/Salvaguarda de Constituição/.test(chat), 'o card mostra a Salvaguarda de Constituição do atingido');
        const card = s.vigia_cards.find((c) => c.alvo === 'PertoE2E');
        if (card?.salvaguarda === false) confere(s.atual !== 'b', 'servidor: falhou na Constituição e o turno do Perto acabou', String(s.atual));
        else console.log('  (o Perto passou na Constituição desta vez: o turno dele segue)');
    }

    etapa('3. O Perto age (Ação) dentro da esfera: novo card; quem está fora ou escondido na camada do Mestre não dispara');
    const status = (nome, categoria) => api(mestre, 'POST', 'combate/acao', { personagem_id: mesa[nome], categoria });
    await status('perto', 'padrao');
    await jogador.waitForTimeout(800);
    s = artisan('e2e:estado');
    confere(
        s.vigia_cards.some((c) => c.alvo === 'PertoE2E' && c.motivo === 'age' && c.estado === 'pendente'),
        'servidor: agir dentro da esfera abriu um card "age"',
        JSON.stringify(s.vigia_cards),
    );
    const antesDosCards = s.vigia_cards.length;
    await status('longe', 'padrao'); // 45 m: fora da esfera
    await status('oculto', 'padrao'); // dentro da esfera, mas na camada do Mestre: não é "criatura que você veja"
    s = artisan('e2e:estado');
    confere(
        s.vigia_cards.length === antesDosCards,
        'servidor: o Longe (fora) e o Oculto (camada do Mestre) não dispararam nada',
        JSON.stringify(s.vigia_cards),
    );
    await status('aliado', 'padrao'); // NPC do encontro a 1,5 m do Perto, dentro da esfera
    s = artisan('e2e:estado');
    confere(
        s.vigia_cards.some((c) => c.alvo === 'AliadoE2E'),
        'servidor: o Aliado (NPC não marcado como aliado, dentro da esfera) disparou',
    );
    await jogador
        .getByRole('button', { name: /^Não atacar/ })
        .first()
        .click(); // o jogador pode recusar um card
    await jogador.waitForTimeout(800);
    confere(
        artisan('e2e:estado').vigia_cards.some((c) => c.estado === 'ignorado'),
        'servidor: "Não atacar" marca o card como ignorado',
    );

    etapa('4. Na vez do Atirador: a Ação bônus move a esfera até 6 m (só uma vez por turno)');
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

    etapa('5. Qualquer outra atividade do Atirador encerra a Vigília');
    await jogador.evaluate(() => (window.__jogadorId = Number(location.pathname.split('/').pop())));
    await api(jogador, 'POST', 'combate/acao', { personagem_id: mesa.atirador, categoria: 'padrao' });
    await jogador.waitForTimeout(1200);
    confere(artisan('e2e:estado').vigia.length === 0, 'servidor: a Vigília acabou quando o Atirador usou uma Ação');
    await abrirAba(jogador, 'Chat');
    confere(/Overwatch foi encerrada/.test(await textoDoChat(jogador)), 'o chat avisa que a Vigília foi encerrada');
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

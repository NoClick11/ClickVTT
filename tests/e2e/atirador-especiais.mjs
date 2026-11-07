// Efeitos de Técnicas que a mesa comanda por botão (Atirador), no navegador: Execução (≤150 PV), Zona do Atirador (+60 PV temporários), Covering
// (desvantagem), Defesa Improvisada (soma 2d8 por PP) e a Execução Perfeita (dano 2×, gasta um uso). O Headshot depende de crítico natural: PHP.
//   node tests/e2e/atirador-especiais.mjs      (app em http://localhost:8000 com o Vite; MOSTRAR=1 abre a janela)
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
const TELA = { perto: [865, 575] };

const mesa = artisan('e2e:preparar-mesa');
// o Aliado (o primeiro da linha de tiro, o alvo que o mapa escolhe) com 100 PV (dentro dos 150 da Execução) e PP/munição de sobra para o roteiro
execSync(
    `docker exec ${CONTAINER} php artisan tinker --execute='$m=App\\Models\\Mesa::find(${mesa.mesa}); $a=$m->personagens()->where("nome","AtiradorE2E")->first(); $f=$a->ficha; $f["pp"]["atual"]=60; foreach($f["inventario"][0]["itens"] as $i=>$r){ if($r["qtd"]>1) $f["inventario"][0]["itens"][$i]["qtd"]=100; } $a->ficha=$f; $a->save(); $p=$m->personagens()->where("nome","AliadoE2E")->first(); $g=$p->ficha; $g["pv"]["atual"]=100; $p->ficha=$g; $p->save();'`,
    { stdio: 'ignore' },
);

const navegador = await chromium.launch({ executablePath: achar(), args: ['--no-sandbox'], headless: !process.env.MOSTRAR });
const erros = [];
const page = await navegador.newPage({ viewport: { width: 1500, height: 950 }, extraHTTPHeaders: { 'X-E2E': '1' } });
page.on('pageerror', (e) => erros.push(e.message.slice(0, 160)));
try {
    await page.goto(`${APP}/convite/${mesa.token}`);
    await page.waitForLoadState('networkidle');
    await page.getByText('MestreE2E', { exact: true }).first().click();
    const entrar = page.getByRole('button', { name: /entrar/i });
    if (await entrar.count()) await entrar.first().click();
    await page.waitForURL(/\/jogo\//);
    await page.waitForTimeout(2500);
    const abrirTecnicas = async () => {
        const fechar = page.getByLabel('Fechar ficha');
        if (await fechar.count()) await fechar.click();
        const aba = page.getByRole('tab', { name: 'Personagens', exact: true });
        if ((await aba.getAttribute('aria-selected')) !== 'true') await aba.click();
        await page.getByLabel('Abrir a ficha de AtiradorE2E').click();
        await page.waitForTimeout(900);
        await page.getByText('Técnicas', { exact: true }).first().click();
        await page.waitForTimeout(400);
    };
    const abaChat = async () => {
        const aba = page.getByRole('tab', { name: 'Chat', exact: true });
        if ((await aba.getAttribute('aria-selected')) !== 'true') await aba.click();
        await page.waitForTimeout(300);
    };
    const usar = async (nome, extra = async () => {}) => {
        await abrirTecnicas();
        await extra();
        await page.getByRole('button', { name: new RegExp(`^Usar ${nome}`) }).click();
        await page.waitForTimeout(900);
        await page.mouse.move(...TELA.perto);
        await page.waitForTimeout(250);
        await page.mouse.click(...TELA.perto);
        await page.waitForTimeout(1800);
        await abaChat();
    };
    // o mestre mira o Perto (o ataque pede o alvo)
    await page.getByRole('button', { name: /^Mirar/ }).click();
    await page.mouse.click(...TELA.perto);

    etapa('1. Execução: o botão aparece no acerto e mata quem tem 150 PV ou menos (o primeiro da linha tem 100)');
    await usar('Execução', async () => {
        const dobrar = page.getByLabel('Rolar o dano duas vezes (Execução Perfeita)');
        confere((await dobrar.count()) > 0, 'a Execução oferece "Dano 2×" (Execução Perfeita, Rei Atirador)');
    });
    const executar = page.getByRole('button', { name: /^Executar/ });
    if (await executar.count()) {
        await executar.click();
        await page.waitForTimeout(1500);
        confere(artisan('e2e:estado').pv.aliado === 0, 'servidor: o alvo morreu (0 PV)', String(artisan('e2e:estado').pv.aliado));
        confere((await page.getByRole('button', { name: /^Executar/ }).count()) === 0, 'o botão some depois de usado');
    } else console.log('  (o ataque errou: rode de novo)');

    etapa('2. Zona do Atirador: +60 PV temporários para quem atacou');
    await usar('Zona do Atirador');
    const zona = page.getByRole('button', { name: /^\+60 PV temporários/ });
    if (await zona.count()) {
        await zona.click();
        await page.waitForTimeout(1500);
        confere(artisan('e2e:estado').atirador.pv_temp === 60, 'servidor: 60 PV temporários no Atirador');
    } else console.log('  (o ataque errou: rode de novo)');

    etapa('3. Covering: a condição de desvantagem entra no alvo por 1 turno');
    await usar('Covering');
    const cobrir = page.getByRole('button', { name: /^Desvantagem no próximo ataque/ });
    if (await cobrir.count()) {
        await cobrir.click();
        await page.waitForTimeout(1500);
        confere(
            artisan('e2e:estado').condicoes.aliado.includes('covering'),
            'servidor: o alvo recebeu Fogo Cadenciado',
            JSON.stringify(artisan('e2e:estado').condicoes),
        );
    } else console.log('  (o ataque errou: rode de novo)');

    etapa('4. Defesa Improvisada: rola a redução (6d8) e o botão soma 2d8 por 1 PP');
    const ppAntes = artisan('e2e:estado').pp;
    await abrirTecnicas();
    await page.getByRole('button', { name: /^Usar Defesa Improvisada/ }).click();
    await page.waitForTimeout(1500);
    await abaChat();
    const ppDepoisDeUsar = artisan('e2e:estado').pp;
    confere(ppDepoisDeUsar === ppAntes - 2, 'servidor: a Técnica custou 2 PP', `${ppAntes}→${ppDepoisDeUsar}`);
    const somar = page.getByRole('button', { name: /^Somar 2d8/ });
    confere((await somar.count()) >= 1, 'o card oferece "Somar 2d8 (1 PP)"');
    await somar.last().click();
    await page.waitForTimeout(1500);
    confere(artisan('e2e:estado').pp === ppDepoisDeUsar - 1, 'servidor: somar 2d8 custou 1 PP');
    confere(/8d8/.test((await page.locator('ol[aria-live="polite"]').innerText()).replace(/\s+/g, ' ')), 'o card mostra a redução total em 8d8');
} catch (e) {
    falhas++;
    console.log(`\n  ✖ o roteiro parou: ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: path.join(os.tmpdir(), 'e2e-falha-especiais.png') }).catch(() => {});
} finally {
    confere(erros.length === 0, 'nenhum erro de JavaScript na página', erros.join(' | '));
    await navegador.close();
}
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);

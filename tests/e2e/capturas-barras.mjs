// Captura o mapa da mesa fixa como o jogador e como o mestre, para conferir a vida, a CA e o PP sobre os tokens (olho humano; não faz verificações).
//   node tests/e2e/capturas-barras.mjs <token-do-convite> [pasta-de-saida]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [token, saida = os.tmpdir()] = process.argv.slice(2);
const base = path.join(os.homedir(), '.cache/ms-playwright');
const chrome = path.join(base, fs.readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().pop(), 'chrome-linux64/chrome');
const navegador = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
for (const quem of ['JogadorE2E', 'OutroE2E', 'MestreE2E']) {
    const page = await navegador.newPage({ viewport: { width: 1500, height: 950 }, extraHTTPHeaders: { 'X-E2E': '1' } });
    await page.goto(`http://localhost:8000/convite/${token}`);
    await page.waitForLoadState('networkidle');
    await page.getByText(quem, { exact: true }).first().click();
    const entrar = page.getByRole('button', { name: /entrar/i });
    if (await entrar.count()) await entrar.first().click();
    await page.waitForURL(/\/jogo\//);
    await page.waitForTimeout(2500);
    for (let i = 0; i < 7; i++) {
        await page.mouse.move(700, 480);
        await page.mouse.wheel(0, -300);
        await page.waitForTimeout(60);
    }
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(saida, `barras-${quem}.png`) });
    await page.close();
}
await navegador.close();
console.log('capturas em', saida);

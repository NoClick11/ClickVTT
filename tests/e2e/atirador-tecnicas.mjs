// Fumaça de todas as Técnicas do Atirador no navegador: o mestre usa cada uma na ficha do Atirador (nível 20, PP e munição de sobra) e o roteiro
// confere que nada quebra (nenhum erro de JavaScript, nenhuma resposta 4xx/5xx), quanto gastou de PP e de munição e o que apareceu no chat.
//   node tests/e2e/atirador-tecnicas.mjs      (app em http://localhost:8000 com o Vite; MOSTRAR=1 abre a janela)
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
const TELA = { perto: [865, 575], atirador: [665, 575] };

const mesa = artisan('e2e:preparar-mesa');
// PP e munição de sobra: o roteiro testa o funcionamento, não a economia
execSync(
    `docker exec ${CONTAINER} php artisan tinker --execute='$m=App\\Models\\Mesa::find(${mesa.mesa}); $p=$m->personagens()->where("nome","AtiradorE2E")->first(); $f=$p->ficha; $f["pp"]["atual"]=999; foreach($f["inventario"][0]["itens"] as $i=>$r){ if($r["qtd"]>1) $f["inventario"][0]["itens"][$i]["qtd"]=200; } $p->ficha=$f; $p->save();'`,
    { stdio: 'ignore' },
);

const navegador = await chromium.launch({ executablePath: achar(), args: ['--no-sandbox'], headless: !process.env.MOSTRAR });
const page = await navegador.newPage({ viewport: { width: 1500, height: 950 }, extraHTTPHeaders: { 'X-E2E': '1' } });
const erros = [];
const ruins = [];
page.on('pageerror', (e) => erros.push(e.message.slice(0, 160)));
page.on('response', async (r) => {
    if (r.status() >= 400 && /\/jogo\//.test(r.url()))
        ruins.push(`${r.status()} ${r.url().split('/jogo/')[1]?.slice(0, 60)} ${(await r.text().catch(() => '')).slice(0, 140)}`);
});
await page.goto(`${APP}/convite/${mesa.token}`);
await page.waitForLoadState('networkidle');
await page.getByText('MestreE2E', { exact: true }).first().click();
const entrar = page.getByRole('button', { name: /entrar/i });
if (await entrar.count()) await entrar.first().click();
await page.waitForURL(/\/jogo\//);
await page.waitForTimeout(2500);

const abrirTecnicas = async () => {
    const fechar = page.getByLabel('Fechar ficha');
    if (await fechar.count()) {
        await fechar.click();
        await page.waitForTimeout(300);
    }
    const aba = page.getByRole('tab', { name: 'Personagens', exact: true });
    if ((await aba.getAttribute('aria-selected')) !== 'true') await aba.click();
    await page.getByLabel('Abrir a ficha de AtiradorE2E').click();
    await page.waitForTimeout(900);
    await page.getByText('Técnicas', { exact: true }).first().click();
    await page.waitForTimeout(400);
};
const lista = JSON.parse(fs.readFileSync(new URL('./ficha-atirador.json', import.meta.url), 'utf8')).campos['tecnicas.lista'].map((t) => t.nome);
const resultados = [];
for (const nome of lista) {
    const antes = artisan('e2e:estado');
    const errosAntes = erros.length + ruins.length;
    let nota = '';
    try {
        await abrirTecnicas();
        const botao = page.getByRole('button', { name: new RegExp(`^Usar ${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) });
        if (!(await botao.count())) {
            resultados.push({ nome, nota: 'SEM BOTÃO Usar' });
            continue;
        }
        if (await botao.isDisabled()) {
            resultados.push({ nome, nota: `desabilitado: ${(await botao.getAttribute('title')) ?? ''}` });
            continue;
        }
        await botao.click();
        await page.waitForTimeout(900);
        // técnica com área/ponto: a ficha fecha e o mapa pede o clique
        if (!(await page.getByText('Ficha · AtiradorE2E').count())) {
            await page.mouse.move(TELA.perto[0], TELA.perto[1]);
            await page.waitForTimeout(250);
            await page.mouse.click(TELA.perto[0], TELA.perto[1]);
        }
        await page.waitForTimeout(1800);
        const depois = artisan('e2e:estado');
        const chat = await page
            .locator('ol[aria-live="polite"]')
            .innerText()
            .catch(() => '');
        const ultimas = chat.replace(/\s+/g, ' ').slice(-150);
        const gastoMunicao = Object.entries(antes.qtds)
            .filter(([k, v]) => k.startsWith('municao') && (depois.qtds[k] ?? 0) !== v)
            .map(([k, v]) => `${k}:${v}→${depois.qtds[k] ?? 0}`)
            .join(' ');
        nota = `PP ${antes.pp}→${depois.pp}${gastoMunicao ? `; munição ${gastoMunicao}` : ''}; ativas=${depois.ativas.length + depois.vigia.length}; cards=${depois.cards.length}; chat…${ultimas}`;
    } catch (e) {
        nota = `FALHA: ${e.message.split('\n')[0]}`;
    }
    if (erros.length + ruins.length > errosAntes) nota += ` | ERROS: ${[...erros, ...ruins].slice(errosAntes).join(' / ')}`;
    resultados.push({ nome, nota });
    // volta ao estado limpo: fecha a ficha e zera as ações do turno do Atirador (o mestre não é limitado, mas a Vigília e o Quick Draw ficam ativos)
}
for (const r of resultados) console.log(`- ${r.nome}: ${r.nota}`);
console.log(`\nErros de JavaScript: ${erros.length}${erros.length ? ' → ' + erros.join(' | ') : ''}`);
console.log(`Respostas 4xx/5xx: ${ruins.length}${ruins.length ? '\n  ' + ruins.join('\n  ') : ''}`);
await navegador.close();

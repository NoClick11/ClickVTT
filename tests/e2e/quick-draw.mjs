// Teste de ponta a ponta do Quick Draw do Atirador, no navegador (Playwright) contra a mesa fixa "E2E Quick Draw (não apagar)".
//
//   npm run e2e:quick-draw
//
// Precisa do app no ar (http://localhost:8000, com o Vite) e do container do Laravel (docker exec). Variáveis: APP_URL, CONTAINER, CHROME_PATH, MOSTRAR=1 (abre a janela).
// O roteiro restaura a mesa (php artisan e2e:preparar-mesa), joga como o jogador e o mestre e confere o que o SERVIDOR decidiu (php artisan e2e:estado).
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const APP = process.env.APP_URL ?? 'http://localhost:8000';
const CONTAINER = process.env.CONTAINER ?? 'clickvtt-laravel.test-1';
const artisan = (cmd) => JSON.parse(execSync(`docker exec ${CONTAINER} php artisan ${cmd}`, { encoding: 'utf8' }).trim().split('\n').pop());

function achar() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    const base = path.join(os.homedir(), '.cache/ms-playwright');
    const pasta = fs.readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().pop();
    return path.join(base, pasta, 'chrome-linux64/chrome');
}

let falhas = 0;
let paginas = {};
const confere = (condicao, texto, detalhe = '') => {
    console.log(`${condicao ? '  ✔' : '  ✖'} ${texto}${!condicao && detalhe ? `  → ${detalhe}` : ''}`);
    if (!condicao) falhas++;
};
const etapa = (t) => console.log(`\n${t}`);

const mesa = artisan('e2e:preparar-mesa');
const navegador = await chromium.launch({ executablePath: achar(), args: ['--no-sandbox'], headless: !process.env.MOSTRAR });
const erros = [];
const entrar = async (quem) => {
    const page = await navegador.newPage({ viewport: { width: 1500, height: 950 } });
    page.on('pageerror', (e) => erros.push(`${quem}: ${e.message.slice(0, 160)}`));
    // a entrada pelo convite tem limite de 8 por minuto: rodadas seguidas do roteiro podem esbarrar nele (espera a janela passar e tenta de novo)
    for (let tentativa = 1; ; tentativa++) {
        await page.goto(`${APP}/convite/${mesa.token}`);
        await page.waitForLoadState('networkidle');
        await page.getByText(quem, { exact: true }).first().click();
        const botao = page.getByRole('button', { name: /entrar/i });
        if (await botao.count()) await botao.first().click();
        try {
            await page.waitForURL(/\/jogo\//, { timeout: 15000 });
            break;
        } catch (e) {
            if (tentativa >= 2) throw e;
            console.log(`  (a entrada de ${quem} foi limitada; esperando 65 s e tentando de novo)`);
            await page.waitForTimeout(65000);
        }
    }
    await page.waitForTimeout(2500);

    paginas[quem] = page;

    return page;
};
/** Abre uma aba da barra lateral (clicar na aba já aberta a recolhe: confere e clica de novo se preciso). */
const abrirAba = async (page, nome) => {
    const aba = page.getByRole('tab', { name: nome, exact: true });
    await aba.click();
    if ((await aba.getAttribute('aria-selected')) !== 'true') await aba.click();
    await page.waitForTimeout(300);
};
const abaChat = (page) => abrirAba(page, 'Chat');
const textoDoChat = async (page) => (await page.locator('ol[aria-live="polite"]').innerText().catch(() => '')).replace(/\s+/g, ' ');

try {
    const jogador = await entrar('JogadorE2E');
    const mestre = await entrar('MestreE2E');
    await abaChat(jogador);

    etapa('1. O jogador abre a ficha do Atirador e vê o Quick Draw separado por grau');
    await abrirAba(jogador, 'Personagens');
    await jogador.getByLabel('Abrir a ficha de AtiradorE2E').click();
    await jogador.waitForTimeout(1200);
    await jogador.getByText('Técnicas', { exact: true }).first().click();
    await jogador.waitForTimeout(500);
    confere(await jogador.getByRole('button', { name: /^6º Grau/ }).count() === 1, 'a seção "6º Grau" existe');
    confere(await jogador.getByRole('button', { name: /^Usar Quick Draw/ }).isEnabled(), 'o botão Usar do Quick Draw está habilitado');

    etapa('2. Usar o Quick Draw: a ficha fecha, a Técnica fica ativa e custa 12 PP e a Ação bônus');
    await jogador.getByRole('button', { name: /^Usar Quick Draw/ }).click();
    await jogador.waitForTimeout(1500);
    confere((await jogador.getByText('Ficha · AtiradorE2E').count()) === 0, 'a janela da ficha fechou sozinha');
    await abaChat(jogador);
    confere((await textoDoChat(jogador)).includes('ativa Quick Draw: 10 rodadas'), 'o chat avisa "ativa Quick Draw: 10 rodadas"');
    let s = artisan('e2e:estado');
    confere(s.ativas.length === 1 && s.ativas[0].rodadas === 10 && s.ativas[0].alcance === 15, 'servidor: 1 Técnica ativa, 10 rodadas, alcance 15 m', JSON.stringify(s.ativas));
    confere(s.pp === 68, 'servidor: PP 80 → 68', String(s.pp));
    confere(s.acoes_atirador.bonus === 1, 'servidor: a Ação bônus foi gasta', JSON.stringify(s.acoes_atirador));

    const proximoTurno = async () => {
        await mestre.getByRole('button', { name: /pr[óo]ximo/i }).first().click();
        await mestre.waitForTimeout(1300);
    };

    etapa('3. Vez do PertoE2E (9 m, inimigo à vista): aparece o card e o jogador clica para atacar');
    await proximoTurno();
    await jogador.waitForTimeout(800);
    const atacar = jogador.getByRole('button', { name: /^Atacar PertoE2E/ });
    confere((await atacar.count()) === 1, 'o card "Atacar PertoE2E" apareceu no chat do jogador');
    const pvAntes = artisan('e2e:estado').pv.perto;
    confere(pvAntes === 400, 'o ataque só rola quando o jogador clica (PV do Perto intacto: 400)', String(pvAntes));
    await atacar.click();
    await jogador.waitForTimeout(1500);
    let chat = await textoDoChat(jogador);
    const acertou = /Acerta|Crítico/.test(chat);
    confere(acertou || /Erra|Falha crítica/.test(chat), `o card mostra o resultado do ataque (${acertou ? 'acerto' : 'erro'})`);
    s = artisan('e2e:estado');
    if (acertou) {
        confere(s.pv.perto < 400, 'servidor: o dano do acerto foi aplicado ao Perto', String(s.pv.perto));
        const antesDoEfeito = s.pv.perto;
        const maisDano = jogador.getByRole('button', { name: /\+2d10 de dano/ });
        confere((await maisDano.count()) === 1, 'o card oferece as escolhas do acerto (movimento 0, +2d10, sem ação)');
        await maisDano.click();
        await jogador.waitForTimeout(1500);
        confere((await textoDoChat(jogador)).includes('Efeito: +2d10'), 'o efeito escolhido aparece no card');
        confere(artisan('e2e:estado').pv.perto < antesDoEfeito, 'servidor: o +2d10 tirou mais PV');
    } else {
        console.log('  (o ataque errou: sem escolha de efeito; rode de novo para ver o acerto)');
    }
    confere(s.gatilhos.length === 1 && s.gatilhos[0].alvo === 'PertoE2E', 'servidor: só 1 card de gatilho até aqui (Perto)', JSON.stringify(s.gatilhos));

    etapa('4. Camadas e sem fogo amigo: Oculto (camada do Mestre), Amigo (PC) e Longe (45 m) não geram card');
    for (const [nome] of [['OcultoE2E'], ['AmigoE2E'], ['LongeE2E']]) {
        await proximoTurno();
        await jogador.waitForTimeout(500);
        confere((await jogador.getByRole('button', { name: new RegExp(`^Atacar ${nome}`) }).count()) === 0, `nenhum card para ${nome} no chat do jogador`);
    }
    s = artisan('e2e:estado');
    confere(s.gatilhos.length === 1, 'servidor: continua 1 só card de gatilho (os outros três foram barrados)', JSON.stringify(s.gatilhos));
    confere(s.pv.oculto === 400 && s.pv.amigo !== null && s.pv.longe === 400, 'servidor: ninguém além do Perto levou dano');

    etapa('5. Nova rodada: a duração cai para 9 e o Atirador não é alvo de si mesmo');
    await proximoTurno();
    s = artisan('e2e:estado');
    confere(s.rodada === 2 && s.atual === 'a', 'servidor: rodada 2, de volta ao Atirador', `${s.rodada}/${s.atual}`);
    confere(s.ativas[0]?.rodadas === 9, 'servidor: faltam 9 rodadas', JSON.stringify(s.ativas));
    confere(s.gatilhos.length === 1, 'servidor: o Atirador não gerou card contra si mesmo');

    etapa('6. A ficha mostra a Técnica ativa e o jogador a encerra');
    await abrirAba(jogador, 'Personagens');
    await jogador.getByLabel('Abrir a ficha de AtiradorE2E').click();
    await jogador.waitForTimeout(1200);
    await jogador.getByText('Técnicas', { exact: true }).first().click();
    await jogador.waitForTimeout(500);
    confere((await jogador.getByText(/ativa · 9 rod\./).count()) === 1, 'a ficha mostra "ativa · 9 rod."');
    await jogador.getByRole('button', { name: 'encerrar', exact: true }).click();
    await jogador.waitForTimeout(1200);
    confere(artisan('e2e:estado').ativas.length === 0, 'servidor: a Técnica foi encerrada');
    await abaChat(jogador);
    confere((await textoDoChat(jogador)).includes('Quick Draw foi encerrada'), 'o chat avisa que foi encerrada');

    confere(erros.length === 0, 'nenhum erro de JavaScript na página', erros.join(' | '));
} catch (e) {
    falhas++;
    console.log(`\n  ✖ o roteiro parou: ${e.message.split('\n')[0]}`);
    for (const [quem, page] of Object.entries(paginas)) await page.screenshot({ path: path.join(os.tmpdir(), `e2e-falha-${quem}.png`) }).catch(() => {});
    console.log(`  (capturas em ${os.tmpdir()}/e2e-falha-*.png)`);
} finally {
    await navegador.close();
}

console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nTudo certo: o fluxo do Quick Draw funciona.');
process.exit(falhas ? 1 : 0);

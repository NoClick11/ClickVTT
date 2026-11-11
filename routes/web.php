<?php

use App\Http\Controllers\App\AlvoController;
use App\Http\Controllers\App\BroadcastAuthController;
use App\Http\Controllers\App\ChatController;
use App\Http\Controllers\App\CombateController;
use App\Http\Controllers\App\CompanheiroController;
use App\Http\Controllers\App\DiarioController;
use App\Http\Controllers\App\EventoDeCombateController;
use App\Http\Controllers\App\ExploracaoController;
use App\Http\Controllers\App\FichaController;
use App\Http\Controllers\App\ForjaController;
use App\Http\Controllers\App\ItemController;
use App\Http\Controllers\App\JogoController;
use App\Http\Controllers\App\LojaController;
use App\Http\Controllers\App\LootController;
use App\Http\Controllers\App\MusicaController;
use App\Http\Controllers\App\NpcController;
use App\Http\Controllers\App\ObjetoController;
use App\Http\Controllers\App\PaginaController;
use App\Http\Controllers\App\PastaController;
use App\Http\Controllers\App\PersonagemController as PersonagemDoJogoController;
use App\Http\Controllers\App\PingController;
use App\Http\Controllers\App\ProgressaoController;
use App\Http\Controllers\App\TecnicaAtivaController;
use App\Http\Controllers\App\TecnicaController;
use App\Http\Controllers\App\TempoController;
use App\Http\Controllers\Site\ConviteController;
use App\Http\Controllers\Site\JogadorController;
use App\Http\Controllers\Site\MesaController;
use App\Http\Controllers\Site\PersonagemController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function () {
    Route::get('/', [MesaController::class, 'index'])->name('home');
    Route::post('mesas', [MesaController::class, 'store'])->name('mesas.store');
    Route::get('mesas/{mesa:slug}', [MesaController::class, 'show'])->name('mesas.show');
    Route::post('mesas/{mesa}/convite', [MesaController::class, 'novoConvite'])->name('mesas.convite');
    Route::post('mesas/{mesa}/jogadores', [JogadorController::class, 'store'])->name('jogadores.store');
    Route::put('mesas/{mesa}/jogadores/{jogador}', [JogadorController::class, 'update'])->name('jogadores.update');
    Route::delete('mesas/{mesa}/jogadores/{jogador}', [JogadorController::class, 'destroy'])->name('jogadores.destroy');
    Route::post('mesas/{mesa}/personagens', [PersonagemController::class, 'store'])->name('personagens.store');
    Route::put('mesas/{mesa}/personagens/{personagem}', [PersonagemController::class, 'update'])->name('personagens.update');
    Route::delete('mesas/{mesa}/personagens/{personagem}', [PersonagemController::class, 'destroy'])->name('personagens.destroy');
    Route::put('mesas/{mesa}', [MesaController::class, 'update'])->name('mesas.update');
    Route::post('mesas/{mesa}/favoritar', [MesaController::class, 'favoritar'])->name('mesas.favoritar');
    Route::post('mesas/{mesa}/travar', [MesaController::class, 'travar'])->name('mesas.travar');
    Route::delete('mesas/{mesa}', [MesaController::class, 'destroy'])->name('mesas.destroy');
});

// Convite público: o jogador escolhe o personagem e digita a senha. Sem conta.
Route::get('convite/{token}', [ConviteController::class, 'show'])->name('convite.show');
Route::post('convite/{token}', [ConviteController::class, 'entrar'])->middleware('throttle:convite')->name('convite.entrar');
Route::post('convite/{token}/sair', [ConviteController::class, 'sair'])->name('convite.sair');
Route::get('jogo/{mesa:slug}', [JogoController::class, 'entrada'])->name('jogo.entrada');
Route::get('jogo/{mesa:slug}/{jogador}', [JogoController::class, 'show'])->name('jogo');

// API da mesa de jogo (JSON). Autorização por papel em App\Support\AcessoMesa.
Route::prefix('jogo/{mesa}')->name('jogo.')->group(function () {
    Route::post('paginas', [PaginaController::class, 'store'])->name('paginas.store');
    Route::patch('paginas/{pagina}', [PaginaController::class, 'update'])->name('paginas.update');
    Route::delete('paginas/{pagina}', [PaginaController::class, 'destroy'])->name('paginas.destroy');
    Route::post('paginas/{pagina}/jogadores/{jogador}', [PaginaController::class, 'moverJogador'])->name('paginas.jogador');
    Route::delete('personagens/{personagem}', [PersonagemDoJogoController::class, 'excluir'])->middleware('throttle:30,1')->name('personagens.excluir');
    Route::post('personagens/{personagem}/foto', [PersonagemDoJogoController::class, 'foto'])->middleware('throttle:30,1')->name('personagens.foto');
    Route::patch('personagens/{personagem}/ficha', [FichaController::class, 'atualizar'])
        ->middleware('throttle:120,1')->name('personagens.ficha');
    Route::post('personagens/{personagem}/companheiros', [CompanheiroController::class, 'criar'])->middleware('throttle:10,1')->name('personagens.companheiros');
    Route::post('personagens/{personagem}/dano', [AlvoController::class, 'dano'])->middleware('throttle:60,1')->name('personagens.dano');
    Route::post('personagens/{personagem}/condicoes', [AlvoController::class, 'condicao'])->middleware('throttle:60,1')->name('personagens.condicoes');
    Route::post('personagens/{personagem}/criacao/dinheiro-rolado', [FichaController::class, 'rolarDinheiro'])
        ->middleware('throttle:20,1')->name('personagens.dinheiro-rolado');
    Route::post('personagens/{personagem}/criacao/atributos-rolados', [FichaController::class, 'rolarAtributos'])
        ->middleware('throttle:20,1')->name('personagens.atributos-rolados');
    Route::post('npcs', [NpcController::class, 'criar'])->middleware('throttle:60,1')->name('npcs.store');
    Route::post('personagens/{personagem}/instanciar', [NpcController::class, 'instanciar'])->middleware('throttle:120,1')->name('personagens.instanciar');
    Route::post('personagens', [PersonagemDoJogoController::class, 'criar'])->middleware('throttle:30,1')->name('personagens.store');
    Route::put('personagens/{personagem}/jogadores', [PersonagemDoJogoController::class, 'atribuir'])->name('personagens.atribuir');
    // Loja: o mestre abre/fecha (jogadores e categorias) e cria itens do catálogo; o jogador compra com a loja aberta.
    Route::post('loja', [LojaController::class, 'abrir'])->middleware('throttle:30,1')->name('loja.abrir');
    Route::delete('loja', [LojaController::class, 'fechar'])->middleware('throttle:30,1')->name('loja.fechar');
    Route::post('loja/entregar', [LojaController::class, 'entregar'])->middleware('throttle:60,1')->name('loja.entregar');
    Route::post('loja/comprar', [LojaController::class, 'comprar'])->middleware('throttle:60,1')->name('loja.comprar');
    // Forja do Ferreiro: criar armas do catálogo e aprimorar a arma de qualquer personagem com Pontos de Forja.
    Route::post('forja/armas', [ForjaController::class, 'armas'])->middleware('throttle:60,1')->name('forja.armas');
    Route::post('forja/criar', [ForjaController::class, 'criar'])->middleware('throttle:30,1')->name('forja.criar');
    Route::post('forja/melhorar', [ForjaController::class, 'melhorar'])->middleware('throttle:30,1')->name('forja.melhorar');
    Route::post('forja/aprimorar', [ForjaController::class, 'aprimorar'])->middleware('throttle:30,1')->name('forja.aprimorar');
    Route::post('catalogo', [LojaController::class, 'store'])->middleware('throttle:60,1')->name('catalogo.store');
    Route::patch('catalogo/{item}', [LojaController::class, 'update'])->middleware('throttle:60,1')->name('catalogo.update');
    Route::delete('catalogo/{item}', [LojaController::class, 'destroy'])->name('catalogo.destroy');
    Route::post('itens', [ItemController::class, 'store'])->middleware('throttle:60,1')->name('itens.store');
    Route::patch('itens/{item}', [ItemController::class, 'update'])->middleware('throttle:60,1')->name('itens.update');
    Route::delete('itens/{item}', [ItemController::class, 'destroy'])->name('itens.destroy');
    Route::post('paginas/{pagina}/objetos', [ObjetoController::class, 'store'])->name('objetos.store');
    // Loot no mapa: o mestre cria e monta; o jogador abre e pega (o servidor trava o loot a cada retirada).
    Route::post('paginas/{pagina}/loot', [LootController::class, 'criar'])->middleware('throttle:60,1')->name('loot.criar');
    Route::get('loot/catalogo', [LootController::class, 'catalogo'])->middleware('throttle:60,1')->name('loot.catalogo');
    Route::get('loot/{objeto}', [LootController::class, 'mostrar'])->middleware('throttle:120,1')->name('loot.mostrar');
    Route::post('loot/{objeto}/pegar', [LootController::class, 'pegar'])->middleware('throttle:120,1')->name('loot.pegar');
    Route::post('loot/{objeto}/itens', [LootController::class, 'adicionarItem'])->middleware('throttle:60,1')->name('loot.itens.store');
    Route::patch('loot/{objeto}/itens/{linha}', [LootController::class, 'definirQtd'])->middleware('throttle:120,1')->name('loot.itens.update');
    Route::patch('loot/{objeto}', [LootController::class, 'atualizar'])->middleware('throttle:60,1')->name('loot.update');
    // Diário: pastas e folhetos (só o mestre) e a pasta de cada personagem.
    Route::post('diario/pastas', [DiarioController::class, 'criarPasta'])->middleware('throttle:60,1')->name('diario.pastas.store');
    Route::patch('diario/pastas/{pasta}', [DiarioController::class, 'atualizarPasta'])->middleware('throttle:60,1')->name('diario.pastas.update');
    Route::delete('diario/pastas/{pasta}', [DiarioController::class, 'excluirPasta'])->middleware('throttle:60,1')->name('diario.pastas.destroy');
    Route::post('diario/folhetos', [DiarioController::class, 'criarFolheto'])->middleware('throttle:30,1')->name('diario.folhetos.store');
    Route::patch('diario/folhetos/{folheto}', [DiarioController::class, 'atualizarFolheto'])->middleware('throttle:60,1')->name('diario.folhetos.update');
    Route::delete('diario/folhetos/{folheto}', [DiarioController::class, 'excluirFolheto'])->middleware('throttle:60,1')->name('diario.folhetos.destroy');
    Route::post('diario/folhetos/{folheto}/mostrar', [DiarioController::class, 'mostrarFolheto'])->middleware('throttle:30,1')->name('diario.folhetos.mostrar');
    Route::patch('personagens/{personagem}/pasta', [DiarioController::class, 'moverPersonagem'])->middleware('throttle:120,1')->name('personagens.pasta');
    Route::post('pastas', [PastaController::class, 'store'])->name('pastas.store');
    Route::patch('pastas/{pasta}', [PastaController::class, 'update'])->name('pastas.update');
    Route::delete('pastas/{pasta}', [PastaController::class, 'destroy'])->name('pastas.destroy');
    Route::patch('objetos/{objeto}', [ObjetoController::class, 'update'])->name('objetos.update');
    // Memória das áreas exploradas (névoa): cada jogador guarda a sua; o mestre apaga.
    Route::get('paginas/{pagina}/exploracao', [ExploracaoController::class, 'mostrar'])->middleware('throttle:60,1')->name('exploracao.mostrar');
    Route::put('paginas/{pagina}/exploracao', [ExploracaoController::class, 'guardar'])->middleware('throttle:30,1')->name('exploracao.guardar');
    Route::delete('paginas/{pagina}/exploracao', [ExploracaoController::class, 'limpar'])->middleware('throttle:20,1')->name('exploracao.limpar');
    Route::post('objetos/{objeto}/alternar', [ObjetoController::class, 'alternar'])->middleware('throttle:120,1')->name('objetos.alternar');
    Route::post('objetos/{objeto}/viajar', [ObjetoController::class, 'viajar'])->middleware('throttle:60,1')->name('objetos.viajar');
    Route::delete('objetos/{objeto}', [ObjetoController::class, 'destroy'])->name('objetos.destroy');
    Route::post('mensagens', [ChatController::class, 'texto'])->middleware('throttle:60,1')->name('mensagens.store');
    Route::post('rolagens', [ChatController::class, 'rolar'])->middleware('throttle:60,1')->name('rolagens.store');
    Route::post('tecnicas/salvaguarda', [TecnicaController::class, 'abrir'])->middleware('throttle:30,1')->name('tecnicas.salvaguarda.abrir');
    Route::post('tecnicas/municao', [TecnicaController::class, 'gastarMunicao'])->middleware('throttle:60,1')->name('tecnicas.municao.gastar');
    Route::post('tecnicas/municao/{mensagem}/efeito', [TecnicaController::class, 'efeitoDaMunicao'])->middleware('throttle:30,1')->name('tecnicas.municao.efeito');
    Route::post('tecnicas/salvaguarda/{mensagem}/rolar', [TecnicaController::class, 'rolar'])->middleware('throttle:120,1')->name('tecnicas.salvaguarda.rolar');
    Route::post('combate', [CombateController::class, 'comando'])->middleware('throttle:120,1')->name('combate.comando');
    Route::post('combate/eventos/{evento}/reagir', [EventoDeCombateController::class, 'reagir'])->middleware('throttle:60,1')->name('combate.eventos.reagir');
    Route::post('combate/eventos/{evento}/encerrar', [EventoDeCombateController::class, 'encerrar'])->middleware('throttle:30,1')->name('combate.eventos.encerrar');
    Route::post('combate/deslocamento', [CombateController::class, 'deslocamento'])->middleware('throttle:60,1')->name('combate.deslocamento');
    Route::post('personagens/{personagem}/socorros', [AlvoController::class, 'socorros'])->middleware('throttle:30,1')->name('personagens.socorros');
    Route::post('combate/disparada', [CombateController::class, 'disparada'])->middleware('throttle:60,1')->name('combate.disparada');
    Route::post('combate/tecnicas-ativas', [TecnicaAtivaController::class, 'ativar'])->middleware('throttle:30,1')->name('combate.tecnicas-ativas.ativar');
    Route::post('combate/tecnicas-ativas/vigia', [TecnicaAtivaController::class, 'ativarVigia'])->middleware('throttle:30,1')->name('combate.tecnicas-ativas.vigia');
    Route::post('combate/tecnicas-ativas/{ativa}/mover', [TecnicaAtivaController::class, 'moverVigia'])->middleware('throttle:30,1')->name('combate.tecnicas-ativas.mover');
    Route::delete('combate/tecnicas-ativas/{ativa}', [TecnicaAtivaController::class, 'encerrar'])->middleware('throttle:30,1')->name('combate.tecnicas-ativas.encerrar');
    Route::post('gatilhos/{mensagem}/atacar', [TecnicaAtivaController::class, 'atacar'])->middleware('throttle:60,1')->name('gatilhos.atacar');
    Route::post('gatilhos/{mensagem}/escolher', [TecnicaAtivaController::class, 'escolher'])->middleware('throttle:60,1')->name('gatilhos.escolher');
    Route::post('gatilhos/{mensagem}/ignorar', [TecnicaAtivaController::class, 'ignorar'])->middleware('throttle:60,1')->name('gatilhos.ignorar');
    Route::post('dano-brutal/{mensagem}/pedir', [AlvoController::class, 'pedirSalvaguardaDanoBrutal'])->middleware('throttle:60,1')->name('dano-brutal.pedir');
    Route::post('dano-brutal/{mensagem}/rolar', [AlvoController::class, 'rolarDanoBrutal'])->middleware('throttle:60,1')->name('dano-brutal.rolar');
    Route::post('dano-brutal/{mensagem}/aplicar', [AlvoController::class, 'aplicarDanoBrutal'])->middleware('throttle:60,1')->name('dano-brutal.aplicar');
    Route::post('dano-brutal/{mensagem}/ignorar', [AlvoController::class, 'ignorarDanoBrutal'])->middleware('throttle:60,1')->name('dano-brutal.ignorar');
    Route::post('personagens/{personagem}/tratar-brutal', [AlvoController::class, 'tratarDanoBrutal'])->middleware('throttle:60,1')->name('personagens.tratar-brutal');
    Route::patch('fogo-amigo', [CombateController::class, 'fogoAmigo'])->name('fogo-amigo');
    Route::patch('musica', [MusicaController::class, 'atualizar'])->name('musica.atualizar');
    Route::patch('tempo', [TempoController::class, 'atualizar'])->name('tempo.atualizar');
    Route::post('ping', [PingController::class, 'ping'])->middleware('throttle:60,1')->name('ping');
    Route::post('mirar', [AlvoController::class, 'mirar'])->middleware('throttle:120,1')->name('mirar');
    // Progressão (só o mestre): libera descansos e subir de nível; divide XP entre os personagens dos jogadores.
    Route::patch('liberacoes', [ProgressaoController::class, 'liberacoes'])->name('liberacoes');
    Route::post('xp', [ProgressaoController::class, 'distribuirXp'])->middleware('throttle:30,1')->name('xp.distribuir');
    Route::post('combate/ataques-extras', [CombateController::class, 'ataquesExtras'])->middleware('throttle:60,1')->name('combate.ataques-extras');
    Route::post('combate/acao', [CombateController::class, 'acao'])->middleware('throttle:240,1')->name('combate.acao');
    Route::post('broadcasting/auth', BroadcastAuthController::class)->name('broadcasting.auth');
});

Route::redirect('dashboard', '/')->name('dashboard');

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';

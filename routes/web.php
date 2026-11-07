<?php

use App\Http\Controllers\App\BroadcastAuthController;
use App\Http\Controllers\App\AlvoController;
use App\Http\Controllers\App\ChatController;
use App\Http\Controllers\App\EventoDeCombateController;
use App\Http\Controllers\App\CompanheiroController;
use App\Http\Controllers\App\CombateController;
use App\Http\Controllers\App\FichaController;
use App\Http\Controllers\App\ForjaController;
use App\Http\Controllers\App\ItemController;
use App\Http\Controllers\App\LojaController;
use App\Http\Controllers\App\JogoController;
use App\Http\Controllers\App\ObjetoController;
use App\Http\Controllers\App\PaginaController;
use App\Http\Controllers\App\PastaController;
use App\Http\Controllers\App\TecnicaAtivaController;
use App\Http\Controllers\App\TecnicaController;
use App\Http\Controllers\App\PersonagemController as PersonagemDoJogoController;
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
Route::post('convite/{token}', [ConviteController::class, 'entrar'])->middleware('throttle:8,1')->name('convite.entrar');
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
    Route::patch('personagens/{personagem}/ficha', [FichaController::class, 'atualizar'])
        ->middleware('throttle:120,1')->name('personagens.ficha');
    Route::post('personagens/{personagem}/companheiros', [CompanheiroController::class, 'criar'])->middleware('throttle:10,1')->name('personagens.companheiros');
    Route::post('personagens/{personagem}/dano', [AlvoController::class, 'dano'])->middleware('throttle:60,1')->name('personagens.dano');
    Route::post('personagens/{personagem}/condicoes', [AlvoController::class, 'condicao'])->middleware('throttle:60,1')->name('personagens.condicoes');
    Route::post('personagens/{personagem}/criacao/atributos-rolados', [FichaController::class, 'rolarAtributos'])
        ->middleware('throttle:20,1')->name('personagens.atributos-rolados');
    Route::post('personagens', [PersonagemDoJogoController::class, 'criar'])->middleware('throttle:30,1')->name('personagens.store');
    Route::put('personagens/{personagem}/jogadores', [PersonagemDoJogoController::class, 'atribuir'])->name('personagens.atribuir');
    // Loja: o mestre abre/fecha (jogadores e categorias) e cria itens do catálogo; o jogador compra com a loja aberta.
    Route::post('loja', [LojaController::class, 'abrir'])->middleware('throttle:30,1')->name('loja.abrir');
    Route::delete('loja', [LojaController::class, 'fechar'])->middleware('throttle:30,1')->name('loja.fechar');
    Route::post('loja/comprar', [LojaController::class, 'comprar'])->middleware('throttle:60,1')->name('loja.comprar');
    // Forja do Ferreiro: criar armas do catálogo e aprimorar a arma de qualquer personagem com Pontos de Forja.
    Route::post('forja/armas', [ForjaController::class, 'armas'])->middleware('throttle:60,1')->name('forja.armas');
    Route::post('forja/criar', [ForjaController::class, 'criar'])->middleware('throttle:30,1')->name('forja.criar');
    Route::post('forja/aprimorar', [ForjaController::class, 'aprimorar'])->middleware('throttle:30,1')->name('forja.aprimorar');
    Route::post('catalogo', [LojaController::class, 'store'])->middleware('throttle:60,1')->name('catalogo.store');
    Route::patch('catalogo/{item}', [LojaController::class, 'update'])->middleware('throttle:60,1')->name('catalogo.update');
    Route::delete('catalogo/{item}', [LojaController::class, 'destroy'])->name('catalogo.destroy');
    Route::post('itens', [ItemController::class, 'store'])->middleware('throttle:60,1')->name('itens.store');
    Route::patch('itens/{item}', [ItemController::class, 'update'])->middleware('throttle:60,1')->name('itens.update');
    Route::delete('itens/{item}', [ItemController::class, 'destroy'])->name('itens.destroy');
    Route::post('paginas/{pagina}/objetos', [ObjetoController::class, 'store'])->name('objetos.store');
    Route::post('pastas', [PastaController::class, 'store'])->name('pastas.store');
    Route::patch('pastas/{pasta}', [PastaController::class, 'update'])->name('pastas.update');
    Route::delete('pastas/{pasta}', [PastaController::class, 'destroy'])->name('pastas.destroy');
    Route::patch('objetos/{objeto}', [ObjetoController::class, 'update'])->name('objetos.update');
    Route::delete('objetos/{objeto}', [ObjetoController::class, 'destroy'])->name('objetos.destroy');
    Route::post('mensagens', [ChatController::class, 'texto'])->middleware('throttle:60,1')->name('mensagens.store');
    Route::post('rolagens', [ChatController::class, 'rolar'])->middleware('throttle:60,1')->name('rolagens.store');
    Route::post('tecnicas/salvaguarda', [TecnicaController::class, 'abrir'])->middleware('throttle:30,1')->name('tecnicas.salvaguarda.abrir');
    Route::post('tecnicas/salvaguarda/{mensagem}/rolar', [TecnicaController::class, 'rolar'])->middleware('throttle:120,1')->name('tecnicas.salvaguarda.rolar');
    Route::post('combate', [CombateController::class, 'comando'])->middleware('throttle:120,1')->name('combate.comando');
    Route::post('combate/eventos/{evento}/reagir', [EventoDeCombateController::class, 'reagir'])->middleware('throttle:60,1')->name('combate.eventos.reagir');
    Route::post('combate/eventos/{evento}/encerrar', [EventoDeCombateController::class, 'encerrar'])->middleware('throttle:30,1')->name('combate.eventos.encerrar');
    Route::post('combate/deslocamento', [CombateController::class, 'deslocamento'])->middleware('throttle:60,1')->name('combate.deslocamento');
    Route::post('personagens/{personagem}/socorros', [AlvoController::class, 'socorros'])->middleware('throttle:30,1')->name('personagens.socorros');
    Route::post('combate/disparada', [CombateController::class, 'disparada'])->middleware('throttle:60,1')->name('combate.disparada');
    Route::post('combate/tecnicas-ativas', [TecnicaAtivaController::class, 'ativar'])->middleware('throttle:30,1')->name('combate.tecnicas-ativas.ativar');
    Route::delete('combate/tecnicas-ativas/{ativa}', [TecnicaAtivaController::class, 'encerrar'])->middleware('throttle:30,1')->name('combate.tecnicas-ativas.encerrar');
    Route::post('gatilhos/{mensagem}/atacar', [TecnicaAtivaController::class, 'atacar'])->middleware('throttle:60,1')->name('gatilhos.atacar');
    Route::post('gatilhos/{mensagem}/escolher', [TecnicaAtivaController::class, 'escolher'])->middleware('throttle:60,1')->name('gatilhos.escolher');
    Route::post('gatilhos/{mensagem}/ignorar', [TecnicaAtivaController::class, 'ignorar'])->middleware('throttle:60,1')->name('gatilhos.ignorar');
    Route::post('combate/ataques-extras', [CombateController::class, 'ataquesExtras'])->middleware('throttle:60,1')->name('combate.ataques-extras');
    Route::post('combate/acao', [CombateController::class, 'acao'])->middleware('throttle:240,1')->name('combate.acao');
    Route::post('broadcasting/auth', BroadcastAuthController::class)->name('broadcasting.auth');
});

Route::redirect('dashboard', '/')->name('dashboard');

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';

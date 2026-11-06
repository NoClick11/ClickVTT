<?php

use App\Http\Controllers\App\BroadcastAuthController;
use App\Http\Controllers\App\ChatController;
use App\Http\Controllers\App\CombateController;
use App\Http\Controllers\App\FichaController;
use App\Http\Controllers\App\ItemController;
use App\Http\Controllers\App\JogoController;
use App\Http\Controllers\App\ObjetoController;
use App\Http\Controllers\App\PaginaController;
use App\Http\Controllers\App\PastaController;
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
    Route::patch('personagens/{personagem}/ficha', [FichaController::class, 'atualizar'])
        ->middleware('throttle:120,1')->name('personagens.ficha');
    Route::post('personagens', [PersonagemDoJogoController::class, 'criar'])->middleware('throttle:30,1')->name('personagens.store');
    Route::put('personagens/{personagem}/jogadores', [PersonagemDoJogoController::class, 'atribuir'])->name('personagens.atribuir');
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
    Route::put('combate', [CombateController::class, 'atualizar'])->name('combate.update');
    Route::post('broadcasting/auth', BroadcastAuthController::class)->name('broadcasting.auth');
});

Route::redirect('dashboard', '/')->name('dashboard');

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';

<?php

use App\Http\Controllers\App\JogoController;
use App\Http\Controllers\Site\ConviteController;
use App\Http\Controllers\Site\MesaController;
use App\Http\Controllers\Site\PersonagemController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware('auth')->group(function () {
    Route::get('/', [MesaController::class, 'index'])->name('home');
    Route::post('mesas', [MesaController::class, 'store'])->name('mesas.store');
    Route::get('mesas/{mesa:slug}', [MesaController::class, 'show'])->name('mesas.show');
    Route::post('mesas/{mesa}/convite', [MesaController::class, 'novoConvite'])->name('mesas.convite');
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
Route::get('jogo/{mesa:slug}', [JogoController::class, 'show'])->name('jogo');

Route::redirect('dashboard', '/')->name('dashboard');

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';

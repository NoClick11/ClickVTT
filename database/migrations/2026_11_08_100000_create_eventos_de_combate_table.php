<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Eventos do combate que esperam resposta (ex.: um ataque com a janela de reações aberta). Ver `Pipeline`.
        Schema::create('eventos_de_combate', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mesa_id')->constrained()->cascadeOnDelete();
            $table->string('tipo', 30); // `ataque`
            $table->string('estado', 20)->default('aguardando'); // aguardando | resolvido
            $table->json('contexto'); // quem, contra quem, a rolagem, a defesa de partida
            $table->json('ofertas'); // por personagem: as reações que ele pode usar agora
            $table->json('respostas'); // por personagem: passou ou a reação escolhida e o que ela fez
            $table->json('resultado')->nullable();
            $table->timestamps();

            $table->index(['mesa_id', 'estado']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('eventos_de_combate');
    }
};

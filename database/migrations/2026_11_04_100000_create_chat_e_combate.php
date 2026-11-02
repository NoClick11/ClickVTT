<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mensagens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mesa_id')->constrained()->cascadeOnDelete();
            $table->foreignId('personagem_id')->nullable()->constrained('personagens')->nullOnDelete();
            $table->string('tipo'); // texto | rolagem
            // todos | mestre (autor + mestre) | secreto (só o mestre vê o resultado; jogadores veem um aviso)
            $table->string('visibilidade')->default('todos');
            $table->text('texto')->nullable();
            $table->json('dados')->nullable(); // rolagem: dado, quantidade, resultados, total
            $table->timestamps();

            $table->index(['mesa_id', 'id']);
        });

        Schema::table('mesas', function (Blueprint $table) {
            $table->json('combate')->nullable(); // turnos/iniciativa (só visual por enquanto)
        });
    }

    public function down(): void
    {
        Schema::table('mesas', function (Blueprint $table) {
            $table->dropColumn('combate');
        });
        Schema::dropIfExists('mensagens');
    }
};

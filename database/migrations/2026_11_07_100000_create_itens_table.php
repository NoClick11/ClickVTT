<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('itens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mesa_id')->constrained()->cascadeOnDelete();
            $table->string('nome');
            $table->text('descricao')->nullable();
            $table->decimal('peso', 10, 2)->default(0); // kg, de 1 unidade
            $table->boolean('equipavel')->default(true);
            $table->boolean('requer_sintonia')->default(false);
            $table->json('dados')->nullable(); // específico do sistema (armadura, arma...)
            $table->json('efeitos')->nullable(); // buffs genéricos do núcleo: [{alvo, modo, valor}]
            $table->timestamps();

            $table->index(['mesa_id', 'nome']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('itens');
    }
};

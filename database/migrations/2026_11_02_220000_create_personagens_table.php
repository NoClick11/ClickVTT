<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('personagens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mesa_id')->constrained()->cascadeOnDelete();
            $table->string('nome');
            $table->string('papel')->default('jogador'); // jogador | mestre
            $table->string('cor', 7)->default('#d4a843');
            $table->string('senha')->nullable(); // hash; null = entra sem senha
            $table->timestamps();

            $table->unique(['mesa_id', 'nome']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('personagens');
    }
};

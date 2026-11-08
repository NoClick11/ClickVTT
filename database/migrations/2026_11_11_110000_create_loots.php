<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Loot: um objeto do mapa (baú, saco...) com itens e dinheiro dentro. Os jogadores pegam; o servidor serializa as disputas.
        Schema::create('loots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mesa_id')->constrained()->cascadeOnDelete();
            $table->foreignId('objeto_id')->unique()->constrained('objetos')->cascadeOnDelete();
            $table->unsignedBigInteger('dinheiro')->default(0);
            $table->timestamps();
        });

        Schema::create('loot_itens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loot_id')->constrained('loots')->cascadeOnDelete();
            $table->foreignId('item_id')->constrained('itens')->cascadeOnDelete();
            $table->unsignedInteger('qtd');
            $table->timestamps();

            $table->unique(['loot_id', 'item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loot_itens');
        Schema::dropIfExists('loots');
    }
};

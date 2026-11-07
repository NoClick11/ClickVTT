<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Itens que o mestre cria para o catálogo/loja da mesa (os do sistema vêm do módulo do sistema, não do banco).
        Schema::create('itens_de_catalogo', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mesa_id')->constrained()->cascadeOnDelete();
            $table->string('nome');
            $table->text('descricao')->nullable();
            $table->string('categoria', 40);
            $table->string('raridade', 20)->default('comum');
            $table->unsignedBigInteger('preco')->default(0);
            $table->decimal('peso', 10, 2)->default(0);
            $table->boolean('equipavel')->default(true);
            $table->boolean('requer_sintonia')->default(false);
            $table->json('dados')->nullable();
            $table->json('efeitos')->nullable();
            $table->timestamps();

            $table->index(['mesa_id', 'categoria']);
        });

        // Lojas abertas pelo mestre: uma por jogador (aberta para "todos" = uma linha para cada jogador).
        Schema::create('lojas_abertas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mesa_id')->constrained()->cascadeOnDelete();
            $table->foreignId('jogador_id')->constrained('jogadores')->cascadeOnDelete();
            $table->json('categorias');
            $table->unsignedInteger('fator')->default(100); // ajuste de preço, em % (100 = preço do livro)
            $table->timestamps();

            $table->unique(['mesa_id', 'jogador_id']);
        });

        // Item da mesa criado por uma compra: guarda de onde veio (id do sistema ou `c:ID` do catálogo da mesa) e não aparece
        // na aba Itens do mestre, que fica para os itens específicos que ele mesmo cria.
        Schema::table('itens', function (Blueprint $table) {
            $table->string('catalogo_id', 60)->nullable()->after('mesa_id');
            $table->index(['mesa_id', 'catalogo_id']);
        });
    }

    public function down(): void
    {
        Schema::table('itens', function (Blueprint $table) {
            $table->dropIndex(['mesa_id', 'catalogo_id']);
            $table->dropColumn('catalogo_id');
        });
        Schema::dropIfExists('lojas_abertas');
        Schema::dropIfExists('itens_de_catalogo');
    }
};

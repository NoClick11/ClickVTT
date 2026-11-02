<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pastas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mesa_id')->constrained()->cascadeOnDelete();
            $table->string('nome');
            $table->unsignedInteger('ordem')->default(0);
            $table->timestamps();
        });

        Schema::create('paginas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mesa_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pasta_id')->nullable()->constrained('pastas')->nullOnDelete();
            $table->string('nome');
            $table->unsignedInteger('ordem')->default(0);
            $table->unsignedSmallInteger('colunas')->default(25);
            $table->unsignedSmallInteger('linhas')->default(25);
            $table->unsignedSmallInteger('tamanho_quadrado')->default(70); // px por quadrado
            $table->boolean('grade_quadrada')->default(true); // false = posicionamento livre
            $table->decimal('distancia_quadrado', 8, 2)->default(1.5);
            $table->string('unidade', 8)->default('m');
            $table->timestamps();
        });

        Schema::create('objetos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pagina_id')->constrained('paginas')->cascadeOnDelete();
            $table->string('camada'); // mapa | mestre | jogadores | iluminacao
            $table->string('tipo'); // imagem | token | luz | parede
            $table->foreignId('personagem_id')->nullable()->constrained('personagens')->nullOnDelete();
            $table->string('nome')->nullable();
            $table->double('x')->default(0);
            $table->double('y')->default(0);
            $table->double('largura')->default(70);
            $table->double('altura')->default(70);
            $table->integer('z')->default(0);
            $table->string('arquivo')->nullable();
            $table->string('arquivo_tipo')->nullable(); // imagem | video | gif
            $table->json('dados')->nullable(); // luz: raio/cor/intensidade; parede: pontos/tipo/aberta
            $table->timestamps();

            $table->index(['pagina_id', 'camada']);
        });

        Schema::table('personagens', function (Blueprint $table) {
            $table->foreignId('pagina_id')->nullable()->constrained('paginas')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('personagens', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pagina_id');
        });
        Schema::dropIfExists('objetos');
        Schema::dropIfExists('paginas');
        Schema::dropIfExists('pastas');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Diário da mesa (estilo Roll20/Foundry): pastas (aninháveis) que organizam personagens e folhetos.
        Schema::create('diario_pastas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mesa_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('pai_id')->nullable();
            $table->string('nome', 80);
            $table->timestamps();

            $table->foreign('pai_id')->references('id')->on('diario_pastas')->nullOnDelete();
        });

        // Folheto: uma imagem (e um texto opcional) que o mestre pode mostrar aos jogadores.
        Schema::create('folhetos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mesa_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pasta_id')->nullable()->constrained('diario_pastas')->nullOnDelete();
            $table->string('nome', 80);
            $table->string('imagem');
            $table->text('texto')->nullable();
            $table->boolean('visivel')->default(false); // os jogadores o veem na lista
            $table->timestamps();
        });

        Schema::table('personagens', function (Blueprint $table) {
            $table->foreignId('pasta_id')->nullable()->after('cor')->constrained('diario_pastas')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('personagens', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pasta_id');
        });
        Schema::dropIfExists('folhetos');
        Schema::dropIfExists('diario_pastas');
    }
};

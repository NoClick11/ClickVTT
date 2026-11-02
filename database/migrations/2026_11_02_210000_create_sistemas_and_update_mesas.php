<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sistemas', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('nome');
            $table->text('descricao')->nullable();
            $table->string('icone')->nullable(); // nome do SVG em public/img/icones
            $table->boolean('ativo')->default(true);
            $table->timestamps();
        });

        // Sistemas disponíveis (dado de referência; regras serão relacionadas a cada um depois).
        $agora = now();
        DB::table('sistemas')->insert([
            ['slug' => 'dnd-5e', 'nome' => 'D&D 5e', 'descricao' => 'Dungeons & Dragons, quinta edição.', 'icone' => 'dragon-head', 'ativo' => true, 'created_at' => $agora, 'updated_at' => $agora],
            ['slug' => 'one-piece', 'nome' => 'One Piece', 'descricao' => 'RPG de aventura pirata no mundo de One Piece.', 'icone' => 'skull-crossed-bones', 'ativo' => true, 'created_at' => $agora, 'updated_at' => $agora],
        ]);

        Schema::table('mesas', function (Blueprint $table) {
            $table->foreignId('sistema_id')->nullable()->after('slug')->constrained('sistemas');
        });

        $padrao = DB::table('sistemas')->where('slug', 'dnd-5e')->value('id');
        $onePiece = DB::table('sistemas')->where('slug', 'one-piece')->value('id');
        DB::table('mesas')->where('sistema', 'One Piece')->update(['sistema_id' => $onePiece]);
        DB::table('mesas')->whereNull('sistema_id')->update(['sistema_id' => $padrao]);

        Schema::table('mesas', function (Blueprint $table) {
            $table->dropColumn(['sistema', 'proxima_sessao']);
        });

        // SQLite (usado nos testes) não suporta ALTER COLUMN; a coluna fica nullable lá.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE mesas ALTER COLUMN sistema_id SET NOT NULL');
        }
    }

    public function down(): void
    {
        Schema::table('mesas', function (Blueprint $table) {
            $table->string('sistema')->default('D&D 5e');
            $table->dateTime('proxima_sessao')->nullable();
            $table->dropConstrainedForeignId('sistema_id');
        });
        Schema::dropIfExists('sistemas');
    }
};

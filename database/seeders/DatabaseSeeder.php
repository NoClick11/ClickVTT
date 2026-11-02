<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Conta de teste do mestre (login: mestre@clickvtt.test / senha: password).
     */
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'mestre@clickvtt.test'],
            ['name' => 'Mestre', 'password' => 'password', 'email_verified_at' => now()],
        );
    }
}

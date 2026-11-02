<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_visitantes_sao_enviados_para_o_login()
    {
        $this->get('/')->assertRedirect('/login');
    }

    public function test_mestre_logado_ve_a_home_das_mesas()
    {
        $this->actingAs(User::factory()->create())->get('/')->assertOk();
    }
}

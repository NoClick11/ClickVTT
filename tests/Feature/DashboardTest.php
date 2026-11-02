<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_o_dashboard_antigo_redireciona_para_a_home()
    {
        $this->get('/dashboard')->assertRedirect('/');
        $this->actingAs(User::factory()->create())->get('/dashboard')->assertRedirect('/');
    }
}

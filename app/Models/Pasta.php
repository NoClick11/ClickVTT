<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Pasta extends Model
{
    protected $fillable = ['nome', 'ordem'];

    public function mesa(): BelongsTo
    {
        return $this->belongsTo(Mesa::class);
    }

    public function paginas(): HasMany
    {
        return $this->hasMany(Pagina::class);
    }
}

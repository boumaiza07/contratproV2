<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UnsignedContract extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'nom_contrat',
        'file_path',
        'file_type',
        'form_data',
        'user_id',
        'status'
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'form_data' => 'array',
    ];

    /**
     * Get the user that owns the unsigned contract.
     */
    public function user()
    {
        return $this->belongsTo(User::class)->withDefault();
    }

    /**
     * Get the signed contract associated with this unsigned contract.
     */
    public function signedContract()
    {
        return $this->hasOne(SignedContract::class);
    }
}

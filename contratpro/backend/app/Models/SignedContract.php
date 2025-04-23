<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SignedContract extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'nom_contrat',
        'email_signataire',
        'file_path',
        'user_id',
        'signature_data',
        'file_type',
        'unsigned_contract_id',
    ];

    /**
     * Get the user that owns the signed contract.
     */
    public function user()
    {
        return $this->belongsTo(User::class)->withDefault();
    }

    /**
     * Get the unsigned contract that was signed.
     */
    public function unsignedContract()
    {
        return $this->belongsTo(UnsignedContract::class);
    }
}
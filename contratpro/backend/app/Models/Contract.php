<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Contract extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'document_id',
        'user_id',
        'contract_number',
        'contract_data',
        'file_path',
        'status',
    ];

    protected $casts = [
        'contract_data' => 'array',
    ];

    // Relations
    public function document()
    {
        return $this->belongsTo(Document::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeDraft($query)
    {
        return $query->where('status', 'draft');
    }

    public function scopeSigned($query)
    {
        return $query->where('status', 'signed');
    }

    // Generate a unique contract number
    public static function generateContractNumber()
    {
        $prefix = 'CT-';
        $year = date('Y');
        $month = date('m');
        
        $lastContract = self::whereYear('created_at', $year)
            ->whereMonth('created_at', $month)
            ->orderBy('id', 'desc')
            ->first();
        
        $sequence = 1;
        if ($lastContract) {
            $parts = explode('-', $lastContract->contract_number);
            $lastSequence = intval(end($parts));
            $sequence = $lastSequence + 1;
        }
        
        return $prefix . $year . $month . '-' . str_pad($sequence, 4, '0', STR_PAD_LEFT);
    }
}
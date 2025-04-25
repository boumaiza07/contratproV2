<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('signed_contracts', function (Blueprint $table) {
            $table->id();
            $table->string('nom_contrat');
            $table->string('email_signataire');
            $table->text('signature_data')->nullable();
            $table->string('file_path');
            $table->string('file_type')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('cascade');
            $table->unsignedBigInteger('unsigned_contract_id')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('signed_contracts');
    }
};

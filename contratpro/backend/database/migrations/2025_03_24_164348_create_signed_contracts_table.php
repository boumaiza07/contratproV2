<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
{
    Schema::create('signed_contracts', function (Blueprint $table) {
        $table->id();
        $table->string('contract_name');
        $table->string('signer_email');
        $table->text('signature_data');
        $table->string('pdf_path');
        $table->foreignId('user_id')->constrained()->onDelete('cascade');
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

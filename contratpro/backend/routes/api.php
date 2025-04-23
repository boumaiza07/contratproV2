<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\SignedContractController;
use App\Http\Controllers\API\UnsignedContractController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\SigninController;
use App\Http\Controllers\Api\ContractController;
use App\Http\Controllers\FileUploadController;
use App\Http\Controllers\Api\DocumentGenerationController;

// File upload routes - accessible without authentication
Route::post('/upload', [FileUploadController::class, 'upload']);
Route::get('/files', [FileUploadController::class, 'listFiles']);
Route::get('/files/download/{filename}', [FileUploadController::class, 'download']);
Route::delete('/files/deleteAll', [FileUploadController::class, 'deleteAll']);
Route::get('/files/extracted-data/{filename}', [FileUploadController::class, 'getExtractedData']);

// Document generation routes
Route::post('/documents/generate', [DocumentGenerationController::class, 'generate']);
Route::get('/documents/download/{filename}', [DocumentGenerationController::class, 'download']);


// User route
Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

// Contract routes
Route::prefix('contracts')->middleware('auth:sanctum')->group(function () {
    Route::get('/', [ContractController::class, 'index']);
    Route::get('/{id}', [ContractController::class, 'show']);
    Route::post('/', [ContractController::class, 'store']);
    Route::put('/{id}', [ContractController::class, 'update']);
    Route::delete('/{id}', [ContractController::class, 'destroy']);
    Route::get('/{id}/download', [ContractController::class, 'download']);
});

// Contract signing routes
Route::post('/contrats/sign', [ContractController::class, 'sign']);
Route::post('/contrats/sign/word', [ContractController::class, 'signWord']);
Route::post('/contrats/sign/text', [ContractController::class, 'signText']);

// Signed Contract routes - public access for viewing and downloading
Route::prefix('signed-contracts')->group(function () {
    Route::get('/', [SignedContractController::class, 'index']);
    Route::get('/{id}', [SignedContractController::class, 'show']);
    Route::get('/{id}/download', [SignedContractController::class, 'download']);

    // Only creation requires authentication
    Route::post('/', [SignedContractController::class, 'store'])->middleware('auth:sanctum');
});

// Unsigned Contract routes - public access for viewing and downloading
Route::prefix('unsigned-contracts')->group(function () {
    Route::get('/', [UnsignedContractController::class, 'index']);
    Route::get('/{id}', [UnsignedContractController::class, 'show']);
    Route::get('/{id}/download', [UnsignedContractController::class, 'download']);

    // Only deletion requires authentication
    Route::delete('/{id}', [UnsignedContractController::class, 'destroy'])->middleware('auth:sanctum');
});

// Auth routes
Route::post('/signin', [AuthController::class, 'signin']);
Route::post('/signout', [AuthController::class, 'signout'])->middleware('auth:sanctum');
Route::post('/signup', [AuthController::class, 'signup']);
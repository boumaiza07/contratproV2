<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});

// Test PHPWord installation
Route::get('/test-phpword', function() {
    return class_exists(\PhpOffice\PhpWord\IOFactory::class)
        ? "PHPWord is installed correctly"
        : "PHPWord is NOT installed";
});

<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\HasApiTokens;

class SigninController extends Controller
{
    public function authenticate(Request $request)
    {
        try {
            $validated = $request->validate([
                'email' => 'required|email',
                'password' => 'required'
            ]);

            $user = User::where('email', $validated['email'])->first();

            if (!$user) {
                return response()->json([
                    'message' => 'Invalid credentials',
                    'errors' => ['email' => ['User not found']]
                ], 401);
            }

            if (!Hash::check($validated['password'], $user->password)) {
                return response()->json([
                    'message' => 'Invalid credentials',
                    'errors' => ['password' => ['Wrong password']]
                ], 401);
            }

            // Vérifier que le modèle User utilise HasApiTokens
            if (!method_exists($user, 'createToken')) {
                throw new \Exception('Sanctum not properly configured');
            }

            $token = $user->createToken('auth-token')->plainTextToken;

            return response()->json([
                'message' => 'Login successful',
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Signin error: ' . $e->getMessage());
            return response()->json([
                'message' => 'Server error',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }
}
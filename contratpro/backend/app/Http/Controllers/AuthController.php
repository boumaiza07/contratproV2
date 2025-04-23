<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function signin(Request $request)
    {
        $request->validate([
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $user = $request->user();
        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Successfully logged in',
            'user' => $user,
            'token' => $token,
            'token_type' => 'Bearer',
        ]);
    }
    public function signout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Successfully logged out'
        ]);
    }
    public function signup(Request $request)
    {
        try {
            $validated = $request->validate([
                'firstname' => 'required|string|max:255',
                'lastname' => 'required|string|max:255',
                'email' => 'required|string|email|max:255|unique:users',
                'password' => ['required', 'confirmed', Password::min(8)],
            ]);
    
            $user = User::create([
                'firstname' => $validated['firstname'],
                'lastname' => $validated['lastname'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
            ]);
    
            return response()->json([
                'message' => 'User registered successfully',
                'user' => $user->makeHidden(['password']) // Don't return password
            ], 201);
    
        } catch (\Exception $e) {
            \Log::error('Signup error: '.$e->getMessage());
            return response()->json([
                'message' => 'Server error',
                'error' => $e->getMessage() // Only in development!
            ], 500);
        }
    }
}
<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Contract;
use App\Models\SignedContract;
use App\Models\UnsignedContract;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;

class AdminController extends Controller
{
    /**
     * Get all users
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function getUsers()
    {
        $users = User::all();
        return response()->json(['users' => $users]);
    }

    /**
     * Get user by ID
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function getUser($id)
    {
        $user = User::findOrFail($id);
        return response()->json(['user' => $user]);
    }

    /**
     * Create a new user
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function createUser(Request $request)
    {
        $validated = $request->validate([
            'firstname' => 'required|string|max:255',
            'lastname' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => ['required', Password::min(8)],
            'is_admin' => 'boolean',
        ]);

        $user = User::create([
            'firstname' => $validated['firstname'],
            'lastname' => $validated['lastname'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'is_admin' => $validated['is_admin'] ?? false,
        ]);

        return response()->json([
            'message' => 'User created successfully',
            'user' => $user->makeHidden(['password'])
        ], 201);
    }

    /**
     * Update a user
     *
     * @param \Illuminate\Http\Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateUser(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'firstname' => 'string|max:255',
            'lastname' => 'string|max:255',
            'email' => 'string|email|max:255|unique:users,email,' . $id,
            'is_admin' => 'boolean',
        ]);

        if ($request->has('password')) {
            $request->validate([
                'password' => ['required', Password::min(8)],
            ]);
            $validated['password'] = Hash::make($request->password);
        }

        $user->update($validated);

        return response()->json([
            'message' => 'User updated successfully',
            'user' => $user->makeHidden(['password'])
        ]);
    }

    /**
     * Delete a user
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function deleteUser($id)
    {
        $user = User::findOrFail($id);
        $user->delete();

        return response()->json([
            'message' => 'User deleted successfully'
        ]);
    }



    /**
     * Get dashboard statistics
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function getDashboardStats()
    {
        // Get total users count
        try {
            $totalUsers = User::count();
            $adminUsers = User::where('is_admin', true)->count();
            $regularUsers = $totalUsers - $adminUsers;
        } catch (\Exception $e) {
            $totalUsers = 0;
            $adminUsers = 0;
            $regularUsers = 0;
        }

        // Get verified vs unverified users
        try {
            $verifiedUsers = User::whereNotNull('email_verified_at')->count();
            $unverifiedUsers = User::whereNull('email_verified_at')->count();
        } catch (\Exception $e) {
            $verifiedUsers = 0;
            $unverifiedUsers = 0;
        }

        // Get users who accepted terms
        try {
            $termsAcceptedUsers = User::where('terms_accepted', true)->count();
        } catch (\Exception $e) {
            $termsAcceptedUsers = 0;
        }

        // Get users created per month for the last 12 months
        $twelveMonthsAgo = now()->subMonths(12);

        try {
            // Use a more compatible SQL syntax for date extraction
            $usersPerMonth = User::where('created_at', '>=', $twelveMonthsAgo)
                ->selectRaw("DATE_FORMAT(created_at, '%m') as month, DATE_FORMAT(created_at, '%Y') as year, count(*) as count")
                ->groupBy(DB::raw("DATE_FORMAT(created_at, '%Y')"), DB::raw("DATE_FORMAT(created_at, '%m')"))
                ->orderBy('year')
                ->orderBy('month')
                ->get();
        } catch (\Exception $e) {
            $usersPerMonth = collect([]);
        }

        // Get recent user registrations
        try {
            $recentUsers = User::orderBy('created_at', 'desc')
                ->take(10)
                ->get(['id', 'firstname', 'lastname', 'email', 'created_at', 'email_verified_at', 'is_admin']);
        } catch (\Exception $e) {
            $recentUsers = collect([]);
        }

        // Get users with most recent activity (based on personal_access_tokens)
        try {
            $activeUsers = DB::table('users')
                ->join('personal_access_tokens', 'users.id', '=', 'personal_access_tokens.tokenable_id')
                ->where('personal_access_tokens.tokenable_type', 'App\\Models\\User')
                ->select('users.id', 'users.firstname', 'users.lastname', 'users.email',
                         DB::raw('MAX(personal_access_tokens.last_used_at) as last_activity'))
                ->groupBy('users.id', 'users.firstname', 'users.lastname', 'users.email')
                ->orderByDesc('last_activity')
                ->take(10)
                ->get();
        } catch (\Exception $e) {
            $activeUsers = collect([]);
        }

        return response()->json([
            'total_users' => $totalUsers,
            'admin_users' => $adminUsers,
            'regular_users' => $regularUsers,
            'verified_users' => $verifiedUsers,
            'unverified_users' => $unverifiedUsers,
            'terms_accepted_users' => $termsAcceptedUsers,
            'users_per_month' => $usersPerMonth,
            'recent_users' => $recentUsers,
            'active_users' => $activeUsers,
        ]);
    }


}

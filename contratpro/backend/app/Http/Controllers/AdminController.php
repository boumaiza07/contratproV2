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
                ->get(['id', 'firstname', 'lastname', 'email', 'created_at', 'is_admin']);
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

        // Get contract statistics
        try {
            // Total contracts
            $totalSignedContracts = SignedContract::count();
            $totalUnsignedContracts = UnsignedContract::count();
            $totalContracts = $totalSignedContracts + $totalUnsignedContracts;

            // Pending contracts
            $pendingContracts = UnsignedContract::where('status', 'pending')->count();

            // Contracts per month for the last 12 months
            $contractsPerMonth = collect();

            // Signed contracts per month
            $signedContractsPerMonth = SignedContract::where('created_at', '>=', $twelveMonthsAgo)
                ->selectRaw("DATE_FORMAT(created_at, '%m') as month, DATE_FORMAT(created_at, '%Y') as year, count(*) as count")
                ->groupBy(DB::raw("DATE_FORMAT(created_at, '%Y')"), DB::raw("DATE_FORMAT(created_at, '%m')"))
                ->orderBy('year')
                ->orderBy('month')
                ->get();

            // Unsigned contracts per month
            $unsignedContractsPerMonth = UnsignedContract::where('created_at', '>=', $twelveMonthsAgo)
                ->selectRaw("DATE_FORMAT(created_at, '%m') as month, DATE_FORMAT(created_at, '%Y') as year, count(*) as count")
                ->groupBy(DB::raw("DATE_FORMAT(created_at, '%Y')"), DB::raw("DATE_FORMAT(created_at, '%m')"))
                ->orderBy('year')
                ->orderBy('month')
                ->get();

            // Recent contracts
            $recentContracts = collect();

            // Recent signed contracts
            $recentSignedContracts = SignedContract::with('user')
                ->orderBy('created_at', 'desc')
                ->take(5)
                ->get()
                ->map(function($contract) {
                    return [
                        'id' => $contract->id,
                        'name' => $contract->nom_contrat,
                        'type' => 'signed',
                        'user' => $contract->user ? $contract->user->firstname . ' ' . $contract->user->lastname : 'Unknown',
                        'email' => $contract->email_signataire,
                        'created_at' => $contract->created_at
                    ];
                });

            // Recent unsigned contracts
            $recentUnsignedContracts = UnsignedContract::with('user')
                ->orderBy('created_at', 'desc')
                ->take(5)
                ->get()
                ->map(function($contract) {
                    return [
                        'id' => $contract->id,
                        'name' => $contract->nom_contrat,
                        'type' => 'unsigned',
                        'status' => $contract->status,
                        'user' => $contract->user ? $contract->user->firstname . ' ' . $contract->user->lastname : 'Unknown',
                        'created_at' => $contract->created_at
                    ];
                });

            // Merge and sort recent contracts
            $recentContracts = $recentSignedContracts->concat($recentUnsignedContracts)
                ->sortByDesc('created_at')
                ->take(10)
                ->values();

        } catch (\Exception $e) {
            $totalContracts = 0;
            $totalSignedContracts = 0;
            $totalUnsignedContracts = 0;
            $pendingContracts = 0;
            $signedContractsPerMonth = collect([]);
            $unsignedContractsPerMonth = collect([]);
            $recentContracts = collect([]);
        }

        return response()->json([
            // User statistics
            'total_users' => $totalUsers,
            'admin_users' => $adminUsers,
            'regular_users' => $regularUsers,
            'terms_accepted_users' => $termsAcceptedUsers,
            'users_per_month' => $usersPerMonth,
            'recent_users' => $recentUsers,
            'active_users' => $activeUsers,

            // Contract statistics
            'total_contracts' => $totalContracts,
            'signed_contracts' => $totalSignedContracts,
            'unsigned_contracts' => $totalUnsignedContracts,
            'pending_contracts' => $pendingContracts,
            'signed_contracts_per_month' => $signedContractsPerMonth,
            'unsigned_contracts_per_month' => $unsignedContractsPerMonth,
            'recent_contracts' => $recentContracts
        ]);
    }


}

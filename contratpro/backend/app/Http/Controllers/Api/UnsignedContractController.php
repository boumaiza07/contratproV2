<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UnsignedContract;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Response;

class UnsignedContractController extends Controller
{
    /**
     * Display a listing of unsigned contracts.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        try {
            Log::info('Fetching all unsigned contracts');

            // If user is authenticated, show their contracts first
            if (Auth::check()) {
                $userContracts = UnsignedContract::where('user_id', Auth::id())
                    ->orderBy('created_at', 'desc')
                    ->get();

                $otherContracts = UnsignedContract::whereNull('user_id')
                    ->orWhere('user_id', '!=', Auth::id())
                    ->orderBy('created_at', 'desc')
                    ->get();

                // Combine and paginate manually
                $allContracts = $userContracts->merge($otherContracts);
                $page = request()->get('page', 1);
                $perPage = 10;
                $contracts = new \Illuminate\Pagination\LengthAwarePaginator(
                    $allContracts->forPage($page, $perPage),
                    $allContracts->count(),
                    $perPage,
                    $page
                );
            } else {
                // If not authenticated, show all contracts
                $contracts = UnsignedContract::orderBy('created_at', 'desc')
                    ->paginate(10);
            }

            Log::info('Found ' . $contracts->count() . ' unsigned contracts');

            return response()->json($contracts);
        } catch (\Exception $e) {
            Log::error('Error fetching unsigned contracts', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch unsigned contracts: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified unsigned contract.
     *
     * @param  int  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($id)
    {
        try {
            Log::info('Fetching unsigned contract details', ['contract_id' => $id]);

            // First try to find the contract associated with the authenticated user
            if (Auth::check()) {
                $contract = UnsignedContract::where('user_id', Auth::id())
                    ->where('id', $id)
                    ->first();

                if ($contract) {
                    Log::info('Found unsigned contract for authenticated user', ['contract_id' => $id, 'user_id' => Auth::id()]);
                    return response()->json($contract);
                }
            }

            // If not found or user not authenticated, try to find the contract without user constraint
            $contract = UnsignedContract::findOrFail($id);
            Log::info('Found unsigned contract without user constraint', ['contract_id' => $id]);

            return response()->json($contract);
        } catch (\Exception $e) {
            Log::error('Error fetching unsigned contract details', [
                'contract_id' => $id,
                'error' => $e->getMessage()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Unsigned contract not found'
            ], 404);
        }
    }

    /**
     * Download an unsigned contract file.
     *
     * @param  int  $id
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
     */
    public function download($id)
    {
        try {
            Log::info('Downloading unsigned contract', ['contract_id' => $id]);

            // First try to find the contract associated with the authenticated user
            if (Auth::check()) {
                $contract = UnsignedContract::where('user_id', Auth::id())
                    ->where('id', $id)
                    ->first();

                if (!$contract) {
                    // If not found for authenticated user, try to find without user constraint
                    $contract = UnsignedContract::findOrFail($id);
                    Log::info('Found unsigned contract without user constraint for download', ['contract_id' => $id]);
                }
            } else {
                // If user not authenticated, try to find the contract without user constraint
                $contract = UnsignedContract::findOrFail($id);
                Log::info('Found unsigned contract without user constraint for download (unauthenticated)', ['contract_id' => $id]);
            }

            if (!$contract->file_path || !Storage::disk('public')->exists($contract->file_path)) {
                Log::error('Unsigned contract file not found', [
                    'contract_id' => $id,
                    'file_path' => $contract->file_path
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'Unsigned contract file not found'
                ], 404);
            }

            $fullPath = Storage::disk('public')->path($contract->file_path);
            $fileName = basename($contract->file_path);

            // Determine the MIME type from the file or use the stored file_type
            $mimeType = $contract->file_type ?? File::mimeType($fullPath);

            Log::info('Serving unsigned contract file', [
                'contract_id' => $id,
                'file_path' => $fullPath,
                'mime_type' => $mimeType
            ]);

            return Response::download($fullPath, $fileName, [
                'Content-Type' => $mimeType,
            ]);
        } catch (\Exception $e) {
            Log::error('Error downloading unsigned contract', [
                'contract_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to download unsigned contract: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete an unsigned contract.
     *
     * @param  int  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy($id)
    {
        try {
            Log::info('Deleting unsigned contract', ['contract_id' => $id]);

            $contract = UnsignedContract::where('user_id', Auth::id())
                ->findOrFail($id);

            // Delete the file if it exists
            if ($contract->file_path && Storage::disk('public')->exists($contract->file_path)) {
                Storage::disk('public')->delete($contract->file_path);
                Log::info('Deleted unsigned contract file', ['file_path' => $contract->file_path]);
            }

            $contract->delete();
            Log::info('Unsigned contract deleted successfully', ['contract_id' => $id]);

            return response()->json([
                'success' => true,
                'message' => 'Unsigned contract deleted successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Error deleting unsigned contract', [
                'contract_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to delete unsigned contract: ' . $e->getMessage()
            ], 500);
        }
    }
}

<?php

// app/Http/Controllers/API/SignedContractController.php
namespace App\Http\Controllers\Api;

use App\Models\SignedContract;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Response;
use Validator;

class SignedContractController extends Controller
{
    /**
     * Display a listing of signed contracts.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        try {
            Log::info('Fetching all signed contracts');

            // If user is authenticated, show their contracts first
            if (Auth::check()) {
                $userContracts = SignedContract::where('user_id', Auth::id())
                    ->orderBy('created_at', 'desc')
                    ->get();

                $otherContracts = SignedContract::whereNull('user_id')
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
                $contracts = SignedContract::orderBy('created_at', 'desc')
                    ->paginate(10);
            }

            Log::info('Found ' . $contracts->count() . ' signed contracts');

            return response()->json($contracts);
        } catch (\Exception $e) {
            Log::error('Error fetching signed contracts', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch signed contracts: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified signed contract.
     *
     * @param  int  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($id)
    {
        try {
            Log::info('Fetching signed contract details', ['contract_id' => $id]);

            // First try to find the contract associated with the authenticated user
            if (Auth::check()) {
                $contract = SignedContract::where('user_id', Auth::id())
                    ->where('id', $id)
                    ->first();

                if ($contract) {
                    Log::info('Found signed contract for authenticated user', ['contract_id' => $id, 'user_id' => Auth::id()]);
                    return response()->json($contract);
                }
            }

            // If not found or user not authenticated, try to find the contract without user constraint
            $contract = SignedContract::findOrFail($id);
            Log::info('Found signed contract without user constraint', ['contract_id' => $id]);

            return response()->json($contract);
        } catch (\Exception $e) {
            Log::error('Error fetching signed contract details', [
                'contract_id' => $id,
                'error' => $e->getMessage()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Signed contract not found'
            ], 404);
        }
    }

    /**
     * Store a newly created signed contract.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function store(Request $request)
    {
        try {
            Log::info('Creating new signed contract');

            $validated = $request->validate([
                'nom_contrat' => 'required|string|max:255',
                'email_signataire' => 'required|email|max:255',
                'signature_data' => 'required|string',
                'pdf_file' => 'required|file|max:10240' // Accept any file type, up to 10MB
            ]);

            if ($request->hasFile('pdf_file')) {
                $uploadedFile = $request->file('pdf_file');
                $originalFileName = $uploadedFile->getClientOriginalName();
                $fileType = $uploadedFile->getMimeType();

                Log::info('Processing file for signing', [
                    'fileName' => $originalFileName,
                    'fileType' => $fileType,
                    'fileSize' => $uploadedFile->getSize()
                ]);

                // Generate a unique filename with timestamp
                $fileName = time() . '_' . $originalFileName;
                $filePath = $uploadedFile->storeAs('contracts/signed', $fileName, 'public');

                Log::info('File stored successfully', ['path' => $filePath]);

                $contract = SignedContract::create([
                    'nom_contrat' => $validated['nom_contrat'],
                    'email_signataire' => $validated['email_signataire'],
                    'signature_data' => $validated['signature_data'],
                    'file_path' => $filePath,
                    'file_type' => $fileType,
                    'user_id' => Auth::id()
                ]);

                Log::info('Signed contract created successfully', ['contract_id' => $contract->id]);

                return response()->json([
                    'success' => true,
                    'message' => 'Contract signed and stored successfully',
                    'data' => $contract
                ], 201);
            }

            Log::warning('No file uploaded with signed contract request');
            return response()->json([
                'success' => false,
                'message' => 'File is required'
            ], 422);
        } catch (\Exception $e) {
            Log::error('Error creating signed contract', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to create signed contract: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Download a signed contract file.
     *
     * @param  int  $id
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
     */
    public function download($id)
    {
        try {
            Log::info('Downloading signed contract', ['contract_id' => $id]);

            // First try to find the contract associated with the authenticated user
            if (Auth::check()) {
                $contract = SignedContract::where('user_id', Auth::id())
                    ->where('id', $id)
                    ->first();

                if (!$contract) {
                    // If not found for authenticated user, try to find without user constraint
                    $contract = SignedContract::findOrFail($id);
                    Log::info('Found signed contract without user constraint for download', ['contract_id' => $id]);
                }
            } else {
                // If user not authenticated, try to find the contract without user constraint
                $contract = SignedContract::findOrFail($id);
                Log::info('Found signed contract without user constraint for download (unauthenticated)', ['contract_id' => $id]);
            }

            if (!$contract->file_path || !Storage::disk('public')->exists($contract->file_path)) {
                Log::error('Signed contract file not found', [
                    'contract_id' => $id,
                    'file_path' => $contract->file_path
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'Signed contract file not found'
                ], 404);
            }

            $fullPath = Storage::disk('public')->path($contract->file_path);
            $fileName = basename($contract->file_path);

            // Determine the MIME type from the file or use the stored file_type
            $mimeType = $contract->file_type ?? File::mimeType($fullPath);

            Log::info('Serving signed contract file', [
                'contract_id' => $id,
                'file_path' => $fullPath,
                'mime_type' => $mimeType
            ]);

            return Response::download($fullPath, $fileName, [
                'Content-Type' => $mimeType,
            ]);
        } catch (\Exception $e) {
            Log::error('Error downloading signed contract', [
                'contract_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to download signed contract: ' . $e->getMessage()
            ], 500);
        }
    }
}
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UnsignedContract;
use App\Services\DocumentGenerationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class DocumentGenerationController extends Controller
{
    protected $documentGenerator;

    public function __construct(DocumentGenerationService $documentGenerator)
    {
        $this->documentGenerator = $documentGenerator;
    }

    /**
     * Generate a document with placeholders replaced by values
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function generate(Request $request)
    {
        Log::info('Document generation request received');
        Log::debug('Request data: ' . json_encode($request->all()));

        // Validate the request
        $validator = Validator::make($request->all(), [
            'filename' => 'required|string',
            'replacements' => 'required|array'
        ]);

        if ($validator->fails()) {
            Log::error('Document generation validation failed: ' . json_encode($validator->errors()));
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $filename = $request->input('filename');
        $replacements = $request->input('replacements');

        // Check if the original file exists
        $originalFilePath = 'uploads/' . $filename;
        if (!Storage::disk('public')->exists($originalFilePath)) {
            Log::error('Original file not found: ' . $originalFilePath);
            return response()->json([
                'success' => false,
                'message' => 'Original file not found'
            ], 404);
        }

        // Generate the document
        $generatedFilePath = $this->documentGenerator->generateDocument($originalFilePath, $replacements);

        if (!$generatedFilePath) {
            Log::error('Failed to generate document');
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate document'
            ], 500);
        }

        // Get file type
        $fileType = null;
        $extension = strtolower(pathinfo($generatedFilePath, PATHINFO_EXTENSION));
        $fullPath = Storage::disk('public')->path($generatedFilePath);

        if (file_exists($fullPath)) {
            $fileType = mime_content_type($fullPath);
            Log::info('Generated file type: ' . $fileType);
        }

        // Save to unsigned_contracts table
        try {
            $unsignedContract = new UnsignedContract([
                'nom_contrat' => pathinfo($filename, PATHINFO_FILENAME),
                'file_path' => $generatedFilePath,
                'file_type' => $fileType,
                'form_data' => $replacements,
                'status' => 'pending'
            ]);

            // Associate with user if authenticated
            if (Auth::check()) {
                $unsignedContract->user_id = Auth::id();
                Log::info('Associated unsigned contract with user', ['user_id' => Auth::id()]);
            } else {
                Log::info('No authenticated user for this unsigned contract');
            }

            $unsignedContract->save();
            Log::info('Unsigned contract saved to database', ['id' => $unsignedContract->id]);
        } catch (\Exception $e) {
            Log::error('Failed to save unsigned contract to database', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            // Continue even if saving to database fails
        }

        // Return the path to the generated file
        return response()->json([
            'success' => true,
            'message' => 'Document generated successfully',
            'file' => [
                'name' => basename($generatedFilePath),
                'path' => $generatedFilePath,
                'download_url' => url('api/documents/download/' . basename($generatedFilePath)),
                'unsigned_contract_id' => $unsignedContract->id ?? null
            ]
        ]);
    }

    /**
     * Download a generated document
     *
     * @param string $filename
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
     */
    public function download($filename)
    {
        $path = 'generated/' . $filename;
        Log::info('Attempting to download generated file: ' . $path);

        // Check if the generated directory exists
        if (!Storage::disk('public')->exists('generated')) {
            Log::error('Generated directory does not exist');
            Storage::disk('public')->makeDirectory('generated');
            Log::info('Created generated directory');
        }

        if (Storage::disk('public')->exists($path)) {
            $fullPath = Storage::disk('public')->path($path);
            Log::info('File exists at path: ' . $fullPath);

            // Check if the file is readable
            if (!is_readable($fullPath)) {
                Log::error('File is not readable: ' . $fullPath);
                return response()->json([
                    'success' => false,
                    'message' => 'Generated file is not readable'
                ], 500);
            }

            $mimeType = mime_content_type($fullPath);
            Log::info('File mime type: ' . $mimeType);

            return response()->download($fullPath, $filename, [
                'Content-Type' => $mimeType,
            ]);
        }

        // List all files in the generated directory for debugging
        $files = Storage::disk('public')->files('generated');
        Log::error('Generated file not found: ' . $path);
        Log::info('Files in generated directory: ' . json_encode($files));

        return response()->json([
            'success' => false,
            'message' => 'Generated file not found'
        ], 404);
    }
}

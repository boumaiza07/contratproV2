<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Response;
use Illuminate\Support\Str;
use App\Services\DocumentProcessingService;
// Service de génération de fichiers supprimé

class FileUploadController extends Controller
{
    protected $documentProcessor;

    public function __construct(DocumentProcessingService $documentProcessor)
    {
        $this->documentProcessor = $documentProcessor;
    }

    /**
     * Upload a file
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function upload(Request $request)
    {
        try {
            $request->validate([
                'document' => 'required|file|max:10240', // 10MB max size
            ]);

            if (!$request->hasFile('document')) {
                return response()->json([
                    'success' => false,
                    'message' => 'No file uploaded'
                ], 400);
            }

            $file = $request->file('document');

            // Vérifier si le fichier est valide
            if (!$file->isValid()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid file: ' . $file->getErrorMessage()
                ], 400);
            }

            $originalName = $file->getClientOriginalName();
            $extension = $file->getClientOriginalExtension();

            // Vérifier l'extension du fichier
            $allowedExtensions = ['txt', 'docx', 'pdf'];
            if (!in_array(strtolower($extension), $allowedExtensions)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unsupported file type. Allowed types: ' . implode(', ', $allowedExtensions)
                ], 400);
            }

            $safeFilename = Str::slug(pathinfo($originalName, PATHINFO_FILENAME)) . '_' . time() . '.' . $extension;

            // Store the file in the public uploads directory
            $path = $file->storeAs('uploads', $safeFilename, 'public');

            if (!$path) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to store file'
                ], 500);
            }

            try {
                // Extract data from the file
                $extractedData = $this->documentProcessor->processFile($file);

                return response()->json([
                    'success' => true,
                    'message' => 'File uploaded successfully',
                    'file' => [
                        'name' => $safeFilename,
                        'path' => $path,
                        'extractedData' => $extractedData
                    ]
                ]);
            } catch (\Exception $e) {
                \Log::error('Error during data extraction: ' . $e->getMessage());

                return response()->json([
                    'success' => true,
                    'message' => 'File uploaded but data extraction failed: ' . $e->getMessage(),
                    'file' => [
                        'name' => $safeFilename,
                        'path' => $path,
                        'extractedData' => []
                    ]
                ]);
            }
        } catch (\Exception $e) {
            \Log::error('Error during file upload: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to upload file: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * List all uploaded files
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function listFiles()
    {
        $files = Storage::disk('public')->files('uploads');

        $fileList = [];
        foreach ($files as $file) {
            $fileInfo = pathinfo($file);
            $fileList[] = [
                'filename' => $fileInfo['basename'],
                'size' => Storage::disk('public')->size($file),
                'last_modified' => Storage::disk('public')->lastModified($file),
                'url' => asset('storage/' . $file)
            ];
        }

        return response()->json([
            'success' => true,
            'files' => $fileList
        ]);
    }

    /**
     * Download a file by filename
     *
     * @param string $filename
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse|\Illuminate\Http\JsonResponse
     */
    public function download($filename)
    {
        $path = 'uploads/' . $filename;

        if (Storage::disk('public')->exists($path)) {
            $fullPath = storage_path('app/public/' . $path);
            $mimeType = File::mimeType($fullPath);

            return Response::download($fullPath, $filename, [
                'Content-Type' => $mimeType,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'File not found'
        ], 404);
    }

    /**
     * Delete all uploaded files
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function deleteAll()
    {
        try {
            $files = Storage::disk('public')->files('uploads');
            $deletedCount = 0;

            foreach ($files as $file) {
                if (Storage::disk('public')->delete($file)) {
                    $deletedCount++;
                }
            }

            return response()->json([
                'success' => true,
                'message' => $deletedCount . ' fichier(s) supprimé(s) avec succès.'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erreur lors de la suppression des fichiers: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get extracted data from a file
     *
     * @param string $filename
     * @return \Illuminate\Http\JsonResponse
     */
    public function getExtractedData($filename)
    {
        $filePath = Storage::disk('public')->path('uploads/' . $filename);

        if (!File::exists($filePath)) {
            return response()->json([
                'success' => false,
                'message' => 'File not found'
            ], 404);
        }

        try {
            $file = new \Illuminate\Http\UploadedFile($filePath, $filename);
            $extractedData = $this->documentProcessor->processFile($file);

            return response()->json([
                'success' => true,
                'data' => $extractedData
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Data extraction failed: ' . $e->getMessage()
            ], 500);
        }
    }
}

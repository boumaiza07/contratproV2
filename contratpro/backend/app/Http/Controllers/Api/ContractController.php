<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\Document;
use App\Services\DocumentSigningService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Barryvdh\DomPDF\Facade\Pdf;

class ContractController extends Controller
{
    /**
     * @var DocumentSigningService
     */
    protected $documentSigningService;

    /**
     * Constructor
     */
    public function __construct(DocumentSigningService $documentSigningService)
    {
        $this->documentSigningService = $documentSigningService;
    }

    /**
     * Get all contracts for the user
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $contracts = Contract::where('user_id', Auth::id())
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        return response()->json($contracts);
    }

    /**
     * Get a contract by ID
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function show($id)
    {
        try {
            $contract = Contract::where('user_id', Auth::id())
                ->findOrFail($id);

            return response()->json($contract);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Contract not found'
            ], 404);
        }
    }

    /**
     * Download a contract as PDF
     *
     * @param int $id
     * @return \Illuminate\Http\Response
     */
    public function download($id)
    {
        try {
            $contract = Contract::where('user_id', Auth::id())
                ->with('document')
                ->findOrFail($id);

            // Check if a PDF file exists
            if ($contract->file_path && Storage::disk('public')->exists($contract->file_path)) {
                return response()->download(
                    Storage::disk('public')->path($contract->file_path),
                    $contract->contract_number . '.pdf'
                );
            }

            // Generate PDF from contract data
            $contractData = $contract->contract_data;

            // Generate HTML content
            $html = $this->generateContractHTML($contractData);

            // Generate PDF
            $pdf = PDF::loadHTML($html);
            $pdfFilename = $contract->contract_number . '.pdf';
            $pdfPath = 'contracts/' . $pdfFilename;

            // Save the PDF
            Storage::disk('public')->put($pdfPath, $pdf->output());

            // Update contract with file path
            $contract->update([
                'file_path' => $pdfPath
            ]);

            return response()->download(
                Storage::disk('public')->path($pdfPath),
                $pdfFilename
            );
        } catch (\Exception $e) {
            Log::error('Contract download failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to download contract: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Generate HTML content for contract
     *
     * @param array $contractData
     * @return string
     */
    private function generateContractHTML($contractData)
    {
        $html = '<!DOCTYPE html><html><head><style>';
        $html .= 'body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }';
        $html .= 'h1 { color: #2c3e50; text-align: center; }';
        $html .= '.contract-header { text-align: center; margin-bottom: 30px; }';
        $html .= '.contract-body { margin-bottom: 30px; }';
        $html .= '.signature-area { margin-top: 100px; display: flex; justify-content: space-between; }';
        $html .= '.signature-line { border-top: 1px solid #000; width: 200px; margin-top: 5px; }';
        $html .= '</style></head><body>';

        // Contract header
        $html .= '<div class="contract-header">';
        $html .= '<h1>CONTRACT AGREEMENT</h1>';
        $html .= '<p>Contract Number: ' . ($contractData['contract_number'] ?? '') . '</p>';
        $html .= '<p>Date: ' . date('F j, Y') . '</p>';
        $html .= '</div>';

        // Contract body with dynamic data
        $html .= '<div class="contract-body">';
        foreach ($contractData as $key => $value) {
            if ($key != 'contract_number') {
                $html .= '<p><strong>' . ucfirst(str_replace('_', ' ', $key)) . ':</strong> ' . $value . '</p>';
            }
        }
        $html .= '</div>';

        // Signature area
        $html .= '<div class="signature-area">';
        $html .= '<div><div class="signature-line"></div><p>Client Signature</p></div>';
        $html .= '<div><div class="signature-line"></div><p>Company Signature</p></div>';
        $html .= '</div>';

        $html .= '</body></html>';

        return $html;
    }

    /**
     * Update a contract
     *
     * @param Request $request
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, $id)
    {
        $request->validate([
            'contract_data' => 'required|array',
            'status' => 'nullable|string|in:draft,active,signed',
        ]);

        try {
            $contract = Contract::where('user_id', Auth::id())
                ->findOrFail($id);

            $dataToUpdate = [
                'contract_data' => $request->input('contract_data'),
            ];

            if ($request->has('status')) {
                $dataToUpdate['status'] = $request->input('status');
            }

            $contract->update($dataToUpdate);

            // If there's a file path, delete it to force regeneration on next download
            if ($contract->file_path && Storage::disk('public')->exists($contract->file_path)) {
                Storage::disk('public')->delete($contract->file_path);
                $contract->update(['file_path' => null]);
            }

            return response()->json($contract);
        } catch (\Exception $e) {
            Log::error('Contract update failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to update contract: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a contract
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy($id)
    {
        try {
            $contract = Contract::where('user_id', Auth::id())
                ->findOrFail($id);

            // Delete the file if it exists
            if ($contract->file_path && Storage::disk('public')->exists($contract->file_path)) {
                Storage::disk('public')->delete($contract->file_path);
            }

            $contract->delete();

            return response()->json([
                'message' => 'Contract deleted successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Contract deletion failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to delete contract: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Sign a contract
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function sign(Request $request)
    {
        try {
            Log::info('Contract signing process started');

            // Validate request
            $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
                'nom_contrat' => 'required|string',
                'email_signataire' => 'required|email',
                'signature_data' => 'required|string',
                'pdf_file' => 'required|file|max:10240|mimes:pdf,doc,docx', // Only PDF and Word files, up to 10MB
                'unsigned_contract_id' => 'nullable|exists:unsigned_contracts,id',
            ]);

            if ($validator->fails()) {
                Log::warning('Contract signing validation failed', ['errors' => $validator->errors()]);

                // Check if there's a file type error
                if ($validator->errors()->has('pdf_file')) {
                    $fileError = $validator->errors()->get('pdf_file');
                    if (strpos(implode(' ', $fileError), 'mimes') !== false) {
                        return response()->json([
                            'success' => false,
                            'message' => 'Format de fichier non supporté. Veuillez utiliser PDF ou Word (.pdf, .doc, .docx).',
                            'errors' => $validator->errors()
                        ], 422);
                    }
                }

                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Get the uploaded file
            $uploadedFile = $request->file('pdf_file');
            $originalFileName = $uploadedFile->getClientOriginalName();
            $fileExtension = $uploadedFile->getClientOriginalExtension();
            $fileType = $uploadedFile->getMimeType();

            Log::info('Processing file for signing', [
                'fileName' => $originalFileName,
                'fileType' => $fileType,
                'fileExtension' => $fileExtension,
                'fileSize' => $uploadedFile->getSize()
            ]);

            // Generate a unique filename with timestamp
            $fileName = time() . '_' . $originalFileName;

            // Store the file in the public storage
            $filePath = $uploadedFile->storeAs('contracts/signed', $fileName, 'public');
            Log::info('File stored successfully', ['path' => $filePath]);

            // Traiter le fichier selon son type
            $signedFilePath = $filePath; // Par défaut, utiliser le fichier original
            $signerName = $request->input('nom_contrat');
            $signatureData = $request->input('signature_data');

            // Déterminer le type de fichier et appliquer le traitement approprié
            $lowerExtension = strtolower($fileExtension);

            if ($lowerExtension === 'docx' || $lowerExtension === 'doc' ||
                $fileType === 'application/msword' ||
                $fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {

                Log::info('Traitement d\'un document Word');
                $processedPath = $this->documentSigningService->signWordDocument($filePath, $signatureData, $signerName);

                if ($processedPath) {
                    $signedFilePath = $processedPath;
                    Log::info('Document Word signé avec succès', ['path' => $signedFilePath]);

                    // Delete the original uploaded file to avoid duplication
                    if (Storage::disk('public')->exists($filePath) && $filePath !== $signedFilePath) {
                        Storage::disk('public')->delete($filePath);
                        Log::info('Deleted original Word document after signing', ['file_path' => $filePath]);
                    }
                } else {
                    Log::warning('Échec de la signature du document Word, utilisation du fichier original');
                }
            }

            else if ($lowerExtension === 'pdf' ||
                    $fileType === 'application/pdf') {
                Log::info('Traitement d\'un document PDF, conservation du fichier original');
                // For PDF files, we keep the original file
            }
            else {
                // This should never happen due to validation, but just in case
                Log::warning('Type de fichier non supporté: ' . $fileType);
                return response()->json([
                    'success' => false,
                    'message' => 'Format de fichier non supporté. Veuillez utiliser PDF ou Word (.pdf, .doc, .docx).'
                ], 400);
            }

            // Create a signed contract record
            $signedContract = new \App\Models\SignedContract();
            $signedContract->nom_contrat = $signerName;
            $signedContract->email_signataire = $request->input('email_signataire');
            $signedContract->file_path = $signedFilePath; // Utiliser le chemin du fichier signé
            $signedContract->signature_data = $signatureData; // Store signature data
            $signedContract->file_type = $fileType; // Store the file type

            // Associate with user if authenticated
            if (Auth::check()) {
                $signedContract->user_id = Auth::id();
                Log::info('Associated contract with user', ['user_id' => Auth::id()]);
            } else {
                Log::info('No authenticated user for this contract');
            }

            // Link to unsigned contract if provided
            if ($request->has('unsigned_contract_id')) {
                $unsignedContractId = $request->input('unsigned_contract_id');
                $signedContract->unsigned_contract_id = $unsignedContractId;
                Log::info('Linked to unsigned contract', ['unsigned_contract_id' => $unsignedContractId]);

                // Store the unsigned contract ID to delete it after saving the signed contract
                $unsignedContractToDelete = $unsignedContractId;
            }

            $signedContract->save();
            Log::info('Signed contract record created successfully', ['contract_id' => $signedContract->id]);

            // Now delete the unsigned contract if needed
            if (isset($unsignedContractToDelete)) {
                try {
                    $unsignedContract = \App\Models\UnsignedContract::find($unsignedContractToDelete);
                    if ($unsignedContract) {
                        // Store the file path before deleting the record
                        $unsignedFilePath = $unsignedContract->file_path;

                        // Delete the unsigned contract record
                        $unsignedContract->delete();
                        Log::info('Deleted unsigned contract after signing', ['unsigned_contract_id' => $unsignedContractToDelete]);

                        // Delete the unsigned contract file if it exists and is different from the signed file
                        if ($unsignedFilePath && Storage::disk('public')->exists($unsignedFilePath) && $unsignedFilePath !== $signedFilePath) {
                            Storage::disk('public')->delete($unsignedFilePath);
                            Log::info('Deleted unsigned contract file after signing', ['file_path' => $unsignedFilePath]);
                        }
                    }
                } catch (\Exception $e) {
                    Log::error('Failed to delete unsigned contract after signing', [
                        'unsigned_contract_id' => $unsignedContractToDelete,
                        'error' => $e->getMessage()
                    ]);
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Contract signed successfully',
                'contract' => $signedContract
            ], 201);
        } catch (\Exception $e) {
            Log::error('Contract signing failed: ' . $e->getMessage(), [
                'exception' => $e,
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to sign contract: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Sign a Word document and return it directly
     *
     * @param Request $request
     * @return \Illuminate\Http\Response
     */
    public function signWord(Request $request)
    {
        try {
            Log::info('Word document signing process started');

            // Validate request
            $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
                'nom_contrat' => 'required|string',
                'email_signataire' => 'required|email',
                'signature_data' => 'required|string',
                'pdf_file' => 'required|file|max:10240|mimes:doc,docx', // Only accept Word documents
                'unsigned_contract_id' => 'nullable|exists:unsigned_contracts,id',
            ]);

            if ($validator->fails()) {
                Log::warning('Word document signing validation failed', ['errors' => $validator->errors()]);

                // Check if there's a file type error
                if ($validator->errors()->has('pdf_file')) {
                    $fileError = $validator->errors()->get('pdf_file');
                    if (strpos(implode(' ', $fileError), 'mimes') !== false) {
                        return response()->json([
                            'success' => false,
                            'message' => 'Format de fichier non supporté. Veuillez utiliser Word (.doc, .docx).',
                            'errors' => $validator->errors()
                        ], 422);
                    }
                }

                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Get the uploaded file
            $uploadedFile = $request->file('pdf_file');
            $originalFileName = $uploadedFile->getClientOriginalName();
            $fileExtension = $uploadedFile->getClientOriginalExtension();
            $fileType = $uploadedFile->getMimeType();

            Log::info('Processing Word document for signing', [
                'fileName' => $originalFileName,
                'fileType' => $fileType,
                'fileExtension' => $fileExtension,
                'fileSize' => $uploadedFile->getSize()
            ]);

            // Generate a unique filename with timestamp
            $fileName = time() . '_' . $originalFileName;

            // Store the file in the public storage
            $filePath = $uploadedFile->storeAs('contracts/signed', $fileName, 'public');
            Log::info('Word document stored successfully', ['path' => $filePath]);

            // Get the signer name and signature data
            $signerName = $request->input('nom_contrat');
            $signatureData = $request->input('signature_data');

            // Process the Word document with the signature
            $signedFilePath = $this->documentSigningService->signWordDocument($filePath, $signatureData, $signerName);

            if (!$signedFilePath) {
                Log::error('Failed to sign Word document');
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to sign Word document'
                ], 500);
            }

            // Delete the original uploaded file to avoid duplication
            if (Storage::disk('public')->exists($filePath) && $filePath !== $signedFilePath) {
                Storage::disk('public')->delete($filePath);
                Log::info('Deleted original Word document after signing', ['file_path' => $filePath]);
            }

            Log::info('Word document signed successfully', ['path' => $signedFilePath]);

            // Create a signed contract record
            $signedContract = new \App\Models\SignedContract();
            $signedContract->nom_contrat = $signerName;
            $signedContract->email_signataire = $request->input('email_signataire');
            $signedContract->file_path = $signedFilePath;
            $signedContract->signature_data = $signatureData;
            $signedContract->file_type = $fileType;

            // Associate with user if authenticated
            if (Auth::check()) {
                $signedContract->user_id = Auth::id();
                Log::info('Associated Word document with user', ['user_id' => Auth::id()]);
            } else {
                Log::info('No authenticated user for this Word document');
            }

            // Link to unsigned contract if provided
            if ($request->has('unsigned_contract_id')) {
                $unsignedContractId = $request->input('unsigned_contract_id');
                $signedContract->unsigned_contract_id = $unsignedContractId;
                Log::info('Linked Word document to unsigned contract', ['unsigned_contract_id' => $unsignedContractId]);

                // Store the unsigned contract ID to delete it after saving the signed contract
                $unsignedContractToDelete = $unsignedContractId;
            }

            $signedContract->save();
            Log::info('Signed Word document record created successfully', ['contract_id' => $signedContract->id]);

            // Now delete the unsigned contract if needed
            if (isset($unsignedContractToDelete)) {
                try {
                    $unsignedContract = \App\Models\UnsignedContract::find($unsignedContractToDelete);
                    if ($unsignedContract) {
                        // Store the file path before deleting the record
                        $unsignedFilePath = $unsignedContract->file_path;

                        // Delete the unsigned contract record
                        $unsignedContract->delete();
                        Log::info('Deleted unsigned contract after signing Word document', ['unsigned_contract_id' => $unsignedContractToDelete]);

                        // Delete the unsigned contract file if it exists and is different from the signed file
                        if ($unsignedFilePath && Storage::disk('public')->exists($unsignedFilePath) && $unsignedFilePath !== $signedFilePath) {
                            Storage::disk('public')->delete($unsignedFilePath);
                            Log::info('Deleted unsigned contract file after signing Word document', ['file_path' => $unsignedFilePath]);
                        }
                    }
                } catch (\Exception $e) {
                    Log::error('Failed to delete unsigned contract after signing Word document', [
                        'unsigned_contract_id' => $unsignedContractToDelete,
                        'error' => $e->getMessage()
                    ]);
                }
            }

            // Return the signed document directly as a download
            $fullPath = Storage::disk('public')->path($signedFilePath);
            $fileName = basename($signedFilePath);
            $mimeType = $fileType;

            Log::info('Returning signed Word document', [
                'path' => $fullPath,
                'fileName' => $fileName,
                'mimeType' => $mimeType
            ]);

            return response()->download($fullPath, $fileName, [
                'Content-Type' => $mimeType,
            ]);
        } catch (\Exception $e) {
            Log::error('Word document signing failed: ' . $e->getMessage(), [
                'exception' => $e,
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Failed to sign Word document: ' . $e->getMessage()
            ], 500);
        }
    }


}
<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpWord\TemplateProcessor;
use PhpOffice\PhpWord\IOFactory;
use ZipArchive;
use Barryvdh\DomPDF\Facade\Pdf;
use Smalot\PdfParser\Parser;

class DocumentGenerationService
{
    /**
     * Generate a new document from a template with placeholders replaced by values
     *
     * @param string $originalFilePath Path to the original template file
     * @param array $replacements Key-value pairs where key is the placeholder name and value is the replacement
     * @return string|null Path to the generated file or null on failure
     */
    public function generateDocument(string $originalFilePath, array $replacements): ?string
    {
        Log::info('Generating document from template: ' . $originalFilePath);
        Log::debug('Replacements: ' . json_encode($replacements));

        $extension = strtolower(pathinfo($originalFilePath, PATHINFO_EXTENSION));

        try {
            switch ($extension) {
                case 'docx':
                case 'doc':
                    return $this->generateDocxDocument($originalFilePath, $replacements);
                case 'pdf':
                    return $this->generatePdfDocument($originalFilePath, $replacements);
                case 'html':
                case 'htm':
                    return $this->generatePdfDocument($originalFilePath, $replacements);
                default:
                    Log::error('Unsupported file type for document generation: ' . $extension);
                    return null;
            }
        } catch (\Exception $e) {
            Log::error('Error generating document: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Generate a new DOCX document from a template
     *
     * @param string $originalFilePath Path to the original DOCX file
     * @param array $replacements Key-value pairs for replacements
     * @return string|null Path to the generated file or null on failure
     */
    private function generateDocxDocument(string $originalFilePath, array $replacements): ?string
    {
        try {
            Log::info('Generating DOCX document from template: ' . $originalFilePath);

            // Check if PhpWord is available
            if (!class_exists('\PhpOffice\PhpWord\TemplateProcessor')) {
                Log::error('PhpOffice\PhpWord\TemplateProcessor class not found.');
                return $this->generateDocxDocumentFallback($originalFilePath, $replacements);
            }

            // Create a unique filename for the generated document
            $outputFilename = 'generated_' . time() . '_' . basename($originalFilePath);
            $outputPath = 'generated/' . $outputFilename;

            // Ensure the storage directory exists
            if (!Storage::disk('public')->exists('generated')) {
                Storage::disk('public')->makeDirectory('generated');
            }

            // Create a temporary copy of the original file to work with
            $tempFile = tempnam(sys_get_temp_dir(), 'docx_');
            copy(Storage::disk('public')->path($originalFilePath), $tempFile);

            // Use PhpWord's TemplateProcessor to replace placeholders
            $templateProcessor = new TemplateProcessor($tempFile);

            // Replace each placeholder with its value
            foreach ($replacements as $placeholder => $value) {
                $templateProcessor->setValue($placeholder, $value);
                Log::debug("Replaced placeholder: \${$placeholder} with value: {$value}");
            }

            // Save the generated document
            $outputTempFile = tempnam(sys_get_temp_dir(), 'docx_output_');
            $templateProcessor->saveAs($outputTempFile);

            // Move the file to the public storage
            Storage::disk('public')->put($outputPath, file_get_contents($outputTempFile));

            // Clean up temporary files
            unlink($tempFile);
            unlink($outputTempFile);

            Log::info('DOCX document generated successfully: ' . $outputPath);
            return $outputPath;
        } catch (\Exception $e) {
            Log::error('Error generating DOCX document: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return $this->generateDocxDocumentFallback($originalFilePath, $replacements);
        }
    }

    /**
     * Fallback method to generate a DOCX document when PhpWord is not available
     * Uses direct ZIP manipulation and XML replacement
     *
     * @param string $originalFilePath Path to the original DOCX file
     * @param array $replacements Key-value pairs for replacements
     * @return string|null Path to the generated file or null on failure
     */
    private function generateDocxDocumentFallback(string $originalFilePath, array $replacements): ?string
    {
        try {
            Log::info('Using fallback method to generate DOCX document');

            // Create a unique filename for the generated document
            $outputFilename = 'generated_' . time() . '_' . basename($originalFilePath);
            $outputPath = 'generated/' . $outputFilename;

            // Ensure the storage directory exists
            if (!Storage::disk('public')->exists('generated')) {
                Storage::disk('public')->makeDirectory('generated');
            }

            // Create a temporary copy of the original file to work with
            $tempFile = tempnam(sys_get_temp_dir(), 'docx_');
            copy(Storage::disk('public')->path($originalFilePath), $tempFile);

            // DOCX files are ZIP archives containing XML files
            $zip = new ZipArchive();
            if ($zip->open($tempFile) === true) {
                // Get the main document content
                $content = $zip->getFromName('word/document.xml');

                if ($content) {
                    // Replace each placeholder with its value
                    foreach ($replacements as $placeholder => $value) {
                        // Escape special XML characters in the value
                        $safeValue = htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');

                        // Replace the placeholder in the XML content
                        $content = str_replace('${'.$placeholder.'}', $safeValue, $content);
                        Log::debug("Replaced placeholder: \${$placeholder} with value: {$safeValue}");
                    }

                    // Update the document.xml file in the ZIP archive
                    $zip->addFromString('word/document.xml', $content);
                    $zip->close();

                    // Move the file to the public storage
                    Storage::disk('public')->put($outputPath, file_get_contents($tempFile));

                    // Clean up temporary file
                    unlink($tempFile);

                    Log::info('DOCX document generated successfully (fallback): ' . $outputPath);
                    return $outputPath;
                } else {
                    Log::error('Failed to extract document.xml from DOCX file');
                    $zip->close();
                    unlink($tempFile);
                    return null;
                }
            } else {
                Log::error('Failed to open DOCX file as ZIP archive');
                unlink($tempFile);
                return null;
            }
        } catch (\Exception $e) {
            Log::error('Error in fallback DOCX generation: ' . $e->getMessage());
            return null;
        }
    }



    /**
     * Generate a new PDF document from a template
     *
     * @param string $originalFilePath Path to the original PDF file
     * @param array $replacements Key-value pairs for replacements
     * @return string|null Path to the generated file or null on failure
     */
    private function generatePdfDocument(string $originalFilePath, array $replacements): ?string
    {
        try {
            Log::info('Generating PDF document from template: ' . $originalFilePath);
            Log::debug('Replacements for PDF: ' . json_encode($replacements));

            // Create a unique filename for the generated document
            $outputFilename = 'generated_' . time() . '_' . basename($originalFilePath);
            $outputPath = 'generated/' . $outputFilename;

            // Ensure the storage directory exists
            if (!Storage::disk('public')->exists('generated')) {
                Storage::disk('public')->makeDirectory('generated');
                Log::info('Created generated directory');
            }

            // Determine the approach based on the file extension
            $originalExtension = strtolower(pathinfo($originalFilePath, PATHINFO_EXTENSION));

            if ($originalExtension === 'pdf') {
                // This is a PDF template - we'll try to extract text, replace placeholders, and generate a new PDF
                return $this->generateFromPdfTemplate($originalFilePath, $replacements, $outputPath);
            } else if ($originalExtension === 'html' || $originalExtension === 'htm') {
                // This is an HTML template - we'll load it, replace placeholders, and convert to PDF
                return $this->generateFromHtmlTemplate($originalFilePath, $replacements, $outputPath);
            } else {
                // For other file types, we'll create a simple PDF with the replacements
                return $this->generateSimplePdf($replacements, $outputPath);
            }
        } catch (\Exception $e) {
            Log::error('Error generating PDF document: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return null;
        }
    }

    /**
     * Generate a PDF from a PDF template
     *
     * @param string $originalFilePath Path to the original PDF file
     * @param array $replacements Key-value pairs for replacements
     * @param string $outputPath Path where the generated file will be saved
     * @return string|null Path to the generated file or null on failure
     */
    private function generateFromPdfTemplate(string $originalFilePath, array $replacements, string $outputPath): ?string
    {
        try {
            Log::info('Generating PDF from PDF template: ' . $originalFilePath);

            // Read the original PDF content
            $pdfContent = Storage::disk('public')->get($originalFilePath);

            // Create a temporary file for the PDF
            $tempFile = tempnam(sys_get_temp_dir(), 'pdf_');
            file_put_contents($tempFile, $pdfContent);

            try {
                // Try to parse the PDF using PdfParser
                $parser = new Parser();
                $pdf = $parser->parseFile($tempFile);
                $text = $pdf->getText();

                Log::debug('Extracted text from PDF, length: ' . strlen($text));

                // Replace each placeholder with its value
                foreach ($replacements as $placeholder => $value) {
                    $text = str_replace('${'.$placeholder.'}', $value, $text);
                    Log::debug("Replaced placeholder: \${$placeholder} with value: {$value}");
                }

                // Generate a new PDF with the replaced content
                // We use <pre> tags to preserve formatting
                $newPdf = PDF::loadHTML('<pre style="font-family: Arial, sans-serif; font-size: 12pt;">' . $text . '</pre>');

                // Configure PDF options
                $newPdf->setPaper('a4');
                $newPdf->setOption('isPhpEnabled', true);
                $newPdf->setOption('isHtml5ParserEnabled', true);

                // Save the generated PDF
                Storage::disk('public')->put($outputPath, $newPdf->output());

                // Clean up temporary file
                unlink($tempFile);

                Log::info('PDF document generated successfully: ' . $outputPath);
                return $outputPath;
            } catch (\Exception $e) {
                Log::error('Error parsing PDF: ' . $e->getMessage());
                Log::info('Falling back to simple PDF generation');

                // Clean up temporary file
                if (file_exists($tempFile)) {
                    unlink($tempFile);
                }

                // Fall back to simple PDF generation
                return $this->generateSimplePdf($replacements, $outputPath);
            }
        } catch (\Exception $e) {
            Log::error('Error in generateFromPdfTemplate: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Generate a PDF from an HTML template
     *
     * @param string $originalFilePath Path to the original HTML file
     * @param array $replacements Key-value pairs for replacements
     * @param string $outputPath Path where the generated file will be saved
     * @return string|null Path to the generated file or null on failure
     */
    private function generateFromHtmlTemplate(string $originalFilePath, array $replacements, string $outputPath): ?string
    {
        try {
            Log::info('Generating PDF from HTML template: ' . $originalFilePath);

            // Read the original HTML content
            $htmlContent = Storage::disk('public')->get($originalFilePath);

            // Replace each placeholder with its value
            foreach ($replacements as $placeholder => $value) {
                $htmlContent = str_replace('${'.$placeholder.'}', $value, $htmlContent);
                Log::debug("Replaced placeholder: \${$placeholder} with value: {$value}");
            }

            // Generate PDF from the HTML content
            $pdf = PDF::loadHTML($htmlContent);

            // Configure PDF options
            $pdf->setPaper('a4');
            $pdf->setOption('isPhpEnabled', true);
            $pdf->setOption('isHtml5ParserEnabled', true);

            // Save the generated PDF
            Storage::disk('public')->put($outputPath, $pdf->output());

            Log::info('PDF generated from HTML template successfully: ' . $outputPath);
            return $outputPath;
        } catch (\Exception $e) {
            Log::error('Error in generateFromHtmlTemplate: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Generate a simple PDF with the replacements
     *
     * @param array $replacements Key-value pairs for replacements
     * @param string $outputPath Path where the generated file will be saved
     * @return string|null Path to the generated file or null on failure
     */
    private function generateSimplePdf(array $replacements, string $outputPath): ?string
    {
        try {
            Log::info('Generating simple PDF with replacements');

            // Create a simple HTML template with the replacements
            $html = <<<HTML
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Generated Document</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            margin: 2cm;
                        }
                        h1 {
                            color: #2c3e50;
                            border-bottom: 1px solid #eee;
                            padding-bottom: 10px;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin: 20px 0;
                        }
                        th, td {
                            padding: 12px;
                            text-align: left;
                            border-bottom: 1px solid #ddd;
                        }
                        th {
                            background-color: #f2f2f2;
                        }
                    </style>
                </head>
                <body>
                    <h1>Generated Document</h1>
                    <p>This document was generated with the following values:</p>
                    <table>
                        <tr>
                            <th>Field</th>
                            <th>Value</th>
                        </tr>
                HTML;

            foreach ($replacements as $placeholder => $value) {
                $html .= '<tr><td><strong>' . htmlspecialchars($placeholder) . '</strong></td><td>' . htmlspecialchars($value) . '</td></tr>';
            }

            $html .= <<<HTML
                    </table>
                    <p style="margin-top: 30px; font-size: 0.8em; color: #7f8c8d;">Generated on: {$this->getCurrentDateTime()}</p>
                </body>
                </html>
                HTML;

            // Generate PDF from HTML
            $pdf = PDF::loadHTML($html);

            // Configure PDF options
            $pdf->setPaper('a4');
            $pdf->setOption('isPhpEnabled', true);
            $pdf->setOption('isHtml5ParserEnabled', true);

            // Save the generated PDF
            Storage::disk('public')->put($outputPath, $pdf->output());

            Log::info('Simple PDF generated successfully: ' . $outputPath);
            return $outputPath;
        } catch (\Exception $e) {
            Log::error('Error in generateSimplePdf: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Get the current date and time formatted
     *
     * @return string Formatted date and time
     */
    private function getCurrentDateTime(): string
    {
        return date('Y-m-d H:i:s');
    }
}

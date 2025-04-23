<?php

namespace Tests\Feature;

use App\Services\DocumentGenerationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PdfGenerationTest extends TestCase
{
    /**
     * Test PDF generation from a text file
     */
    public function test_generate_pdf_from_text(): void
    {
        // Create a test text file with placeholders
        $content = "Test document with placeholders: \${name}, \${email}, \${date}";
        Storage::disk('public')->put('uploads/test_template.txt', $content);

        // Create replacements
        $replacements = [
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'date' => date('Y-m-d')
        ];

        // Generate PDF
        $service = new DocumentGenerationService();
        $outputPath = $service->generateDocument('uploads/test_template.txt', $replacements);

        // Assert the file was generated
        $this->assertNotNull($outputPath);
        $this->assertTrue(Storage::disk('public')->exists($outputPath));

        // Clean up
        Storage::disk('public')->delete('uploads/test_template.txt');
        Storage::disk('public')->delete($outputPath);
    }

    /**
     * Test PDF generation from an HTML file
     */
    public function test_generate_pdf_from_html(): void
    {
        // Create a test HTML file with placeholders
        $content = "<!DOCTYPE html>
        <html>
        <head>
            <title>Test HTML Template</title>
        </head>
        <body>
            <h1>Hello, \${name}!</h1>
            <p>Your email is: \${email}</p>
            <p>Date: \${date}</p>
        </body>
        </html>";
        Storage::disk('public')->put('uploads/test_template.html', $content);

        // Create replacements
        $replacements = [
            'name' => 'Jane Smith',
            'email' => 'jane@example.com',
            'date' => date('Y-m-d')
        ];

        // Generate PDF
        $service = new DocumentGenerationService();
        $outputPath = $service->generateDocument('uploads/test_template.html', $replacements);

        // Assert the file was generated
        $this->assertNotNull($outputPath);
        $this->assertTrue(Storage::disk('public')->exists($outputPath));

        // Clean up
        Storage::disk('public')->delete('uploads/test_template.html');
        Storage::disk('public')->delete($outputPath);
    }

    /**
     * Test simple PDF generation
     */
    public function test_generate_simple_pdf(): void
    {
        // Create replacements
        $replacements = [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'date' => date('Y-m-d'),
            'address' => '123 Test Street',
            'phone' => '555-1234'
        ];

        // Generate PDF - use a valid extension to trigger the PDF generation
        $service = new DocumentGenerationService();
        $outputPath = $service->generateDocument('nonexistent_file.pdf', $replacements);

        // Assert the file was generated
        $this->assertNotNull($outputPath);
        $this->assertTrue(Storage::disk('public')->exists($outputPath));

        // Clean up
        Storage::disk('public')->delete($outputPath);
    }
}

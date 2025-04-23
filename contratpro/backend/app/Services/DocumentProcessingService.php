<?php

namespace App\Services;

class DocumentProcessingService
{
    /**
     * Extract data from document content
     */
    public function extractData(string $content): array
    {
        \Log::info('Extracting data from content of length: ' . strlen($content));

        // Rechercher spécifiquement le format ${name}
        $pattern = '/\$\{([^\}]+)\}/';
        $extractedData = [];

        // Essayer de corriger les problèmes de formatage courants pour le format ${name}
        $content = str_replace('$ {', '${', $content);
        $content = str_replace('} ', '}', $content);

        // Rechercher des patterns qui pourraient être des placeholders mal formatés
        if (preg_match_all('/\$\s*\{\s*([^\}]+)\s*\}/', $content, $matches)) {
            \Log::info('Found ' . count($matches[0]) . ' potential malformed placeholders');

            // Corriger les placeholders mal formatés
            foreach ($matches[0] as $index => $match) {
                $corrected = '${'. trim($matches[1][$index]) .'}';
                $content = str_replace($match, $corrected, $content);
                \Log::debug("Corrected placeholder: {$match} -> {$corrected}");
            }
        }

        // Rechercher les placeholders au format ${name}
        if (preg_match_all($pattern, $content, $matches)) {
            \Log::info('Found ' . count($matches[0]) . ' matches with format ${name}');
            \Log::debug('Matches with format ${name}: ' . json_encode($matches[0]));

            // Utiliser un tableau temporaire pour regrouper les champs par clé
            $tempFields = [];

            // Traiter chaque occurrence du format ${name}
            foreach ($matches[0] as $index => $fullMatch) {
                $value = $matches[1][$index];
                \Log::debug("Processing match: {$fullMatch}, extracted value: {$value}");

                // Utiliser directement le texte entre accolades comme nom de champ
                $fieldName = $value;
                \Log::debug("Using text as field name: {$fieldName}");

                // Vérifier si cette clé existe déjà
                if (!isset($tempFields[$fieldName])) {
                    // Première occurrence de cette clé
                    $tempFields[$fieldName] = [
                        'key' => $fieldName,
                        'value' => $fieldName, // Utiliser le même texte comme valeur
                        'original' => $fullMatch,
                        'occurrences' => [$fullMatch] // Stocker toutes les occurrences
                    ];
                } else {
                    // Clé déjà rencontrée, ajouter cette occurrence
                    $tempFields[$fieldName]['occurrences'][] = $fullMatch;
                    \Log::debug("Duplicate field found: {$fieldName}, now has " . count($tempFields[$fieldName]['occurrences']) . " occurrences");
                }
            }

            // Convertir le tableau associatif en tableau indexé
            $extractedData = array_values($tempFields);
            \Log::info('Extracted ' . count($extractedData) . ' unique fields after deduplication');

            // Ajouter un log pour déboguer les champs avec plusieurs occurrences
            foreach ($extractedData as $index => $field) {
                if (count($field['occurrences']) > 1) {
                    \Log::debug("Field '{$field['key']}' has " . count($field['occurrences']) . " occurrences: " . json_encode($field['occurrences']));
                }

                // Nettoyer le tableau pour supprimer la propriété 'occurrences' qui n'est pas nécessaire pour le frontend
                unset($extractedData[$index]['occurrences']);
            }
        } else {
            \Log::warning('No matches found with format ${name}');
            \Log::debug('Content preview: ' . substr($content, 0, 500));
        }

        return $extractedData;
    }

    /**
     * Process an uploaded file and extract its content
     */
    public function processFile($file)
    {
        try {
            $content = '';
            $extension = strtolower($file->getClientOriginalExtension());

            \Log::info('Processing file with extension: ' . $extension);

            // Vérifier si le fichier existe et est lisible
            if (!file_exists($file->getPathname()) || !is_readable($file->getPathname())) {
                \Log::error('File does not exist or is not readable: ' . $file->getPathname());
                return [];
            }

            // Vérifier la taille du fichier
            if (filesize($file->getPathname()) === 0) {
                \Log::error('File is empty: ' . $file->getPathname());
                return [];
            }

            switch ($extension) {
                case 'txt':
                    try {
                        $content = file_get_contents($file->getPathname());
                        if ($content === false) {
                            \Log::error('Failed to read TXT file: ' . $file->getPathname());
                            return [];
                        }
                    } catch (\Exception $e) {
                        \Log::error('Error reading TXT file: ' . $e->getMessage());
                        return [];
                    }
                    break;
                case 'docx':
                    $content = $this->extractDocxContent($file);
                    break;
                case 'pdf':
                    $content = $this->extractPdfContent($file);
                    break;
                default:
                    // Essayer de traiter comme un fichier texte
                    \Log::warning('Unsupported file type: ' . $extension . '. Trying to process as text file.');
                    try {
                        $content = @file_get_contents($file->getPathname());
                        if ($content === false) {
                            \Log::error('Failed to read file as text: ' . $file->getPathname());
                            return [];
                        }
                    } catch (\Exception $e) {
                        \Log::error('Error reading file as text: ' . $e->getMessage());
                        return [];
                    }
            }

            // Vérifier si le contenu est vide
            if (empty($content)) {
                \Log::warning('Extracted content is empty');
                return [];
            }

            return $this->extractData($content);
        } catch (\Exception $e) {
            \Log::error('Error processing file: ' . $e->getMessage());
            // Retourner un tableau vide en cas d'erreur
            return [];
        }
    }

    /**
     * Extract content from DOCX file
     */
    public function extractDocxContent($file)
    {
        try {
            \Log::info('Extracting content from DOCX file: ' . $file->getClientOriginalName());

            // Vérifier si la classe PhpWord est disponible
            if (!class_exists('\PhpOffice\PhpWord\IOFactory')) {
                \Log::error('PhpOffice\PhpWord\IOFactory class not found. Using fallback method.');
                return $this->extractDocxContentFallback($file);
            }

            // Utiliser directement la méthode de secours pour éviter les problèmes avec PhpWord
            // Cette ligne est temporaire et peut être supprimée une fois que le problème est résolu
            return $this->extractDocxContentFallback($file);

            /* Commentaire temporaire pour déboguer
            $phpWord = \PhpOffice\PhpWord\IOFactory::load($file->getPathname());
            $content = '';

            // Parcourir toutes les sections du document
            foreach ($phpWord->getSections() as $sectionIndex => $section) {
                \Log::debug("Processing section {$sectionIndex}");
                $content .= $this->extractTextFromElements($section->getElements());
            }

            // Log the extracted content for debugging
            \Log::info('Extracted DOCX content length: ' . strlen($content));
            \Log::debug('DOCX content preview: ' . substr($content, 0, 500) . '...');

            return $content;
            */
        } catch (\Exception $e) {
            \Log::error('Error extracting content from DOCX file: ' . $e->getMessage());
            return $this->extractDocxContentFallback($file);
        }
    }

    /**
     * Méthode de secours pour extraire le contenu d'un fichier DOCX
     * Utilise une approche simple basée sur les expressions régulières
     */
    private function extractDocxContentFallback($file)
    {
        \Log::info('Using fallback method to extract DOCX content');

        try {
            // Créer un répertoire temporaire
            $tempDir = sys_get_temp_dir() . '/' . uniqid('docx_');
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }

            // Copier le fichier DOCX dans le répertoire temporaire
            $tempFile = $tempDir . '/' . $file->getClientOriginalName();
            copy($file->getPathname(), $tempFile);

            // Extraire le contenu du fichier ZIP (DOCX est un fichier ZIP)
            $zip = new \ZipArchive();
            if ($zip->open($tempFile) === true) {
                // Extraire le fichier document.xml qui contient le contenu du document
                $content = $zip->getFromName('word/document.xml');
                $zip->close();

                // Nettoyer le contenu XML pour extraire le texte
                // Conserver les sauts de ligne pour une meilleure extraction des champs
                $content = preg_replace('/<w:p[^>]*>/', "\n", $content); // Remplacer les paragraphes par des sauts de ligne
                $content = preg_replace('/<[^>]+>/', ' ', $content); // Supprimer les autres balises XML
                $content = preg_replace('/\s+/', ' ', $content); // Normaliser les espaces
                $content = str_replace(' \n ', "\n", $content); // Nettoyer les sauts de ligne
                $content = preg_replace('/\n+/', "\n", $content); // Supprimer les sauts de ligne multiples
                $content = trim($content);

                // Vérifier si le contenu contient des placeholders au format ${name}
                if (!preg_match('/\$\{([^\}]+)\}/', $content)) {
                    \Log::warning('No ${name} placeholders found in DOCX content, trying to fix potential formatting issues');

                    // Essayer de corriger les problèmes de formatage courants pour le format ${name}
                    $content = str_replace('$ {', '${', $content);
                    $content = str_replace('} ', '}', $content);

                    // Rechercher des patterns qui pourraient être des placeholders mal formatés
                    if (preg_match_all('/\$\s*\{\s*([^\}]+)\s*\}/', $content, $matches)) {
                        \Log::info('Found ' . count($matches[0]) . ' potential malformed placeholders');

                        // Corriger les placeholders mal formatés
                        foreach ($matches[0] as $index => $match) {
                            $corrected = '${'. trim($matches[1][$index]) .'}';
                            $content = str_replace($match, $corrected, $content);
                            \Log::debug("Corrected placeholder: {$match} -> {$corrected}");
                        }
                    }
                }

                // Nettoyer les fichiers temporaires
                unlink($tempFile);
                rmdir($tempDir);

                \Log::info('Extracted DOCX content length (fallback): ' . strlen($content));
                \Log::debug('DOCX content preview (fallback): ' . substr($content, 0, 500) . '...');

                return $content;
            } else {
                \Log::error('Failed to open DOCX file as ZIP archive');
                throw new \Exception('Failed to open DOCX file as ZIP archive');
            }
        } catch (\Exception $e) {
            \Log::error('Error in fallback DOCX extraction: ' . $e->getMessage());
            // Retourner une chaîne vide en cas d'échec
            return '';
        }
    }

    /**
     * Extrait le texte des éléments d'un document Word de manière récursive
     */
    private function extractTextFromElements($elements)
    {
        $content = '';

        foreach ($elements as $element) {
            $className = get_class($element);
            \Log::debug("Processing element of type: {$className}");

            try {
                // Si c'est un élément TextRun, parcourir ses sous-éléments
                if ($element instanceof \PhpOffice\PhpWord\Element\TextRun) {
                    $content .= $this->extractTextFromElements($element->getElements());
                    $content .= "\n";
                }
                // Si c'est un élément Text, ajouter son contenu
                elseif ($element instanceof \PhpOffice\PhpWord\Element\Text) {
                    $text = $element->getText();
                    \Log::debug("Found text: {$text}");
                    $content .= $text;
                }
                // Si c'est un élément Table, parcourir ses cellules
                elseif ($element instanceof \PhpOffice\PhpWord\Element\Table) {
                    foreach ($element->getRows() as $row) {
                        foreach ($row->getCells() as $cell) {
                            $content .= $this->extractTextFromElements($cell->getElements());
                        }
                        $content .= "\n";
                    }
                }
                // Si c'est un autre type d'élément qui contient des éléments, les parcourir
                elseif (method_exists($element, 'getElements')) {
                    $content .= $this->extractTextFromElements($element->getElements());
                }
                // Si c'est un élément qui a une méthode getText, utiliser cette méthode
                elseif (method_exists($element, 'getText')) {
                    $text = $element->getText();
                    \Log::debug("Found text via getText(): {$text}");
                    $content .= $text . "\n";
                }
            } catch (\Exception $e) {
                \Log::warning('Error extracting text from element: ' . $e->getMessage());
                // Continue with the next element
            }
        }

        return $content;
    }

    /**
     * Extract content from PDF file
     */
    public function extractPdfContent($file)
    {
        try {
            \Log::info('Extracting content from PDF file: ' . $file->getClientOriginalName());

            // Vérifier si la classe Parser est disponible
            if (!class_exists('\Smalot\PdfParser\Parser')) {
                \Log::error('Smalot\PdfParser\Parser class not found. Returning empty content.');
                return '';
            }

            $parser = new \Smalot\PdfParser\Parser();
            $pdf = $parser->parseFile($file->getPathname());
            $content = $pdf->getText();

            \Log::info('Extracted PDF content length: ' . strlen($content));
            \Log::debug('PDF content preview: ' . substr($content, 0, 500) . '...');

            return $content;
        } catch (\Exception $e) {
            \Log::error('Error extracting content from PDF file: ' . $e->getMessage());
            return '';
        }
    }
}
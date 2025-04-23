<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Element\Section;
use PhpOffice\PhpWord\Element\Image;
use PhpOffice\PhpWord\Element\TextRun;

class DocumentSigningService
{
    /**
     * Ajoute une signature à un document Word
     *
     * @param string $filePath Chemin du fichier dans le stockage
     * @param string $signatureData Données de la signature en base64
     * @param string $signerName Nom du signataire
     * @return string|null Chemin du fichier signé ou null en cas d'erreur
     */
    public function signWordDocument(string $filePath, string $signatureData, string $signerName): ?string
    {
        try {
            Log::info('Début du processus de signature du document Word', [
                'filePath' => $filePath
            ]);

            // Vérifier si le fichier existe
            if (!Storage::disk('public')->exists($filePath)) {
                Log::error('Le fichier Word à signer n\'existe pas', ['filePath' => $filePath]);
                return null;
            }

            // Chemin complet du fichier
            $fullPath = Storage::disk('public')->path($filePath);

            // Charger le document Word
            $phpWord = IOFactory::load($fullPath);

            // Obtenir la dernière section ou en créer une nouvelle si nécessaire
            $sections = $phpWord->getSections();
            $lastSection = end($sections);

            if (!$lastSection) {
                Log::warning('Aucune section trouvée dans le document, création d\'une nouvelle section');
                $lastSection = $phpWord->addSection();
            }

            // Ajouter un saut de page avant la signature si nécessaire
            // Si le document a déjà du contenu, ajouter un saut de page
            if (count($sections) > 0 && count($lastSection->getElements()) > 0) {
                $lastSection->addPageBreak();
            }

            // Ajouter les informations de signature dans le format exact demandé
            $dateText = date('d/m/Y'); // Format jour/mois/année comme dans l'exemple

            // Créer un paragraphe pour chaque ligne avec un espacement approprié
            // Ligne "Signé par : [nom]"
            $lastSection->addText("Signé par : {$signerName}", ['size' => 12], ['spaceAfter' => 120]);

            // Ligne "Fait le : [date]"
            $lastSection->addText("Fait le : {$dateText}", ['size' => 12], ['spaceAfter' => 120]);

            // Ligne "Signature électronique"
            $lastSection->addText("Signature électronique", ['size' => 12], ['spaceAfter' => 240]);

            // Traiter l'image de signature (supprimer le préfixe data URL)
            $signatureBase64 = '';
            if (strpos($signatureData, 'data:image/png;base64,') === 0) {
                $signatureBase64 = substr($signatureData, 22); // Enlever 'data:image/png;base64,'
            } else {
                $signatureBase64 = $signatureData;
            }

            // Créer un fichier temporaire pour l'image de signature
            $tempSignatureFile = tempnam(sys_get_temp_dir(), 'signature_') . '.png';
            file_put_contents($tempSignatureFile, base64_decode($signatureBase64));

            Log::info('Signature image created', ['tempFile' => $tempSignatureFile]);

            // Ajouter l'image de signature au document avec des dimensions appropriées
            try {
                $lastSection->addImage($tempSignatureFile, [
                    'width' => 180,
                    'height' => 60,
                    'alignment' => 'left',
                    'marginTop' => 0,
                    'marginBottom' => 10
                ]);
                Log::info('Signature image added to Word document');
            } catch (\Exception $e) {
                Log::error('Error adding signature image to Word document', [
                    'error' => $e->getMessage()
                ]);
                // Fallback to text signature if image fails
                $lastSection->addText("___________/\\___________", ['size' => 12], ['spaceAfter' => 240]);
            }

            // Générer un nouveau nom de fichier pour le document signé
            $originalFileName = basename($filePath);
            $signedFileName = pathinfo($originalFileName, PATHINFO_FILENAME) . '_signed_' . time() . '.' . pathinfo($originalFileName, PATHINFO_EXTENSION);
            $signedFilePath = 'contracts/signed/' . $signedFileName;

            // Sauvegarder le document modifié
            $fullSignedPath = Storage::disk('public')->path($signedFilePath);
            $objWriter = IOFactory::createWriter($phpWord, 'Word2007');
            $objWriter->save($fullSignedPath);

            // Supprimer le fichier temporaire de signature
            unlink($tempSignatureFile);

            Log::info('Document Word signé avec succès', [
                'originalPath' => $filePath,
                'signedPath' => $signedFilePath
            ]);

            return $signedFilePath;
        } catch (\Exception $e) {
            Log::error('Erreur lors de la signature du document Word', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return null;
        }
    }

    /**
     * Ajoute une signature à un fichier texte
     *
     * @param string $filePath Chemin du fichier dans le stockage
     * @param string $signerName Nom du signataire
     * @param string|null $signatureData Données de la signature en base64 (optionnel)
     * @return string|null Chemin du fichier signé ou null en cas d'erreur
     */
    public function signTextDocument(string $filePath, string $signerName, ?string $signatureData = null): ?string
    {
        try {
            Log::info('Début du processus de signature du document texte', [
                'filePath' => $filePath
            ]);

            // Vérifier si le fichier existe
            if (!Storage::disk('public')->exists($filePath)) {
                Log::error('Le fichier texte à signer n\'existe pas', ['filePath' => $filePath]);
                return null;
            }

            // Lire le contenu du fichier
            $content = Storage::disk('public')->get($filePath);

            // Ajouter le bloc de signature dans le format exact demandé
            $dateText = date('d/m/Y'); // Format jour/mois/année comme dans l'exemple
            $signatureBlock = "\n\n";
            $signatureBlock .= "Signé par : {$signerName}\n";
            $signatureBlock .= "Fait le : {$dateText}\n";
            $signatureBlock .= "Signature électronique\n\n";

            // Si nous avons des données de signature, créer un fichier image
            $signatureImagePath = null;
            if ($signatureData) {
                Log::info('Traitement de l\'image de signature pour le document texte');

                // Traiter l'image de signature (supprimer le préfixe data URL)
                $signatureBase64 = '';
                if (strpos($signatureData, 'data:image/png;base64,') === 0) {
                    $signatureBase64 = substr($signatureData, 22); // Enlever 'data:image/png;base64,'
                } else {
                    $signatureBase64 = $signatureData;
                }

                // Générer un nom de fichier unique pour l'image de signature
                $signatureFileName = 'signature_' . time() . '.png';
                $signatureImagePath = 'contracts/signatures/' . $signatureFileName;

                // Sauvegarder l'image de signature
                Storage::disk('public')->put($signatureImagePath, base64_decode($signatureBase64));

                Log::info('Image de signature sauvegardée', ['path' => $signatureImagePath]);

                // Ajouter une référence à l'image de signature dans le document texte
                $signatureBlock .= "[Une signature électronique a été ajoutée à ce document]\n";
                $signatureBlock .= "L'image de la signature est disponible dans le fichier: {$signatureFileName}\n\n";
            } else {
                // Utiliser la signature ASCII si aucune image n'est fournie
                $signatureBlock .= "       ___________/\\\___________\n";
            }

            $signedContent = $content . $signatureBlock;

            // Générer un nouveau nom de fichier pour le document signé
            $originalFileName = basename($filePath);
            $signedFileName = pathinfo($originalFileName, PATHINFO_FILENAME) . '_signed_' . time() . '.' . pathinfo($originalFileName, PATHINFO_EXTENSION);
            $signedFilePath = 'contracts/signed/' . $signedFileName;

            // Sauvegarder le document modifié
            Storage::disk('public')->put($signedFilePath, $signedContent);

            Log::info('Document texte signé avec succès', [
                'originalPath' => $filePath,
                'signedPath' => $signedFilePath
            ]);

            return $signedFilePath;
        } catch (\Exception $e) {
            Log::error('Erreur lors de la signature du document texte', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return null;
        }
    }
}

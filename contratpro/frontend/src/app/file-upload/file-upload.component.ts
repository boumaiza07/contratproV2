import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { FooterComponent } from '../footer/footer.component';
import { SpinnerComponent } from '../shared/components/spinner/spinner.component';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.css'],
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    FooterComponent,
    RouterModule,
    SpinnerComponent,
    ReactiveFormsModule,
    FormsModule
  ]
})
export class FileUploadComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef;

  selectedFile: File | null = null;
  currentFileName: string = '';
  fileList: string[] = [];
  isUploading: boolean = false;
  isLoadingFiles: boolean = false;
  uploadProgress: number = 0;
  uploadMessage: string = '';
  extractedData: any[] = [];
  isGenerating: boolean = false;
  generatedDocumentUrl: string | null = null;
  generationError: string | null = null;
  generatedUnsignedContractId: number | null = null;

  // Add date-related properties
  currentDate = new Date();
  formattedDate = this.currentDate.toLocaleDateString('fr-FR');

  // Ajouter une propriété pour stocker les souscriptions
  private subscriptions: Subscription[] = [];

  constructor(
    private http: HttpClient
  ) {}

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.uploadMessage = '';
      this.uploadProgress = 0;
      this.uploadFile();
    }
  }

  uploadFile(): void {
    if (!this.selectedFile) return;

    const formData = new FormData();
    formData.append('document', this.selectedFile);
    this.isUploading = true;
    this.uploadProgress = 0;

    const subscription = this.http.post('/api/upload', formData, {
      reportProgress: true,
      observe: 'events'
    }).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadProgress = Math.round(100 * (event.loaded / (event.total || event.loaded)));
        } else if (event.type === HttpEventType.Response) {
          const response = event.body as any;
          this.uploadMessage = response.success ? 'File uploaded successfully' : 'Upload failed';
          if (response.success) {
            this.currentFileName = response.file.name; // Store the actual filename from server
            this.loadFiles();

            // Handle extracted data if available
            if (response.file.extractedData) {
              // Ensure all required fields are present
              this.extractedData = response.file.extractedData.map((item: any) => ({
                key: item.key || '',
                value: item.value || '',
                original: item.original || ''
              }));
              console.log('Extracted data from upload:', this.extractedData);
            } else {
              // If no data was extracted, try to get it explicitly
              this.getExtractedData(response.file.name);
            }

            this.selectedFile = null;
            this.fileInput.nativeElement.value = '';
          }
        }
      },
      error: (error) => {
        this.uploadMessage = 'Failed to upload file: ' + error.message;
        this.isUploading = false;
      },
      complete: () => {
        this.isUploading = false;
      }
    });

    // Ajouter la souscription au tableau pour pouvoir la nettoyer plus tard
    this.subscriptions.push(subscription);
  }

  loadFiles(): void {
    this.isLoadingFiles = true;
    const subscription = this.http.get<any>('/api/files').subscribe({
      next: (response) => {
        if (response.success) {
          this.fileList = response.files.map((file: any) => file.filename);
        }
      },
      error: (error) => {
        console.error('Failed to load files:', error);
      },
      complete: () => {
        this.isLoadingFiles = false;
      }
    });

    // Ajouter la souscription au tableau
    this.subscriptions.push(subscription);
  }

  deleteAllFiles(): void {
    if (confirm('Are you sure you want to delete all files?')) {
      const subscription = this.http.delete('/api/files/deleteAll').subscribe({
        next: (response: any) => {
          if (response.success) {
            this.fileList = [];
            this.uploadMessage = 'All files deleted successfully';
          }
        },
        error: (error) => {
          console.error('Failed to delete files:', error);
          this.uploadMessage = 'Failed to delete files';
        }
      });

      // Ajouter la souscription au tableau
      this.subscriptions.push(subscription);
    }
  }

  // Methods for handling extracted data and generating files
  getExtractedData(filename: string): void {
    const subscription = this.http.get<any>(`/api/files/extracted-data/${filename}`).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Ensure all required fields are present
          this.extractedData = response.data.map((item: any) => ({
            key: item.key || '',
            value: item.value || '',
            original: item.original || ''
          }));
          console.log('Extracted data:', this.extractedData);
        }
      },
      error: (error) => {
        console.error('Failed to get extracted data:', error);
      }
    });

    // Ajouter la souscription au tableau
    this.subscriptions.push(subscription);
  }

  /**
   * Generate a document with placeholders replaced by values
   */
  generateDocument(): void {
    if (!this.currentFileName || this.extractedData.length === 0) {
      console.error('No file selected or no data to replace');
      this.generationError = 'No file selected or no data to replace';
      return;
    }

    this.isGenerating = true;
    this.generatedDocumentUrl = null;
    this.generationError = null;

    // Prepare the replacements object
    const replacements: {[key: string]: string} = {};
    this.extractedData.forEach(field => {
      replacements[field.key] = field.value;
    });

    console.log('Generating document with replacements:', replacements);
    console.log('Original filename:', this.currentFileName);

    // Send the request to generate the document
    const subscription = this.http.post<any>('/api/documents/generate', {
      filename: this.currentFileName,
      replacements: replacements
    }).subscribe({
      next: (response) => {
        if (response.success) {
          console.log('Document generated successfully:', response);
          this.generatedDocumentUrl = response.file.download_url;
          this.generatedUnsignedContractId = response.file.unsigned_contract_id || null;
          console.log('Generated unsigned contract ID:', this.generatedUnsignedContractId);
        } else {
          console.error('Failed to generate document:', response.message);
          this.generationError = 'Failed to generate document: ' + response.message;
        }
      },
      error: (error) => {
        console.error('Error generating document:', error);
        this.generationError = 'Error generating document: ' + (error.message || 'Unknown error');
      },
      complete: () => {
        this.isGenerating = false;
      }
    });

    // Add the subscription to the array
    this.subscriptions.push(subscription);
  }


  ngOnInit(): void {
    // Utiliser requestAnimationFrame pour décaler le chargement des fichiers
    // Cela est plus performant et moins susceptible de causer des problèmes
    requestAnimationFrame(() => {
      this.loadFiles();
    });
  }

  ngOnDestroy(): void {
    // Nettoyer toutes les souscriptions lors de la destruction du composant
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { FooterComponent } from '../footer/footer.component';
import { SpinnerComponent } from '../shared/components/spinner/spinner.component';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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

  // File upload properties
  selectedFile: File | null = null;
  currentFileName: string = '';
  fileList: string[] = [];
  filteredFiles: string[] = [];
  isUploading: boolean = false;
  isLoadingFiles: boolean = false;
  uploadProgress: number = 0;
  uploadMessage: string = '';
  extractedData: any[] = [];
  isGenerating: boolean = false;
  generatedDocumentUrl: string | null = null;
  generationError: string | null = null;
  generatedUnsignedContractId: number | null = null;
  reloadCountdown: number = 0;
  maxFileSize: number = 10 * 1024 * 1024; // 10MB in bytes
  isDragOver: boolean = false;
  filePreviewUrl: SafeResourceUrl | null = null;

  // Search and filter properties
  searchTerm: string = '';
  fileTypeFilter: 'all' | 'pdf' | 'word' = 'all';

  // Add date-related properties
  currentDate = new Date();
  formattedDate = this.currentDate.toLocaleDateString('fr-FR');

  // Subscription management
  private subscriptions: Subscription[] = [];

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer?.files.length) {
      const file = event.dataTransfer.files[0];
      this.processFile(file);
    }
  }

  processFile(file: File): void {
    // Check file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['pdf', 'doc', 'docx'];

    if (!validExtensions.includes(fileExtension || '')) {
      this.uploadMessage = 'Format de fichier non supporté. Veuillez utiliser PDF ou Word (.pdf, .doc, .docx).';
      this.fileInput.nativeElement.value = '';
      return;
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      this.uploadMessage = 'Le fichier est trop volumineux. La taille maximale est de 10 MB.';
      this.fileInput.nativeElement.value = '';
      return;
    }

    this.selectedFile = file;
    this.uploadMessage = '';
    this.uploadProgress = 0;

    // Create file preview URL for PDF files
    if (file.type === 'application/pdf') {
      const fileURL = URL.createObjectURL(file);
      this.filePreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(fileURL);
    } else {
      this.filePreviewUrl = null;
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

    // Track subscription for cleanup
    this.subscriptions.push(subscription);
  }

  loadFiles(): void {
    this.isLoadingFiles = true;
    const subscription = this.http.get<any>('/api/files').subscribe({
      next: (response) => {
        if (response.success) {
          this.fileList = response.files.map((file: any) => file.filename);
          this.filterFiles(); // Apply any active filters
        }
      },
      error: (error) => {
        console.error('Failed to load files:', error);
      },
      complete: () => {
        this.isLoadingFiles = false;
      }
    });

    // Track subscription for cleanup
    this.subscriptions.push(subscription);
  }

  // File utility methods
  getFileType(file: File): string {
    return file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Word';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  removeSelectedFile(event: Event): void {
    event.stopPropagation(); // Prevent click from propagating to parent
    this.selectedFile = null;
    this.filePreviewUrl = null;
    this.fileInput.nativeElement.value = '';
    this.uploadProgress = 0;
    this.uploadMessage = '';
  }

  // Search and filter methods
  filterFiles(): void {
    if (!this.fileList.length) {
      this.filteredFiles = [];
      return;
    }

    let result = [...this.fileList];

    // Apply search term filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(file => file.toLowerCase().includes(term));
    }

    // Apply file type filter
    if (this.fileTypeFilter !== 'all') {
      if (this.fileTypeFilter === 'pdf') {
        result = result.filter(file => file.toLowerCase().endsWith('.pdf'));
      } else if (this.fileTypeFilter === 'word') {
        result = result.filter(file =>
          file.toLowerCase().endsWith('.doc') || file.toLowerCase().endsWith('.docx')
        );
      }
    }

    this.filteredFiles = result;
  }

  setFileTypeFilter(filter: 'all' | 'pdf' | 'word'): void {
    this.fileTypeFilter = filter;
    this.filterFiles();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.fileTypeFilter = 'all';
    this.filterFiles();
  }

  // File actions
  downloadFile(filename: string): void {
    window.open(`/api/files/download/${filename}`, '_blank');
  }

  deleteFile(filename: string): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le fichier "${filename}"?`)) {
      const subscription = this.http.delete(`/api/files/delete/${filename}`).subscribe({
        next: (response: any) => {
          if (response.success) {
            this.uploadMessage = 'Fichier supprimé avec succès';
            this.loadFiles();
          }
        },
        error: (error) => {
          console.error('Failed to delete file:', error);
          this.uploadMessage = 'Échec de la suppression du fichier';
        }
      });

      // Track subscription for cleanup
      this.subscriptions.push(subscription);
    }
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

      // Track subscription for cleanup
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

    // Track subscription for cleanup
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

          // Start countdown for page reload
          this.reloadCountdown = 5;
          const countdownInterval = setInterval(() => {
            this.reloadCountdown--;
            if (this.reloadCountdown <= 0) {
              clearInterval(countdownInterval);
              console.log('Reloading page after document generation...');
              window.location.reload();
            }
          }, 1000);
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

    // Track subscription for cleanup
    this.subscriptions.push(subscription);
  }


  ngOnInit(): void {
    // Initialize filteredFiles
    this.filteredFiles = [...this.fileList];

    // Utiliser requestAnimationFrame pour décaler le chargement des fichiers
    // Cela est plus performant et moins susceptible de causer des problèmes
    requestAnimationFrame(() => {
      this.loadFiles();
    });
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());

    // Clean up any object URLs to prevent memory leaks
    if (this.filePreviewUrl) {
      URL.revokeObjectURL(this.filePreviewUrl.toString());
    }
  }
}
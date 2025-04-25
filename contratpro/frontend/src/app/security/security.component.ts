import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, AfterViewInit, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { NavbarComponent } from "../navbar/navbar.component";
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { catchError, debounceTime, takeUntil, throwError } from 'rxjs';
import { FooterComponent } from "../footer/footer.component";
import { HttpClientModule } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { Subject } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';

// Error messages constants
const ERROR_MESSAGES = {
  REQUIRED: 'Ce champ est requis',
  INVALID_EMAIL: 'Format email invalide',
  PDF_REQUIRED: 'Un fichier PDF est requis',
  PDF_TOO_LARGE: 'Le fichier ne doit pas dépasser 5MB',
  SIGNATURE_REQUIRED: 'Signature requise',
  CONSENT_REQUIRED: 'Vous devez accepter les termes',
  INVALID_NAME: 'Le nom doit contenir au moins 2 caractères alphabétiques',
  SESSION_EXPIRED: 'Session expirée. Veuillez vous reconnecter.',
  GENERIC_ERROR: 'Une erreur est survenue. Veuillez réessayer.'
};
const API_BASE_URL = 'http://localhost:8000/api'; // Définissez votre URL ici

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NavbarComponent, FooterComponent, HttpClientModule],
  templateUrl: './security.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./security.component.css'],
})
export class SecurityComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('signaturePad') signaturePad!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  isDrawing = false;
  lastX = 0;
  lastY = 0;
  uploadedFileUrl: SafeResourceUrl | null = null;
  filePreviewType: 'pdf' | 'word' | null = null;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  isLoading = false;
  fieldErrors: { [key: string]: string } = {};
  maxFileSize = 5 * 1024 * 1024; // 5MB

  // Signature options
  signatureType: 'draw' | 'type' = 'draw';
  penColor: string = '#1e3c72';
  penSize: number = 2;
  selectedFont: string = 'Dancing Script';
  typedSignature: string = '';
  signaturePosition: 'bottom-left' | 'bottom-center' | 'bottom-right' = 'bottom-right';

  // Undo/Redo stacks
  private undoStack: ImageData[] = [];
  private redoStack: ImageData[] = [];
  private destroy$ = new Subject<void>();

  // Form configuration
  signForm: FormGroup = this.fb.group({
    fullName: ['', [
      Validators.required,
      Validators.pattern(/^[\p{L} -]{2,}$/u)
    ]],
    email: ['', [Validators.required, Validators.email]],
    consent: [false, Validators.requiredTrue],
    typedSignature: [''] // Add typed signature to the form
  });

  pdfFile?: File;
  unsignedContractId?: number;

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngAfterViewInit() {
    // Wrap canvas setup in ngZone to fix hydration issues
    this.ngZone.run(() => {
      // First attempt at initialization
      setTimeout(() => {
        // Only setup canvas if we're in draw mode
        if (this.signatureType === 'draw') {
          this.setupCanvas();
          this.setupResizeObserver();
        }
        this.cdr.detectChanges();

        // Second attempt after a longer delay to ensure DOM is fully rendered
        setTimeout(() => {
          if (this.signatureType === 'draw') {
            this.setupCanvas();
            this.setupResizeObserver();
            this.cdr.detectChanges();
          }
        }, 500);
      }, 0);
    });
  }

  private setupCanvas() {
    if (!this.signaturePad) {
      console.warn('Signature pad not available yet');
      return;
    }

    try {
      const canvas = this.signaturePad.nativeElement;
      if (!canvas) {
        console.warn('Canvas element not available');
        return;
      }

      this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      if (!this.ctx) {
        console.warn('Could not get 2D context from canvas');
        return;
      }

      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) {
        console.warn('Canvas parent element not available');
        // Use default dimensions
        canvas.width = 400;
        canvas.height = 200;
      } else {
        canvas.width = rect.width || 400;
        canvas.height = 200;
      }

      this.ctx.lineWidth = this.penSize;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.strokeStyle = this.penColor;
    } catch (error) {
      console.error('Error setting up canvas:', error);
    }
  }

  private setupResizeObserver() {
    if (!this.signaturePad) {
      console.warn('Signature pad not available yet for resize observer');
      return;
    }

    try {
      const resizeObserver = new ResizeObserver(() => {
        try {
          this.setupCanvas();
          if (this.signatureDataUrl && this.signaturePad && this.ctx) {
            // Redraw signature if canvas resizes
            const img = new Image();
            img.onload = () => {
              try {
                this.ctx.clearRect(0, 0, this.signaturePad.nativeElement.width, this.signaturePad.nativeElement.height);
                this.ctx.drawImage(img, 0, 0);
              } catch (error) {
                console.error('Error redrawing signature on resize:', error);
              }
            };
            img.onerror = (error) => {
              console.error('Error loading signature image:', error);
            };
            img.src = this.signatureDataUrl;
          }
        } catch (error) {
          console.error('Error in resize observer callback:', error);
        }
      });

      if (this.signaturePad.nativeElement && this.signaturePad.nativeElement.parentElement) {
        resizeObserver.observe(this.signaturePad.nativeElement.parentElement);
      } else {
        console.warn('Cannot attach resize observer - signature pad or parent element not available');
      }
    } catch (error) {
      console.error('Error setting up resize observer:', error);
    }
  }

  // Drawing methods
  startDrawing(event: MouseEvent | TouchEvent) {
    this.isDrawing = true;
    const canvas = this.signaturePad.nativeElement;
    const rect = canvas.getBoundingClientRect();

    this.undoStack.push(this.ctx.getImageData(0, 0, canvas.width, canvas.height));
    this.redoStack = [];
    this.ctx.lineWidth = this.penSize;
    this.ctx.strokeStyle = this.penColor;

    const coords = this.getEventCoordinates(event, rect);
    this.lastX = coords.x;
    this.lastY = coords.y;

    if (event instanceof TouchEvent && event.touches[0].force) {
      this.ctx.lineWidth = Math.min(event.touches[0].force * 4, 6);
    }
  }

  draw(event: MouseEvent | TouchEvent) {
    if (!this.isDrawing) return;

    event.preventDefault();
    const rect = this.signaturePad.nativeElement.getBoundingClientRect();
    const coords = this.getEventCoordinates(event, rect);

    if (event instanceof TouchEvent && event.touches[0].force) {
      this.ctx.lineWidth = Math.min(event.touches[0].force * 4, 6);
    } else {
      this.ctx.lineWidth = this.penSize;
    }

    this.ctx.strokeStyle = this.penColor;
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(coords.x, coords.y);
    this.ctx.stroke();

    this.lastX = coords.x;
    this.lastY = coords.y;
  }

  signatureDataUrl?: string;
  endDrawing() {
    this.isDrawing = false;
    // Enregistrez la version string
    const signatureDataUrl = this.signaturePad.nativeElement.toDataURL('image/png', 1.0);
    this.signatureDataUrl = signatureDataUrl;
    this.ctx.lineWidth = this.penSize;
  }

  // Signature type methods
  setSignatureType(type: 'draw' | 'type') {
    this.signatureType = type;
    this.signatureDataUrl = undefined;

    // Clear previous signature data
    if (type === 'draw') {
      // If switching to draw, make sure canvas is ready
      setTimeout(() => {
        if (this.signaturePad) {
          this.setupCanvas();
          this.setupResizeObserver();
        } else {
          console.warn('Signature pad not available when switching to draw mode');
          // Try to initialize the canvas again after a short delay
          setTimeout(() => {
            this.ngZone.run(() => {
              this.setupCanvas();
              this.setupResizeObserver();
              this.cdr.detectChanges();
            });
          }, 100);
        }
      }, 0);
    } else if (type === 'type') {
      // Reset typed signature
      this.typedSignature = '';
      this.signForm.get('typedSignature')?.setValue('');
    }

    this.cdr.detectChanges();
  }

  // Pen color and size methods
  setPenColor(color: string) {
    this.penColor = color;
    if (this.ctx) {
      this.ctx.strokeStyle = color;
    }
  }

  setPenSize(size: number) {
    this.penSize = size;
    if (this.ctx) {
      this.ctx.lineWidth = size;
    }
  }

  // Font methods
  setFont(font: string) {
    this.selectedFont = font;
    this.updateTypedSignature();
  }

  updateTypedSignature() {
    // Get the typed signature from the form control
    const typedSignatureValue = this.signForm.get('typedSignature')?.value;
    this.typedSignature = typedSignatureValue || '';

    if (this.typedSignature) {
      try {
        // Create a canvas with higher resolution for better quality
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        // Set canvas size with higher resolution
        const scale = 2; // Higher resolution scale
        canvas.width = 600 * scale;
        canvas.height = 200 * scale;

        // Scale the context to match the higher resolution
        ctx.scale(scale, scale);

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Set font and text properties
        const fontSize = Math.min(60, 600 / (this.typedSignature.length * 0.7)); // Adjust font size based on text length
        ctx.font = `${fontSize}px ${this.selectedFont}`;
        ctx.fillStyle = this.penColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Add a subtle shadow for depth
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        // Draw text
        ctx.fillText(this.typedSignature, 300, 100);

        // Convert to data URL with maximum quality
        const signatureDataUrl = canvas.toDataURL('image/png', 1.0);
        this.signatureDataUrl = signatureDataUrl;
      } catch (error) {
        console.error('Error creating typed signature:', error);
        this.errorMessage = 'Erreur lors de la création de la signature. Veuillez réessayer.';
      }
    } else {
      this.signatureDataUrl = undefined;
    }

    this.cdr.detectChanges();
  }

  // Signature image upload method removed

  // Signature position
  setSignaturePosition(position: 'bottom-left' | 'bottom-center' | 'bottom-right') {
    this.signaturePosition = position;
    this.cdr.detectChanges();
  }

  private getEventCoordinates(event: MouseEvent | TouchEvent, rect: DOMRect) {
    return {
      x: (event instanceof TouchEvent ? event.touches[0].clientX : event.clientX) - rect.left,
      y: (event instanceof TouchEvent ? event.touches[0].clientY : event.clientY) - rect.top
    };
  }

  clearSignature() {
    if (this.signatureType === 'draw') {
      const canvas = this.signaturePad.nativeElement;
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.signatureDataUrl = undefined;
      this.undoStack = [];
      this.redoStack = [];
    } else if (this.signatureType === 'type') {
      this.typedSignature = '';
      this.signForm.get('typedSignature')?.setValue('');
      this.signatureDataUrl = undefined;
    }

    this.cdr.detectChanges();
  }

  // Utility methods for document info
  getFileType(): string {
    if (!this.pdfFile) return '';

    const fileExtension = this.pdfFile.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'pdf') {
      return 'Document PDF';
    } else if (fileExtension === 'doc' || fileExtension === 'docx') {
      return 'Document Word';
    } else {
      return 'Document';
    }
  }

  getCurrentDate(): string {
    const now = new Date();
    return now.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Form handling
  private validateFormFields() {
    this.fieldErrors = {};
    const controls = this.signForm.controls;

    if (controls['fullName'].invalid) {
      this.fieldErrors['fullName'] = controls['fullName'].hasError('required')
        ? ERROR_MESSAGES.REQUIRED
        : ERROR_MESSAGES.INVALID_NAME;
    }

    if (controls['email'].invalid) {
      this.fieldErrors['email'] = controls['email'].hasError('required')
        ? ERROR_MESSAGES.REQUIRED
        : ERROR_MESSAGES.INVALID_EMAIL;
    }

    if (controls['consent'].invalid) {
      this.fieldErrors['consent'] = ERROR_MESSAGES.CONSENT_REQUIRED;
    }

    if (!this.isSignatureValid()) {
      this.fieldErrors['signature'] = ERROR_MESSAGES.SIGNATURE_REQUIRED;
    }
  }

  isSignatureValid(): boolean {
    if (this.signatureType === 'draw') {
      if (!this.signaturePad || !this.ctx) return false;

      const imageData = this.ctx.getImageData(
        0, 0,
        this.signaturePad.nativeElement.width,
        this.signaturePad.nativeElement.height
      );
      return imageData.data.some((_, index) => index % 4 === 3 && imageData.data[index] > 0);
    } else if (this.signatureType === 'type') {
      return !!this.typedSignature && this.typedSignature.trim().length > 0;
    }

    return false;
  }

  // File handling
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Check file size
    if (file.size > this.maxFileSize) {
      this.errorMessage = ERROR_MESSAGES.PDF_TOO_LARGE;
      this.cdr.detectChanges();
      return;
    }

    // Check file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['pdf', 'doc', 'docx'];

    if (!validExtensions.includes(fileExtension || '')) {
      this.errorMessage = 'Format de fichier non supporté. Veuillez utiliser PDF ou Word (.pdf, .doc, .docx).';
      this.cdr.detectChanges();
      return;
    }

    // File passed validation
    this.pdfFile = file;
    this.errorMessage = null;

    // Clean up previous preview
    this.clearFilePreview();

    // Determine file type for preview
    this.determineFilePreviewType(file);

    this.cdr.detectChanges();
  }

  // Determine the type of file for preview
  private determineFilePreviewType(file: File) {
    // Check file type - only support PDF and Word documents
    if (file.type === 'application/pdf') {
      this.filePreviewType = 'pdf';
      this.createPdfPreview(file);
    } else if (file.type === 'application/msword' ||
              file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
              file.name.toLowerCase().endsWith('.doc') ||
              file.name.toLowerCase().endsWith('.docx')) {
      this.filePreviewType = 'word';
      // Word files can't be previewed directly in the browser
      // We'll just show a placeholder
    } else {
      // Unsupported file type
      this.errorMessage = 'Format de fichier non supporté. Veuillez utiliser PDF ou Word.';
      this.filePreviewType = null;
      this.pdfFile = undefined;
    }
  }

  // Create PDF preview
  private createPdfPreview(file: File) {
    try {
      const fileUrl = URL.createObjectURL(file);
      this.uploadedFileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(fileUrl);

      // Store cleanup function
      this.cleanupFilePreview = () => {
        URL.revokeObjectURL(fileUrl);
        this.cleanupFilePreview = undefined;
      };
    } catch (error) {
      console.error('Error creating PDF preview:', error);
      this.uploadedFileUrl = null;
    }
  }

  private cleanupFilePreview?: () => void;

  private clearFilePreview() {
    if (this.cleanupFilePreview) {
      this.cleanupFilePreview();
    }
    this.uploadedFileUrl = null;
    this.filePreviewType = null;
  }

  // Submission handling
  submitSignature() {
    this.errorMessage = null;
    this.successMessage = null;

    if (this.signForm.invalid || !this.isSignatureValid()) {
      this.validateFormFields();
      return;
    }

    if (!this.pdfFile) {
      this.errorMessage = ERROR_MESSAGES.PDF_REQUIRED;
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges(); // Force change detection

    const formData = new FormData();
    formData.append('nom_contrat', this.signForm.value.fullName || '');
    formData.append('email_signataire', this.signForm.value.email || '');
    formData.append('signature_data', this.signatureDataUrl || '');
    formData.append('pdf_file', this.pdfFile);
    formData.append('signature_position', this.signaturePosition);

    // Add unsigned contract ID if available
    if (this.unsignedContractId) {
      formData.append('unsigned_contract_id', this.unsignedContractId.toString());
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('logToken') || ''}`
    });

    // Determine which endpoint to use based on file type
    let endpoint = `${API_BASE_URL}/contrats/sign`;

    // For Word documents
    if (this.pdfFile && (this.pdfFile.type === 'application/msword' ||
        this.pdfFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        this.pdfFile.name.toLowerCase().endsWith('.doc') ||
        this.pdfFile.name.toLowerCase().endsWith('.docx'))) {
      endpoint = `${API_BASE_URL}/contrats/sign/word`;
    }

    // Use NgZone to ensure change detection works properly
    this.ngZone.run(() => {
      // For Word files, we need to handle the response as a blob
      if (endpoint.includes('/word')) {
        this.http.post(endpoint, formData, {
          headers,
          responseType: 'blob'
        })
        .pipe(
          takeUntil(this.destroy$),
          catchError((error: HttpErrorResponse) => this.handleError(error))
        )
        .subscribe({
          next: (response: Blob) => {
            this.isLoading = false;
            this.successMessage = 'Contrat signé avec succès!';
            this.cdr.detectChanges(); // Force change detection

            // Create a download link for the blob
            const dateText = new Date().toLocaleDateString('fr-FR');
            const fileExt = this.pdfFile?.name.split('.').pop() || '';
            const fileName = this.pdfFile?.name.replace(`.${fileExt}`, '') || 'document';

            const url = window.URL.createObjectURL(response);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}_Signé_${dateText}.${fileExt}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Reset the form after successful signing
            setTimeout(() => {
              this.successMessage = null;
              this.signForm.reset();
              this.clearSignature();
              this.clearFilePreview();
              this.cdr.detectChanges(); // Force change detection
            }, 3000);
          },
          error: (err) => {
            this.ngZone.run(() => {
              this.isLoading = false;
              this.handleSubmissionError(err);
              this.cdr.detectChanges(); // Force change detection
            });
          }
        });
      } else {
        // For PDF files, use the regular endpoint
        this.http.post(endpoint, formData, { headers })
          .pipe(
            takeUntil(this.destroy$),
            catchError((error: HttpErrorResponse) => this.handleError(error))
          )
          .subscribe({
            next: async () => {
              this.isLoading = false;
              this.successMessage = 'Contrat signé avec succès!';
              this.cdr.detectChanges(); // Force change detection

              try {
                await new Promise(resolve => setTimeout(resolve, 500));
                await this.downloadSignedContract();

                this.ngZone.run(() => {
                  setTimeout(() => {
                    this.successMessage = null;
                    this.signForm.reset();
                    this.clearSignature();
                    this.clearFilePreview();
                    this.cdr.detectChanges(); // Force change detection
                  }, 3000);
                });
              } catch (error) {
                console.error('Download failed:', error);
                this.ngZone.run(() => {
                  this.errorMessage = ERROR_MESSAGES.GENERIC_ERROR;
                  this.cdr.detectChanges(); // Force change detection
                });
              }
            },
            error: (err) => {
              this.ngZone.run(() => {
                this.isLoading = false;
                this.handleSubmissionError(err);
                this.cdr.detectChanges(); // Force change detection
              });
            }
          });
      }
    });
  }

  private handleSubmissionError(err: any) {
    if (err.status === 422) {
      this.fieldErrors = err.error.errors || {};
      this.errorMessage = 'Erreur de validation: ' + Object.values(this.fieldErrors).join(', ');
    } else {
      this.errorMessage = err.error?.message || ERROR_MESSAGES.GENERIC_ERROR;
    }
  }

  private handleError(error: HttpErrorResponse) {
    let errorMsg = ERROR_MESSAGES.GENERIC_ERROR;

    if (error.status === 401) {
      errorMsg = ERROR_MESSAGES.SESSION_EXPIRED;
      this.router.navigate(['/login']);
    } else {
      errorMsg = error.error?.message || error.message || ERROR_MESSAGES.GENERIC_ERROR;
    }

    this.errorMessage = errorMsg;
    this.isLoading = false;
    return throwError(() => new Error(errorMsg));
  }

  // File handling for all document types (PDF, DOC, TXT)
  private async downloadSignedContract(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        if (!this.pdfFile || !this.signatureDataUrl) {
          console.error('Missing data for download: file or signature missing');
          throw new Error('Missing data for download');
        }

        this.ngZone.run(async () => {
          try {
            // Check if we're working with a PDF file
            if (this.pdfFile && this.pdfFile.type === 'application/pdf') {
              try {
                // Process PDF for adding signature
                const pdfBytes = await this.pdfFile.arrayBuffer();
                const pdfDoc = await PDFDocument.load(pdfBytes);
                pdfDoc.registerFontkit(fontkit);

                // Process signature image (remove data URL prefix)
                if (this.signatureDataUrl) {
                  // Ensure the data URL is properly formatted
                  let dataUrl = this.signatureDataUrl;
                  if (!dataUrl.startsWith('data:image/png;base64,')) {
                    dataUrl = 'data:image/png;base64,' + dataUrl;
                  }

                  try {
                    // Extract the base64 data
                    const base64Data = dataUrl.split(',')[1];

                    // Embed the PNG image
                    const signatureImage = await pdfDoc.embedPng(base64Data);

                    const pages = pdfDoc.getPages();
                    if (pages.length === 0) {
                      console.error('Empty PDF detected');
                      throw new Error('Empty PDF');
                    }

                    const lastPage = pages[pages.length - 1];
                    const { width } = lastPage.getSize();

                    const signatureWidth = 180;
                    const signatureHeight = 60;
                    const padding = 20;

                    // Calculate position based on selected position
                    let signatureX = padding;
                    let signatureY = padding;

                    // Position the signature based on the selected position
                    if (this.signaturePosition === 'bottom-left') {
                      signatureX = padding;
                      signatureY = padding;
                    } else if (this.signaturePosition === 'bottom-center') {
                      signatureX = (width - signatureWidth) / 2;
                      signatureY = padding;
                    } else if (this.signaturePosition === 'bottom-right') {
                      signatureX = width - signatureWidth - padding;
                      signatureY = padding;
                    }

                    // Add signature to the PDF
                    lastPage.drawImage(signatureImage, {
                      x: signatureX,
                      y: signatureY,
                      width: signatureWidth,
                      height: signatureHeight,
                    });

                    const dateText = new Date().toLocaleDateString('fr-FR');

                    lastPage.drawText('Signature électronique', {
                      x: signatureX,
                      y: signatureY + signatureHeight + 5,
                      size: 10,
                      color: rgb(0, 0, 0),
                    });

                    lastPage.drawText(`Fait le : ${dateText}`, {
                      x: signatureX,
                      y: signatureY + signatureHeight + 20,
                      size: 10,
                      color: rgb(0, 0, 0),
                    });

                    lastPage.drawText(`Signé par : ${this.signForm.value.fullName || ''}`, {
                      x: signatureX,
                      y: signatureY + signatureHeight + 35,
                      size: 10,
                      color: rgb(0, 0, 0),
                    });

                    // Save the modified PDF
                    const modifiedPdf = await pdfDoc.save();

                    // Download the signed PDF
                    const blob = new Blob([modifiedPdf], { type: 'application/pdf' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Contrat_Signé_${dateText}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    resolve();
                    return;
                  } catch (embedError) {
                    console.error('Error embedding signature image:', embedError);
                    throw embedError;
                  }
                }
              } catch (pdfError) {
                console.error('PDF processing error:', pdfError);
                // Fall back to original file download if PDF processing fails
              }
            } else {
              // For Word files, we don't need to do anything here as they're handled in submitSignature()
              console.log(`File already processed or unsupported type: ${this.pdfFile?.type || 'unknown'}`);
              this.downloadOriginalFile();
              resolve();
              return;
            }
          } catch (error) {
            console.error('File processing error:', error);
            reject(error);
          }
        });
      } catch (error) {
        console.error('General error:', error);
        reject(error);
      }
    });
  }

  // Helper method to download the original file
  private downloadOriginalFile(): void {
    if (!this.pdfFile) return;

    const fileReader = new FileReader();
    fileReader.onload = () => {
      if (this.pdfFile) {
        const dateText = new Date().toLocaleDateString('fr-FR');
        const fileExt = this.pdfFile.name.split('.').pop() || '';
        const fileName = this.pdfFile.name.replace(`.${fileExt}`, '');

        const blob = new Blob([fileReader.result as ArrayBuffer], { type: this.pdfFile.type || 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}_Signé_${dateText}.${fileExt}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    };
    fileReader.onerror = (error) => {
      console.error('Error reading file:', error);
    };
    fileReader.readAsArrayBuffer(this.pdfFile as File);
  }



  // Undo/Redo functionality
  undo() {
    if (this.undoStack.length === 0) return;

    const lastState = this.undoStack.pop();
    if (!lastState) return;

    this.redoStack.push(this.ctx.getImageData(0, 0,
      this.signaturePad.nativeElement.width,
      this.signaturePad.nativeElement.height
    ));

    this.ctx.putImageData(lastState, 0, 0);
    this.signatureDataUrl = this.signaturePad.nativeElement.toDataURL();
  }

  redo() {
    if (this.redoStack.length === 0) return;

    const nextState = this.redoStack.pop();
    if (!nextState) return;

    this.undoStack.push(this.ctx.getImageData(0, 0,
      this.signaturePad.nativeElement.width,
      this.signaturePad.nativeElement.height
    ));

    this.ctx.putImageData(nextState, 0, 0);
    this.signatureDataUrl = this.signaturePad.nativeElement.toDataURL();
  }

  // Lifecycle hooks
  ngOnInit() {
    this.signForm.valueChanges
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.fieldErrors = {};
      });

    // Check for unsigned contract ID in query params
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['unsignedContractId']) {
          this.unsignedContractId = Number(params['unsignedContractId']);

          // Load the file from the unsigned contract
          this.loadUnsignedContract(this.unsignedContractId);
        }
      });
  }

  /**
   * Load the unsigned contract file
   */
  private loadUnsignedContract(id: number): void {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('logToken') || ''}`
    });

    this.http.get<any>(`/api/unsigned-contracts/${id}`, { headers })
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          console.error('Error loading unsigned contract:', error);
          return throwError(() => error);
        })
      )
      .subscribe({
        next: (contract) => {
          // Now download the file
          this.http.get(`/api/unsigned-contracts/${id}/download`, {
            headers,
            responseType: 'blob'
          }).subscribe({
            next: (blob) => {
              // Create a File object from the blob
              const filename = contract.file_path.split('/').pop() || 'document';
              this.pdfFile = new File([blob], filename, { type: contract.file_type || 'application/octet-stream' });

              // Determine file type for preview
              this.determineFilePreviewType(this.pdfFile);
              this.cdr.detectChanges();
            },
            error: (error) => {
              console.error('Error downloading unsigned contract file:', error);
            }
          });
        },
        error: (error) => {
          console.error('Error loading unsigned contract:', error);
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.cleanupFilePreview) {
      this.cleanupFilePreview();
    }
  }
  get formattedFileSize(): string {
    if (!this.pdfFile) return '';
    const sizeInKB = this.pdfFile.size / 1024;
    return sizeInKB < 1024
      ? `${sizeInKB.toFixed(1)} Ko`
      : `${(sizeInKB / 1024).toFixed(1)} Mo`;
  }
}
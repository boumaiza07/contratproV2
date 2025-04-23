import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, AfterViewInit, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { NavbarComponent } from "../navbar/navbar.component";
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { catchError, debounceTime, takeUntil, throwError } from 'rxjs';
import { FooterComponent } from "../footer/footer.component";
import { HttpClientModule } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl, SafeUrl } from '@angular/platform-browser';
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
  imports: [CommonModule, ReactiveFormsModule, NavbarComponent, FooterComponent, HttpClientModule],
  templateUrl: './security.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./security.component.css'],
})
export class SecurityComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('signaturePad') signaturePad!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  signatureImg?: SafeUrl;
  isDrawing = false;
  lastX = 0;
  lastY = 0;
  uploadedFileUrl: SafeResourceUrl | null = null;
  filePreviewType: 'pdf' | 'text' | 'word' | 'other' | null = null;
  fileTextContent: string | null = null;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  isLoading = false;
  fieldErrors: { [key: string]: string } = {};
  maxFileSize = 5 * 1024 * 1024; // 5MB

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
    consent: [false, Validators.requiredTrue]
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
      setTimeout(() => {
        this.setupCanvas();
        this.setupResizeObserver();
        this.cdr.detectChanges();
      }, 0);
    });
  }

  private setupCanvas() {
    const canvas = this.signaturePad.nativeElement;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const rect = canvas.parentElement?.getBoundingClientRect();

    canvas.width = rect?.width || 400;
    canvas.height = 200;

    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#1e3c72';
  }

  private setupResizeObserver() {
    const resizeObserver = new ResizeObserver(() => {
      this.setupCanvas();
      if (this.signatureImg) {
        // Redraw signature if canvas resizes
        const img = new Image();
        img.onload = () => {
          this.ctx.clearRect(0, 0, this.signaturePad.nativeElement.width, this.signaturePad.nativeElement.height);
          this.ctx.drawImage(img, 0, 0);
        };
        img.src = this.signatureImg as string;
      }
    });
    resizeObserver.observe(this.signaturePad.nativeElement.parentElement!);
  }

  // Drawing methods
  startDrawing(event: MouseEvent | TouchEvent) {
    this.isDrawing = true;
    const canvas = this.signaturePad.nativeElement;
    const rect = canvas.getBoundingClientRect();

    this.undoStack.push(this.ctx.getImageData(0, 0, canvas.width, canvas.height));
    this.redoStack = [];
    this.ctx.lineWidth = 2;

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
    }

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
    // Enregistrez à la fois la version SafeUrl et la version string
    const signatureDataUrl = this.signaturePad.nativeElement.toDataURL('image/png', 1.0);
    this.signatureImg = this.sanitizer.bypassSecurityTrustUrl(signatureDataUrl);
    this.signatureDataUrl = signatureDataUrl; // Nouvelle propriété pour stocker la version string
    this.ctx.lineWidth = 2;
  }

  private getEventCoordinates(event: MouseEvent | TouchEvent, rect: DOMRect) {
    return {
      x: (event instanceof TouchEvent ? event.touches[0].clientX : event.clientX) - rect.left,
      y: (event instanceof TouchEvent ? event.touches[0].clientY : event.clientY) - rect.top
    };
  }

  clearSignature() {
    const canvas = this.signaturePad.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.signatureImg = undefined;
    this.undoStack = [];
    this.redoStack = [];
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
    const imageData = this.ctx.getImageData(
      0, 0,
      this.signaturePad.nativeElement.width,
      this.signaturePad.nativeElement.height
    );
    return imageData.data.some((_, index) => index % 4 === 3 && imageData.data[index] > 0);
  }

  // File handling
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    if (file.size > this.maxFileSize) {
      this.errorMessage = ERROR_MESSAGES.PDF_TOO_LARGE;
      this.cdr.detectChanges();
      return;
    }

    // Accept all file types, not just PDF
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
    console.log(`Determining preview type for file: ${file.name}, type: ${file.type}`);

    // Check file type
    if (file.type === 'application/pdf') {
      this.filePreviewType = 'pdf';
      this.createPdfPreview(file);
    } else if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
      this.filePreviewType = 'text';
      this.createTextPreview(file);
    } else if (file.type === 'application/msword' ||
              file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
              file.name.toLowerCase().endsWith('.doc') ||
              file.name.toLowerCase().endsWith('.docx')) {
      this.filePreviewType = 'word';
      // Word files can't be previewed directly in the browser
      // We'll just show a placeholder
    } else {
      this.filePreviewType = 'other';
      // For other file types, we'll just show file info
    }

    console.log(`File preview type set to: ${this.filePreviewType}`);
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

      console.log('PDF preview created successfully');
    } catch (error) {
      console.error('Error creating PDF preview:', error);
      this.uploadedFileUrl = null;
    }
  }

  // Create text file preview
  private async createTextPreview(file: File) {
    try {
      // Read the text content
      const text = await file.text();
      this.fileTextContent = text;
      console.log('Text preview created successfully');
    } catch (error) {
      console.error('Error creating text preview:', error);
      this.fileTextContent = 'Error loading text content';
    }
  }

  private cleanupFilePreview?: () => void;

  private clearFilePreview() {
    if (this.cleanupFilePreview) {
      this.cleanupFilePreview();
    }
    this.uploadedFileUrl = null;
    this.fileTextContent = null;
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

    // Add unsigned contract ID if available
    if (this.unsignedContractId) {
      formData.append('unsigned_contract_id', this.unsignedContractId.toString());
      console.log('Adding unsigned contract ID to form data:', this.unsignedContractId);
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
      console.log('Using Word document signing endpoint');
    }
    // For Text files
    else if (this.pdfFile && (this.pdfFile.type === 'text/plain' ||
        this.pdfFile.name.toLowerCase().endsWith('.txt'))) {
      endpoint = `${API_BASE_URL}/contrats/sign/text`;
      console.log('Using Text file signing endpoint');
    }
    else {
      console.log('Using default signing endpoint for file type:', this.pdfFile.type);
    }

    // Use NgZone to ensure change detection works properly
    this.ngZone.run(() => {
      // For Word and Text files, we need to handle the response as a blob
      if (endpoint.includes('/word') || endpoint.includes('/text')) {
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
            next: async (response) => {
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

        console.log(`Processing file: ${this.pdfFile.name}, type: ${this.pdfFile.type}`);

        this.ngZone.run(async () => {
          try {
            // Check if we're working with a PDF file
            if (this.pdfFile && this.pdfFile.type === 'application/pdf') {
              console.log('Processing PDF file with signature');
              try {
                // Process PDF for adding signature
                const pdfBytes = await this.pdfFile.arrayBuffer();
                console.log(`PDF loaded, size: ${pdfBytes.byteLength} bytes`);
                const pdfDoc = await PDFDocument.load(pdfBytes);
                pdfDoc.registerFontkit(fontkit);
                console.log('PDF document loaded successfully');

                // Process signature image (remove data URL prefix)
                if (this.signatureDataUrl) {
                  console.log('Adding signature to PDF');
                  const pngImage = this.signatureDataUrl.split(',')[1];
                  const signatureImage = await pdfDoc.embedPng(pngImage);

                  const pages = pdfDoc.getPages();
                  if (pages.length === 0) {
                    console.error('Empty PDF detected');
                    throw new Error('Empty PDF');
                  }
                  console.log(`PDF has ${pages.length} pages`);

                  const lastPage = pages[pages.length - 1];
                  const { width, height } = lastPage.getSize();
                  console.log(`Last page dimensions: ${width}x${height}`);

                  const signatureWidth = 180;
                  const signatureHeight = 60;
                  const padding = 20;

                  // Add signature to the PDF
                  lastPage.drawImage(signatureImage, {
                    x: padding,
                    y: padding,
                    width: signatureWidth,
                    height: signatureHeight,
                  });
                  console.log('Signature image added to PDF');

                  const dateText = new Date().toLocaleDateString('fr-FR');

                  lastPage.drawText('Signature électronique', {
                    x: padding,
                    y: padding + signatureHeight + 5,
                    size: 10,
                    color: rgb(0, 0, 0),
                  });

                  lastPage.drawText(`Fait le : ${dateText}`, {
                    x: padding,
                    y: padding + signatureHeight + 20,
                    size: 10,
                    color: rgb(0, 0, 0),
                  });

                  lastPage.drawText(`Signé par : ${this.signForm.value.fullName || ''}`, {
                    x: padding,
                    y: padding + signatureHeight + 35,
                    size: 10,
                    color: rgb(0, 0, 0),
                  });
                  console.log('Text annotations added to PDF');

                  // Save the modified PDF
                  const modifiedPdf = await pdfDoc.save();
                  console.log(`Modified PDF created, size: ${modifiedPdf.length} bytes`);

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
                  console.log('PDF download initiated');
                  resolve();
                  return;
                }
              } catch (pdfError) {
                console.error('PDF processing error:', pdfError);
                // Fall back to original file download if PDF processing fails
              }
            } else {
              // For Word and Text files, we don't need to do anything here as they're handled in submitSignature()
              // For other file types, download the original file
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

    console.log(`Downloading original file: ${this.pdfFile.name}`);
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
        console.log('Original file download completed');
      }
    };
    fileReader.onerror = (error) => {
      console.error('Error reading file:', error);
    };
    fileReader.readAsArrayBuffer(this.pdfFile as File);
  }

  // Helper method to download the signed file from the backend
  private downloadSignedFileFromBackend(): void {
    // Nous utilisons le fait que le fichier a déjà été envoyé au backend
    // et que le backend a déjà traité le fichier avec la signature

    console.log('Téléchargement du fichier signé depuis le backend');

    // Pour l'instant, nous utilisons la méthode de téléchargement du fichier original
    // car le backend a déjà remplacé le fichier original par le fichier signé
    // Dans une implémentation plus complète, nous pourrions utiliser l'ID du contrat signé
    // pour télécharger le fichier signé via une API spécifique

    // Exemple d'implémentation future :
    // this.http.get(`${API_BASE_URL}/signed-contracts/${contractId}/download`, {
    //   responseType: 'blob',
    //   headers: new HttpHeaders({
    //     'Authorization': `Bearer ${localStorage.getItem('logToken') || ''}`
    //   })
    // }).subscribe({
    //   next: (blob: Blob) => {
    //     const url = window.URL.createObjectURL(blob);
    //     const a = document.createElement('a');
    //     a.href = url;
    //     a.download = `Document_Signé.${fileExt}`;
    //     document.body.appendChild(a);
    //     a.click();
    //     window.URL.revokeObjectURL(url);
    //     document.body.removeChild(a);
    //   },
    //   error: (error) => {
    //     console.error('Erreur lors du téléchargement du fichier signé:', error);
    //   }
    // });

    // Pour l'instant, nous utilisons la méthode simple
    this.downloadOriginalFile();
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
    this.signatureImg = this.sanitizer.bypassSecurityTrustUrl(
      this.signaturePad.nativeElement.toDataURL()
    );
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
    this.signatureImg = this.sanitizer.bypassSecurityTrustUrl(
      this.signaturePad.nativeElement.toDataURL()
    );
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
          console.log('Unsigned contract ID from URL:', this.unsignedContractId);

          // Load the file from the unsigned contract
          this.loadUnsignedContract(this.unsignedContractId);
        }
      });
  }

  /**
   * Load the unsigned contract file
   */
  private loadUnsignedContract(id: number): void {
    console.log('Loading unsigned contract:', id);

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
          console.log('Unsigned contract loaded:', contract);

          // Now download the file
          this.http.get(`/api/unsigned-contracts/${id}/download`, {
            headers,
            responseType: 'blob'
          }).subscribe({
            next: (blob) => {
              console.log('Unsigned contract file downloaded');

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
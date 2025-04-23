// src/app/services/file-upload.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {
  private apiUrl = 'http://localhost:8000/api'; // Laravel API URL
  private storageUrl = 'http://localhost:8000/storage';

  constructor(private http: HttpClient) { }

  uploadFile(file: File): Observable<HttpEvent<any>> {
    const formData = new FormData();
    formData.append('document', file);

    const req = new HttpRequest(
      'POST',
      `${this.apiUrl}/upload`,
      formData,
      {
        reportProgress: true,
        responseType: 'json'
      }
    );

    return this.http.request(req);
  }

  getFiles(): Observable<any> {
    return this.http.get(`${this.apiUrl}/files`);
  }

  deleteAllFiles(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/files/deleteAll`);
  }

  getFileUrl(path: string): string {
    return `${this.storageUrl}/${path}`;
  }

  getExtractedData(filename: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/files/extracted-data/${filename}`);
  }

  // Méthode de génération de fichiers supprimée


}
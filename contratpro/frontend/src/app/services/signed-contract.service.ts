import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SignedContractService {
  private apiUrl = environment.apiUrl + '/api/signed-contracts';

  constructor(private http: HttpClient) { }

  /**
   * Get all signed contracts
   */
  getSignedContracts(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  /**
   * Get a specific signed contract by ID
   */
  getSignedContract(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  /**
   * Download a signed contract
   */
  downloadSignedContract(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/download`, {
      responseType: 'blob'
    });
  }
}

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ContractService {
  private apiUrl = environment.apiUrl + '/api/contracts';

  constructor(private http: HttpClient) { }

  /**
   * Get all contracts
   */
  getContracts(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  /**
   * Get a specific contract by ID
   */
  getContract(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  /**
   * Create a new contract
   */
  createContract(contractData: any): Observable<any> {
    return this.http.post(this.apiUrl, contractData);
  }

  /**
   * Update an existing contract
   */
  updateContract(id: number, contractData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, contractData);
  }

  /**
   * Delete a contract
   */
  deleteContract(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  /**
   * Download a contract
   */
  downloadContract(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/download`, {
      responseType: 'blob'
    });
  }

  /**
   * Sign a contract
   */
  signContract(id: number, signatureData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/sign`, signatureData);
  }
} 
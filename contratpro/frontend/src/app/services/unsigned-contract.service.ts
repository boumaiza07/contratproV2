import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UnsignedContractService {
  private apiUrl = environment.apiUrl + '/api/unsigned-contracts';

  constructor(private http: HttpClient) { }

  /**
   * Get all unsigned contracts
   */
  getUnsignedContracts(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  /**
   * Get a specific unsigned contract by ID
   */
  getUnsignedContract(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`);
  }

  /**
   * Download an unsigned contract
   */
  downloadUnsignedContract(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/download`, {
      responseType: 'blob'
    });
  }

  /**
   * Delete an unsigned contract
   */
  deleteUnsignedContract(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}

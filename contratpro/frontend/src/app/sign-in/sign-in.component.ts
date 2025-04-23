import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { LogService } from '../auth/services/log.service';

@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, HttpClientModule],
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css']
})
export class SignInComponent {
  signinForm: FormGroup;
  hidePassword = true;
  isLoading = false;
  message = '';
  private apiUrl = 'http://localhost:8000/api';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private logService: LogService
  ) {
    this.signinForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  togglePasswordVisibility() {
    this.hidePassword = !this.hidePassword;
  }

  onSubmit() {
    if (this.signinForm.invalid) {
      // Mark fields as touched to show validation errors
      Object.keys(this.signinForm.controls).forEach(key => {
        this.signinForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.isLoading = true;
    this.message = '';

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    });

    this.http.post(`${this.apiUrl}/signin`, this.signinForm.value, { headers })
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          
          // Set success message
          this.message = 'success: Login successful! Redirecting...';
          
          // Store authentication data using LogService
          if (response.token) {
            this.logService.login(response.token, response.user || {});
          }
          
          // Reset form
          this.signinForm.reset();
          
          // Redirect after 2 seconds
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 2000);
        },
        error: (error) => {
          this.isLoading = false;
          console.error('Login error:', error);

          let errorMessage = 'Login failed. Please try again later.';
          if (error.status === 401) {
            errorMessage = 'Invalid email or password';
          } else if (error.status === 422 && error.error?.errors) {
            const errorValues = Object.values(error.error.errors);
            errorMessage = errorValues.length > 0 ? errorValues[0] as string : 'Validation error';
          } else if (error.status === 500) {
            errorMessage = 'Server error. Please try again later or contact support.';
            if (error.error?.message) {
              errorMessage = error.error.message;
            }
          } else if (error.status === 0) {
            errorMessage = 'Unable to connect to the server. Please check your internet connection.';
          }

          this.message = `error: ${errorMessage}`;
        }
      });
  }
}
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router ,RouterModule} from '@angular/router';
import { CommonModule } from '@angular/common'; // Add this import
import { HttpClientModule } from '@angular/common/http'; // Add this import


@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule,CommonModule,HttpClientModule,RouterModule],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css']
})
export class SignupComponent {
  signupForm: FormGroup;
  hidePassword = true;
  isLoading = false;
  message = '';
  private apiUrl = 'http://localhost:8000/api';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router
  ) {
    this.signupForm = this.fb.group({
      firstname: ['', Validators.required],
      lastname: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', Validators.required],
    }, { validator: this.passwordMatchValidator });
  }

  passwordMatchValidator(form: FormGroup) {
    return form.get('password')?.value === form.get('password_confirmation')?.value
      ? null : { mismatch: true };
  }

  togglePasswordVisibility() {
    this.hidePassword = !this.hidePassword;
  }

  onSubmit() {
    if (this.signupForm.invalid) return;

    this.isLoading = true;
    this.message = '';

    const headers = new HttpHeaders({
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    });

    // Ensure password_confirmation is included
    const formData = {
      ...this.signupForm.value,
      password_confirmation: this.signupForm.get('password_confirmation')?.value
    };

    this.http.post(`${this.apiUrl}/signup`, formData, { headers })
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          this.message = 'success: Registration successful! Redirecting...';

          // Immediate feedback
          this.signupForm.reset();

          // Clear any previous errors
          Object.keys(this.signupForm.controls).forEach(key => {
            this.signupForm.get(key)?.setErrors(null);
          });

          // Redirect after 2 seconds
          setTimeout(() => {
            this.router.navigate(['/sign-in']);
          }, 2000);
        },
        error: (error) => {
          this.isLoading = false;

          const serverMessage = error.error?.message ||
                               error.error?.error ||
                               'Unknown server error';

          if (error.status === 500) {
            this.message = `Server error: ${serverMessage}`;
          } else if (error.status === 401) {
            this.message = 'Invalid email or password';
          } else if (error.status === 419) {
            this.message = 'Session expired. Please try again.';
            console.error('CSRF token mismatch or session expired');
          } else if (error.status === 422) {
            // Validation errors
            const validationErrors = error.error?.errors || {};
            let errorMsg = 'Validation error: ';

            Object.keys(validationErrors).forEach(key => {
              errorMsg += validationErrors[key].join(', ') + ' ';
            });

            this.message = errorMsg;
          } else {
            this.message = `Error: ${serverMessage}`;
          }

          console.error('Full error:', {
            status: error.status,
            message: error.message,
            serverResponse: error.error
          });
        }
        });
  }
}
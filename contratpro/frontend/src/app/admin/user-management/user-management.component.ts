import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { NavbarComponent } from '../../navbar/navbar.component';
import { FooterComponent } from '../../footer/footer.component';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    HttpClientModule, 
    FormsModule, 
    ReactiveFormsModule,
    NavbarComponent,
    FooterComponent
  ],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
  users: any[] = [];
  isLoading = true;
  showUserForm = false;
  userForm: FormGroup;
  isEditMode = false;
  currentUserId: number | null = null;
  searchTerm = '';
  filteredUsers: any[] = [];
  
  constructor(
    private adminService: AdminService,
    private fb: FormBuilder
  ) {
    this.userForm = this.fb.group({
      firstname: ['', [Validators.required]],
      lastname: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.minLength(8)]],
      is_admin: [false]
    });
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.adminService.getUsers().subscribe({
      next: (response) => {
        this.users = response.users;
        this.filteredUsers = [...this.users];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.isLoading = false;
      }
    });
  }

  toggleUserForm(): void {
    this.showUserForm = !this.showUserForm;
    if (!this.showUserForm) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.userForm.reset({
      firstname: '',
      lastname: '',
      email: '',
      password: '',
      is_admin: false
    });
    this.isEditMode = false;
    this.currentUserId = null;
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      return;
    }

    const userData = this.userForm.value;
    
    if (this.isEditMode && this.currentUserId) {
      // If password is empty, remove it from the request
      if (!userData.password) {
        delete userData.password;
      }
      
      this.adminService.updateUser(this.currentUserId, userData).subscribe({
        next: () => {
          this.loadUsers();
          this.toggleUserForm();
        },
        error: (error) => {
          console.error('Error updating user:', error);
        }
      });
    } else {
      this.adminService.createUser(userData).subscribe({
        next: () => {
          this.loadUsers();
          this.toggleUserForm();
        },
        error: (error) => {
          console.error('Error creating user:', error);
        }
      });
    }
  }

  editUser(user: any): void {
    this.isEditMode = true;
    this.currentUserId = user.id;
    this.userForm.patchValue({
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      is_admin: user.is_admin
    });
    // Clear password field for edit mode
    this.userForm.get('password')?.setValidators([]);
    this.userForm.get('password')?.updateValueAndValidity();
    
    this.showUserForm = true;
  }

  deleteUser(userId: number): void {
    if (confirm('Are you sure you want to delete this user?')) {
      this.adminService.deleteUser(userId).subscribe({
        next: () => {
          this.loadUsers();
        },
        error: (error) => {
          console.error('Error deleting user:', error);
        }
      });
    }
  }

  searchUsers(): void {
    if (!this.searchTerm.trim()) {
      this.filteredUsers = [...this.users];
      return;
    }
    
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredUsers = this.users.filter(user => 
      user.firstname.toLowerCase().includes(term) || 
      user.lastname.toLowerCase().includes(term) || 
      user.email.toLowerCase().includes(term)
    );
  }
}

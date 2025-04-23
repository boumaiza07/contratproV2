import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NavbarComponent } from "../navbar/navbar.component";
import { FooterComponent } from "../footer/footer.component";

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NavbarComponent, FooterComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent {
  isEditing = signal(false);
  twoFactorEnabled = signal(false);
  profileForm: FormGroup;

  user = {
    avatar: '',
    fullName: 'John Doe',
    email: 'john@example.com',
    phone: '+216 12 345 678',
    birthDate: '1990-01-01'
  };

  payments = [
    { date: '2024-01-15', amount: '29.99 TND' },
    { date: '2023-12-15', amount: '29.99 TND' }
  ];

  recentActivities = [
    { type: 'contract', title: 'Contrat NDA signé', date: new Date() },
    { type: 'signature', title: 'Signature requise', date: new Date() }
  ];

  constructor(private fb: FormBuilder, private router: Router) {
    this.profileForm = this.fb.group({
      fullName: [this.user.fullName, Validators.required],
      email: [this.user.email, [Validators.required, Validators.email]],
      phone: [this.user.phone, Validators.required],
      birthDate: [this.user.birthDate]
    });
  }

  toggleEdit() {
    this.isEditing.update(value => !value);
    if (!this.isEditing()) {
      this.profileForm.reset({
        fullName: this.user.fullName,
        email: this.user.email,
        phone: this.user.phone,
        birthDate: this.user.birthDate
      });
    }
  }

  onSubmit() {
    if (this.profileForm.valid) {
      // Update user logic here
      console.log('Profile updated:', this.profileForm.value);
      this.isEditing.set(false);
    }
  }

  triggerFileInput() {
    document.getElementById('avatarInput')?.click();
  }

  handleAvatarUpload(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.user.avatar = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  toggleTwoFactor() {
    this.twoFactorEnabled.update(value => !value);
  }

  changePassword() {
    this.router.navigate(['/change-password']);
  }

  getActivityIcon(type: string): string {
    return {
      'contract': 'fa-file-signature',
      'signature': 'fa-pen-to-square'
    }[type] || 'fa-circle-info';
  }
}
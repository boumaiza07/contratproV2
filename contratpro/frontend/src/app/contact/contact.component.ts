// contact.component.ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from "../navbar/navbar.component";
import { FooterComponent } from "../footer/footer.component";

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, NavbarComponent, FooterComponent],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css']
})
export class ContactComponent {
  isLoading = false;
  contactForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    subject: ['', Validators.required],
    message: ['', Validators.required]
  });

  constructor(private fb: FormBuilder) {}

  onSubmit() {
    if (this.contactForm.valid) {
      this.isLoading = true;
      console.log('Formulaire envoyé :', this.contactForm.value);
      // Ajouter ici la logique d'envoi (ex: service HTTP)
      
      // Simulate API call
      setTimeout(() => {
        this.isLoading = false;
        this.contactForm.reset();
      }, 1500);
    }
  }
}
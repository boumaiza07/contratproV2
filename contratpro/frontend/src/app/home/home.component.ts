import { Component } from '@angular/core';
import { NavbarComponent } from "../navbar/navbar.component";
import { FooterComponent } from "../footer/footer.component";
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [NavbarComponent, FooterComponent, CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})

export class HomeComponent {
  activeFeature: string = 'generer'; // Le premier bouton est actif par défaut

  // Fonction pour afficher le contenu d'une fonctionnalité
  showContent(feature: string) {
    this.activeFeature = feature;
  }
}
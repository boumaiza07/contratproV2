import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet], // Importez RouterOutlet pour le routage
  template: `
    <router-outlet></router-outlet> <!-- Utilisez le routeur ici -->
  `,
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'WebCnt';
}
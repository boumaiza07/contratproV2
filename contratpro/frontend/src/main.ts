import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Démarrage simple de l'application sans hydratation
console.log('Démarrage de l\'application Angular...');
bootstrapApplication(AppComponent, appConfig)
  .then(() => console.log('Application démarrée avec succès'))
  .catch((err) => console.error('Erreur lors du démarrage de l\'application:', err));
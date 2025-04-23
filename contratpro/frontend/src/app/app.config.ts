import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
// Suppression de l'import de provideClientHydration
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { AuthInterceptor } from './auth/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    // Suppression de provideClientHydration pour résoudre les problèmes d'hydratation
    provideAnimationsAsync(),
    provideHttpClient(
      withFetch(),
      withInterceptors([AuthInterceptor])
    )
  ]
};

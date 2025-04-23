import { Injectable, inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpInterceptorFn,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

export const AuthInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const router = inject(Router);

  // Récupérer le token d'authentification
  const token = localStorage.getItem('logToken') || localStorage.getItem('auth_token');

  // Si le token existe, ajouter l'en-tête Authorization aux requêtes
  if (token) {
    request = addTokenToRequest(request, token);
  }

  // Gérer la réponse et les erreurs
  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // Gérer les erreurs 401 (non autorisé) - redirection vers la page de connexion
      if (error.status === 401) {
        // Effacer les données d'authentification
        localStorage.removeItem('logToken');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('user');

        // Rediriger vers la page de connexion
        router.navigate(['/sign-in']);
      } else if (error.status === 419) {
        // Handle 419 errors (CSRF token mismatch) by logging the error
        console.error('Authentication error:', error);
        router.navigate(['/sign-in']);
      }

      return throwError(() => error);
    })
  );
};

// Fonction utilitaire pour ajouter le token à une requête
function addTokenToRequest(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}
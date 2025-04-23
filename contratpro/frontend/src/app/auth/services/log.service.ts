// auth.service.ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

export interface UserInfo {
  id?: number;
  name?: string;
  email?: string;
  avatar?: string;
  username?: string;
  // Autres propriétés possibles...
}

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private isAuthenticated = false;
  private userSubject = new BehaviorSubject<UserInfo | null>(null);
  
  // Observable auquel les composants peuvent souscrire pour être notifiés des changements
  readonly user$ = this.userSubject.asObservable();

  constructor(private router: Router) {
    // Vérifier au démarrage si l'utilisateur est déjà connecté
    this.checkInitialAuthState();
  }

  /**
   * Vérifie si un token est présent au démarrage de l'application
   */
  private checkInitialAuthState(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      const token = localStorage.getItem('logToken') || localStorage.getItem('auth_token');
      if (token) {
        this.isAuthenticated = true;
        
        // Récupérer les infos utilisateur stockées
        const userInfoStr = localStorage.getItem('userInfo') || localStorage.getItem('user');
        if (userInfoStr) {
          try {
            const userInfo = JSON.parse(userInfoStr);
            this.userSubject.next(userInfo);
          } catch (e) {
            console.error("Erreur lors de la récupération des informations utilisateur", e);
          }
        }
      }
    }
  }

  /**
   * Connecte l'utilisateur et stocke ses informations
   */
  login(token: string, userInfo: UserInfo): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Stocker le token et les infos utilisateur
      localStorage.setItem('logToken', token);
      localStorage.setItem('userInfo', JSON.stringify(userInfo));
    }
    
    // Mettre à jour l'état d'authentification
    this.isAuthenticated = true;
    this.userSubject.next(userInfo);
    
    console.log('Utilisateur connecté:', userInfo);
  }

  /**
   * Déconnecte l'utilisateur
   */
  logout(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Supprimer les données stockées
      localStorage.removeItem('logToken');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('userInfo');
      localStorage.removeItem('user');
    }
    
    // Réinitialiser l'état d'authentification
    this.isAuthenticated = false;
    this.userSubject.next(null);
    
    // Rediriger vers la page de connexion
    this.router.navigate(['/sign-in']);
  }

  /**
   * Vérifie si l'utilisateur est connecté
   */
  isLoggedIn(): boolean {
    // Si l'état déjà mis à jour est vrai, retourner vrai
    if (this.isAuthenticated) {
      return true;
    }
    
    // Sinon, vérifier s'il y a un token dans le localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const hasToken = !!localStorage.getItem('logToken') || !!localStorage.getItem('auth_token');
      this.isAuthenticated = hasToken;
      return hasToken;
    }
    return false;
  }

  /**
   * Récupère les informations de l'utilisateur connecté
   */
  getUserInfo(): UserInfo | null {
    // Si disponible dans le BehaviorSubject, utiliser ces données
    const currentUser = this.userSubject.getValue();
    if (currentUser) {
      return currentUser;
    }
    
    // Sinon, essayer de lire depuis localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const userInfoStr = localStorage.getItem('userInfo') || localStorage.getItem('user');
      if (userInfoStr) {
        try {
          const userInfo = JSON.parse(userInfoStr);
          // Mettre à jour le BehaviorSubject avec les données récupérées
          this.userSubject.next(userInfo);
          return userInfo;
        } catch (e) {
          console.error("Erreur lors de la récupération des informations utilisateur", e);
        }
      }
    }
    
    return null;
  }
}
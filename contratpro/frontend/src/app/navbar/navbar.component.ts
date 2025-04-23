// navbar.component.ts
import { Component, OnInit, HostListener, OnDestroy } from '@angular/core';
import { LogService } from '../auth/services/log.service';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  imports: [CommonModule, RouterModule],
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  isLoggedIn = false;
  menuOpen = false;
  userMenuOpen = false;
  userName = '';
  userEmail = '';
  userAvatar = '';
  notificationCount = 0;
  screenWidth = window.innerWidth;
  private authCheckInterval: any;
  private subscriptions: Subscription[] = [];

  constructor(private logService: LogService, private router: Router) {}

  ngOnInit(): void {
    // Vérifier l'état d'authentification au démarrage
    this.checkAuthStatus();

    // Utiliser requestAnimationFrame pour décaler l'initialisation de l'intervalle
    // Cela est plus performant et moins susceptible de causer des problèmes
    requestAnimationFrame(() => {
      // Vérifier périodiquement l'état d'authentification (tous les 60 secondes)
      // Augmenter l'intervalle pour réduire la charge
      this.authCheckInterval = setInterval(() => {
        this.checkAuthStatus();
      }, 60000); // Intervalle de 60 secondes au lieu de 30
    });
  }

  ngOnDestroy(): void {
    // Nettoyer l'intervalle lors de la destruction du composant
    if (this.authCheckInterval) {
      clearInterval(this.authCheckInterval);
    }

    // Nettoyer toutes les souscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  checkAuthStatus(): void {
    const wasLoggedIn = this.isLoggedIn;
    this.isLoggedIn = this.logService.isLoggedIn();

    // Si l'utilisateur vient de se connecter, charger ses données
    if (!wasLoggedIn && this.isLoggedIn) {
      this.loadUserData();
      this.loadNotifications();
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    this.screenWidth = window.innerWidth;
    if (this.screenWidth > 768) {
      this.menuOpen = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    // Fermer le menu utilisateur si on clique en dehors
    if (this.userMenuOpen && !target.closest('.user-menu')) {
      this.userMenuOpen = false;
    }

    // Fermer le menu mobile si on clique en dehors sur mobile
    if (this.screenWidth <= 768 && this.menuOpen && !target.closest('.navbar-container')) {
      this.menuOpen = false;
    }
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) {
      this.userMenuOpen = false;
    }
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  loadUserData(): void {
    try {
      const userInfo = this.logService.getUserInfo();
      if (userInfo) {
        this.userName = userInfo.name || userInfo.username || 'Utilisateur';
        this.userEmail = userInfo.email || '';
        this.userAvatar = userInfo.avatar || '';
        // Utiliser console.debug au lieu de console.log pour réduire les logs en production
        console.debug('Données utilisateur chargées:', this.userName);
      } else {
        this.userName = 'Utilisateur';
        this.userEmail = '';
        this.userAvatar = '';
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données utilisateur:', error);
      this.userName = 'Utilisateur';
      this.userEmail = '';
      this.userAvatar = '';
    }
  }

  loadNotifications(): void {
    // Utiliser requestAnimationFrame pour décaler le chargement des notifications
    // Cela est plus performant et moins susceptible de causer des problèmes
    requestAnimationFrame(() => {
      // Ici, vous pourriez faire un appel API pour charger les notifications réelles
      // Pour l'instant, on utilise une valeur fictive
      this.notificationCount = 2;
      // Utiliser console.debug pour réduire les logs en production
      console.debug('Notifications chargées:', this.notificationCount);
    });
  }

  logout(): void {
    this.logService.logout();
    this.isLoggedIn = false;
    this.userMenuOpen = false;
    this.router.navigate(['/sign-in']);
  }
}
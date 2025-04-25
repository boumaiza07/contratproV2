import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from "../navbar/navbar.component";
import { FooterComponent } from "../footer/footer.component";
import { NotificationService, Notification } from '../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, FooterComponent],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  private subscriptions: Subscription[] = [];

  // Filtres et tri
  filterType: 'all' | 'alert' | 'reminder' | 'update' = 'all';
  sortBy: 'date' | 'unread' = 'date';
  isLoading: boolean = true;
  showEmptyState: boolean = false;
  unreadCount: number = 0;

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.loadNotifications();
  }

  ngOnDestroy(): void {
    // Nettoyer les souscriptions pour éviter les fuites de mémoire
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // Charger les notifications depuis le service
  loadNotifications(): void {
    this.isLoading = true;

    const sub = this.notificationService.getNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.checkEmptyState();
        this.updateUnreadCount();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des notifications:', error);
        this.isLoading = false;
        this.showEmptyState = true;
      }
    });

    this.subscriptions.push(sub);
  }

  // Marquer toutes les notifications comme lues
  markAsRead(): void {
    this.isLoading = true;

    const sub = this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.loadNotifications();
      },
      error: (error) => {
        console.error('Erreur lors du marquage des notifications:', error);
        this.isLoading = false;
      }
    });

    this.subscriptions.push(sub);
  }

  // Marquer une notification individuelle comme lue/non lue
  toggleReadStatus(notification: Notification): void {
    if (notification.isRead) {
      const sub = this.notificationService.markAsUnread(notification.id).subscribe({
        next: () => this.updateUnreadCount(),
        error: (error) => console.error('Erreur:', error)
      });
      this.subscriptions.push(sub);
    } else {
      const sub = this.notificationService.markAsRead(notification.id).subscribe({
        next: () => this.updateUnreadCount(),
        error: (error) => console.error('Erreur:', error)
      });
      this.subscriptions.push(sub);
    }

    // Mettre à jour l'état local immédiatement pour une meilleure UX
    notification.isRead = !notification.isRead;
  }

  // Supprimer une notification
  deleteNotification(notification: Notification): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette notification ?')) {
      const sub = this.notificationService.deleteNotification(notification.id).subscribe({
        next: () => {
          this.notifications = this.notifications.filter(n => n.id !== notification.id);
          this.checkEmptyState();
          this.updateUnreadCount();
        },
        error: (error) => console.error('Erreur lors de la suppression:', error)
      });

      this.subscriptions.push(sub);
    }
  }

  // Filtrer les notifications par type
  filterNotifications(type: 'all' | 'alert' | 'reminder' | 'update'): void {
    this.filterType = type;
  }

  // Trier les notifications
  sortNotifications(sortBy: 'date' | 'unread'): void {
    this.sortBy = sortBy;
  }

  // Vérifier s'il y a des notifications à afficher
  private checkEmptyState(): void {
    this.showEmptyState = this.notifications.length === 0;
  }

  // Mettre à jour le compteur de notifications non lues
  private updateUnreadCount(): void {
    const sub = this.notificationService.getUnreadCount().subscribe({
      next: (count) => this.unreadCount = count,
      error: (error) => console.error('Erreur lors du comptage des notifications non lues:', error)
    });

    this.subscriptions.push(sub);
  }

  // Obtenir les notifications filtrées et triées
  get filteredNotifications(): Notification[] {
    let result = [...this.notifications];

    // Appliquer le filtre
    if (this.filterType !== 'all') {
      result = result.filter(n => n.type === this.filterType);
    }

    // Appliquer le tri
    if (this.sortBy === 'date') {
      result.sort((a, b) => b.date.getTime() - a.date.getTime());
    } else if (this.sortBy === 'unread') {
      result.sort((a, b) => (a.isRead === b.isRead) ? 0 : a.isRead ? 1 : -1);
    }

    return result;
  }
}

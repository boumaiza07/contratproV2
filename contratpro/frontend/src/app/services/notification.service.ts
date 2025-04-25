import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

// Interface pour typer les notifications
export interface Notification {
  id: number;
  title: string;
  message: string;
  date: Date;
  isRead: boolean;
  type: 'alert' | 'reminder' | 'update';
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  // Simuler une base de données de notifications
  private mockNotifications: Notification[] = [
    {
      id: 1,
      title: "Signature en attente",
      message: "Le contrat 'Contrat Microsoft 2024' attend votre signature",
      date: new Date('2024-03-10'),
      isRead: false,
      type: 'reminder'
    },
    {
      id: 2,
      title: "Nouvelle version",
      message: "Mise à jour des clauses RGPD disponible",
      date: new Date('2024-03-09'),
      isRead: true,
      type: 'update'
    },
    {
      id: 3,
      title: "Contrat expiré",
      message: "Le contrat 'Contrat de maintenance' a expiré",
      date: new Date('2024-03-08'),
      isRead: true,
      type: 'alert'
    },
    {
      id: 4,
      title: "Nouveau modèle disponible",
      message: "Un nouveau modèle de contrat est disponible dans la bibliothèque",
      date: new Date('2024-03-07'),
      isRead: true,
      type: 'update'
    }
  ];

  // BehaviorSubject pour stocker et émettre les notifications
  private notificationsSubject = new BehaviorSubject<Notification[]>(this.mockNotifications);
  
  // Observable public pour les composants
  public notifications$ = this.notificationsSubject.asObservable();

  constructor() { }

  // Obtenir toutes les notifications
  getNotifications(): Observable<Notification[]> {
    // Simuler un délai de chargement depuis une API
    return of(this.mockNotifications).pipe(delay(800));
  }

  // Marquer une notification comme lue
  markAsRead(id: number): Observable<boolean> {
    const notifications = this.notificationsSubject.value;
    const updatedNotifications = notifications.map(notification => {
      if (notification.id === id) {
        return { ...notification, isRead: true };
      }
      return notification;
    });
    
    this.notificationsSubject.next(updatedNotifications);
    return of(true).pipe(delay(300));
  }

  // Marquer une notification comme non lue
  markAsUnread(id: number): Observable<boolean> {
    const notifications = this.notificationsSubject.value;
    const updatedNotifications = notifications.map(notification => {
      if (notification.id === id) {
        return { ...notification, isRead: false };
      }
      return notification;
    });
    
    this.notificationsSubject.next(updatedNotifications);
    return of(true).pipe(delay(300));
  }

  // Marquer toutes les notifications comme lues
  markAllAsRead(): Observable<boolean> {
    const notifications = this.notificationsSubject.value;
    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      isRead: true
    }));
    
    this.notificationsSubject.next(updatedNotifications);
    return of(true).pipe(delay(300));
  }

  // Supprimer une notification
  deleteNotification(id: number): Observable<boolean> {
    const notifications = this.notificationsSubject.value;
    const updatedNotifications = notifications.filter(notification => notification.id !== id);
    
    this.notificationsSubject.next(updatedNotifications);
    return of(true).pipe(delay(300));
  }

  // Obtenir le nombre de notifications non lues
  getUnreadCount(): Observable<number> {
    const count = this.notificationsSubject.value.filter(n => !n.isRead).length;
    return of(count);
  }

  // Ajouter une nouvelle notification (pour les tests)
  addNotification(notification: Omit<Notification, 'id'>): Observable<boolean> {
    const notifications = this.notificationsSubject.value;
    const newId = Math.max(...notifications.map(n => n.id), 0) + 1;
    
    const newNotification: Notification = {
      ...notification,
      id: newId
    };
    
    this.notificationsSubject.next([newNotification, ...notifications]);
    return of(true).pipe(delay(300));
  }
}

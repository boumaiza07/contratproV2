import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from "../navbar/navbar.component";
import { FooterComponent } from "../footer/footer.component";

// Interface pour typer les notifications
interface Notification {
  id: number;
  title: string;
  message: string;
  date: Date;
  isRead: boolean;
  type: 'alert' | 'reminder' | 'update';
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent, FooterComponent],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit {
  notifications: Notification[] = [
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
    }
  ];
getNotificationTitle: any;
notification: any;
deleteNotification: any;

  ngOnInit(): void {
    this.markAsRead();
  }

  // Marquer toutes les notifications comme lues
  markAsRead(): void {
    this.notifications = this.notifications.map(notification => ({
      ...notification,
      isRead: true
    }));
  }

  // Filtrer les notifications non lues
  get unreadCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }
  
}

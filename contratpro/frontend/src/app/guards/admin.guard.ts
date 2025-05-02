import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { LogService } from '../auth/services/log.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(
    private logService: LogService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    const user = this.logService.getUserInfo();

    if (user && user.is_admin) {
      return of(true);
    }

    // If not admin, redirect to dashboard
    this.router.navigate(['/dashboard']);
    return of(false);
  }
}

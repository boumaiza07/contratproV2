import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { SecurityComponent } from './security/security.component';
import { ContactComponent } from './contact/contact.component';
import { NotificationsComponent } from './notifications/notifications.component';
import { ProfileComponent } from './profile/profile.component';
import { SignInComponent } from './sign-in/sign-in.component';
import { SignupComponent } from './signup/signup.component';
import { FileUploadComponent } from './file-upload/file-upload.component';


export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'security', component: SecurityComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'notifications', component: NotificationsComponent },
  { path: 'profile', component: ProfileComponent },
  { path: 'sign-in', component: SignInComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'upload', component: FileUploadComponent },
  { path: 'fileupload', component: FileUploadComponent },


  // Redirects for old routes
  { path: 'login', redirectTo: 'sign-in', pathMatch: 'full' },
  { path: 'register', redirectTo: 'signup', pathMatch: 'full' },
  { path: 'forgot-password', redirectTo: 'sign-in', pathMatch: 'full' },


  // Catch all route
  { path: '**', redirectTo: '' }
];

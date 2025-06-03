import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { onAuthStateChanged, User } from 'firebase/auth';
import { firstValueFrom, BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUser: User | null = null;
  private authReadySubject = new BehaviorSubject<boolean>(false);
  public authReady$: Observable<boolean> = this.authReadySubject.asObservable();

  constructor(private auth: Auth) {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUser = user;
      this.authReadySubject.next(true);
    });
  }

  getUid(): string | null {
    return this.currentUser?.uid ?? null;
  }

  getUser(): User | null {
    return this.currentUser;
  }
}

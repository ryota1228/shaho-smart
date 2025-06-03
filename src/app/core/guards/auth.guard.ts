import { Injectable } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { map, take, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.authReady$.pipe(
    take(1), // authReady$ の初回完了のみ使う
    switchMap((isReady) => {
      if (!isReady) return of(false); // ありえないが保険
      const uid = authService.getUid();
      if (uid) {
        return of(true); // ログインOK
      } else {
        router.navigate(['/login']);
        return of(false); // ログインしてないので弾く
      }
    })
  );
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { filter, map } from 'rxjs/operators';

export const loginRedirectGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.authReady$.pipe(
    filter(isReady => isReady),
    map(() => {
      const uid = authService.getUid();
      if (uid) {
        router.navigate(['/insurance-premium']);
        return false;
      }
      return true;
    })
  );
};

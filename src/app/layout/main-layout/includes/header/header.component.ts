import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../shared/material/material.module';
import { AuthService } from '../../../../core/services/auth.service';
import { first } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  @Output() toggleSidenav = new EventEmitter<void>();
  userName = '';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.authReady$.pipe(first()).subscribe(() => {
      this.userName = this.authService.getCurrentUserFullName();
    });
  }
}

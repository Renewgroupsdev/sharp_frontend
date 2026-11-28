import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';

/** Username / password sign-in for every role, checked against the SHARP backend API. */
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly changed = inject(ActivatedRoute).snapshot.queryParamMap.get('changed') === '1';
  protected username = '';
  protected password = '';
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly showPassword = signal(false);

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    this.busy.set(true);
    const err = await this.auth.signIn(this.username, this.password);
    this.busy.set(false);
    if (err) { this.error.set(err); return; }
    void this.router.navigateByUrl(this.auth.homeUrl());
  }
}

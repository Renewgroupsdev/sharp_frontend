import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Renders its element only when the viewed role holds the permission, using the slug scheme
 * `<moduleKey>.<view|create|edit|delete>`:
 *
 *   <button *appCan="'a_orgs.create'" (click)="add()">Add institute</button>
 */
@Directive({
  selector: '[appCan]',
  standalone: true,
})
export class CanActionDirective {
  private readonly auth = inject(AuthService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private shown = false;

  readonly appCan = input.required<string>();

  constructor() {
    effect(() => {
      // Reads the role + permission matrix signals, so the button appears / disappears when either changes.
      this.auth.role();
      const allowed = this.auth.hasActionAccess(this.appCan());
      if (allowed && !this.shown) { this.container.createEmbeddedView(this.template); this.shown = true; }
      else if (!allowed && this.shown) { this.container.clear(); this.shown = false; }
    });
  }
}

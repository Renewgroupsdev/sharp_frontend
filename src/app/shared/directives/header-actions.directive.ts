import { Directive, Injectable, OnDestroy, OnInit, TemplateRef, inject, signal } from '@angular/core';

/** Holds the buttons a tab wants to show on the right of its page header (the page draws them, the tab owns them). */
@Injectable({ providedIn: 'root' })
export class HeaderActions {
  readonly template = signal<TemplateRef<unknown> | null>(null);
}

/**
 * Put `<ng-template appHeaderActions>…buttons…</ng-template>` in a tab and its buttons appear on the right of the page
 * header, in line with the heading, instead of on a row of their own. The click handlers still belong to the tab.
 */
@Directive({ selector: 'ng-template[appHeaderActions]', standalone: true })
export class HeaderActionsDirective implements OnInit, OnDestroy {
  private readonly template = inject(TemplateRef);
  private readonly actions = inject(HeaderActions);

  // Deferred so the header is not changed in the middle of the check that is drawing it.
  ngOnInit(): void { queueMicrotask(() => this.actions.template.set(this.template)); }

  ngOnDestroy(): void { queueMicrotask(() => { if (this.actions.template() === this.template) this.actions.template.set(null); }); }
}

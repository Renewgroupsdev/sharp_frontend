import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * Moves the element to the end of <body> while it exists. A popup that sits inside a card is clipped or covered by the
 * cards around it (their own stacking and overflow); on <body> it floats above everything and fixed positions are exact.
 */
@Directive({ selector: '[appPortal]', standalone: true })
export class PortalDirective implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  ngOnInit(): void { document.body.appendChild(this.el); }

  ngOnDestroy(): void { this.el.remove(); }
}

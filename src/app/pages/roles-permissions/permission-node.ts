import { Component, input } from '@angular/core';
import { PermAction, PermNode, PermTab } from '../../shared/common-services/permissions.service';

/** What a tree node needs from the Roles & Permissions page. */
export interface PermContext {
  state(node: PermNode): 'all' | 'some' | 'none';
  has(roles: string[]): boolean;
  isOpen(slug: string): boolean;
  toggleOpen(slug: string): void;
  matches(node: PermNode): boolean;
  locked(slug: string): boolean;
  toggleModule(node: PermNode, on: boolean): void;
  toggleAction(action: PermAction, on: boolean): void;
  toggleTab(tab: PermTab, on: boolean): void;
}

/** One module or sub-module row of the Assign Permissions tree: tick it to give the role the whole branch, or tick single tabs and actions. */
@Component({
  selector: 'app-perm-node',
  standalone: true,
  styleUrl: './permission-node.scss',
  template: `
    @if (ctx().matches(node())) {
      <div class="pn" [class.sub]="level() > 0" [class.on]="ctx().state(node()) !== 'none'">
        <div class="pn-row">
          <span class="pn-icon"><i class="bi" [class]="node().icon || 'bi-folder2-open'"></i></span>
          <div class="pn-title">
            <b class="pn-name">{{ node().name }}</b>
            <span class="pn-meta">
              @if (node().sub_modules.length) { {{ node().sub_modules.length }} sub-module{{ node().sub_modules.length === 1 ? '' : 's' }} · }
              {{ node().tabs.length }} tab{{ node().tabs.length === 1 ? '' : 's' }} · {{ node().actions.length }} action{{ node().actions.length === 1 ? '' : 's' }}
            </span>
          </div>
          <input type="checkbox" class="pn-switch" role="switch" [checked]="ctx().state(node()) === 'all'" [indeterminate]="ctx().state(node()) === 'some'"
                 [disabled]="ctx().locked(node().slug)" [attr.aria-label]="'Give access to ' + node().name"
                 (change)="ctx().toggleModule(node(), $any($event.target).checked)" />
          <button type="button" class="pn-caret" [class.open]="ctx().isOpen(node().slug)" [attr.aria-label]="'Show details of ' + node().name" (click)="ctx().toggleOpen(node().slug)"><i class="bi bi-chevron-right"></i></button>
        </div>

        @if (ctx().isOpen(node().slug)) {
          <div class="pn-body">
            @if (node().tabs.length) {
              <div class="pn-group">
                <span class="pn-label"><i class="bi bi-layout-text-window"></i> Tabs</span>
                <div class="pn-chips">
                  @for (t of node().tabs; track t.slug) {
                    <label class="pn-chip" [class.on]="ctx().has(t.roles)">
                      <input type="checkbox" [checked]="ctx().has(t.roles)" [disabled]="ctx().locked(t.slug)" (change)="ctx().toggleTab(t, $any($event.target).checked)" />
                      {{ t.name }}
                    </label>
                  }
                </div>
              </div>
            }
            @if (node().actions.length) {
              <div class="pn-group">
                <span class="pn-label"><i class="bi bi-lightning-charge"></i> Actions</span>
                <div class="pn-chips">
                  @for (a of node().actions; track a.slug) {
                    <label class="pn-chip" [class.on]="ctx().has(a.roles)">
                      <input type="checkbox" [checked]="ctx().has(a.roles)" [disabled]="ctx().locked(a.slug)" (change)="ctx().toggleAction(a, $any($event.target).checked)" />
                      {{ a.name }}
                    </label>
                  }
                </div>
              </div>
            }
            @for (child of node().sub_modules; track child.slug) {
              <app-perm-node [node]="child" [ctx]="ctx()" [level]="level() + 1" />
            }
          </div>
        }
      </div>
    }
  `,
})
export class PermissionNode {
  readonly node = input.required<PermNode>();
  readonly ctx = input.required<PermContext>();
  readonly level = input(0);
}

import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

type ToastKind = 'success' | 'error' | 'warning' | 'info';

const KINDS: Record<ToastKind, { icon: string; color: string; ms: number; role: 'status' | 'alert' }> = {
  success: { icon: 'bi-check-circle-fill', color: '#16a34a', ms: 10_000, role: 'status' },
  info: { icon: 'bi-info-circle-fill', color: '#2563eb', ms: 10_000, role: 'status' },
  warning: { icon: 'bi-exclamation-triangle-fill', color: '#d97706', ms: 12_000, role: 'alert' },
  error: { icon: 'bi-x-octagon-fill', color: '#dc2626', ms: 12_000, role: 'alert' },
};

const STYLE_ID = 'app-toast-style';
const CSS = `
.app-toasts { position: fixed; top: 16px; right: 16px; z-index: 2000; display: flex; flex-direction: column; gap: 10px; width: 360px; max-width: calc(100vw - 24px); pointer-events: none; }
.app-toast { pointer-events: auto; position: relative; overflow: hidden; display: flex; align-items: flex-start; gap: 10px; padding: 12px 10px 14px 14px; border-left: 4px solid var(--tc); border-radius: 12px; background: #fff; color: #111827; box-shadow: 0 8px 26px rgba(0, 0, 0, .22); animation: app-toast-in .2s ease-out; }
.app-toast.out { opacity: 0; transform: translateX(30px); transition: opacity .2s, transform .2s; }
@keyframes app-toast-in { from { transform: translateX(30px); opacity: 0; } to { transform: none; opacity: 1; } }
.app-toast > i { flex: none; margin-top: 1px; font-size: 18px; color: var(--tc); }
.app-toast .tt { flex: 1; min-width: 0; }
.app-toast .tt b { display: block; font-size: 13.5px; line-height: 1.35; word-break: break-word; }
.app-toast .tt small { display: block; margin-top: 2px; font-size: 12.5px; color: #6b7280; word-break: break-word; }
.app-toast button { flex: none; width: 24px; height: 24px; border: 0; border-radius: 50%; background: none; color: #9ca3af; cursor: pointer; }
.app-toast button:hover { background: #f3f4f6; color: #374151; }
.app-toast .bar { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; background: var(--tc); opacity: .55; transform-origin: left; animation: app-toast-bar var(--ms) linear forwards; }
.app-toast:hover .bar { animation-play-state: paused; }
@keyframes app-toast-bar { to { transform: scaleX(0); } }
:root[data-theme='dark'] .app-toast { background: #1b2927; color: #e5e7eb; }
:root[data-theme='dark'] .app-toast .tt small { color: #9ca3af; }
`;

/**
 * Success, error, warning and info messages are small toasts in the top-right corner. They never block the page and never
 * close an open dialog, so the steps that follow a save (closing a form, opening the next one, navigating) carry on.
 * Questions that need an answer (confirm, prompt, select, secret) still use SweetAlert2 dialogs.
 */
@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private container: HTMLElement | null = null;

  private host(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    if (!this.container || !this.container.isConnected) {
      this.container = document.createElement('div');
      this.container.className = 'app-toasts';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  private fire(kind: ToastKind, title: string, text?: string): void {
    const host = this.host();
    if (!host) return;
    const k = KINDS[kind];

    const el = document.createElement('div');
    el.className = 'app-toast';
    el.setAttribute('role', k.role);
    el.style.setProperty('--tc', k.color);
    el.style.setProperty('--ms', `${k.ms}ms`);

    const icon = document.createElement('i');
    icon.className = `bi ${k.icon}`;
    icon.setAttribute('aria-hidden', 'true');
    const body = document.createElement('div');
    body.className = 'tt';
    const b = document.createElement('b');
    b.textContent = title; // textContent: messages can carry server text, never HTML
    body.appendChild(b);
    if (text) {
      const small = document.createElement('small');
      small.textContent = text;
      body.appendChild(small);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss');
    close.innerHTML = '<i class="bi bi-x-lg"></i>';
    const bar = document.createElement('span');
    bar.className = 'bar';
    el.append(icon, body, close, bar);
    host.appendChild(el);

    let timer: ReturnType<typeof setTimeout>;
    const remove = () => {
      clearTimeout(timer);
      el.classList.add('out');
      setTimeout(() => el.remove(), 200);
    };
    const arm = (ms: number) => { clearTimeout(timer); timer = setTimeout(remove, ms); };
    let startedAt = Date.now();
    let left = k.ms;
    arm(left);
    el.addEventListener('mouseenter', () => { clearTimeout(timer); left -= Date.now() - startedAt; });
    el.addEventListener('mouseleave', () => { startedAt = Date.now(); arm(Math.max(left, 1500)); });
    close.addEventListener('click', remove);
  }

  success(title: string, text?: string): void {
    this.fire('success', title, text);
  }

  error(title: string, text?: string): void {
    this.fire('error', title, text);
  }

  warning(title: string, text?: string): void {
    this.fire('warning', title, text);
  }

  info(title: string, text?: string): void {
    this.fire('info', title, text);
  }

  /** Shows a value once (e.g. a temporary password) in a dark box with a Copy button. */
  secret(title: string, note: string, label: string, value: string): Promise<void> {
    return Swal.fire({
      icon: 'success',
      title,
      html: `<p style="font-size:13px;margin:0 0 10px">${note}</p>
        <div style="background:#16231d;color:#fff;border-radius:12px;padding:16px">
          <div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#B9C7BF">${label}</div>
          <div id="secret-value" style="font-family:ui-monospace,Menlo,monospace;font-size:20px;font-weight:700;margin-top:4px;user-select:all"></div>
        </div>`,
      didOpen: el => { el.querySelector('#secret-value')!.textContent = value; },
      showDenyButton: true,
      denyButtonText: 'Copy',
      denyButtonColor: '#0E7A4E',
      confirmButtonText: 'Done',
      confirmButtonColor: '#6C63FF',
      allowOutsideClick: false,
      preDeny: () => {
        void navigator.clipboard?.writeText(value);
        const btn = Swal.getDenyButton();
        if (btn) btn.textContent = 'Copied';
        return false;
      },
    }).then(() => undefined);
  }

  /** Asks the user to pick one of `options`. Resolves with the chosen option, or null when cancelled. */
  async select(title: string, label: string, options: string[], confirmButtonText = 'Continue', text?: string): Promise<string | null> {
    const result = await Swal.fire({
      title,
      text,
      input: 'select',
      inputLabel: label,
      inputOptions: Object.fromEntries(options.map(o => [o, o])),
      inputPlaceholder: 'Choose a reason',
      showCancelButton: true,
      confirmButtonText,
      confirmButtonColor: '#dc4c4c',
      cancelButtonText: 'Back',
      reverseButtons: true,
      inputValidator: value => (value ? null : 'Please choose one.'),
    });
    return result.isConfirmed ? String(result.value) : null;
  }

  /** Asks for one line of text (for example a reason). Resolves with the trimmed text, or null when cancelled. */
  async prompt(title: string, label: string, confirmButtonText = 'Submit', minLength = 3): Promise<string | null> {
    const result = await Swal.fire({
      title,
      input: 'textarea',
      inputLabel: label,
      inputAttributes: { maxlength: '255' },
      showCancelButton: true,
      confirmButtonText,
      confirmButtonColor: '#6C63FF',
      reverseButtons: true,
      inputValidator: value => (value.trim().length < minLength ? 'Please write a little more.' : null),
    });
    return result.isConfirmed ? String(result.value).trim() : null;
  }

  /** Swal-based Yes/No prompt so destructive actions never fall back to the browser's native confirm(). */
  confirm(title: string, text?: string, confirmButtonText = 'Yes, delete it'): Promise<boolean> {
    return Swal.fire({
      icon: 'warning',
      title,
      text,
      showCancelButton: true,
      confirmButtonText,
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc4c4c',
      cancelButtonColor: '#6C63FF',
      reverseButtons: true,
    }).then(result => result.isConfirmed);
  }
}


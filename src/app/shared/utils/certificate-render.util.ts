import { create as createQr } from 'qrcode';
import { Certificate } from '../models/certificate.model';
import { escapeHtml } from './export.util';
import { initials } from './format.util';

/** Styles of the certificate artwork; also embedded in a downloaded file so it looks the same offline. */
export const CERT_CSS = ".lm-cert{position:relative;box-sizing:border-box;width:100%;max-width:760px;aspect-ratio:1.414;margin:0 auto;padding:6% 8%;background:#fff;color:#1a2520;text-align:center;font-family:Georgia,'Times New Roman',serif;display:flex;flex-direction:column;justify-content:space-between}" +
  ".lm-cert.t-Classic{border:10px double #0E7A4E}.lm-cert.t-Modern{border-left:34px solid #0E7A4E;border-top:1px solid #d6e0d9;border-right:1px solid #d6e0d9;border-bottom:1px solid #d6e0d9;font-family:'Segoe UI',Arial,sans-serif;text-align:left}" +
  ".lm-cert.t-Minimal{border:1px solid #aab7ae;font-family:'Segoe UI',Arial,sans-serif}.lm-cert h1{margin:0;font-size:clamp(18px,3.4vw,30px);letter-spacing:.04em;color:#0A5B39}.lm-cert .ct{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#6c7a72}" +
  ".lm-cert .cn{font-size:clamp(20px,4vw,34px);font-weight:700;margin:6px 0}.lm-cert .cb{font-size:clamp(11px,1.6vw,14px);line-height:1.6;max-width:80%;margin:0 auto}.lm-cert.t-Modern .cb{margin:0}" +
  ".lm-cert .cf{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;font-size:11px;text-align:center}.lm-cert .cf small{display:block;color:#6c7a72}.lm-cert .sig{min-width:130px;border-top:1px solid #1a2520;padding-top:4px}" +
  ".lm-cert .sig img{display:block;max-height:42px;margin:0 auto 2px}.lm-cert .qr svg{width:62px;height:62px;display:block}.lm-cert .pf{width:64px;height:64px;border-radius:50%;object-fit:cover;margin:6px auto;display:grid;place-items:center;background:#0E7A4E;color:#fff;font:700 20px sans-serif}";

/** What the artwork needs from a certificate; an unissued one may carry the date staff chose in `issue_date`. */
export type CertificateArt = Pick<Certificate, 'name' | 'course' | 'score' | 'number' | 'issued_at' | 'design'> & { issue_date?: string | null; photo?: string | null };

const longDate = (iso: string | null): string =>
  new Date(iso ? (iso.length === 10 ? iso + 'T00:00:00' : iso) : Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/** The URL a certificate's QR code points to: the public verification page of this app. */
export const verifyUrl = (number: string): string => `${window.location.origin}/verify/${encodeURIComponent(number)}`;

function qrSvg(text: string): string {
  try {
    const { modules } = createQr(text, { errorCorrectionLevel: 'M' });
    const size = modules.size;
    let path = '';
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (modules.get(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path d="${path}" fill="#000"/></svg>`;
  } catch {
    return '';
  }
}

/**
 * The certificate artwork as HTML. Every value, including the admin's own wording, is escaped before the placeholders
 * ({student} {course} {score} {date} {no}) are filled in, so the result is safe to render.
 */
export function certificateHtml(c: CertificateArt): string {
  const e = escapeHtml;
  const d = c.design;
  const no = c.number ?? '(assigned on issue)';
  const date = longDate(c.issued_at ?? c.issue_date ?? null);
  const body = e(d.body)
    .replace(/\{student\}/g, `<b>${e(c.name)}</b>`).replace(/\{course\}/g, e(c.course))
    .replace(/\{score\}/g, e(c.score ?? '—')).replace(/\{date\}/g, e(date)).replace(/\{no\}/g, e(no));
  const qr = d.show_qr && c.number ? qrSvg(verifyUrl(c.number)) : '';
  // The student's own picture when there is one, otherwise their initials.
  const prof = d.show_profile ? (c.photo ? `<img class="pf" src="${e(c.photo)}" alt="${e(c.name)}">` : `<div class="pf">${e(initials(c.name))}</div>`) : '';
  const sig = d.signature_image ? `<img src="${e(d.signature_image)}" alt="">` : '';

  return `<div class="lm-cert t-${e(d.template)}"><div><div class="ct">${e(d.type)}</div><h1>${e(d.title)}</h1></div>` +
    `<div>${prof}<div class="cn">${e(c.name)}</div><p class="cb">${body}</p></div>` +
    `<div class="cf"><div class="sig">${sig}${e(d.signature_name ?? '')}<small>${e(d.signature_role ?? '')}</small></div>` +
    `<div>Certificate no.<br><b>${e(no)}</b><small>Issued ${e(date)}</small></div><div class="qr">${qr}</div></div></div>`;
}

/** A stand-alone HTML file of the certificate: open it to view, or print it to save as PDF. */
export function certificateDocument(c: CertificateArt): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(c.number ?? 'Certificate')}</title>` +
    `<style>body{margin:0;padding:24px;background:#eef2ef}${CERT_CSS}@media print{body{padding:0;background:#fff}@page{size:A4 landscape;margin:10mm}}</style></head><body>${certificateHtml(c)}</body></html>`;
}

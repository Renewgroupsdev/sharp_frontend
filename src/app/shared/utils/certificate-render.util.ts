import { create as createQr } from 'qrcode';
import { Certificate } from '../models/certificate.model';
import { escapeHtml } from './export.util';
import { initials } from './format.util';

/** Styles of the certificate artwork; also embedded in a downloaded file so it looks the same offline. */
export const CERT_CSS = ".lm-cert .lgrow{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px}.lm-cert .lgc{flex:1;display:flex;align-items:center;gap:8px;min-height:1px}.lm-cert .lgc.l{justify-content:flex-start}.lm-cert .lgc.c{justify-content:center}.lm-cert .lgc.r{justify-content:flex-end}.lm-cert .lgc img{height:34px;width:auto;max-width:120px;object-fit:contain}.lm-cert.t-Royal .lgc img{background:#fff;padding:3px 6px;border-radius:4px}" +
  ".lm-cert{position:relative;box-sizing:border-box;width:100%;max-width:760px;aspect-ratio:1.414;margin:0 auto;padding:6% 8%;background:#fff;color:#1a2520;text-align:center;font-family:Georgia,'Times New Roman',serif;display:flex;flex-direction:column;justify-content:space-between;gap:16px}" +
  ".lm-cert.t-Classic{border:10px double var(--ca,#0E7A4E)}.lm-cert.t-Modern{border-left:34px solid var(--ca,#0E7A4E);border-top:1px solid #d6e0d9;border-right:1px solid #d6e0d9;border-bottom:1px solid #d6e0d9;font-family:'Segoe UI',Arial,sans-serif;text-align:left}" +
  ".lm-cert.t-Minimal{border:1px solid #aab7ae;font-family:'Segoe UI',Arial,sans-serif}.lm-cert h1{margin:0;font-size:clamp(18px,3.4vw,30px);letter-spacing:.04em;color:var(--ca,#0A5B39)}.lm-cert .ct{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#6c7a72}" +
  ".lm-cert .cn{font-size:clamp(20px,4vw,34px);font-weight:700;margin:6px 0}.lm-cert .cb{font-size:clamp(11px,1.6vw,14px);line-height:1.6;max-width:80%;margin:0 auto}.lm-cert.t-Modern .cb{margin:0}" +
  ".lm-cert .cf{min-height:64px;margin-top:8px;padding-top:6px;display:grid;grid-template-columns:1fr auto 1fr;align-items:end;gap:10px;font-size:11px;text-align:center}.lm-cert .cf>.no{justify-self:start;min-width:130px;padding-top:4px}.lm-cert .cf>.qr{justify-self:center;min-height:1px}.lm-cert .cf>.sigc{justify-self:end}.lm-cert .cf small{display:block;color:#6c7a72}.lm-cert .sig{min-width:130px;padding-top:4px}" +
  ".lm-cert .sig img{display:block;max-height:42px;margin:0 auto 2px}.lm-cert .qr svg{width:62px;height:62px;display:block}.lm-cert .pf{width:64px;height:64px;border-radius:50%;object-fit:cover;margin:6px auto;display:grid;place-items:center;background:var(--ca,#0E7A4E);color:#fff;font:700 20px sans-serif}" +
  // more layouts
  ".lm-cert.t-Elegant{background:#fffdf6;border:3px solid #B8912F;box-shadow:inset 0 0 0 7px #fffdf6,inset 0 0 0 9px #B8912F;padding:7% 9%}.lm-cert.t-Elegant .ct{color:#B8912F;letter-spacing:.3em}.lm-cert.t-Elegant h1{font-style:italic;font-weight:400;font-size:clamp(20px,4vw,36px)}.lm-cert.t-Elegant .cn{font-style:italic;border-bottom:1px solid #B8912F;display:inline-block;padding:0 24px 4px}" +
  ".lm-cert.t-Corporate{border:1px solid #d6e0d9;border-top:30px solid var(--ca,#0E7A4E);font-family:'Segoe UI',Arial,sans-serif;padding:5% 8%}.lm-cert.t-Corporate h1{text-transform:uppercase;letter-spacing:.12em;font-size:clamp(16px,3vw,26px)}.lm-cert.t-Corporate .cn{font-weight:600;border-bottom:3px solid var(--ca,#0E7A4E);display:inline-block;padding-bottom:4px}.lm-cert.t-Corporate .ct{font-weight:600}" +
  ".lm-cert.t-Royal{background:var(--ca,#0E7A4E);color:#fff;border:6px solid #fff;box-shadow:inset 0 0 0 3px var(--ca,#0E7A4E),inset 0 0 0 5px rgba(255,255,255,.75);outline:1px solid var(--ca,#0E7A4E);padding:7% 9%}.lm-cert.t-Royal h1,.lm-cert.t-Royal .ct,.lm-cert.t-Royal .cf small{color:#fff}.lm-cert.t-Royal .ct{opacity:.85}.lm-cert.t-Royal .qr{background:#fff;padding:4px;border-radius:4px}.lm-cert.t-Royal .pf{background:#fff;color:var(--ca,#0E7A4E)}.lm-cert.t-Royal .cn{font-size:clamp(22px,4.4vw,38px)}";

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
  // Before a number is issued the QR shows where it will sit (it points at the verification page).
  const qr = d.show_qr ? qrSvg(verifyUrl(c.number ?? 'pending')) : '';
  const logoPos = d.logo_position === 'left' || d.logo_position === 'right' ? d.logo_position : 'center';
  // The SHARP logo and every uploaded logo, each on its own side of one header row.
  const marks: { pos: string; src: string; alt: string }[] = [];
  if (d.show_logo !== false) marks.push({ pos: logoPos, src: d.logo_image && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(d.logo_image) ? d.logo_image : `${window.location.origin}/assets/02_Renew Group -Logo png.png`, alt: 'SHARP' });
  for (const l of d.logos ?? []) {
    if (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(l.image)) marks.push({ pos: l.position === 'left' || l.position === 'right' ? l.position : 'center', src: l.image, alt: 'Logo' });
  }
  const slot = (p: string): string => marks.filter(m => m.pos === p).map(m => `<img src="${e(m.src)}" alt="${e(m.alt)}">`).join('');
  const logo = marks.length ? `<div class="lgrow"><div class="lgc l">${slot('left')}</div><div class="lgc c">${slot('center')}</div><div class="lgc r">${slot('right')}</div></div>` : '';
  // The student's own picture when there is one, otherwise their initials.
  const prof = d.show_profile ? (c.photo ? `<img class="pf" src="${e(c.photo)}" alt="${e(c.name)}">` : `<div class="pf">${e(initials(c.name))}</div>`) : '';
  const sig = d.signature_image ? `<img src="${e(d.signature_image)}" alt="">` : '';

  const accent = d.accent && /^#[0-9a-f]{6}$/i.test(d.accent) ? d.accent : '';
  return `<div class="lm-cert t-${e(d.template)}"${accent ? ` style="--ca:${accent}"` : ''}><div>${logo}<div class="ct">${e(d.type)}</div><h1>${e(d.title)}</h1></div>` +
    `<div>${prof}<div class="cn">${e(c.name)}</div><p class="cb">${body}</p></div>` +
    `<div class="cf"><div class="no">Certificate no.<br><b>${e(no)}</b><small>Issued ${e(date)}</small></div><div class="qr">${qr}</div>` +
    `<div class="sigc"><div class="sig">${sig}${e(d.signature_name ?? '')}<small>${e(d.signature_role ?? '')}</small></div></div></div></div>`;
}

/** A stand-alone HTML file of the certificate: open it to view, or print it to save as PDF. */
export function certificateDocument(c: CertificateArt): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(c.number ?? 'Certificate')}</title>` +
    `<style>body{margin:0;padding:24px;background:#eef2ef}${CERT_CSS}@media print{body{padding:0;background:#fff}@page{size:A4 landscape;margin:10mm}}</style></head><body>${certificateHtml(c)}</body></html>`;
}

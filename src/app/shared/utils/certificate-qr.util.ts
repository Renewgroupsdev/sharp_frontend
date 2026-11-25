import { toDataURL } from 'qrcode';
import { CertQrCode, scanUrl } from '../models/certificate.model';

export type CertQrCard = CertQrCode & { image: string; url: string };

/** Adds the link and the drawn QR picture to each course code. */
export const withQrImages = (codes: CertQrCode[]): Promise<CertQrCard[]> =>
  Promise.all(codes.map(async c => {
    const url = scanUrl(c.token);
    return { ...c, url, image: await toDataURL(url, { width: 240, margin: 1, errorCorrectionLevel: 'M' }) };
  }));

export const qrStatusLabel = (c: CertQrCode): string =>
  ({ issued: 'Certificate issued', completed: 'Course completed', in_progress: `In progress · ${c.progress}%`, cancelled: 'Certificate cancelled' })[c.status];

/** Saves the QR picture as a PNG named after the course. */
export function downloadQrImage(c: { course: string; image: string }): void {
  const a = document.createElement('a');
  a.href = c.image;
  a.download = `certificate-qr-${c.course.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}.png`;
  a.click();
}

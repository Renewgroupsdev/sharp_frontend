/** Mirrors the API's upload rules (App\Support\Uploads) so a bad file is caught before it is sent. */
export const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.jpg,.jpeg,.png';
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const ALLOWED = new Set(DOCUMENT_ACCEPT.split(',').map(e => e.slice(1)));

/** The reason a file cannot be uploaded, or null when it is fine. */
export function documentProblem(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED.has(ext)) return 'Allowed files: PDF, Word, Excel, PowerPoint, TXT, ZIP, JPG or PNG.';
  if (file.size > MAX_UPLOAD_BYTES) return 'The file must be 20 MB or smaller.';
  return null;
}

/** "845 KB", "2.4 MB". */
export const humanSize = (bytes: number): string => (bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`);

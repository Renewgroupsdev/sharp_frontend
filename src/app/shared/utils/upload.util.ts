/** Mirrors the API's upload rules (App\Support\Uploads) so a bad file is caught before it is sent. */
export const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.jpg,.jpeg,.png,.mp4,.webm,.mov';
/** Videos get 5 MB; every other file 2 MB. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 5 * 1024 * 1024;
const VIDEO = new Set(['mp4', 'webm', 'mov']);

const ALLOWED = new Set(DOCUMENT_ACCEPT.split(',').map(e => e.slice(1)));

/** The reason a file cannot be uploaded, or null when it is fine. */
export function documentProblem(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED.has(ext)) return 'Allowed files: PDF, Word, Excel, PowerPoint, TXT, ZIP, JPG, PNG or video (MP4, WebM, MOV).';
  if (VIDEO.has(ext)) return file.size > MAX_VIDEO_BYTES ? 'A video must be 5 MB or smaller.' : null;
  if (file.size > MAX_UPLOAD_BYTES) return 'A file other than a video must be 2 MB or smaller.';
  return null;
}

/** How a file is drawn in lists: an icon, a short label and a colour class, from its extension. */
export function fileKind(name: string): { icon: string; label: string; tone: string; ext: string } {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'webm', 'mov'].includes(ext)) return { icon: 'bi-camera-video-fill', label: 'Video', tone: 'v', ext };
  if (['jpg', 'jpeg', 'png'].includes(ext)) return { icon: 'bi-file-earmark-image-fill', label: 'Image', tone: 'i', ext };
  if (ext === 'pdf') return { icon: 'bi-file-earmark-pdf-fill', label: 'PDF', tone: 'p', ext };
  if (['doc', 'docx'].includes(ext)) return { icon: 'bi-file-earmark-word-fill', label: 'Word', tone: 'w', ext };
  if (['xls', 'xlsx'].includes(ext)) return { icon: 'bi-file-earmark-excel-fill', label: 'Excel', tone: 'x', ext };
  if (['ppt', 'pptx'].includes(ext)) return { icon: 'bi-file-earmark-ppt-fill', label: 'PowerPoint', tone: 'o', ext };
  if (ext === 'zip') return { icon: 'bi-file-earmark-zip-fill', label: 'ZIP', tone: 'z', ext };
  return { icon: 'bi-file-earmark-text-fill', label: 'Text', tone: 't', ext };
}

/** "845 KB", "2.4 MB". */
export const humanSize = (bytes: number): string => (bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`);

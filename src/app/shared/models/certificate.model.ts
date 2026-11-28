export const CERT_TEMPLATES = ['Classic', 'Modern', 'Minimal', 'Elegant', 'Corporate', 'Royal'] as const;
export const CERT_TYPES = ['Completion', 'Participation', 'Achievement', 'Merit'] as const;
/** Colours offered for a template; the picker also takes any colour. */
export const CERT_ACCENTS = ['#0E7A4E', '#080536', '#1868B0', '#7B3FA0', '#B42318', '#C4620A', '#0E7490', '#475467'] as const;
export const CERT_DEFAULT_ACCENT = '#0E7A4E';
/** An uploaded logo (PNG / JPEG data URL) and the side of the header it sits on. */
export interface CertLogo { image: string; position: 'left' | 'center' | 'right' }
export const LOGO_POSITIONS = ['left', 'center', 'right'] as const;
export type LogoPosition = (typeof LOGO_POSITIONS)[number];
export const CERT_STATUSES = ['Pending', 'Issued', 'Rejected', 'Cancelled'] as const;

export type CertStatus = (typeof CERT_STATUSES)[number];

/** The artwork fields. An issued certificate carries the copy it was issued with, so later edits never change it. */
export interface CertDesign {
  template: string;
  type: string;
  title: string;
  body: string;
  /** Main colour of the border, bar and title (#RRGGBB); the green default when unset. */
  accent?: string | null;
  show_profile: boolean;
  show_qr: boolean;
  /** The SHARP logo, and the side of the header it sits on. */
  show_logo?: boolean;
  logo_position?: LogoPosition;
  /** Replaces the built-in SHARP logo (PNG / JPEG data URL). */
  logo_image?: string | null;
  /** Extra uploaded logos, each with its own position. */
  logos?: CertLogo[];
  signature_name: string | null;
  signature_role: string | null;
  /** A small PNG / JPEG data URL, or null. */
  signature_image: string | null;
}

/** GET / PUT /certificate-settings: the design plus numbering and who is eligible. */
export interface CertSettings extends CertDesign {
  prefix: string;
  min_attendance: number;
  min_score: number;
}

export const defaultCertSettings = (): CertSettings => ({
  template: 'Classic', type: 'Completion', title: 'Certificate of Completion',
  body: 'This is to certify that {student} has successfully completed the course “{course}” with a score of {score}% on {date}.',
  show_profile: true, show_qr: true, show_logo: true, logo_position: 'center', signature_name: '', signature_role: '', signature_image: null,
  prefix: 'SHARP', min_attendance: 75, min_score: 0,
});

/** A saved design staff can pick when they create a certificate. */
export interface CertTemplate {
  id: number;
  name: string;
  description: string | null;
  design: CertDesign;
  updated_at?: string;
}

export interface MentorReview {
  decision: 'approved' | 'returned' | null;
  note: string | null;
  by: string | null;
  at: string | null;
}

/** A certificate as the API returns it (snake_case). `eligibility`, `override` and `mentor` are absent for students. */
export interface Certificate {
  id: number;
  number: string | null;
  status: CertStatus;
  student_id: string;
  name: string;
  org: string | null;
  /** URL of the student's profile picture, or null. */
  photo?: string | null;
  batch: string | null;
  course_id: number;
  course: string;
  /** Average quiz result % for the course, or null when none is recorded. */
  score: number | null;
  /** Share of recorded days attended, or null when none is recorded. */
  attendance: number | null;
  issued_at: string | null;
  /** The date an unissued certificate will carry (set by staff); null means the day it is issued. */
  issue_date: string | null;
  cancelled_at: string | null;
  /** Why an issued certificate was cancelled: a listed reason (or "Other") and an optional note. */
  cancel_reason: string | null;
  cancel_note: string | null;
  created_at: string | null;
  design: CertDesign;
  eligibility?: { ok: boolean; min_attendance: number; min_score: number } | null;
  override?: boolean;
  /** The computed score, before any score staff entered. */
  score_live?: number | null;
  /** Staff changed the date, score or wording of this certificate. */
  edited?: boolean;
  mentor?: MentorReview;
}

/** GET /verify/{number}: what anyone can learn from a certificate number. */
export interface CertVerification {
  valid: boolean;
  status: CertStatus | 'NotFound';
  number?: string;
  name?: string;
  course?: string;
  issued_at?: string | null;
  cancelled_at?: string | null;
}

/** One of the student's courses with the QR token of its certificate (GET /my/certificate-qr). */
export interface CertQrCode {
  course_id: number;
  course: string;
  token: string;
  status: 'issued' | 'cancelled' | 'completed' | 'in_progress';
  progress: number;
  number: string | null;
  issued_at: string | null;
}

/** GET /certificate-scan/{token}: what a scanned QR shows. `certificate` is only present once the certificate is issued. */
export interface CertScan {
  status: 'issued' | 'cancelled' | 'completed' | 'in_progress' | 'not_found';
  name?: string;
  course?: string;
  progress?: number;
  cancelled_at?: string | null;
  /** True once the office has issued the certificate (it has a number); false when the course is only completed. */
  official?: boolean;
  certificate?: Pick<Certificate, 'name' | 'course' | 'score' | 'number' | 'issued_at' | 'issue_date' | 'photo' | 'design'>;
}

/** The link a certificate QR code opens: the public scan page of this app. */
export const scanUrl = (token: string): string => `${window.location.origin}/certificate/${encodeURIComponent(token)}`;

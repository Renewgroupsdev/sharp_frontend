import { ADMIN_MODULES, Batch, Institute, PermissionMap, ROLES, SharpUser } from './models';

/** Sample data carried over from the HTML prototype. */

export const SEED_COLLEGES = ['Fatima College, Madurai', 'Thiagarajar College', 'Lady Doak College', 'American College', 'Madurai Kamaraj University', 'Velammal Engineering College'];

export const SEED_BATCHES: Batch[] = [
  { id: 'SH-B07', n: 'SHARP Batch 07', start: '14 Jun 2026', end: '20 Dec 2026', seats: 64, filled: 58, mentors: 6, st: 'running' },
  { id: 'SH-B06', n: 'SHARP Batch 06', start: '11 Jan 2026', end: '28 Jun 2026', seats: 60, filled: 60, mentors: 6, st: 'closed' },
  { id: 'SH-B08', n: 'SHARP Batch 08', start: '10 Jan 2027', end: '27 Jun 2027', seats: 64, filled: 9, mentors: 2, st: 'enrolling' },
  { id: 'SH-B05', n: 'SHARP Batch 05', start: '12 Jul 2025', end: '21 Dec 2025', seats: 48, filled: 48, mentors: 5, st: 'closed' },
];

const PAL = ['#0E7A4E', '#1B9AD6', '#C2186B', '#B4531B', '#6A4CB3', '#0A5B39', '#5B3FA8'];

export function initials(name: string): string {
  return String(name || '?').replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}

type RawUser = Omit<SharpUser, 'i' | 'col'> & { col?: string };

const RAW_USERS: RawUser[] = [
  { id: 'SH2026-0412', n: 'Priya R', r: 'Student', org: 'Fatima College, Madurai', b: 'SHARP Batch 07', st: 'Active', ph: '+91 98••• ••412', username: 'priya.r', col: '#0E7A4E', last: 'Today, 9:41 AM' },
  { id: 'SH2026-0413', n: 'Arun Kumar S', r: 'Student', org: 'Thiagarajar College', b: 'SHARP Batch 07', st: 'Active', ph: '+91 90••• ••118', username: 'arun.k', col: '#1B9AD6', last: 'Today, 8:12 AM' },
  { id: 'SH2026-0418', n: 'Divya Bharathi', r: 'Student', org: 'Lady Doak College', b: 'SHARP Batch 07', st: 'Active', ph: '+91 94••• ••277', username: 'divya.b', col: '#C2186B', last: 'Yesterday' },
  { id: 'SH2026-0431', n: 'Mohammed Rafi', r: 'Student', org: 'American College', b: 'SHARP Batch 07', st: 'Suspended', ph: '+91 87••• ••905', username: 'mohammed.r', col: '#B4531B', last: '5 days ago' },
  { id: 'MN-118', n: 'SG', r: 'Mentor', org: 'Sundaram Textiles Pvt Ltd', b: 'SHARP Batch 07', st: 'Active', ph: '+91 98••• ••001', username: 'sg.mentor', col: '#0A5B39', last: 'Today, 9:02 AM' },
  { id: 'MN-121', n: 'R. Venkatesh', r: 'Mentor', org: 'Venkateshwara Mills', b: 'SHARP Batch 07', st: 'Active', ph: '+91 99••• ••442', username: 'r.venkatesh', col: '#6A4CB3', last: 'Yesterday' },
  { id: 'TR-009', n: 'Ms. Anitha Rajan', r: 'Trainer', org: 'TNCCI Faculty Panel', b: 'All batches', st: 'Active', ph: '+91 91••• ••330', username: 'anitha.rajan', col: '#1B9AD6', last: 'Today, 7:55 AM' },
  { id: 'TR-012', n: 'Mr. S. Balaji', r: 'Trainer', org: 'TNCCI Faculty Panel', b: 'All batches', st: 'Invited', ph: '+91 95••• ••671', username: 's.balaji', col: '#B4531B', last: 'Never signed in' },
  { id: 'AD-001', n: 'K. Ramesh', r: 'Admin', org: 'TNCCI Programme Office', b: 'All batches', st: 'Active', ph: '+91 98••• ••100', username: 'k.ramesh', col: '#5B3FA8', last: 'Today, 9:38 AM' },
  { id: 'SA-001', n: 'Meera Subramanian', r: 'Super Admin', org: 'TNCCI Programme Office', b: 'All batches', st: 'Active', ph: '+91 98430 00001', email: 'meera@sharp.tncci.in', username: 'meera.sa', last: 'Today, 9:10 AM' },
  { id: 'MB-001', n: 'Sundaram Textiles Pvt Ltd', r: 'Member', org: 'Sundaram Textiles Pvt Ltd', b: 'All batches', st: 'Active', ph: '+91 98430 00002', email: 'hr@sundaramtextiles.in', username: 'sundaram.member', spec: 'Textiles & apparel', sd: 'Member company, Madurai chamber', bio: 'Hosts industry visits and interviews for SHARP students.', last: 'Yesterday' },
  { id: 'OB-001', n: 'R. Kannan', r: 'OB', org: 'TNCCI Madurai', b: 'All batches', st: 'Active', ph: '+91 98430 00003', email: 'kannan@tncci.in', username: 'kannan.ob', spec: 'Programme oversight', sd: 'Office bearer, TNCCI', bio: 'Office bearer overseeing the SHARP programme.', last: '3 days ago' },
  { id: 'IN-001', n: 'Dr. S. Meenakshi', r: 'Institution', org: 'Fatima College', b: 'All batches', st: 'Active', ph: '+91 98430 00004', email: 'principal@fc.edu.in', username: 'fatima.principal', spec: 'Commerce', sd: 'Principal, Fatima College', bio: 'Point of contact for Fatima College students.', last: '2 days ago' },
];

export const buildUsers = (): SharpUser[] => RAW_USERS.map((u, i) => ({ ...u, i: initials(u.n), col: u.col ?? PAL[i % PAL.length] }));

function orgCode(name: string, taken: string[]): string {
  const base = String(name).split(',')[0].split(/\s+/).filter(w => w && !/^(of|the|and|&)$/i.test(w)).map(w => w[0]).join('').toUpperCase().slice(0, 4) || 'ORG';
  let c = base, i = 2;
  while (taken.includes(c)) c = base + i++;
  return c;
}

export function buildInstitutes(): Institute[] {
  const taken: string[] = [];
  const principals = ['Dr. S. Meenakshi', 'Dr. R. Jayakumar', 'Dr. A. Mary Ponni', 'Dr. T. Selvam', 'Prof. K. Lakshmi', 'Dr. V. Rajan'];
  return SEED_COLLEGES.map((n, i) => {
    const code = orgCode(n, taken); taken.push(code);
    return {
      id: 'ORG-' + String(i + 1).padStart(3, '0'),
      n: n.split(',')[0],
      code,
      city: n.includes(',') ? n.split(',')[1].trim() : 'Madurai',
      pr: principals[i % 6],
      email: 'office@' + code.toLowerCase() + '.edu.in',
      ph: '+91 452 ' + String(2300000 + i * 4117).padStart(7, '0'),
      st: i === 5 ? 'Inactive' : 'Active',
    } as Institute;
  });
}

/** Default View / Create / Edit / Delete grants per role, per admin module. */
export function buildPermissions(): PermissionMap {
  const spec: Record<string, Record<string, string>> = {
    'Super Admin': { '*': 'vcud' },
    Admin: { '*': 'vcud' },
    Mentor: { a_users: 'v', a_courses: 'v', a_enroll: 'v', a_attend: 'vcu', a_learn: 'v', a_assess: 'v', a_attempts: 'vu', a_certs: 'v', a_comms: 'vc', a_notif: 'v' },
    Member: { a_users: 'v', a_orgs: 'v', a_courses: 'v' },
    OB: { a_courses: 'v', a_enroll: 'v', a_attend: 'v', a_learn: 'v', a_assess: 'v', a_attempts: 'v', a_comms: 'v' },
    Institution: { a_users: 'v', a_orgs: 'v', a_attend: 'v', a_learn: 'v', a_certs: 'v', a_reports: 'v' },
    Student: { a_courses: 'v', a_learn: 'v', a_attend: 'v', a_assess: 'v', a_certs: 'v', a_comms: 'vc' },
  };
  const out: PermissionMap = {};
  for (const role of ROLES) {
    out[role] = {};
    for (const m of ADMIN_MODULES) out[role][m.key] = spec[role][m.key] ?? spec[role]['*'] ?? '';
  }
  return out;
}

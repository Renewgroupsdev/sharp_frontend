export interface AttendanceRecord {
  id: string;
  /** Display date, e.g. "06 Sep 2026". */
  date: string;
  /** ISO day (YYYY-MM-DD) used for filtering and the one-record-per-person-per-day rule. */
  iso: string;
  batch: string;
  sid: string;
  name: string;
  status: 'Present' | 'Absent';
  /** Reported = the student said so and an admin confirmed; Manual = marked by staff; Geolocation = checked in on site. */
  mode: 'Reported' | 'Manual' | 'Geolocation';
  method: string;
  remarks: string;
  /** Who marked it manually. */
  by?: string;
  lat?: number;
  lng?: number;
}

/** What a student reports for the day, and what the admin marks. */
export type AttendanceChoice = 'Present' | 'Absent';

/** A student's Present / Absent report for a day, waiting for an admin (or the student's mentor) to mark it. */
export interface AttendanceRequest {
  id: string;
  sid: string;
  name: string;
  org: string;
  batch: string;
  iso: string;
  /** Display date, e.g. "06 Sep 2026". */
  date: string;
  /** What the student reported. */
  requested: AttendanceChoice;
  /** Required when the student reports Absent. */
  reason: string;
  /** Pending until marked, then the final status. */
  outcome: 'Pending' | AttendanceChoice;
  /** When the student sent (or last changed) the report. */
  on: string;
  /** Who marked it. */
  by?: string;
  /** The marker's note. */
  resolution?: string;
}

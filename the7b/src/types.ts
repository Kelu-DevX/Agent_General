export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  SITE_URL: string;
  SEASON_END: string;
  CONTACT_EMAIL: string;
}

export interface User {
  id: number;
  email: string;
  display_name: string;
  is_admin: number;
  mailing_consent: number;
  created_at: string;
}

export interface Objective {
  id: number;
  title: string;
  description: string;
  points: number;
  sort: number;
  active: number;
}

export type SubmissionStatus = "pending" | "approved" | "rejected" | "removed";

export interface Submission {
  id: number;
  user_id: number;
  objective_id: number;
  photo_key: string;
  status: SubmissionStatus;
  reject_reason: string | null;
  featured: number;
  created_at: string;
  decided_at: string | null;
}

export interface Happening {
  id: number;
  text: string;
  date_label: string | null;
  sort: number;
  active: number;
}

export type AppEnv = { Bindings: Env; Variables: { user: User | null } };

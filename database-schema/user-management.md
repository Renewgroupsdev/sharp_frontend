# User Management — Database Schema

Schema for the **User Management** module (`src/app/pages/users`). MySQL 8 / MariaDB 10.4+, InnoDB, `utf8mb4`.
It extends the `users` table in the reference backend (`sharp/backend/sql/schema.sql`) so both apps can share one database.

## 1. Entity overview

```
colleges (institutes) 1 ─── * users * ─── 1 batches
                              │
          ┌───────────────────┼────────────────────┐
          1                   1                    1
          *                   *                    *
     auth_tokens        user_invites         activity_log
                                          (actor_id → users)
     id_sequences  (ID generation counters, no FK)
```

| Table | Purpose | Angular source |
|---|---|---|
| `colleges` | Institutes students / institution users belong to | `Institute` in `core/data/models.ts` |
| `batches` | Programme batches (schedule, seats) | `Batch` / `BatchRecord` |
| `users` | Every account: students, mentors, admins, members, OBs, institutions | `SharpUser` |
| `user_invites` | Sign-in invites sent / resent to a mobile number | `UsersService.resendInvite` |
| `auth_tokens` | Active sign-in sessions; wiped on password reset or suspend | — |
| `id_sequences` | Race-free counters for `FCM26-0001` / `MN-001` style IDs | `UsersService.genId` |
| `activity_log` | Audit trail of every user action | `ActivityLog`, `ActivityLogService.record` |

## 2. SQL

```sql
-- ---------------------------------------------------------------
-- colleges (institutes)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS colleges (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  code           CHAR(3)      NOT NULL UNIQUE,          -- used in student IDs, e.g. FCM
  city           VARCHAR(100) DEFAULT NULL,
  principal_name VARCHAR(150) DEFAULT NULL,
  email          VARCHAR(150) DEFAULT NULL,
  mobile         VARCHAR(20)  DEFAULT NULL,
  status         ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_college_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- batches
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS batches (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id   VARCHAR(20)  NOT NULL UNIQUE,              -- SH-B07
  name        VARCHAR(60)  NOT NULL UNIQUE,              -- SHARP Batch 07
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  seats       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status      ENUM('enrolling','running','closed') NOT NULL DEFAULT 'enrolling',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- users
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  public_id            VARCHAR(40)  NOT NULL UNIQUE,     -- FCM26-0001, MN-001, AD-001, IN-001 ...
  name                 VARCHAR(150) NOT NULL,
  username             VARCHAR(60)  NOT NULL UNIQUE,     -- lower-case, [a-z0-9._-]{3,}
  password_hash        VARCHAR(255) NOT NULL,            -- password_hash() / bcrypt; never plain text
  must_change_password TINYINT(1)   NOT NULL DEFAULT 1,  -- 1 after create or admin reset (SharpUser.tempPw)
  role                 ENUM('super_admin','admin','mentor','member','ob',
                            'institution','student','trainer') NOT NULL,
  college_id           INT UNSIGNED DEFAULT NULL,        -- students + institution users
  batch_id             INT UNSIGNED DEFAULT NULL,        -- students, mentors, trainers; NULL = "All batches"
  org                  VARCHAR(200) DEFAULT NULL,        -- employer / programme office (non-institute roles)
  mobile               VARCHAR(20)  DEFAULT NULL,        -- stored as "+91 9876543210"
  email                VARCHAR(150) DEFAULT NULL,
  status               ENUM('Active','Invited','Suspended') NOT NULL DEFAULT 'Invited',

  -- profile (mentor, member, ob, institution)
  specialist           VARCHAR(150) DEFAULT NULL,
  short_description    VARCHAR(255) DEFAULT NULL,
  biography            TEXT         DEFAULT NULL,
  avatar_url           VARCHAR(255) DEFAULT NULL,        -- uploaded file path, max 300 KB
  avatar_initials      VARCHAR(4)   DEFAULT NULL,
  avatar_color         VARCHAR(10)  DEFAULT NULL,

  created_by           INT UNSIGNED DEFAULT NULL,
  last_login           DATETIME     DEFAULT NULL,        -- NULL = "Never signed in"
  password_changed_at  DATETIME     DEFAULT NULL,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_users_college FOREIGN KEY (college_id) REFERENCES colleges(id) ON DELETE SET NULL,
  CONSTRAINT fk_users_batch   FOREIGN KEY (batch_id)   REFERENCES batches(id)  ON DELETE SET NULL,
  CONSTRAINT fk_users_creator FOREIGN KEY (created_by) REFERENCES users(id)    ON DELETE SET NULL,

  UNIQUE KEY uq_users_email (email),                     -- NULLs allowed, duplicates not
  INDEX idx_users_role_status (role, status),
  INDEX idx_users_college (college_id),
  INDEX idx_users_batch (batch_id),
  FULLTEXT KEY ft_users_search (name, username, email, mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- user_invites  (initial invite + every "Resend invite")
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_invites (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  sent_to     VARCHAR(20)  NOT NULL,                     -- mobile number at send time
  sent_by     INT UNSIGNED DEFAULT NULL,
  sent_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME DEFAULT NULL,                     -- first successful sign-in
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_invites_user (user_id, sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- auth_tokens
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_tokens (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  token      CHAR(64)  NOT NULL UNIQUE,                  -- store a hash of the token, not the token
  expires_at DATETIME  NOT NULL,
  created_at DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tokens_user (user_id),
  INDEX idx_tokens_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- id_sequences  (one row per ID prefix; increment inside a transaction)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS id_sequences (
  prefix   VARCHAR(20)  NOT NULL PRIMARY KEY,            -- 'FCM26-' (student) or 'MN-' (others)
  last_no  INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------
-- activity_log  (module-wide audit trail)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_log (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id   INT UNSIGNED DEFAULT NULL,
  module     VARCHAR(60)  NOT NULL,                      -- 'User Management'
  action     VARCHAR(255) NOT NULL,                      -- 'Suspended user MN-001 S. Karthik (Mentor)'
  target     VARCHAR(40)  DEFAULT NULL,                  -- users.public_id
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_log_created (created_at),
  INDEX idx_log_module (module, created_at),
  INDEX idx_log_target (target)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 3. Angular model → column mapping

| `SharpUser` field | Column | Notes |
|---|---|---|
| `id` | `users.public_id` | Display ID; the numeric `id` stays internal |
| `n` | `name` | |
| `r` | `role` | UI label → enum: `Super Admin`→`super_admin`, `OB`→`ob`, `Institution`→`institution`, others lower-case |
| `username` | `username` | Stored lower-case |
| `ph` | `mobile` | UI shows `+91 xxxxxxxxxx`; form edits the 10 digits |
| `email` | `email` | |
| `st` | `status` | |
| `org` | `college_id` **or** `org` | Institute roles (Student, Institution) → `college_id`; the rest → free-text `org` |
| `b` | `batch_id` | `"All batches"` → `NULL` |
| `spec` / `sd` / `bio` | `specialist` / `short_description` / `biography` | Only for Mentor, Member, OB, Institution |
| `pic` | `avatar_url` | Save the uploaded file; do not store a base64 data URL in the row |
| `i` / `col` | `avatar_initials` / `avatar_color` | |
| `last` | `last_login` | `NULL` renders as "Never signed in" |
| `tempPw` | `must_change_password` | |
| form `pw` | `password_hash` | Hash on the server; never persisted or logged in clear text |

## 4. Business rules (enforce in the API, not only in the UI)

| Rule | Where |
|---|---|
| Username: `^[a-z0-9._-]{3,}$`, unique | `users.username` UNIQUE + API validation |
| Email unique when present | `uq_users_email` |
| Mobile: exactly 10 digits | API validation |
| Temporary password ≥ 6 chars on create | API validation |
| Student ID = `<college code><yy>-NNNN` (e.g. `FCM26-0001`); others = `<prefix>-NNN` | `id_sequences` |
| Role prefixes: `SA` `AD` `MN` `MB` `OB` `IN` `ST` `TR` | API constant |
| Cannot suspend, delete or reset the password of your own account | API (compare to the signed-in user) |
| **Cannot delete** a Student / Mentor / Trainer whose batch has `status = 'running'`; suspend instead | API (`deleteBlocker`) |
| Suspend → status `Suspended` and `DELETE FROM auth_tokens WHERE user_id = ?` | API |
| Reset password → new random password, `must_change_password = 1`, delete tokens, log the action, return the password **once** | API |
| Resend invite only for `Invited` users with a mobile number; insert into `user_invites` | API |
| Change batch only for Student / Mentor / Trainer | API |

### ID generation (transaction)

```sql
START TRANSACTION;
INSERT INTO id_sequences (prefix, last_no) VALUES (:prefix, 1)
  ON DUPLICATE KEY UPDATE last_no = LAST_INSERT_ID(last_no + 1);
SELECT CONCAT(:prefix, LPAD(LAST_INSERT_ID(), :width, '0')) AS public_id;  -- width 4 for students, 3 otherwise
COMMIT;
```

On the first insert `LAST_INSERT_ID()` returns 0, so the API should read `last_no` back (or `SELECT ... FOR UPDATE`) in that case.

## 5. Common queries

```sql
-- User list: search + filters + paging (matches the table, filter card and stat cards)
SELECT u.public_id, u.name, u.username, u.role, u.status, u.last_login,
       COALESCE(c.name, u.org) AS organization, b.name AS batch
FROM users u
LEFT JOIN colleges c ON c.id = u.college_id
LEFT JOIN batches  b ON b.id = u.batch_id
WHERE (:status IS NULL OR u.status = :status)
  AND (:role   IS NULL OR u.role   = :role)
  AND (:q      IS NULL OR MATCH(u.name, u.username, u.email, u.mobile) AGAINST (:q IN BOOLEAN MODE))
ORDER BY u.created_at DESC
LIMIT :limit OFFSET :offset;

-- Stat cards: total, students, mentors, suspended
SELECT COUNT(*)                         AS users,
       SUM(role = 'student')            AS students,
       SUM(role = 'mentor')             AS mentors,
       SUM(status = 'Suspended')        AS suspended
FROM users;

-- Role access guide: head-count per role
SELECT role, COUNT(*) AS users FROM users GROUP BY role;

-- Delete blocker: is the user in a running batch?
SELECT 1 FROM users u JOIN batches b ON b.id = u.batch_id
WHERE u.public_id = :id AND u.role IN ('student','mentor','trainer') AND b.status = 'running';
```

## 6. Notes

- `FULLTEXT` search matches whole words; for "starts with" style search use `LIKE 'term%'` on `name` / `username` instead.
- Permissions per role (View / Create / Edit / Delete on `a_users`) belong to the **Roles & Permissions** module and are not part of this schema; the API should check them before running any action above.
- `activity_log.action` must never contain passwords or tokens.

# Smart University Internship & Placement Management Portal

A production-quality web portal for managing university internships and placements, built with Node.js, Express, MySQL, and Bootstrap 5.

## Tech Stack

| Layer          | Technology                    |
|----------------|-------------------------------|
| Frontend       | HTML5, CSS3, Bootstrap 5, Vanilla JS |
| Backend        | Node.js (LTS), Express.js    |
| Database       | MySQL                         |
| Authentication | express-session, bcrypt       |
| File Uploads   | multer                        |
| PDF Generation | pdfkit                        |

## Project Structure

```
internship-portal/
├── public/              # Static assets
│   ├── css/             # Stylesheets
│   ├── js/              # Client-side JavaScript
│   └── images/          # Images and icons
├── uploads/             # User-uploaded files
│   ├── resumes/
│   ├── reports/
│   ├── certificates/
│   └── offer_letters/
├── routes/              # Express route definitions
├── controllers/         # Request handlers
├── models/              # Database models
├── middleware/           # Custom middleware (auth, validation, errors)
├── config/              # App configuration (DB, session, uploads, helpers)
├── database/            # SQL schema and migration files
├── views/               # HTML templates
├── .devcontainer/       # GitHub Codespaces configuration
├── .env.example         # Environment variable template
├── .gitignore           # Git ignore rules
├── package.json         # Node.js project manifest
├── server.js            # Application entry point
└── README.md            # This file
```

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **MySQL** 8.0+

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd internship-portal
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your MySQL credentials:

```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=internship_portal
SESSION_SECRET=your_session_secret_change_in_production
```

### 4. Set Up the Database

Log into MySQL and run the schema file:

```bash
mysql -u root -p < database/schema.sql
```

Or from the MySQL prompt:

```sql
source database/schema.sql;
```

### 5. Start the Server

**Development mode** (with auto-reload):

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

The server will start on `http://localhost:3000`.

### GitHub Codespaces

This project includes a `.devcontainer` configuration. When opened in GitHub Codespaces:

1. Dependencies install automatically via `postCreateCommand`.
2. Port 3000 is forwarded automatically.
3. Use the forwarded URL provided by Codespaces to access the app.

## Available Scripts

| Command        | Description                          |
|----------------|--------------------------------------|
| `npm start`    | Start the production server          |
| `npm run dev`  | Start with nodemon (auto-reload)     |

## API Endpoints

| Method | Path          | Description            |
|--------|---------------|------------------------|
| GET    | `/`           | Landing page           |
| GET    | `/health`     | Server health check    |
| GET    | `/api/status` | API status endpoint    |
| GET    | `/dashboard`  | Dashboard (auth required) |

## Database Tables

- `users` — Authentication and role management
- `students` — Student profiles
- `faculty` — Faculty profiles
- `companies` — Company profiles
- `internships` — Internship listings
- `applications` — Student applications
- `attendance` — Attendance tracking
- `weekly_reports` — Weekly report submissions
- `documents` — Uploaded document records
- `feedback` — Feedback and ratings
- `certificates` — Certificate records

## Security

- Passwords are hashed with bcrypt (never stored in plain text)
- Sessions use httpOnly, sameSite cookies
- Input is sanitized (trimmed) on every request
- File uploads are type-restricted and size-limited (5 MB)
- Routes are role-protected via middleware
- Secrets are stored in `.env` (never committed to git)

## Authentication & Identity Management (Phase 2)

### Authentication Setup
The authentication system is built using `express-session` and `bcrypt` for secure session management and password hashing.
When the application starts, it automatically verifies the database connection and runs a seeding routine to ensure a default administrator account exists.

### Default Admin Account
- **Email:** `admin@university.com`
- **Password:** `Admin@123`
- **Role:** `admin`
- **Verification Flag:** `must_change_password = true`

*Note: On the very first login, the default admin is forced to change their password to one that meets the system's security requirements.*

### Login Process
1. The user visits `/login` and submits their email and password.
2. The server validates that all fields are filled, searches for the user, and compares the password using `bcrypt.compare()`.
3. Upon validation, the session is regenerated (to prevent session fixation) and session details (`id`, `name`, `email`, `role`) are stored.
4. If "Remember Session" is checked, the session cookie's `maxAge` is extended to 30 days.
5. The user is redirected:
   - If `must_change_password` is true: redirected to `/change-password`.
   - Otherwise: redirected by role to their respective dashboard.

### Role-Based Access Control
The portal supports four primary user roles:
1. **Admin** — Redirects to `/admin/dashboard` (protected by `requireAuth` & `requireAdmin`).
2. **Faculty** — Redirects to `/faculty/dashboard` (protected by `requireAuth` & `requireFaculty`).
3. **Student** — Redirects to `/student/dashboard` (protected by `requireAuth` & `requireStudent`).
4. **Company** — Redirects to `/company/dashboard` (protected by `requireAuth` & `requireCompany`).

If an authenticated user attempts to access a route restricted to another role, the server blocks access and renders a professional `403 Access Denied` error page.

### Testing Instructions
We use **Playwright** for complete end-to-end integration testing.
To execute the tests:
1. Ensure the MySQL server is started:
   ```bash
   sudo service mysql start
   ```
2. Run the test suite:
   ```bash
   # Run all tests (Phase 1 + Phase 2)
   npx playwright test

   # Run only authentication tests
   npx playwright test tests/auth.spec.js
   ```

## Student Experience & Internship Lifecycle (Phase 3)

The Student Portal provides a comprehensive, responsive, and secure Enterprise Resource Planning (ERP) environment for students to manage their internship lifecycle.

### 1. Student Dashboard (`/student/dashboard`)
A unified, real-time center for student activities:
- **Welcome Banner**: Dynamic greeting displaying the student's name and profile photo.
- **8 Statistics Cards**: High-fidelity cards displaying dynamic values from the database (Attendance Rate, Internship Progress, Reports Submitted, Pending Reports, Documents Uploaded, Mentor Feedbacks, Days Completed, and Certificate Status).
- **Compliance Visualizer**: Evaluates the overall student status and automatically unlocks the certificate when completion hits 100%.
- **Milestones Timeline**: Renders a vertical roadmap of student placements (Application, Offer Letter, Coordinator Approval, Internship Started, etc.).
- **Recent Activity Logs**: Tracks the student's actions (check-ins, report submissions, document uploads) in reverse chronological order.
- **Dynamic Charts**: Dynamic Chart.js visualizations powered by real-time database values.
- **Quick Actions Panel**: Punch In / Check Out forms and quick links to submit daily work logs, weekly reports, or upload compliance documents directly.

### 2. Student Profile (`/student/profile`)
Provides self-service profile settings with robust validation and security:
- **Form Editor**: Full name, email, phone, dob, gender, permanent address, enrollment number, department, semester, bio, skills, LinkedIn, and GitHub links.
- **Profile Security**: Strict session checks verify `user_id` ownership, blocking students from editing other users' profiles.
- **Secure Photo Upload**: Restricts uploads to JPG/JPEG/PNG (max 2MB), saves to `uploads/profile_photos/`, and automatically sanitizes/renames filenames to prevent collisions.

### 3. Internship Details (`/student/internship`)
Tracks placement info in real-time, showing:
- Headline banner with role, company, and remaining days.
- Animated progress bar calculating completed vs total days.
- Mentor card with rating and communication channels.
- Status badges mapping placement states (`Pending`, `Approved`, `Active`, `Completed`, `Rejected`).

### 4. Attendance & Leaves Module (`/student/attendance`)
Tracks attendance in real-time with an ERP-style dashboard:
- **Check-In**: Students can punch in once per day. Stores date, time, location, and remarks.
- **Check-Out**: Students can punch out after checking in. Automatically calculates working hours and logs check-out time.
- **Attendance Validation**: Prevents double check-in, double check-out, checking out without checking in, future date punch-ins, and invalid dates.
- **Calendar Grid**: A monthly grid displaying present (green), absent (red), leave (yellow), weekend (gray), and holiday statuses.
- **Leave Requests**: Allows students to submit leave requests with dates, reasons, and pending/approved/rejected status.

### 5. Daily Work Logs (`/student/attendance`)
Allows logging daily hours and progress descriptions:
- Fields: Date, hours worked (0-24), tech used, tasks completed, problems faced, and learning outcomes.
- Input constraints: Maximum 1000 characters per text field to protect against buffer overflow.
- Filtering & Search: Live text search and date range filters for instant lookups.

### 6. Weekly Progress Reports (`/student/reports`)
A complete weekly reporting and grading module:
- **Workflow**: Draft → Submitted → Coordinator Review → Approved / Rejected.
- **Actions**: Students can create, edit, and delete reports while in `draft` status. Once submitted, editing and deleting are strictly blocked.
- **Visual Step Tracker**: A visual timeline showing the status of the weekly report.
- **Feedback Callouts**: Distinct boxes highlighting industry mentor remarks and academic coordinator remarks.

### 7. Document Center (`/student/documents`)
A secure file repository for academic and compliance documents:
- **Uploader**: Supports uploads of Resume, Offer Letter, NOC, report PDFs, presentations, and certificates.
- **Compliance Checklist**: A required documents checklist (Resume, Offer Letter, NOC, Final Project Report) displaying a compliance progress bar.
- **Secure Downloads**: Files are stored in a top-level `uploads/documents/` folder outside the public web root. The server streams files securely via `/api/student/documents/:id/download` after verifying student ownership, completely preventing directory traversal, executable uploads, and direct access bypasses.
- **Actions**: Supports upload, delete, replace, and secure download.

### 8. Student Intelligence, Analytics & Features (Phase 3 Part 3)
A major intelligence upgrade extending the student module with advanced reporting, dashboards, exports, and notifications:

#### A. Analytics Dashboard
A dedicated dashboard interface showing detailed program analytics:
- **Program Performance Indicators**: Visual grid tracking Attendance %, Internship Progress %, Completed/Pending/Rejected/Approved Reports, Leaves Count, Daily/Weekly/Monthly Hours, and compliance checklist completion.
- **7 Dynamic Chart.js Visualizations**: Powered entirely by dynamic database metrics (no static or dummy placeholders):
  1. *Attendance Trend*: Line chart showing daily hours logged over the last 15 active days.
  2. *Weekly Hours*: Bar chart showing total hours worked each week.
  3. *Monthly Hours*: Bar/Line chart summarizing total hours logged per month.
  4. *Internship Progress*: Doughnut chart showing completed vs remaining internship days.
  5. *Reports Submitted*: Doughnut chart analyzing weekly report statuses (Draft, Submitted, Approved, Rejected).
  6. *Documents Uploaded*: Bar chart showing compliance documents uploaded by category.
  7. *Timeline Activity*: Line chart displaying milestone log intensity over months.

#### B. Student Insights Engine
An automated intelligence widget that evaluates student data to calculate:
- **Attendance Streak**: Longest consecutive present days, with a weekend-aware algorithm that bridges Friday-to-Monday gaps (3 calendar days).
- **Average Hours**: Calculates average daily hours and cumulative hours logged from daily logs.
- **Compliance Deficits**: Automatically scans and lists missing weekly reports (based on elapsed weeks) and missing core compliance documents (Resume, Offer Letter, NOC, Final Report).
- **Deadlines & Approvals**: Identifies next-Friday deadlines, pending approvals, and generates actionable, dynamic suggestions to keep the student in perfect academic compliance.

#### C. Global Cross-Module Search
A comprehensive search feature integrated into the top navbar on every student page:
- **SQL Prepared Statements**: Direct, secure database querying using prepared `LIKE` statements across Attendance, Daily Logs, Weekly Reports, Compliance Documents, and Timeline.
- **Interactive Search Modal**: Dynamic search input with real-time debouncing, rendering results categorized by module, highlighting matches, showing status badges, and linking directly to corresponding pages.

#### D. Advanced Filters & Sorting
All student module listing tables and cards support robust server-side query manipulation:
- **Filters**: Filter by Week, Month, Year, Status (Draft/Submitted/Approved/Rejected), Date Range, Document Category, and Leave Status.
- **Sorting**: Sort records dynamically by Newest, Oldest, Alphabetical (filenames), and Hours Worked.
- **Pagination**: Consistent pagination (`page`, `limit`) across all listing endpoints.

#### E. Export System
A high-fidelity export engine that generates professional reports in multiple formats:
- **PDF Export**: Generates professional, grid-aligned, multi-page PDF documents using `pdfkit`. Includes custom page headers, student metadata blocks (name, roll, enrollment, department), alternating row backgrounds, and custom column configurations depending on the export type.
- **CSV Export**: Compiles clean, comma-separated values with strict field escaping to prevent injection.
- **Supported Ledgers**: Export complete ledgers for Attendance, Weekly Reports, Daily Logs, Placement Timeline, and compliance Documents.

#### F. Local Notification Center
A real-time notification hub in the top navbar on all student pages:
- **Unread Counter Badge**: Displays the count of unread timeline events.
- **Dropdown Feed**: Shows the 10 most recent timeline events (Profile Updated, Attendance Recorded, Report Submitted, Document Uploaded, Coordinator Feedback, Leave Status, etc.).
- **Read/Unread Tracking**: Visual indicator dots for unread notifications and a "Mark all read" button that updates all events to `is_read = TRUE` in the database.

#### G. Accessibility & UI Polish
Enhanced user experience designed for maximum accessibility and visual excellence:
- **Keyboard Navigation**: Focus states and tab-index support on all interactive components.
- **Semantic HTML**: Proper heading structures and ARIA labels.
- **Dynamic Feedback**: Loading spinners during data fetching, clean and illustrated empty states, and descriptive error banners.
- **Responsive Design**: Elegant mobile-first layouts with responsive navigation collapsing into toggleable sidebars.

### 9. REST API Specifications
All student portal endpoints have been refactored to support consistent JSON responses, standard HTTP status codes, pagination, and sorting:
- `GET /api/student/search?q=query` — Global cross-module search
- `GET /api/student/notifications` — Fetch unread count and latest notifications
- `POST /api/student/notifications/read` — Mark all notifications as read
- `GET /api/student/export/:type?format=pdf|csv` — Export complete data ledgers
- `GET /api/student/attendance?month=&year=&status=&sortBy=&page=&limit=` — Paginated and sorted attendance ledger
- `GET /api/student/logs?startDate=&endDate=&search=&sortBy=&page=&limit=` — Paginated and sorted daily logs
- `GET /api/student/reports?status=&search=&sortBy=&page=&limit=` — Paginated and sorted weekly reports
- `GET /api/student/documents?documentType=&search=&sortBy=&page=&limit=` — Paginated and sorted documents list

### 10. Playwright E2E Test Suite
A complete, release-quality E2E test suite consisting of **43 comprehensive tests** in `tests/student.spec.js` checking:
- Dashboard metrics and Chart.js initialization
- Profile updates, size limits, and security ownership
- Internship dates, duration, progress bar, and status badges
- Attendance punch-in, double-punch prevention, check-out hours calculation, and leave request calendar updates
- Daily logs submissions, character limits, working hours boundaries, and search filters
- Weekly reports workflow, drafts, updates, deletions, submissions, and feedback callout rendering
- Document center uploads, size restrictions, secure streaming downloads, unauthorized access blocks, replacements, and deletions
- Global search, notification dropdowns, and exports

To run the complete test suite in serial mode:
```bash
npx playwright test tests/student.spec.js
```

All tests automatically run a database cleaning routine in `beforeAll` using the seeded `student@university.com` credentials, guaranteeing clean, repeatable, and idempotent test execution.

---

## License

ISC

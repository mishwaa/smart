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

## Student Experience & Internship Lifecycle (Phase 3 Part 1)

In Sprint 3, the Student Portal was fully implemented, offering a comprehensive, responsive, and secure experience for students to manage their profiles and track their placements.

### 1. Student Dashboard (`/student/dashboard`)
A professional, unified center for student activities.
- **8 Statistics Cards**: High-level overview of core internship metrics (Attendance Rate, Internship Progress, Reports Submitted, Pending Reports, Documents Uploaded, Mentor Feedbacks, Days Completed, Certificate Status).
- **Upcoming Tasks Widget**: Displays active action items (e.g. pending report submissions or required documents) with status badges.
- **Timeline Widget**: Shows the student's journey through various program phases.
- **Interactive Charts**: Developed using Chart.js, visualizing weekly progress trends, attendance rates, and document submissions.

### 2. Student Profile (`/student/profile`)
Provides self-service profile management with robust validation and security.
- **Form Editor**: Allows students to view and update their full name, email, phone, DOB, gender, permanent address, enrollment number, department, semester, bio, skills, LinkedIn, and GitHub links.
- **Security & Ownership**: Strong session-based authorization ensures students can only view and modify their own profiles (verifying `user_id` ownership).
- **Secure Photo Upload**: Integrated profile picture upload.
  - **File Restrictions**: Only JPG, JPEG, and PNG formats.
  - **Size Limit**: Maximum of 2 MB.
  - **Storage**: Saved securely in `uploads/profile_photos/` with automatic UUID-based renaming to prevent collisions.
  - **Validation**: Strict file-type and file-size validation enforced on both the client-side and server-side (via Multer).

### 3. Internship Details (`/student/internship`)
Tracks the active internship placement in real-time.
- **Headline Banner**: Displays current role, host company, and days remaining.
- **Animated Progress Bar**: Calculates and renders the exact progress percentage of days completed relative to total days.
- **Mentor Card**: Displays details of the assigned industry mentor, including feedback rating and communication channels.
- **Bootstrap Badges**: Visualizes placement status (`Pending`, `Approved`, `Active`, `Completed`, `Rejected`) with matching color palettes.
- **Fallback Capability**: Employs high-fidelity mock data if the student has no active DB placement yet, ensuring a complete and visually stunning first-time user experience.

### 4. Routes & Endpoints
The following student routes and JSON APIs are protected under `requireAuth` and `requireStudent` middleware:
- `GET /student/dashboard` — Serves the Student Dashboard view
- `GET /student/profile` — Serves the Student Profile view
- `GET /student/internship` — Serves the Internship Details view
- `GET /api/student/profile` — Retrieves the current student's profile data (with auto-initialization/self-seeding to prevent database crashes)
- `POST /api/student/profile` — Updates profile fields with strict server-side validation
- `POST /api/student/profile/photo` — Uploads and updates the student's profile photo
- `GET /api/student/internship` — Retrieves active internship placement details

---

## License

ISC

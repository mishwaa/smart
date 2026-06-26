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

## License

ISC

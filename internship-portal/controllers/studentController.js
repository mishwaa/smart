/**
 * Student Controller
 * Handles student dashboard, profile, internship, attendance, logs, reports, documents,
 * analytics, insights, global search, exports, and notification center.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const Student = require('../models/Student');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const DailyLog = require('../models/DailyLog');
const WeeklyReport = require('../models/WeeklyReport');
const StudentDocument = require('../models/StudentDocument');
const TimelineEvent = require('../models/TimelineEvent');
const exportHelper = require('../helpers/exportHelper');
const { pool } = require('../config/database');
const { validateEmail } = require('../middleware/validators');

const phoneRegex = /^\+?[0-9\s-]{10,15}$/;

/**
 * Helper to ensure a student has an active internship and accepted application,
 * auto-seeding a high-fidelity mock placement if none exists in the database.
 */
async function getOrCreateActiveInternship(studentId, department) {
  const [apps] = await pool.execute(
    `SELECT a.internship_id FROM applications a 
     WHERE a.student_id = ? AND a.status = 'accepted' LIMIT 1`,
    [studentId]
  );
  
  if (apps.length > 0) {
    return apps[0].internship_id;
  }
  
  let companyId;
  const [companies] = await pool.execute(
    `SELECT id FROM companies WHERE company_name = 'TechCorp Solutions' LIMIT 1`
  );
  if (companies.length > 0) {
    companyId = companies[0].id;
  } else {
    let companyUserId;
    const [compUsers] = await pool.execute(
      `SELECT id FROM users WHERE email = 'company@techcorp.com' LIMIT 1`
    );
    if (compUsers.length > 0) {
      companyUserId = compUsers[0].id;
    } else {
      const [userRes] = await pool.execute(
        `INSERT INTO users (email, password, role, is_active) 
         VALUES ('company@techcorp.com', '$2b$10$hashed_placeholder_for_security_reasons', 'company', 1)`
      );
      companyUserId = userRes.insertId;
    }
    
    const [compRes] = await pool.execute(
      `INSERT INTO companies (user_id, company_name, industry, website, contact_person, contact_email, is_verified)
       VALUES (?, 'TechCorp Solutions', 'Technology', 'https://techcorp.com', 'Sarah Connor', 'sarah@techcorp.com', 1)`,
      [companyUserId]
    );
    companyId = compRes.insertId;
  }
  
  let internshipId;
  const [internships] = await pool.execute(
    `SELECT id FROM internships WHERE company_id = ? AND title = 'Frontend Developer Intern' LIMIT 1`,
    [companyId]
  );
  if (internships.length > 0) {
    internshipId = internships[0].id;
  } else {
    const [internRes] = await pool.execute(
      `INSERT INTO internships (company_id, title, description, location, duration, start_date, end_date, status)
       VALUES (?, 'Frontend Developer Intern', 'Web development internship', 'Remote', '6 Months', '2026-01-01', '2026-06-30', 'open')`,
      [companyId]
    );
    internshipId = internRes.insertId;
  }
  
  await pool.execute(
    `INSERT IGNORE INTO applications (student_id, internship_id, status)
     VALUES (?, ?, 'accepted')`,
    [studentId, internshipId]
  );
  
  // Seed default timeline events
  await TimelineEvent.create({
    student_id: studentId,
    event_type: 'application',
    title: 'Applied for Placement',
    description: 'Submitted application to TechCorp Solutions for Frontend Developer Intern.',
    event_date: '2026-01-01'
  });
  await TimelineEvent.create({
    student_id: studentId,
    event_type: 'offer_letter',
    title: 'Offer Letter Issued',
    description: 'Received internship offer from TechCorp Solutions.',
    event_date: '2026-01-03'
  });
  await TimelineEvent.create({
    student_id: studentId,
    event_type: 'faculty_approval',
    title: 'Academic Approval Granted',
    description: 'Placement approved by Department Coordinator.',
    event_date: '2026-01-05'
  });
  await TimelineEvent.create({
    student_id: studentId,
    event_type: 'internship_started',
    title: 'Internship Commenced',
    description: 'Successfully joined the team and began onboarding.',
    event_date: '2026-01-08'
  });
  
  return internshipId;
}

/**
 * Calculates the longest attendance streak, ignoring weekend gaps.
 */
async function getLongestAttendanceStreak(studentId) {
  const [rows] = await pool.execute(
    `SELECT date FROM attendance 
     WHERE student_id = ? AND status = 'present' 
     ORDER BY date ASC`,
    [studentId]
  );
  if (rows.length === 0) return 0;
  
  let longestStreak = 0;
  let currentStreak = 0;
  let prevDate = null;
  
  for (const row of rows) {
    const currentDate = new Date(row.date);
    if (prevDate === null) {
      currentStreak = 1;
    } else {
      const diffTime = Math.abs(currentDate - prevDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentStreak++;
      } else if (diffDays > 1) {
        const prevDayOfWeek = prevDate.getDay(); // 5 = Friday
        const currentDayOfWeek = currentDate.getDay(); // 1 = Monday
        if (prevDayOfWeek === 5 && currentDayOfWeek === 1 && diffDays === 3) {
          currentStreak++; // Weekend gap, maintain streak
        } else {
          currentStreak = 1; // Broken streak
        }
      }
    }
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
    prevDate = currentDate;
  }
  
  return longestStreak;
}

const studentController = {
  // ─── Serve HTML Views ──────────────────────────────────────────────────────
  getDashboard(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'student-dashboard.html'));
  },

  getProfilePage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'student-profile.html'));
  },

  getInternshipPage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'student-internship.html'));
  },

  getAttendancePage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'student-attendance.html'));
  },

  getReportsPage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'student-reports.html'));
  },

  getDocumentsPage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'student-documents.html'));
  },

  // ─── Profile & Photo Handlers ──────────────────────────────────────────────
  async getProfileData(req, res) {
    try {
      const userId = req.session.user.id;
      let student = await Student.findByUserId(userId);

      if (!student) {
        const nameParts = (req.session.user.name || '').split(' ');
        const firstName = nameParts[0] || 'Student';
        const lastName = nameParts.slice(1).join(' ') || 'User';
        
        const randomStr = Math.floor(1000 + Math.random() * 9000);
        const rollNumber = `ROLL-${userId}-${randomStr}`;
        const enrollmentNumber = `ENR-${userId}-${randomStr}`;

        await Student.create({
          user_id: userId,
          first_name: firstName,
          last_name: lastName,
          roll_number: rollNumber,
          enrollment_number: enrollmentNumber,
          department: 'Computer Science',
          semester: 6,
          phone: '',
          address: '',
          gender: 'Other',
          dob: null,
          skills: '',
          bio: '',
          linkedin: '',
          github: ''
        });

        student = await Student.findByUserId(userId);
      }

      return res.json({
        success: true,
        student
      });
    } catch (error) {
      console.error('Error fetching student profile:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while fetching profile data.'
      });
    }
  },

  async updateProfile(req, res) {
    const {
      first_name, last_name, email, phone, address,
      gender, dob, department, semester, enrollment_number,
      bio, skills, linkedin, github
    } = req.body;

    const userId = req.session.user.id;

    if (!first_name || !last_name || !email || !department || !semester || !enrollment_number) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: Name, Email, Department, Semester, and Enrollment Number are required.'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    if (phone && !phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number (10-15 digits).'
      });
    }

    const semNum = parseInt(semester, 10);
    if (isNaN(semNum) || semNum < 1 || semNum > 8) {
      return res.status(400).json({
        success: false,
        message: 'Semester must be a number between 1 and 8.'
      });
    }

    if (dob && isNaN(Date.parse(dob))) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid date of birth.'
      });
    }

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      if (student.user_id !== userId) {
        return res.status(403).json({ success: false, message: 'Access denied. You can only modify your own profile.' });
      }

      await Student.update(student.id, {
        first_name,
        last_name,
        phone: phone || '',
        address: address || '',
        gender: gender || 'Other',
        dob: dob ? new Date(dob) : null,
        department,
        semester: semNum,
        enrollment_number,
        bio: bio || '',
        skills: skills || '',
        linkedin: linkedin || '',
        github: github || ''
      });

      const fullName = `${first_name} ${last_name}`.trim();
      await User.update(userId, { email, name: fullName });

      req.session.user.name = fullName;
      req.session.user.email = email;

      // Log notification/timeline event
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'attendance',
        title: 'Profile Updated',
        description: 'Successfully updated your personal and academic details in profile settings.'
      });

      return res.json({
        success: true,
        message: 'Profile updated successfully.',
        user: req.session.user
      });
    } catch (error) {
      console.error('Error updating student profile:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while updating profile.' });
    }
  },

  async uploadPhoto(req, res) {
    const userId = req.session.user.id;

    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded or invalid file type. Only JPG, JPEG, and PNG are allowed.' });
      }

      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const photoPath = `/uploads/profile_photos/${req.file.filename}`;

      if (student.profile_photo) {
        const oldFullPath = path.join(__dirname, '..', student.profile_photo);
        if (fs.existsSync(oldFullPath)) {
          fs.unlink(oldFullPath, (err) => {
            if (err) console.error('Error deleting old profile photo:', err);
          });
        }
      }

      await Student.update(student.id, {
        profile_photo: photoPath,
        profile_image: photoPath
      });

      // Log notification/timeline event
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'attendance',
        title: 'Profile Updated',
        description: 'Uploaded a new profile picture.'
      });

      return res.json({
        success: true,
        message: 'Profile photo uploaded successfully.',
        photoPath
      });
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while uploading profile photo.' });
    }
  },

  // ─── Internship Details Handler ───────────────────────────────────────────
  async getInternshipData(req, res) {
    const userId = req.session.user.id;

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const internshipId = await getOrCreateActiveInternship(student.id, student.department);

      const [rows] = await pool.execute(
        `SELECT i.*, c.company_name, c.contact_person, c.contact_email, a.status AS application_status, a.applied_at
         FROM applications a
         JOIN internships i ON a.internship_id = i.id
         JOIN companies c ON i.company_id = c.id
         WHERE a.student_id = ? AND a.status = 'accepted'
         LIMIT 1`,
        [student.id]
      );

      const dbIntern = rows[0];
      const startDate = new Date(dbIntern.start_date);
      const endDate = new Date(dbIntern.end_date);
      const today = new Date();
      
      const totalTime = endDate.getTime() - startDate.getTime();
      const totalDays = Math.ceil(totalTime / (1000 * 60 * 60 * 24)) || 120;
      
      let daysCompleted = 0;
      if (today > startDate) {
        const completedTime = today.getTime() - startDate.getTime();
        daysCompleted = Math.min(totalDays, Math.ceil(completedTime / (1000 * 60 * 60 * 24)));
      }
      
      const percent = Math.round((daysCompleted / totalDays) * 100);

      const internship = {
        company: dbIntern.company_name,
        mentor: dbIntern.contact_person || 'Sarah Connor (Senior Engineering Manager)',
        department: student.department || 'Software Engineering',
        position: dbIntern.title,
        duration: dbIntern.duration || '6 Months',
        startDate: dbIntern.start_date,
        endDate: dbIntern.end_date,
        status: 'Active',
        workingDays: totalDays,
        daysCompleted,
        percentage: percent
      };

      return res.json({
        success: true,
        internship
      });
    } catch (error) {
      console.error('Error fetching internship details:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching internship details.' });
    }
  },

  // ─── Attendance & Leaves API ───────────────────────────────────────────────
  async getAttendanceData(req, res) {
    const userId = req.session.user.id;
    const { month, year, status, sortBy, page, limit } = req.query;

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      await getOrCreateActiveInternship(student.id, student.department);

      const filters = {
        month: month ? parseInt(month, 10) : null,
        year: year ? parseInt(year, 10) : null,
        status: status || null,
        sortBy: sortBy || 'newest',
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : null // If no limit, fetch all (for exports/full lists)
      };

      const records = await Attendance.getAttendanceList(student.id, filters);
      const stats = await Attendance.getStatistics(student.id);

      // Check today's check-in status
      const todayDate = new Date().toISOString().slice(0, 10);
      const todayRecord = await Attendance.findByStudentAndDate(student.id, todayDate);

      const checkInStatus = {
        checkedIn: todayRecord ? true : false,
        checkedOut: (todayRecord && todayRecord.check_out_time) ? true : false,
        checkInTime: todayRecord ? todayRecord.check_in_time : null,
        checkOutTime: todayRecord ? todayRecord.check_out_time : null,
        status: todayRecord ? todayRecord.status : null,
        leaveStatus: todayRecord ? todayRecord.leave_status : null
      };

      return res.json({
        success: true,
        records,
        statistics: stats,
        today: checkInStatus
      });
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while retrieving attendance.' });
    }
  },

  async checkIn(req, res) {
    const userId = req.session.user.id;
    const { location, remarks } = req.body;

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const internshipId = await getOrCreateActiveInternship(student.id, student.department);
      
      const todayDate = new Date().toISOString().slice(0, 10);
      const existing = await Attendance.findByStudentAndDate(student.id, todayDate);
      
      if (existing) {
        return res.status(400).json({
          success: false,
          message: existing.status === 'leave' 
            ? 'Cannot check in. You have requested leave for today.' 
            : 'You have already checked in for today.'
        });
      }

      const checkInTime = new Date().toTimeString().split(' ')[0]; // HH:MM:SS
      
      await Attendance.checkIn({
        student_id: student.id,
        internship_id: internshipId,
        date: todayDate,
        check_in_time: checkInTime,
        location,
        remarks
      });

      // Log notification/timeline event
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'attendance',
        title: 'Attendance Recorded',
        description: `Checked in successfully at ${checkInTime} (${location || 'Remote'}).`
      });

      return res.json({ success: true, message: 'Checked in successfully.', time: checkInTime });
    } catch (error) {
      console.error('Error checking in:', error);
      return res.status(500).json({ success: false, message: 'Internal server error during check-in.' });
    }
  },

  async checkOut(req, res) {
    const userId = req.session.user.id;
    const { remarks } = req.body;

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const todayDate = new Date().toISOString().slice(0, 10);
      const record = await Attendance.findByStudentAndDate(student.id, todayDate);

      if (!record) {
        return res.status(400).json({ success: false, message: 'Cannot check out without checking in first.' });
      }

      if (record.check_out_time) {
        return res.status(400).json({ success: false, message: 'You have already checked out for today.' });
      }

      const checkOutTime = new Date().toTimeString().split(' ')[0]; // HH:MM:SS

      // Calculate working hours
      const [inH, inM, inS] = record.check_in_time.split(':').map(Number);
      const [outH, outM, outS] = checkOutTime.split(':').map(Number);
      const diffMs = (outH * 3600 + outM * 60 + outS) - (inH * 3600 + inM * 60 + inS);
      const workingHours = Math.max(0.1, parseFloat((diffMs / 3600).toFixed(2)));

      await Attendance.checkOut(record.id, {
        check_out_time: checkOutTime,
        working_hours: workingHours,
        remarks
      });

      // Log notification/timeline event
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'attendance',
        title: 'Attendance Recorded',
        description: `Checked out successfully at ${checkOutTime}. Logged ${workingHours} working hours.`
      });

      return res.json({ success: true, message: 'Checked out successfully.', time: checkOutTime, hours: workingHours });
    } catch (error) {
      console.error('Error checking out:', error);
      return res.status(500).json({ success: false, message: 'Internal server error during check-out.' });
    }
  },

  async requestLeave(req, res) {
    const userId = req.session.user.id;
    const { date, reason } = req.body;

    if (!date || !reason) {
      return res.status(400).json({ success: false, message: 'Date and reason are required.' });
    }

    if (isNaN(Date.parse(date))) {
      return res.status(400).json({ success: false, message: 'Invalid date provided.' });
    }

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const internshipId = await getOrCreateActiveInternship(student.id, student.department);

      const existing = await Attendance.findByStudentAndDate(student.id, date);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Attendance or leave record already exists for this date.' });
      }

      await Attendance.createLeaveRequest({
        student_id: student.id,
        internship_id: internshipId,
        date,
        leave_reason: reason
      });

      // Log notification/timeline event
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'attendance',
        title: 'Leave Status',
        description: `Submitted a leave request for ${date}. Status: PENDING.`
      });

      return res.json({ success: true, message: 'Leave request submitted successfully.' });
    } catch (error) {
      console.error('Error requesting leave:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while requesting leave.' });
    }
  },

  // ─── Daily Work Log API ────────────────────────────────────────────────────
  async getDailyLogs(req, res) {
    const userId = req.session.user.id;
    const { startDate, endDate, search, sortBy, page, limit } = req.query;

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const filters = {
        startDate,
        endDate,
        search: search || null,
        sortBy: sortBy || 'newest',
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : null
      };
      
      const logs = await DailyLog.getLogsList(student.id, filters);
      const stats = await DailyLog.getStatistics(student.id);

      return res.json({ success: true, logs, statistics: stats });
    } catch (error) {
      console.error('Error fetching daily logs:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching daily logs.' });
    }
  },

  async submitDailyLog(req, res) {
    const userId = req.session.user.id;
    const {
      date, tasks_completed, hours_worked,
      technology_used, problems_faced, learning_outcome, remarks
    } = req.body;

    if (!date || !tasks_completed || hours_worked === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields: Date, Tasks, and Hours are required.' });
    }

    if (isNaN(Date.parse(date))) {
      return res.status(400).json({ success: false, message: 'Invalid date format.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (date > todayStr) {
      return res.status(400).json({ success: false, message: 'Cannot submit work logs for future dates.' });
    }

    const hours = parseFloat(hours_worked);
    if (isNaN(hours) || hours < 0 || hours > 24) {
      return res.status(400).json({ success: false, message: 'Hours worked must be a number between 0 and 24.' });
    }

    const textLimit = (str) => (str || '').slice(0, 1000);

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const internshipId = await getOrCreateActiveInternship(student.id, student.department);

      const existing = await DailyLog.findByStudentAndDate(student.id, date);
      if (existing) {
        return res.status(400).json({ success: false, message: 'A work log already exists for this date.' });
      }

      await DailyLog.create({
        student_id: student.id,
        internship_id: internshipId,
        date,
        tasks_completed: textLimit(tasks_completed),
        hours_worked: hours,
        technology_used: textLimit(technology_used),
        problems_faced: textLimit(problems_faced),
        learning_outcome: textLimit(learning_outcome),
        remarks: textLimit(remarks)
      });

      // Log notification/timeline event
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'attendance',
        title: 'Attendance Recorded',
        description: `Submitted work log for ${date} (${hours} hours).`
      });

      return res.json({ success: true, message: 'Daily work log submitted successfully.' });
    } catch (error) {
      console.error('Error submitting daily log:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while submitting daily log.' });
    }
  },

  // ─── Weekly Reports API ────────────────────────────────────────────────────
  async getWeeklyReports(req, res) {
    const userId = req.session.user.id;
    const { status, search, sortBy, page, limit } = req.query;

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const filters = {
        status: status || null,
        search: search || null,
        sortBy: sortBy || 'newest',
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : null
      };

      const reports = await WeeklyReport.getReportsList(student.id, filters);
      const stats = await WeeklyReport.getStatistics(student.id);

      return res.json({ success: true, reports, statistics: stats });
    } catch (error) {
      console.error('Error fetching weekly reports:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching weekly reports.' });
    }
  },

  async createWeeklyReport(req, res) {
    const userId = req.session.user.id;
    const {
      week_number, date_range, report_content, skills_learned,
      problems_faced, hours_worked, achievements, future_plan
    } = req.body;

    const weekNum = parseInt(week_number, 10);
    if (isNaN(weekNum) || weekNum < 1 || weekNum > 52) {
      return res.status(400).json({ success: false, message: 'Please provide a valid week number (1-52).' });
    }

    if (!report_content || report_content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Tasks Completed / Report Content cannot be empty.' });
    }

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const internshipId = await getOrCreateActiveInternship(student.id, student.department);

      const existing = await WeeklyReport.findByStudentAndWeek(student.id, weekNum);
      if (existing) {
        return res.status(400).json({ success: false, message: `A report already exists for Week ${weekNum}.` });
      }

      const hours = parseFloat(hours_worked || 0);

      await WeeklyReport.create({
        student_id: student.id,
        internship_id: internshipId,
        week_number: weekNum,
        date_range: date_range || '',
        report_content,
        skills_learned: skills_learned || '',
        problems_faced: problems_faced || '',
        hours_worked: isNaN(hours) ? 0 : hours,
        achievements: achievements || '',
        future_plan: future_plan || ''
      });

      // Log notification/timeline event
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'weekly_reports',
        title: 'Timeline Updates',
        description: `Created Week ${weekNum} weekly report draft.`
      });

      return res.json({ success: true, message: 'Weekly report draft saved successfully.' });
    } catch (error) {
      console.error('Error creating weekly report:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while saving draft.' });
    }
  },

  async updateWeeklyReport(req, res) {
    const userId = req.session.user.id;
    const reportId = parseInt(req.params.id, 10);
    const fields = req.body;

    if (fields.report_content && fields.report_content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Tasks Completed / Report Content cannot be empty.' });
    }

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const report = await WeeklyReport.findById(reportId);
      if (!report) {
        return res.status(404).json({ success: false, message: 'Weekly report not found.' });
      }

      if (report.student_id !== student.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized. You do not own this report.' });
      }

      if (report.status !== 'draft') {
        return res.status(400).json({ success: false, message: 'Cannot edit an already submitted or reviewed report.' });
      }

      if (fields.hours_worked !== undefined) {
        fields.hours_worked = parseFloat(fields.hours_worked || 0);
      }

      await WeeklyReport.update(reportId, fields);

      return res.json({ success: true, message: 'Weekly report updated successfully.' });
    } catch (error) {
      console.error('Error updating weekly report:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while updating report.' });
    }
  },

  async deleteWeeklyReport(req, res) {
    const userId = req.session.user.id;
    const reportId = parseInt(req.params.id, 10);

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const report = await WeeklyReport.findById(reportId);
      if (!report) {
        return res.status(404).json({ success: false, message: 'Weekly report not found.' });
      }

      if (report.student_id !== student.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized. You do not own this report.' });
      }

      if (report.status !== 'draft') {
        return res.status(400).json({ success: false, message: 'Cannot delete an already submitted or reviewed report.' });
      }

      await WeeklyReport.delete(reportId);

      return res.json({ success: true, message: 'Weekly report deleted successfully.' });
    } catch (error) {
      console.error('Error deleting weekly report:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while deleting report.' });
    }
  },

  async submitWeeklyReport(req, res) {
    const userId = req.session.user.id;
    const reportId = parseInt(req.params.id, 10);

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const report = await WeeklyReport.findById(reportId);
      if (!report) {
        return res.status(404).json({ success: false, message: 'Weekly report not found.' });
      }

      if (report.student_id !== student.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized. You do not own this report.' });
      }

      if (report.status !== 'draft') {
        return res.status(400).json({ success: false, message: 'Report has already been submitted.' });
      }

      await WeeklyReport.submit(reportId);

      // Log notification/timeline event
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'weekly_reports',
        title: 'Report Submitted',
        description: `Submitted Week ${report.week_number} progress report for coordinator review.`
      });

      return res.json({ success: true, message: 'Weekly report submitted successfully.' });
    } catch (error) {
      console.error('Error submitting weekly report:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while submitting report.' });
    }
  },

  // ─── Document Center API ───────────────────────────────────────────────────
  async getDocuments(req, res) {
    const userId = req.session.user.id;
    const { documentType, search, sortBy, page, limit } = req.query;

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const filters = {
        documentType: documentType || null,
        search: search || null,
        sortBy: sortBy || 'newest',
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : null
      };

      const documents = await StudentDocument.getDocumentsList(student.id, filters);
      const stats = await StudentDocument.getStatistics(student.id);

      return res.json({ success: true, documents, statistics: stats });
    } catch (error) {
      console.error('Error fetching documents:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching documents.' });
    }
  },

  async uploadDocument(req, res) {
    const userId = req.session.user.id;
    const { document_type } = req.body;

    const allowedTypes = ['resume', 'offer_letter', 'noc', 'weekly_report_pdf', 'presentation', 'final_report', 'certificate', 'other'];
    if (!allowedTypes.includes(document_type)) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(400).json({ success: false, message: 'Invalid document type.' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded or invalid file format.' });
      }

      const student = await Student.findByUserId(userId);
      if (!student) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const doc = await StudentDocument.create({
        student_id: student.id,
        document_type,
        file_name: req.file.originalname,
        file_path: `/uploads/documents/${req.file.filename}`,
        file_size: req.file.size
      });

      // Log notification/timeline event
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'offer_letter',
        title: 'Document Uploaded',
        description: `Successfully uploaded ${document_type.replace('_', ' ')}: ${req.file.originalname}.`
      });

      return res.json({ success: true, message: 'Document uploaded successfully.', document: doc });
    } catch (error) {
      console.error('Error uploading document:', error);
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(500).json({ success: false, message: 'Internal server error during upload.' });
    }
  },

  async downloadDocument(req, res) {
    const userId = req.session.user.id;
    const docId = parseInt(req.params.id, 10);

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const doc = await StudentDocument.findById(docId);
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found.' });
      }

      if (doc.student_id !== student.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized access to this document.' });
      }

      const rootUploads = path.resolve(__dirname, '..', 'uploads', 'documents');
      const filename = path.basename(doc.file_path);
      const fullPath = path.join(rootUploads, filename);

      if (!fullPath.startsWith(rootUploads)) {
        return res.status(403).json({ success: false, message: 'Access denied: Directory traversal detected.' });
      }

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ success: false, message: 'Physical file not found on server.' });
      }

      return res.download(fullPath, doc.file_name);
    } catch (error) {
      console.error('Error downloading document:', error);
      return res.status(500).json({ success: false, message: 'Internal server error during download.' });
    }
  },

  async deleteDocument(req, res) {
    const userId = req.session.user.id;
    const docId = parseInt(req.params.id, 10);

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const doc = await StudentDocument.findById(docId);
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found.' });
      }

      if (doc.student_id !== student.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized to delete this document.' });
      }

      const rootUploads = path.resolve(__dirname, '..', 'uploads', 'documents');
      const filename = path.basename(doc.file_path);
      const fullPath = path.join(rootUploads, filename);

      if (fullPath.startsWith(rootUploads) && fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      await StudentDocument.delete(docId);

      return res.json({ success: true, message: 'Document deleted successfully.' });
    } catch (error) {
      console.error('Error deleting document:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while deleting document.' });
    }
  },

  async replaceDocument(req, res) {
    const userId = req.session.user.id;
    const docId = parseInt(req.params.id, 10);

    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No replacement file uploaded.' });
      }

      const student = await Student.findByUserId(userId);
      if (!student) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const doc = await StudentDocument.findById(docId);
      if (!doc) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ success: false, message: 'Document to replace not found.' });
      }

      if (doc.student_id !== student.id) {
        fs.unlink(req.file.path, () => {});
        return res.status(403).json({ success: false, message: 'Unauthorized to replace this document.' });
      }

      const rootUploads = path.resolve(__dirname, '..', 'uploads', 'documents');
      const oldFilename = path.basename(doc.file_path);
      const oldFullPath = path.join(rootUploads, oldFilename);

      if (oldFullPath.startsWith(rootUploads) && fs.existsSync(oldFullPath)) {
        fs.unlinkSync(oldFullPath);
      }

      await StudentDocument.delete(docId);

      const newDoc = await StudentDocument.create({
        student_id: student.id,
        document_type: doc.document_type,
        file_name: req.file.originalname,
        file_path: `/uploads/documents/${req.file.filename}`,
        file_size: req.file.size
      });

      return res.json({ success: true, message: 'Document replaced successfully.', document: newDoc });
    } catch (error) {
      console.error('Error replacing document:', error);
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(500).json({ success: false, message: 'Internal server error while replacing document.' });
    }
  },

  // ─── Timeline & Progress API ───────────────────────────────────────────────
  async getTimelineData(req, res) {
    const userId = req.session.user.id;

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      await getOrCreateActiveInternship(student.id, student.department);

      const timeline = await TimelineEvent.getTimeline(student.id);
      return res.json({ success: true, timeline });
    } catch (error) {
      console.error('Error fetching timeline:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching timeline.' });
    }
  },

  async getActivityHistory(req, res) {
    const userId = req.session.user.id;

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      await getOrCreateActiveInternship(student.id, student.department);

      const history = await TimelineEvent.getActivityHistory(student.id, 15);
      return res.json({ success: true, history });
    } catch (error) {
      console.error('Error fetching activity history:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching activity history.' });
    }
  },

  async getProgressData(req, res) {
    const userId = req.session.user.id;

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      const internshipId = await getOrCreateActiveInternship(student.id, student.department);

      // Get internship days percentage and remaining days
      const [rows] = await pool.execute(
        `SELECT start_date, end_date FROM internships WHERE id = ? LIMIT 1`,
        [internshipId]
      );
      
      let internshipPercent = 0;
      let remainingDays = 0;
      let startDateVal = new Date();
      
      if (rows.length > 0) {
        const start = new Date(rows[0].start_date);
        const end = new Date(rows[0].end_date);
        const today = new Date();
        const total = end.getTime() - start.getTime();
        const totalDays = Math.ceil(total / (1000 * 60 * 60 * 24)) || 120;
        
        startDateVal = start;
        
        let completed = 0;
        if (today > start) {
          completed = Math.min(totalDays, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        }
        internshipPercent = Math.round((completed / totalDays) * 100);
        remainingDays = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      }

      // Fetch statistics
      const attStats = await Attendance.getStatistics(student.id);
      const repStats = await WeeklyReport.getStatistics(student.id);
      const docStats = await StudentDocument.getStatistics(student.id);

      const overallCompletion = Math.round(
        (internshipPercent + attStats.attendancePercentage + repStats.reportsPercentage + docStats.documentsPercentage) / 4
      );

      // ─── Calculate Advanced Insights ───
      // 1. Longest Streak
      const longestStreak = await getLongestAttendanceStreak(student.id);
      
      // 2. Average Working Hours
      const [hourRows] = await pool.execute(
        `SELECT AVG(hours_worked) AS avg_hours, SUM(hours_worked) AS total_hours FROM daily_logs WHERE student_id = ?`,
        [student.id]
      );
      const avgDailyHours = hourRows[0] && hourRows[0].avg_hours ? parseFloat(parseFloat(hourRows[0].avg_hours).toFixed(1)) : 0.0;
      const totalHours = hourRows[0] && hourRows[0].total_hours ? parseFloat(hourRows[0].total_hours) : 0.0;

      // 3. Missing Reports calculation (based on elapsed weeks)
      const missingReports = [];
      const today = new Date();
      if (today > startDateVal) {
        const diffTime = today.getTime() - startDateVal.getTime();
        const elapsedWeeks = Math.min(16, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7)));
        
        const [existingReports] = await pool.execute(
          `SELECT week_number FROM weekly_reports WHERE student_id = ?`,
          [student.id]
        );
        const reportWeeks = new Set(existingReports.map(r => r.week_number));
        
        for (let w = 1; w <= elapsedWeeks; w++) {
          if (!reportWeeks.has(w)) {
            missingReports.push(w);
          }
        }
      }

      // 4. Missing Documents
      const missingDocs = [];
      if (docStats.resumeCount === 0) missingDocs.push('Resume / CV');
      if (docStats.offerLetterCount === 0) missingDocs.push('Signed Offer Letter');
      if (docStats.nocCount === 0) missingDocs.push('No Objection Certificate (NOC)');
      if (docStats.finalReportCount === 0) missingDocs.push('Final Project Report');

      // 5. Pending Approvals
      const pendingApprovals = repStats.submittedCount + attStats.pendingLeaves;

      // 6. Next Friday Deadline
      const getNextFriday = () => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() + (5 - day + (day >= 5 ? 7 : 0));
        return new Date(d.setDate(diff)).toISOString().slice(0, 10);
      };
      const nextFriday = getNextFriday();

      // 7. Dynamic Suggestions
      const suggestions = [];
      if (attStats.attendancePercentage < 90) {
        suggestions.push('Your attendance rate is below 90%. Punch in daily to meet university guidelines.');
      }
      if (missingReports.length > 0) {
        suggestions.push(`Please submit missing weekly reports (Week ${missingReports.join(', ')}) to maintain academic compliance.`);
      }
      if (missingDocs.length > 0) {
        suggestions.push(`Upload missing required documents: ${missingDocs.join(', ')} in the Document Center.`);
      }
      if (suggestions.length === 0) {
        suggestions.push('Excellent job! You are in perfect compliance with all program benchmarks.');
      }

      return res.json({
        success: true,
        progress: {
          internshipPercentage: internshipPercent,
          attendancePercentage: attStats.attendancePercentage,
          weeklyReportsPercentage: repStats.reportsPercentage,
          documentsPercentage: docStats.documentsPercentage,
          overallCompletionPercentage: Math.min(100, overallCompletion)
        },
        insights: {
          remainingInternshipDays: remainingDays,
          averageDailyHours: avgDailyHours,
          totalHoursLogged: totalHours,
          longestAttendanceStreak: longestStreak,
          missingReports,
          missingDocuments: missingDocs,
          pendingApprovals,
          upcomingDeadlines: `Weekly Report due on ${nextFriday} at 5:00 PM`,
          suggestions
        }
      });
    } catch (error) {
      console.error('Error fetching progress data:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching progress statistics.' });
    }
  },

  // ─── Global Search API ─────────────────────────────────────────────────────
  async getGlobalSearch(req, res) {
    const userId = req.session.user.id;
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json({
        success: true,
        results: { attendance: [], logs: [], reports: [], documents: [], timeline: [] }
      });
    }

    const searchTerm = `%${q.trim()}%`;

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      // 1. Search Attendance
      const [attendance] = await pool.execute(
        `SELECT * FROM attendance 
         WHERE student_id = ? AND (remarks LIKE ? OR location LIKE ? OR leave_reason LIKE ?)
         ORDER BY date DESC LIMIT 10`,
        [student.id, searchTerm, searchTerm, searchTerm]
      );

      // 2. Search Daily Logs
      const [logs] = await pool.execute(
        `SELECT * FROM daily_logs 
         WHERE student_id = ? AND (tasks_completed LIKE ? OR technology_used LIKE ? OR learning_outcome LIKE ?)
         ORDER BY date DESC LIMIT 10`,
        [student.id, searchTerm, searchTerm, searchTerm]
      );

      // 3. Search Weekly Reports
      const [reports] = await pool.execute(
        `SELECT * FROM weekly_reports 
         WHERE student_id = ? AND (report_content LIKE ? OR skills_learned LIKE ? OR achievements LIKE ?)
         ORDER BY week_number DESC LIMIT 10`,
        [student.id, searchTerm, searchTerm, searchTerm]
      );

      // 4. Search Documents
      const [documents] = await pool.execute(
        `SELECT * FROM student_documents 
         WHERE student_id = ? AND file_name LIKE ?
         ORDER BY uploaded_at DESC LIMIT 10`,
        [student.id, searchTerm]
      );

      // 5. Search Timeline
      const [timeline] = await pool.execute(
        `SELECT * FROM timeline_events 
         WHERE student_id = ? AND (title LIKE ? OR description LIKE ?)
         ORDER BY event_date DESC LIMIT 10`,
        [student.id, searchTerm, searchTerm]
      );

      return res.json({
        success: true,
        results: { attendance, logs, reports, documents, timeline }
      });
    } catch (error) {
      console.error('Error during global search:', error);
      return res.status(500).json({ success: false, message: 'Internal server error during search query.' });
    }
  },

  // ─── Local Notification Center API ──────────────────────────────────────────
  async getNotifications(req, res) {
    const userId = req.session.user.id;

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      // Count unread notifications
      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS unread FROM timeline_events WHERE student_id = ? AND is_read = FALSE`,
        [student.id]
      );
      const unreadCount = countRows[0] && countRows[0].unread ? countRows[0].unread : 0;

      // Fetch 10 most recent events (notifications)
      const [notifications] = await pool.execute(
        `SELECT * FROM timeline_events WHERE student_id = ? ORDER BY created_at DESC LIMIT 10`,
        [student.id]
      );

      return res.json({
        success: true,
        unreadCount,
        notifications
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching notifications.' });
    }
  },

  async markNotificationsRead(req, res) {
    const userId = req.session.user.id;

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      await pool.execute(
        `UPDATE timeline_events SET is_read = TRUE WHERE student_id = ? AND is_read = FALSE`,
        [student.id]
      );

      return res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while modifying notifications.' });
    }
  },

  // ─── Export System API (PDF & CSV) ─────────────────────────────────────────
  async exportData(req, res) {
    const userId = req.session.user.id;
    const { type } = req.params;
    const { format } = req.query;

    const allowedTypes = ['attendance', 'reports', 'logs', 'timeline', 'documents'];
    const allowedFormats = ['pdf', 'csv'];

    if (!allowedTypes.includes(type) || !allowedFormats.includes(format)) {
      return res.status(400).json({ success: false, message: 'Invalid export type or format.' });
    }

    try {
      const student = await Student.findByUserId(userId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      let rows = [];
      let headers = [];
      let keys = [];
      let title = '';

      // Query complete ledger data
      if (type === 'attendance') {
        rows = await Attendance.getAttendanceList(student.id, { sortBy: 'oldest' });
        headers = ['Date', 'Status', 'Check-In', 'Check-Out', 'Hours Worked', 'Remarks'];
        keys = ['date', 'status', 'check_in_time', 'check_out_time', 'working_hours', 'remarks'];
        title = 'Student Attendance Ledger';
      } else if (type === 'reports') {
        rows = await WeeklyReport.getReportsList(student.id, { sortBy: 'oldest' });
        headers = ['Week', 'Date Range', 'Hours Logged', 'Status', 'Tasks Completed'];
        keys = ['week_number', 'date_range', 'hours_worked', 'status', 'report_content'];
        title = 'Weekly Progress Reports Index';
      } else if (type === 'logs') {
        rows = await DailyLog.getLogsList(student.id, { sortBy: 'oldest' });
        headers = ['Date', 'Hours', 'Technologies Used', 'Tasks Completed'];
        keys = ['date', 'hours_worked', 'technology_used', 'tasks_completed'];
        title = 'Daily Work Logs Ledger';
      } else if (type === 'timeline') {
        const [timelineRows] = await pool.execute(
          `SELECT * FROM timeline_events WHERE student_id = ? ORDER BY event_date ASC, created_at ASC`,
          [student.id]
        );
        rows = timelineRows;
        headers = ['Date', 'Milestone Event', 'Description Details'];
        keys = ['event_date', 'title', 'description'];
        title = 'Internship Placement Milestones Timeline';
      } else if (type === 'documents') {
        rows = await StudentDocument.getDocumentsList(student.id, { sortBy: 'name' });
        headers = ['Filename', 'Document Category', 'File Size (Bytes)', 'Upload Date'];
        keys = ['file_name', 'document_type', 'file_size', 'uploaded_at'];
        title = 'Compliance Documents Index';
      }

      if (format === 'csv') {
        const csvString = exportHelper.generateCSV(headers, rows, keys);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${type}_export_${Date.now()}.csv`);
        return res.send(csvString);
      } else {
        // PDF format
        const pdfBuffer = await exportHelper.generatePDF(title, student, headers, rows, type);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${type}_export_${Date.now()}.pdf`);
        return res.send(pdfBuffer);
      }
    } catch (error) {
      console.error(`Error exporting ${type} to ${format}:`, error);
      return res.status(500).json({ success: false, message: 'Internal server error during export compilation.' });
    }
  }
};

module.exports = studentController;

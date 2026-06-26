/**
 * Faculty Controller
 * Handles faculty dashboard, student supervision list, reviews, approvals, feedback, and exports.
 */

'use strict';

const path = require('path');
const { pool } = require('../config/database');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const WeeklyReport = require('../models/WeeklyReport');
const Attendance = require('../models/Attendance');
const StudentDocument = require('../models/StudentDocument');
const TimelineEvent = require('../models/TimelineEvent');
const Feedback = require('../models/Feedback');
const DailyLog = require('../models/DailyLog');
const exportHelper = require('../helpers/exportHelper');

const facultyController = {
  /**
   * Render the Faculty Dashboard page
   */
  getDashboard(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'faculty-dashboard.html'));
  },

  /**
   * Render the Faculty Student Supervision list page
   */
  getStudentsPage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'faculty-students.html'));
  },

  /**
   * Render the Faculty Student Detail Review page
   */
  getStudentReviewPage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'faculty-student-review.html'));
  },

  /**
   * Get Faculty profile data
   */
  async getProfileData(req, res) {
    const userId = req.session.user.id;
    try {
      const faculty = await Faculty.findByUserId(userId);
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      }
      return res.json({ success: true, faculty });
    } catch (error) {
      console.error('Error fetching faculty profile:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching profile.' });
    }
  },

  /**
   * Get Faculty Dashboard Stats
   */
  async getDashboardStats(req, res) {
    const userId = req.session.user.id;
    try {
      const faculty = await Faculty.findByUserId(userId);
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      }

      // 1. Total students supervised
      const [studentsCountRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM students WHERE faculty_id = ?`,
        [faculty.id]
      );
      const totalStudents = studentsCountRows[0].total;

      // 2. Active internships
      const [activeInternshipsRows] = await pool.execute(
        `SELECT COUNT(DISTINCT s.id) AS active 
         FROM students s 
         JOIN applications a ON s.id = a.student_id 
         WHERE s.faculty_id = ? AND a.status = 'accepted'`,
        [faculty.id]
      );
      const activeInternships = activeInternshipsRows[0].active;

      // 3. Pending reports count
      const [pendingReportsRows] = await pool.execute(
        `SELECT COUNT(*) AS pending 
         FROM weekly_reports wr 
         JOIN students s ON wr.student_id = s.id 
         WHERE s.faculty_id = ? AND wr.status = 'submitted'`,
        [faculty.id]
      );
      const pendingReports = pendingReportsRows[0].pending;

      // 4. Pending leave approvals count
      const [pendingLeavesRows] = await pool.execute(
        `SELECT COUNT(*) AS pending 
         FROM attendance att 
         JOIN students s ON att.student_id = s.id 
         WHERE s.faculty_id = ? AND att.status = 'leave' AND att.leave_status = 'pending'`,
        [faculty.id]
      );
      const pendingLeaves = pendingLeavesRows[0].pending;

      // 5. Pending document approvals count
      const [pendingDocsRows] = await pool.execute(
        `SELECT COUNT(*) AS pending 
         FROM student_documents sd 
         JOIN students s ON sd.student_id = s.id 
         WHERE s.faculty_id = ? AND sd.status = 'pending'`,
        [faculty.id]
      );
      const pendingDocs = pendingDocsRows[0].pending;

      // 6. Average attendance rate
      const [attendanceRows] = await pool.execute(
        `SELECT 
           COUNT(CASE WHEN att.status = 'present' THEN 1 END) AS present_count,
           COUNT(att.id) AS total_count
         FROM attendance att
         JOIN students s ON att.student_id = s.id
         WHERE s.faculty_id = ?`,
        [faculty.id]
      );
      const presentCount = attendanceRows[0].present_count || 0;
      const totalCount = attendanceRows[0].total_count || 0;
      const avgAttendance = totalCount > 0 ? parseFloat(((presentCount / totalCount) * 100).toFixed(1)) : 100.0;

      // 7. Recent student activities (notifications for faculty)
      const [recentActivities] = await pool.execute(
        `SELECT te.*, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.roll_number
         FROM timeline_events te
         JOIN students s ON te.student_id = s.id
         WHERE s.faculty_id = ?
         ORDER BY te.created_at DESC
         LIMIT 10`,
        [faculty.id]
      );

      // 8. Pending items details (reports, leaves, docs combined) for quick actions
      const [pendingReportsList] = await pool.execute(
        `SELECT wr.id, wr.week_number, wr.submitted_at, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.roll_number, 'report' AS type
         FROM weekly_reports wr
         JOIN students s ON wr.student_id = s.id
         WHERE s.faculty_id = ? AND wr.status = 'submitted'
         ORDER BY wr.submitted_at DESC
         LIMIT 5`,
        [faculty.id]
      );

      const [pendingLeavesList] = await pool.execute(
        `SELECT att.id, att.date, att.leave_reason, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.roll_number, 'leave' AS type
         FROM attendance att
         JOIN students s ON att.student_id = s.id
         WHERE s.faculty_id = ? AND att.status = 'leave' AND att.leave_status = 'pending'
         ORDER BY att.date DESC
         LIMIT 5`,
        [faculty.id]
      );

      const [pendingDocsList] = await pool.execute(
        `SELECT sd.id, sd.document_type, sd.file_name, sd.uploaded_at, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.roll_number, 'document' AS type
         FROM student_documents sd
         JOIN students s ON sd.student_id = s.id
         WHERE s.faculty_id = ? AND sd.status = 'pending'
         ORDER BY sd.uploaded_at DESC
         LIMIT 5`,
        [faculty.id]
      );

      return res.json({
        success: true,
        stats: {
          totalStudents,
          activeInternships,
          pendingReports,
          pendingLeaves,
          pendingDocs,
          avgAttendance
        },
        recentActivities,
        pendingApprovals: [
          ...pendingReportsList,
          ...pendingLeavesList,
          ...pendingDocsList
        ]
      });
    } catch (error) {
      console.error('Error compiling dashboard stats:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while compiling stats.' });
    }
  },

  /**
   * Get Faculty Dashboard Charts Data
   */
  async getDashboardCharts(req, res) {
    const userId = req.session.user.id;
    try {
      const faculty = await Faculty.findByUserId(userId);
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      }

      // 1. Weekly report status distribution
      const [reportStats] = await pool.execute(
        `SELECT wr.status, COUNT(*) AS count 
         FROM weekly_reports wr 
         JOIN students s ON wr.student_id = s.id 
         WHERE s.faculty_id = ? 
         GROUP BY wr.status`,
        [faculty.id]
      );

      // 2. Department distribution
      const [deptStats] = await pool.execute(
        `SELECT s.department, COUNT(*) AS count 
         FROM students s 
         WHERE s.faculty_id = ? AND s.department IS NOT NULL
         GROUP BY s.department`,
        [faculty.id]
      );

      // 3. Company distribution
      const [companyStats] = await pool.execute(
        `SELECT c.company_name, COUNT(*) AS count 
         FROM students s 
         JOIN applications a ON s.id = a.student_id 
         JOIN internships i ON a.internship_id = i.id 
         JOIN companies c ON i.company_id = c.id 
         WHERE s.faculty_id = ? AND a.status = 'accepted'
         GROUP BY c.company_name`,
        [faculty.id]
      );

      return res.json({
        success: true,
        charts: {
          reports: reportStats,
          departments: deptStats,
          companies: companyStats
        }
      });
    } catch (error) {
      console.error('Error compiling dashboard charts:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while compiling charts.' });
    }
  },

  /**
   * Get Assigned Students with Pagination, Search and Filters
   */
  async getAssignedStudents(req, res) {
    const userId = req.session.user.id;
    const { department, semester, company, status, search, attendance, page = 1, limit = 10 } = req.query;

    try {
      const faculty = await Faculty.findByUserId(userId);
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      }

      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params = [faculty.id];

      let filterSQL = '';
      
      if (department) {
        filterSQL += ' AND s.department = ?';
        params.push(department);
      }

      if (semester) {
        filterSQL += ' AND s.semester = ?';
        params.push(semester);
      }

      if (company) {
        filterSQL += ' AND c.company_name LIKE ?';
        params.push(`%${company}%`);
      }

      if (search) {
        filterSQL += ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.roll_number LIKE ?)';
        const searchWild = `%${search}%`;
        params.push(searchWild, searchWild, searchWild);
      }

      if (status) {
        // 'active' vs 'completed' vs 'unassigned'
        if (status === 'active') {
          filterSQL += " AND a.status = 'accepted'";
        } else if (status === 'completed') {
          filterSQL += " AND a.status = 'accepted' AND i.end_date < CURRENT_DATE()";
        } else if (status === 'pending_approval') {
          filterSQL += " AND (SELECT COUNT(*) FROM weekly_reports WHERE student_id = s.id AND status = 'submitted') > 0";
        }
      }

      if (attendance) {
        if (attendance === 'low') {
          filterSQL += ` AND COALESCE((SELECT COUNT(CASE WHEN status='present' THEN 1 END) FROM attendance WHERE student_id = s.id) / 
                            NULLIF((SELECT COUNT(*) FROM attendance WHERE student_id = s.id), 0) * 100, 100) < 75`;
        } else if (attendance === 'high') {
          filterSQL += ` AND COALESCE((SELECT COUNT(CASE WHEN status='present' THEN 1 END) FROM attendance WHERE student_id = s.id) / 
                            NULLIF((SELECT COUNT(*) FROM attendance WHERE student_id = s.id), 0) * 100, 0) >= 75`;
        }
      }

      // 1. Get Count
      const countQuery = `
        SELECT COUNT(DISTINCT s.id) AS total 
        FROM students s
        LEFT JOIN applications a ON s.id = a.student_id AND a.status = 'accepted'
        LEFT JOIN internships i ON a.internship_id = i.id
        LEFT JOIN companies c ON i.company_id = c.id
        WHERE s.faculty_id = ? ${filterSQL}
      `;

      const [countRows] = await pool.execute(countQuery, params);
      const total = countRows[0].total;

      // 2. Get Data
      const dataQuery = `
        SELECT s.*, u.email,
               c.company_name, i.title AS internship_title, i.start_date, i.end_date,
               (SELECT COUNT(*) FROM weekly_reports WHERE student_id = s.id AND status = 'submitted') AS pending_reports_count,
               (SELECT COUNT(*) FROM attendance WHERE student_id = s.id AND status = 'present') AS present_days_count,
               (SELECT COUNT(*) FROM attendance WHERE student_id = s.id) AS total_attendance_days
        FROM students s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN applications a ON s.id = a.student_id AND a.status = 'accepted'
        LEFT JOIN internships i ON a.internship_id = i.id
        LEFT JOIN companies c ON i.company_id = c.id
        WHERE s.faculty_id = ? ${filterSQL}
        ORDER BY s.first_name ASC, s.last_name ASC
        LIMIT ? OFFSET ?
      `;

      const dataParams = [...params, String(limit), String(offset)];
      const [students] = await pool.execute(dataQuery, dataParams);

      // Map students to include calculated fields like attendance percentage
      const enrichedStudents = students.map(st => {
        const totalDays = st.total_attendance_days || 0;
        const presentDays = st.present_days_count || 0;
        const attendancePercentage = totalDays > 0 ? parseFloat(((presentDays / totalDays) * 100).toFixed(1)) : 100.0;

        return {
          ...st,
          attendancePercentage
        };
      });

      return res.json({
        success: true,
        students: enrichedStudents,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error('Error fetching assigned students:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching students.' });
    }
  },

  /**
   * Get complete student overview (read-only for Faculty)
   */
  async getStudentReviewData(req, res) {
    const userId = req.session.user.id;
    const studentId = parseInt(req.params.id, 10);

    try {
      const faculty = await Faculty.findByUserId(userId);
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      }

      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      // Security: Enforce ownership check
      if (student.faculty_id !== faculty.id) {
        return res.status(403).json({ success: false, message: 'Access denied. This student is not assigned to you.' });
      }

      // 1. Fetch Internship Details
      const [internshipRows] = await pool.execute(
        `SELECT i.*, c.company_name, c.contact_person, c.contact_email, c.contact_phone
         FROM applications a
         JOIN internships i ON a.internship_id = i.id
         JOIN companies c ON i.company_id = c.id
         WHERE a.student_id = ? AND a.status = 'accepted'
         LIMIT 1`,
        [student.id]
      );
      const internship = internshipRows[0] || null;

      // 2. Fetch Attendance History
      const attendance = await Attendance.getAttendanceList(student.id, { sortBy: 'newest' });
      const attendanceStats = await Attendance.getStatistics(student.id);

      // 3. Fetch Daily Logs
      const dailyLogs = await DailyLog.getLogsList(student.id, { sortBy: 'newest' });

      // 4. Fetch Weekly Reports
      const weeklyReports = await WeeklyReport.getReportsList(student.id, { sortBy: 'newest' });
      const reportStats = await WeeklyReport.getStatistics(student.id);

      // 5. Fetch Documents
      const documents = await StudentDocument.getDocumentsList(student.id, { sortBy: 'newest' });
      const docStats = await StudentDocument.getStatistics(student.id);

      // 6. Fetch Timeline Events
      const [timeline] = await pool.execute(
        `SELECT * FROM timeline_events WHERE student_id = ? ORDER BY event_date DESC, created_at DESC`,
        [student.id]
      );

      // 7. Fetch Faculty Feedback History
      const feedbackHistory = await Feedback.getFeedbackForUser(student.user_id, 'faculty_review');

      return res.json({
        success: true,
        student,
        internship,
        attendance: {
          logs: attendance,
          stats: attendanceStats
        },
        dailyLogs,
        weeklyReports: {
          logs: weeklyReports,
          stats: reportStats
        },
        documents: {
          files: documents,
          stats: docStats
        },
        timeline,
        feedbackHistory
      });
    } catch (error) {
      console.error('Error fetching student review data:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while loading student data.' });
    }
  },

  /**
   * Approve or reject a weekly report with remarks
   */
  async reviewWeeklyReport(req, res) {
    const userId = req.session.user.id;
    const reportId = parseInt(req.params.reportId, 10);
    const { status, remarks } = req.body; // status: 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status. Must be 'approved' or 'rejected'." });
    }

    try {
      const faculty = await Faculty.findByUserId(userId);
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      }

      const report = await WeeklyReport.findById(reportId);
      if (!report) {
        return res.status(404).json({ success: false, message: 'Weekly report not found.' });
      }

      const student = await Student.findById(report.student_id);
      if (!student || student.faculty_id !== faculty.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized. This student is not assigned to you.' });
      }

      // Update weekly report status and faculty remarks
      await pool.execute(
        `UPDATE weekly_reports 
         SET status = ?, faculty_remarks = ?, reviewed_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [status, remarks || null, reportId]
      );

      // Add student notification (TimelineEvent)
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'weekly_reports',
        title: `Weekly Report ${status === 'approved' ? 'Approved' : 'Correction Required'}`,
        description: `Week ${report.week_number} report review completed. Status: ${status.toUpperCase()}. Remarks: ${remarks || 'None'}`
      });

      return res.json({ success: true, message: `Weekly report has been successfully ${status}.` });
    } catch (error) {
      console.error('Error reviewing weekly report:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while reviewing report.' });
    }
  },

  /**
   * Approve or reject a leave request
   */
  async reviewLeaveRequest(req, res) {
    const userId = req.session.user.id;
    const attendanceId = parseInt(req.params.attendanceId, 10);
    const { status, remarks } = req.body; // status: 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status. Must be 'approved' or 'rejected'." });
    }

    try {
      const faculty = await Faculty.findByUserId(userId);
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      }

      const attRecord = await Attendance.findById(attendanceId);
      if (!attRecord) {
        return res.status(404).json({ success: false, message: 'Attendance record not found.' });
      }

      const student = await Student.findById(attRecord.student_id);
      if (!student || student.faculty_id !== faculty.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized. This student is not assigned to you.' });
      }

      // Update attendance leave status and remarks
      await pool.execute(
        `UPDATE attendance 
         SET leave_status = ?, remarks = ?, marked_by = ? 
         WHERE id = ?`,
        [status, remarks || null, userId, attendanceId]
      );

      // Add student notification (TimelineEvent)
      const dateStr = new Date(attRecord.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'attendance',
        title: `Leave Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        description: `Leave request for ${dateStr} has been ${status}. Remarks: ${remarks || 'None'}`
      });

      return res.json({ success: true, message: `Leave request has been successfully ${status}.` });
    } catch (error) {
      console.error('Error reviewing leave request:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while reviewing leave request.' });
    }
  },

  /**
   * Approve or reject an uploaded compliance document
   */
  async reviewDocument(req, res) {
    const userId = req.session.user.id;
    const documentId = parseInt(req.params.documentId, 10);
    const { status, remarks } = req.body; // status: 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status. Must be 'approved' or 'rejected'." });
    }

    try {
      const faculty = await Faculty.findByUserId(userId);
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      }

      const doc = await StudentDocument.findById(documentId);
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found.' });
      }

      const student = await Student.findById(doc.student_id);
      if (!student || student.faculty_id !== faculty.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized. This student is not assigned to you.' });
      }

      // Update document status and remarks
      await StudentDocument.update(documentId, { status, remarks: remarks || '' });

      // Add student notification (TimelineEvent)
      const category = doc.document_type.replace('_', ' ').toUpperCase();
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'weekly_reports',
        title: `Document ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        description: `Compliance document ${category} (${doc.file_name}) has been ${status}. Remarks: ${remarks || 'None'}`
      });

      return res.json({ success: true, message: `Document has been successfully ${status}.` });
    } catch (error) {
      console.error('Error reviewing document:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while reviewing document.' });
    }
  },

  /**
   * Write mentor remarks, leave recommendations, and rate student performance
   */
  async submitFeedback(req, res) {
    const userId = req.session.user.id;
    const studentId = parseInt(req.params.id, 10);
    const { rating, comments } = req.body;

    const rateVal = parseInt(rating, 10);
    if (isNaN(rateVal) || rateVal < 1 || rateVal > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5.' });
    }

    if (!comments || comments.trim() === '') {
      return res.status(400).json({ success: false, message: 'Remarks / comments are required.' });
    }

    try {
      const faculty = await Faculty.findByUserId(userId);
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      }

      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found.' });
      }

      // Security: Enforce ownership check
      if (student.faculty_id !== faculty.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized. This student is not assigned to you.' });
      }

      // Get active internship
      const [internships] = await pool.execute(
        `SELECT internship_id FROM applications WHERE student_id = ? AND status = 'accepted' LIMIT 1`,
        [student.id]
      );
      const internshipId = internships[0] ? internships[0].internship_id : null;

      // Save feedback in database
      await Feedback.create({
        from_user_id: userId,
        to_user_id: student.user_id,
        internship_id: internshipId,
        rating: rateVal,
        comments,
        feedback_type: 'faculty_review'
      });

      // Add timeline event
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'mentor_feedback',
        title: 'Faculty Evaluation Received',
        description: `Faculty advisor submitted evaluation. Performance Rating: ${rateVal}/5. Comments: ${comments}`
      });

      return res.json({ success: true, message: 'Evaluation and performance feedback submitted successfully.' });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while submitting evaluation.' });
    }
  },

  /**
   * Export student ledger details to PDF or CSV (Security-restricted to assigned Faculty)
   */
  async exportStudentData(req, res) {
    const userId = req.session.user.id;
    const studentId = parseInt(req.params.id, 10);
    const { type } = req.params; // 'attendance' | 'reports' | 'logs' | 'timeline' | 'documents'
    const { format } = req.query; // 'pdf' | 'csv'

    const allowedTypes = ['attendance', 'reports', 'logs', 'timeline', 'documents'];
    const allowedFormats = ['pdf', 'csv'];

    if (!allowedTypes.includes(type) || !allowedFormats.includes(format)) {
      return res.status(400).json({ success: false, message: 'Invalid export type or format.' });
    }

    try {
      const faculty = await Faculty.findByUserId(userId);
      if (!faculty) {
        return res.status(404).json({ success: false, message: 'Faculty profile not found.' });
      }

      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      // Security: Enforce ownership check
      if (student.faculty_id !== faculty.id) {
        return res.status(403).json({ success: false, message: 'Access denied. This student is not assigned to you.' });
      }

      let rows = [];
      let headers = [];
      let keys = [];
      let title = '';

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
        res.setHeader('Content-Disposition', `attachment; filename=student_${studentId}_${type}_export_${Date.now()}.csv`);
        return res.send(csvString);
      } else {
        // PDF format
        const pdfBuffer = await exportHelper.generatePDF(title, student, headers, rows, type);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=student_${studentId}_${type}_export_${Date.now()}.pdf`);
        return res.send(pdfBuffer);
      }
    } catch (error) {
      console.error(`Error exporting ${type} to ${format}:`, error);
      return res.status(500).json({ success: false, message: 'Internal server error during export compilation.' });
    }
  }
};

module.exports = facultyController;

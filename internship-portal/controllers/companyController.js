/**
 * Company Controller
 * Handles company profile, dashboard analytics, intern supervision catalog, reviews, approvals, evaluations, and secure exports.
 */

'use strict';

const path = require('path');
const { pool } = require('../config/database');
const Student = require('../models/Student');
const Company = require('../models/Company');
const WeeklyReport = require('../models/WeeklyReport');
const Attendance = require('../models/Attendance');
const StudentDocument = require('../models/StudentDocument');
const TimelineEvent = require('../models/TimelineEvent');
const Feedback = require('../models/Feedback');
const DailyLog = require('../models/DailyLog');
const exportHelper = require('../helpers/exportHelper');

const companyController = {
  /**
   * Render the Company Dashboard page
   */
  getDashboard(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'company-dashboard.html'));
  },

  /**
   * Render the Company Intern supervision list page
   */
  getInternsPage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'company-interns.html'));
  },

  /**
   * Render the Company Intern Detail Review page
   */
  getInternReviewPage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'company-intern-review.html'));
  },

  /**
   * Get Company profile data
   */
  async getProfileData(req, res) {
    const userId = req.session.user.id;
    try {
      const company = await Company.findByUserId(userId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company profile not found.' });
      }
      return res.json({ success: true, company });
    } catch (error) {
      console.error('Error fetching company profile:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching profile.' });
    }
  },

  /**
   * Update Company profile data
   */
  async updateProfile(req, res) {
    const userId = req.session.user.id;
    const fields = req.body;

    try {
      const company = await Company.findByUserId(userId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company profile not found.' });
      }

      await Company.update(company.id, fields);

      return res.json({ success: true, message: 'Company profile updated successfully.' });
    } catch (error) {
      console.error('Error updating company profile:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while updating profile.' });
    }
  },

  /**
   * Get Company Dashboard Stats
   */
  async getDashboardStats(req, res) {
    const userId = req.session.user.id;
    try {
      const company = await Company.findByUserId(userId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company profile not found.' });
      }

      // 1. Total active interns
      const [internCountRows] = await pool.execute(
        `SELECT COUNT(DISTINCT s.id) AS total 
         FROM students s 
         JOIN applications a ON s.id = a.student_id 
         JOIN internships i ON a.internship_id = i.id 
         WHERE i.company_id = ? AND a.status = 'accepted'`,
        [company.id]
      );
      const totalInterns = internCountRows[0].total;

      // 2. Pending weekly reports count for this company's interns (status = 'submitted' and mentor_remarks IS NULL)
      const [pendingReportsRows] = await pool.execute(
        `SELECT COUNT(*) AS pending 
         FROM weekly_reports wr 
         JOIN students s ON wr.student_id = s.id 
         JOIN applications a ON s.id = a.student_id 
         JOIN internships i ON a.internship_id = i.id 
         WHERE i.company_id = ? AND a.status = 'accepted' AND wr.status = 'submitted' AND wr.mentor_remarks IS NULL`,
        [company.id]
      );
      const pendingReports = pendingReportsRows[0].pending;

      // 3. Pending leave approvals count
      const [pendingLeavesRows] = await pool.execute(
        `SELECT COUNT(*) AS pending 
         FROM attendance att 
         JOIN students s ON att.student_id = s.id 
         JOIN applications a ON s.id = a.student_id 
         JOIN internships i ON a.internship_id = i.id 
         WHERE i.company_id = ? AND a.status = 'accepted' AND att.status = 'leave' AND att.leave_status = 'pending'`,
        [company.id]
      );
      const pendingLeaves = pendingLeavesRows[0].pending;

      // 4. Pending document approvals count
      const [pendingDocsRows] = await pool.execute(
        `SELECT COUNT(*) AS pending 
         FROM student_documents sd 
         JOIN students s ON sd.student_id = s.id 
         JOIN applications a ON s.id = a.student_id 
         JOIN internships i ON a.internship_id = i.id 
         WHERE i.company_id = ? AND a.status = 'accepted' AND sd.status = 'pending'`,
        [company.id]
      );
      const pendingDocs = pendingDocsRows[0].pending;

      // 5. Average intern attendance rate
      const [attendanceRows] = await pool.execute(
        `SELECT 
           COUNT(CASE WHEN att.status = 'present' THEN 1 END) AS present_count,
           COUNT(att.id) AS total_count
         FROM attendance att
         JOIN students s ON att.student_id = s.id
         JOIN applications a ON s.id = a.student_id
         JOIN internships i ON a.internship_id = i.id
         WHERE i.company_id = ? AND a.status = 'accepted'`,
        [company.id]
      );
      const presentCount = attendanceRows[0].present_count || 0;
      const totalCount = attendanceRows[0].total_count || 0;
      const avgAttendance = totalCount > 0 ? parseFloat(((presentCount / totalCount) * 100).toFixed(1)) : 100.0;

      // 6. Average performance rating given by this company
      const [ratingRows] = await pool.execute(
        `SELECT AVG(rating) AS avg_rating 
         FROM feedback 
         WHERE from_user_id = ? AND feedback_type = 'company_to_student'`,
        [userId]
      );
      const avgRating = ratingRows[0].avg_rating ? parseFloat(parseFloat(ratingRows[0].avg_rating).toFixed(1)) : 0.0;

      // 7. Recent intern activities (timeline events feed)
      const [recentActivities] = await pool.execute(
        `SELECT te.*, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.roll_number
         FROM timeline_events te
         JOIN students s ON te.student_id = s.id
         JOIN applications a ON s.id = a.student_id
         JOIN internships i ON a.internship_id = i.id
         WHERE i.company_id = ? AND a.status = 'accepted'
         ORDER BY te.created_at DESC
         LIMIT 10`,
        [company.id]
      );

      // 8. Upcoming completions (internships ending in the next 30 days)
      const [upcomingCompletions] = await pool.execute(
        `SELECT s.id, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.roll_number, i.title AS internship_title, i.end_date
         FROM students s
         JOIN applications a ON s.id = a.student_id
         JOIN internships i ON a.internship_id = i.id
         WHERE i.company_id = ? AND a.status = 'accepted' AND i.end_date BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)
         ORDER BY i.end_date ASC`,
        [company.id]
      );

      // 9. Pending approvals details list for quick dashboard actions
      const [pendingReportsList] = await pool.execute(
        `SELECT wr.id, wr.week_number, wr.submitted_at, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.roll_number, 'report' AS type
         FROM weekly_reports wr
         JOIN students s ON wr.student_id = s.id
         JOIN applications a ON s.id = a.student_id
         JOIN internships i ON a.internship_id = i.id
         WHERE i.company_id = ? AND a.status = 'accepted' AND wr.status = 'submitted' AND wr.mentor_remarks IS NULL
         ORDER BY wr.submitted_at DESC
         LIMIT 5`,
        [company.id]
      );

      const [pendingLeavesList] = await pool.execute(
        `SELECT att.id, att.date, att.leave_reason, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.roll_number, 'leave' AS type
         FROM attendance att
         JOIN students s ON att.student_id = s.id
         JOIN applications a ON s.id = a.student_id
         JOIN internships i ON a.internship_id = i.id
         WHERE i.company_id = ? AND a.status = 'accepted' AND att.status = 'leave' AND att.leave_status = 'pending'
         ORDER BY att.date DESC
         LIMIT 5`,
        [company.id]
      );

      const [pendingDocsList] = await pool.execute(
        `SELECT sd.id, sd.document_type, sd.file_name, sd.uploaded_at, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.roll_number, 'document' AS type
         FROM student_documents sd
         JOIN students s ON sd.student_id = s.id
         JOIN applications a ON s.id = a.student_id
         JOIN internships i ON a.internship_id = i.id
         WHERE i.company_id = ? AND a.status = 'accepted' AND sd.status = 'pending'
         ORDER BY sd.uploaded_at DESC
         LIMIT 5`,
        [company.id]
      );

      return res.json({
        success: true,
        stats: {
          totalInterns,
          pendingReports,
          pendingLeaves,
          pendingDocs,
          avgAttendance,
          avgRating
        },
        recentActivities,
        upcomingCompletions,
        pendingApprovals: [
          ...pendingReportsList,
          ...pendingLeavesList,
          ...pendingDocsList
        ]
      });
    } catch (error) {
      console.error('Error compiling company dashboard stats:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while compiling stats.' });
    }
  },

  /**
   * Get Company Dashboard Charts Data
   */
  async getDashboardCharts(req, res) {
    const userId = req.session.user.id;
    try {
      const company = await Company.findByUserId(userId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company profile not found.' });
      }

      // 1. Intern performance rating distribution
      const [ratingStats] = await pool.execute(
        `SELECT rating, COUNT(*) AS count 
         FROM feedback 
         WHERE from_user_id = ? AND feedback_type = 'company_to_student'
         GROUP BY rating`,
        [userId]
      );

      // 2. Weekly report status distribution for active interns
      const [reportStats] = await pool.execute(
        `SELECT wr.status, COUNT(*) AS count 
         FROM weekly_reports wr 
         JOIN students s ON wr.student_id = s.id 
         JOIN applications a ON s.id = a.student_id
         JOIN internships i ON a.internship_id = i.id
         WHERE i.company_id = ? AND a.status = 'accepted'
         GROUP BY wr.status`,
        [company.id]
      );

      // 3. Department distribution of active interns
      const [deptStats] = await pool.execute(
        `SELECT s.department, COUNT(*) AS count 
         FROM students s 
         JOIN applications a ON s.id = a.student_id
         JOIN internships i ON a.internship_id = i.id
         WHERE i.company_id = ? AND a.status = 'accepted' AND s.department IS NOT NULL
         GROUP BY s.department`,
        [company.id]
      );

      return res.json({
        success: true,
        charts: {
          ratings: ratingStats,
          reports: reportStats,
          departments: deptStats
        }
      });
    } catch (error) {
      console.error('Error compiling company charts:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while compiling charts.' });
    }
  },

  /**
   * Get Assigned Interns with Pagination, Search and Filters
   */
  async getAssignedInterns(req, res) {
    const userId = req.session.user.id;
    const { department, semester, search, attendance, page = 1, limit = 10 } = req.query;

    try {
      const company = await Company.findByUserId(userId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company profile not found.' });
      }

      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const params = [company.id];

      let filterSQL = '';

      if (department) {
        filterSQL += ' AND s.department = ?';
        params.push(department);
      }

      if (semester) {
        filterSQL += ' AND s.semester = ?';
        params.push(semester);
      }

      if (search) {
        filterSQL += ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.roll_number LIKE ?)';
        const searchWild = `%${search}%`;
        params.push(searchWild, searchWild, searchWild);
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
        JOIN applications a ON s.id = a.student_id AND a.status = 'accepted'
        JOIN internships i ON a.internship_id = i.id
        WHERE i.company_id = ? ${filterSQL}
      `;

      const [countRows] = await pool.execute(countQuery, params);
      const total = countRows[0].total;

      // 2. Get Data
      const dataQuery = `
        SELECT s.*, u.email,
               i.title AS internship_title, i.start_date, i.end_date,
               (SELECT COUNT(*) FROM weekly_reports WHERE student_id = s.id AND status = 'submitted' AND mentor_remarks IS NULL) AS pending_reports_count,
               (SELECT COUNT(*) FROM attendance WHERE student_id = s.id AND status = 'present') AS present_days_count,
               (SELECT COUNT(*) FROM attendance WHERE student_id = s.id) AS total_attendance_days,
               (SELECT AVG(rating) FROM feedback WHERE to_user_id = s.user_id AND feedback_type = 'company_to_student') AS avg_rating
        FROM students s
        JOIN users u ON s.user_id = u.id
        JOIN applications a ON s.id = a.student_id AND a.status = 'accepted'
        JOIN internships i ON a.internship_id = i.id
        WHERE i.company_id = ? ${filterSQL}
        ORDER BY s.first_name ASC, s.last_name ASC
        LIMIT ? OFFSET ?
      `;

      const dataParams = [...params, String(limit), String(offset)];
      const [interns] = await pool.execute(dataQuery, dataParams);

      // Map interns to include calculated fields
      const enrichedInterns = interns.map(it => {
        const totalDays = it.total_attendance_days || 0;
        const presentDays = it.present_days_count || 0;
        const attendancePercentage = totalDays > 0 ? parseFloat(((presentDays / totalDays) * 100).toFixed(1)) : 100.0;
        const ratingVal = it.avg_rating ? parseFloat(parseFloat(it.avg_rating).toFixed(1)) : 0.0;

        return {
          ...it,
          attendancePercentage,
          avgRating: ratingVal
        };
      });

      return res.json({
        success: true,
        interns: enrichedInterns,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error('Error fetching company interns:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching interns.' });
    }
  },

  /**
   * Get complete student review dossier (strict company ownership verification)
   */
  async getInternReviewData(req, res) {
    const userId = req.session.user.id;
    const internId = parseInt(req.params.id, 10);

    try {
      const company = await Company.findByUserId(userId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company profile not found.' });
      }

      const student = await Student.findById(internId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      // Strict security boundary check: verify student has accepted application in this company
      const [verifyRows] = await pool.execute(
        `SELECT a.id 
         FROM applications a 
         JOIN internships i ON a.internship_id = i.id 
         WHERE a.student_id = ? AND a.status = 'accepted' AND i.company_id = ?`,
        [student.id, company.id]
      );

      if (verifyRows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied. This intern is not assigned to your company.' });
      }

      // 1. Fetch Internship Placement Details
      const [internshipRows] = await pool.execute(
        `SELECT i.*, c.company_name, c.contact_person, c.contact_email 
         FROM applications a
         JOIN internships i ON a.internship_id = i.id
         JOIN companies c ON i.company_id = c.id
         WHERE a.student_id = ? AND a.status = 'accepted'
         LIMIT 1`,
        [student.id]
      );
      const internship = internshipRows[0] || null;

      // 2. Fetch Attendance Logs & Stats
      const attendance = await Attendance.getAttendanceList(student.id, { sortBy: 'newest' });
      const attendanceStats = await Attendance.getStatistics(student.id);

      // 3. Fetch Daily Work Logs
      const dailyLogs = await DailyLog.getLogsList(student.id, { sortBy: 'newest' });

      // 4. Fetch Weekly Progress Reports & Stats
      const weeklyReports = await WeeklyReport.getReportsList(student.id, { sortBy: 'newest' });
      const reportStats = await WeeklyReport.getStatistics(student.id);

      // 5. Fetch Compliance Documents & Stats
      const documents = await StudentDocument.getDocumentsList(student.id, { sortBy: 'newest' });
      const docStats = await StudentDocument.getStatistics(student.id);

      // 6. Fetch Timeline Milestones
      const [timeline] = await pool.execute(
        `SELECT * FROM timeline_events WHERE student_id = ? ORDER BY event_date DESC, created_at DESC`,
        [student.id]
      );

      // 7. Fetch Faculty Feedback History (where appropriate, faculty reviews and recommendations)
      const facultyFeedback = await Feedback.getFeedbackForUser(student.user_id, 'faculty_review');

      // 8. Fetch Company Evaluation History
      const companyFeedback = await Feedback.getFeedbackForUser(student.user_id, 'company_to_student');

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
        facultyFeedback,
        companyFeedback
      });
    } catch (error) {
      console.error('Error fetching student dossier review:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while loading intern data.' });
    }
  },

  /**
   * Add company mentor remarks/review to a weekly report
   */
  async reviewWeeklyReport(req, res) {
    const userId = req.session.user.id;
    const reportId = parseInt(req.params.reportId, 10);
    const { status, remarks } = req.body; // status: 'reviewed', 'approved' or 'rejected'

    if (!['reviewed', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    if (!remarks || remarks.trim() === '') {
      return res.status(400).json({ success: false, message: 'Remarks are required.' });
    }

    try {
      const company = await Company.findByUserId(userId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company profile not found.' });
      }

      const report = await WeeklyReport.findById(reportId);
      if (!report) {
        return res.status(404).json({ success: false, message: 'Weekly report not found.' });
      }

      const student = await Student.findById(report.student_id);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found.' });
      }

      // Secure ownership check
      const [verifyRows] = await pool.execute(
        `SELECT a.id 
         FROM applications a 
         JOIN internships i ON a.internship_id = i.id 
         WHERE a.student_id = ? AND a.status = 'accepted' AND i.company_id = ?`,
        [student.id, company.id]
      );

      if (verifyRows.length === 0) {
        return res.status(403).json({ success: false, message: 'Unauthorized. This intern is not assigned to your company.' });
      }

      // Update weekly report mentor remarks and status
      // When reviewed by company, we keep status as 'submitted' or set it to 'reviewed' depending on coordinator preference
      // Here, we set the status to the one chosen by the mentor, e.g. 'reviewed' or 'approved'/'rejected'
      await pool.execute(
        `UPDATE weekly_reports 
         SET status = ?, mentor_remarks = ?, reviewed_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [status, remarks, reportId]
      );

      // Create timeline notification for student
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'weekly_reports',
        title: `Mentor Report Review: ${status.toUpperCase()}`,
        description: `Week ${report.week_number} report was reviewed by company mentor. Remarks: ${remarks}`
      });

      return res.json({ success: true, message: `Weekly report reviewed successfully and set to ${status}.` });
    } catch (error) {
      console.error('Error reviewing weekly report:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while reviewing weekly report.' });
    }
  },

  /**
   * Verify leave requests submitted by company interns
   */
  async reviewLeaveRequest(req, res) {
    const userId = req.session.user.id;
    const attendanceId = parseInt(req.params.attendanceId, 10);
    const { status, remarks } = req.body; // status: 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be approved or rejected.' });
    }

    try {
      const company = await Company.findByUserId(userId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company profile not found.' });
      }

      const attRecord = await Attendance.findById(attendanceId);
      if (!attRecord) {
        return res.status(404).json({ success: false, message: 'Attendance record not found.' });
      }

      const student = await Student.findById(attRecord.student_id);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found.' });
      }

      // Secure ownership check
      const [verifyRows] = await pool.execute(
        `SELECT a.id 
         FROM applications a 
         JOIN internships i ON a.internship_id = i.id 
         WHERE a.student_id = ? AND a.status = 'accepted' AND i.company_id = ?`,
        [student.id, company.id]
      );

      if (verifyRows.length === 0) {
        return res.status(403).json({ success: false, message: 'Unauthorized. This intern is not assigned to your company.' });
      }

      // Update attendance record status
      await pool.execute(
        `UPDATE attendance 
         SET leave_status = ?, remarks = ?, marked_by = ? 
         WHERE id = ?`,
        [status, remarks || null, userId, attendanceId]
      );

      // Create timeline event
      const dateStr = new Date(attRecord.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'attendance',
        title: `Employer Leave Review: ${status.toUpperCase()}`,
        description: `Leave request for ${dateStr} has been ${status} by company mentor. Remarks: ${remarks || 'None'}`
      });

      return res.json({ success: true, message: `Leave request has been successfully ${status}.` });
    } catch (error) {
      console.error('Error reviewing leave request:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while reviewing leave request.' });
    }
  },

  /**
   * Review compliance documents uploaded by interns
   */
  async reviewDocument(req, res) {
    const userId = req.session.user.id;
    const documentId = parseInt(req.params.documentId, 10);
    const { status, remarks } = req.body; // status: 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be approved or rejected.' });
    }

    try {
      const company = await Company.findByUserId(userId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company profile not found.' });
      }

      const doc = await StudentDocument.findById(documentId);
      if (!doc) {
        return res.status(404).json({ success: false, message: 'Document not found.' });
      }

      const student = await Student.findById(doc.student_id);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found.' });
      }

      // Secure ownership check
      const [verifyRows] = await pool.execute(
        `SELECT a.id 
         FROM applications a 
         JOIN internships i ON a.internship_id = i.id 
         WHERE a.student_id = ? AND a.status = 'accepted' AND i.company_id = ?`,
        [student.id, company.id]
      );

      if (verifyRows.length === 0) {
        return res.status(403).json({ success: false, message: 'Unauthorized. This intern is not assigned to your company.' });
      }

      // Update document
      await StudentDocument.update(documentId, { status, remarks: remarks || '' });

      // Create timeline notification
      const category = doc.document_type.replace('_', ' ').toUpperCase();
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'weekly_reports',
        title: `Employer Document Review: ${status.toUpperCase()}`,
        description: `Compliance document ${category} (${doc.file_name}) was ${status} by company mentor. Remarks: ${remarks || 'None'}`
      });

      return res.json({ success: true, message: `Compliance document has been successfully ${status}.` });
    } catch (error) {
      console.error('Error reviewing document:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while reviewing compliance document.' });
    }
  },

  /**
   * Verify and add mentor remarks to an intern's daily work log
   */
  async verifyDailyLog(req, res) {
    const userId = req.session.user.id;
    const logId = parseInt(req.params.logId, 10);
    const { remarks } = req.body;

    try {
      const company = await Company.findByUserId(userId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company profile not found.' });
      }

      const log = await pool.execute(`SELECT * FROM daily_logs WHERE id = ?`, [logId]);
      const logRecord = log[0] ? log[0][0] : null;
      if (!logRecord) {
        return res.status(404).json({ success: false, message: 'Daily work log not found.' });
      }

      const student = await Student.findById(logRecord.student_id);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found.' });
      }

      // Secure ownership check
      const [verifyRows] = await pool.execute(
        `SELECT a.id 
         FROM applications a 
         JOIN internships i ON a.internship_id = i.id 
         WHERE a.student_id = ? AND a.status = 'accepted' AND i.company_id = ?`,
        [student.id, company.id]
      );

      if (verifyRows.length === 0) {
        return res.status(403).json({ success: false, message: 'Unauthorized. This intern is not assigned to your company.' });
      }

      // Update daily log with verification remarks
      await pool.execute(
        `UPDATE daily_logs 
         SET remarks = ?, verified_by = ?, verified_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [remarks || null, userId, logId]
      );

      return res.json({ success: true, message: 'Daily work log verified successfully by mentor.' });
    } catch (error) {
      console.error('Error verifying daily log:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while verifying daily log.' });
    }
  },

  /**
   * Submit comprehensive mentor evaluation (ratings across technical, communication, professionalism, punctuality and completion recommendations)
   */
  async submitFeedback(req, res) {
    const userId = req.session.user.id;
    const studentId = parseInt(req.params.id, 10);
    const { 
      rating, comments, technical_rating, communication_rating, 
      professionalism_rating, punctuality_rating, 
      recommend_completion, recommend_certificate, is_final 
    } = req.body;

    // Validate ratings
    const ratings = [rating, technical_rating, communication_rating, professionalism_rating, punctuality_rating];
    for (const val of ratings) {
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 1 || num > 5) {
        return res.status(400).json({ success: false, message: 'All star ratings must be integers between 1 and 5.' });
      }
    }

    if (!comments || comments.trim() === '') {
      return res.status(400).json({ success: false, message: 'Detailed evaluation comments are required.' });
    }

    try {
      const company = await Company.findByUserId(userId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company profile not found.' });
      }

      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found.' });
      }

      // Secure ownership check
      const [verifyRows] = await pool.execute(
        `SELECT a.id, a.internship_id 
         FROM applications a 
         JOIN internships i ON a.internship_id = i.id 
         WHERE a.student_id = ? AND a.status = 'accepted' AND i.company_id = ?`,
        [student.id, company.id]
      );

      if (verifyRows.length === 0) {
        return res.status(403).json({ success: false, message: 'Unauthorized. This intern is not assigned to your company.' });
      }

      const internshipId = verifyRows[0].internship_id;

      // Save feedback in database
      await Feedback.create({
        from_user_id: userId,
        to_user_id: student.user_id,
        internship_id: internshipId,
        rating: parseInt(rating, 10),
        comments,
        feedback_type: 'company_to_student',
        technical_rating: parseInt(technical_rating, 10),
        communication_rating: parseInt(communication_rating, 10),
        professionalism_rating: parseInt(professionalism_rating, 10),
        punctuality_rating: parseInt(punctuality_rating, 10),
        recommend_completion: recommend_completion === 'true' || recommend_completion === true,
        recommend_certificate: recommend_certificate === 'true' || recommend_certificate === true,
        is_final: is_final === 'true' || is_final === true
      });

      // Create timeline milestones event
      const eventTitle = is_final ? 'Final Employer Evaluation Received' : 'Mentor Review Logged';
      const recommendText = recommend_completion ? 'RECOMMENDED for completion' : 'In Progress';
      await TimelineEvent.create({
        student_id: student.id,
        event_type: 'mentor_feedback',
        title: eventTitle,
        description: `Company mentor submitted performance evaluation. Overall: ${rating}/5. Technical: ${technical_rating}/5. Completion Status: ${recommendText}. Remarks: ${comments}`
      });

      // If it is a final evaluation, log a completion timeline milestone
      if (is_final === 'true' || is_final === true) {
        await TimelineEvent.create({
          student_id: student.id,
          event_type: 'completion',
          title: 'Internship Term Completed',
          description: `Employer recommended internship completion successfully. Evaluation rating: ${rating}/5.`
        });
      }

      return res.json({ success: true, message: 'Employer mentor evaluation submitted successfully.' });
    } catch (error) {
      console.error('Error submitting company feedback:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while submitting evaluation.' });
    }
  },

  /**
   * Secure PDF or CSV exports of intern ledger details (restricted to employer company)
   */
  async exportInternData(req, res) {
    const userId = req.session.user.id;
    const internId = parseInt(req.params.id, 10);
    const { type } = req.params; // 'attendance' | 'reports' | 'logs' | 'timeline' | 'documents'
    const { format } = req.query; // 'pdf' | 'csv'

    const allowedTypes = ['attendance', 'reports', 'logs', 'timeline', 'documents'];
    const allowedFormats = ['pdf', 'csv'];

    if (!allowedTypes.includes(type) || !allowedFormats.includes(format)) {
      return res.status(400).json({ success: false, message: 'Invalid export type or format.' });
    }

    try {
      const company = await Company.findByUserId(userId);
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company profile not found.' });
      }

      const student = await Student.findById(internId);
      if (!student) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }

      // Secure ownership check
      const [verifyRows] = await pool.execute(
        `SELECT a.id 
         FROM applications a 
         JOIN internships i ON a.internship_id = i.id 
         WHERE a.student_id = ? AND a.status = 'accepted' AND i.company_id = ?`,
        [student.id, company.id]
      );

      if (verifyRows.length === 0) {
        return res.status(403).json({ success: false, message: 'Access denied. This intern is not assigned to your company.' });
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
        res.setHeader('Content-Disposition', `attachment; filename=intern_${internId}_${type}_export_${Date.now()}.csv`);
        return res.send(csvString);
      } else {
        // PDF format
        const pdfBuffer = await exportHelper.generatePDF(title, student, headers, rows, type);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=intern_${internId}_${type}_export_${Date.now()}.pdf`);
        return res.send(pdfBuffer);
      }
    } catch (error) {
      console.error(`Error exporting ${type} to ${format}:`, error);
      return res.status(500).json({ success: false, message: 'Internal server error during export compilation.' });
    }
  }
};

module.exports = companyController;

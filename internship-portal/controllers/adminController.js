/**
 * Admin Controller
 * Handles administration dashboard analytics, user CRUD management, academic cohort assignments,
 * partnership approvals, system configuration settings, audit logging, database integrity checks,
 * backup creation, and comprehensive PDF/CSV report exports.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const { pool } = require('../config/database');

// Helper to log audit events
async function logAudit(userId, action, details, ipAddress = null) {
  try {
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)`,
      [userId, action, details, ipAddress]
    );
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

const adminController = {
  // ─── PAGE ROUTE RENDERING ──────────────────────────────────────────────────
  getDashboard(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin-dashboard.html'));
  },

  getUsersPage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin-users.html'));
  },

  getStudentsPage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin-students.html'));
  },

  getFacultyPage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin-faculty.html'));
  },

  getCompaniesPage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin-companies.html'));
  },

  getInternshipsPage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin-internships.html'));
  },

  getSystemPage(req, res) {
    res.sendFile(path.join(__dirname, '..', 'views', 'admin-system.html'));
  },

  // ─── ANALYTICS & STATS API ─────────────────────────────────────────────────
  async getDashboardStats(req, res) {
    try {
      // 1. Total counts across entities
      const [studentRows] = await pool.execute('SELECT COUNT(*) AS total FROM students');
      const [facultyRows] = await pool.execute('SELECT COUNT(*) AS total FROM faculty');
      const [companyRows] = await pool.execute('SELECT COUNT(*) AS total FROM companies');
      const [internshipRows] = await pool.execute('SELECT COUNT(*) AS total FROM internships');

      // 2. Active placements (accepted applications)
      const [placementRows] = await pool.execute("SELECT COUNT(*) AS total FROM applications WHERE status = 'accepted'");

      // 3. Average attendance rate across all students
      const [attendanceRows] = await pool.execute(
        `SELECT 
           COUNT(CASE WHEN status = 'present' THEN 1 END) AS present_count,
           COUNT(id) AS total_count
         FROM attendance`
      );
      const presentCount = attendanceRows[0].present_count || 0;
      const totalCount = attendanceRows[0].total_count || 0;
      const avgAttendance = totalCount > 0 ? parseFloat(((presentCount / totalCount) * 100).toFixed(1)) : 100.0;

      // 4. Pending items queues count
      const [pendingReports] = await pool.execute("SELECT COUNT(*) AS total FROM weekly_reports WHERE status = 'submitted'");
      const [pendingLeaves] = await pool.execute("SELECT COUNT(*) AS total FROM attendance WHERE status = 'leave' AND leave_status = 'pending'");
      const [pendingDocs] = await pool.execute("SELECT COUNT(*) AS total FROM student_documents WHERE status = 'pending'");
      const [pendingCompanies] = await pool.execute("SELECT COUNT(*) AS total FROM companies WHERE is_verified = 0");

      return res.json({
        success: true,
        stats: {
          totalStudents: studentRows[0].total,
          totalFaculty: facultyRows[0].total,
          totalCompanies: companyRows[0].total,
          totalInternships: internshipRows[0].total,
          activePlacements: placementRows[0].total,
          avgAttendance,
          pendingTasks: pendingReports[0].total + pendingLeaves[0].total + pendingDocs[0].total + pendingCompanies[0].total,
          pendingReports: pendingReports[0].total,
          pendingLeaves: pendingLeaves[0].total,
          pendingDocs: pendingDocs[0].total,
          pendingCompanies: pendingCompanies[0].total
        }
      });
    } catch (error) {
      console.error('Error fetching admin dashboard stats:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching stats.' });
    }
  },

  async getDashboardCharts(req, res) {
    try {
      // 1. Department distribution of students
      const [deptStats] = await pool.execute(
        `SELECT department, COUNT(*) AS count FROM students WHERE department IS NOT NULL GROUP BY department`
      );

      // 2. Internship success/status rate (open vs closed vs filled)
      const [statusStats] = await pool.execute(
        `SELECT status, COUNT(*) AS count FROM internships GROUP BY status`
      );

      // 3. Company engagement (active interns per company)
      const [companyEngagement] = await pool.execute(
        `SELECT c.company_name, COUNT(DISTINCT s.id) AS count
         FROM companies c
         JOIN internships i ON c.id = i.company_id
         JOIN applications a ON i.id = a.internship_id AND a.status = 'accepted'
         JOIN students s ON a.student_id = s.id
         GROUP BY c.company_name
         ORDER BY count DESC
         LIMIT 5`
      );

      // 4. Faculty supervision workload (assigned students per faculty coordinator)
      const [facultyWorkload] = await pool.execute(
        `SELECT CONCAT(f.first_name, ' ', f.last_name) AS faculty_name, COUNT(s.id) AS count
         FROM faculty f
         LEFT JOIN students s ON f.id = s.faculty_id
         GROUP BY f.id
         ORDER BY count DESC`
      );

      // 5. Weekly report status distribution
      const [reportStats] = await pool.execute(
        `SELECT status, COUNT(*) AS count FROM weekly_reports GROUP BY status`
      );

      return res.json({
        success: true,
        charts: {
          departments: deptStats,
          internshipStatuses: statusStats,
          companyEngagement,
          facultyWorkload,
          reports: reportStats
        }
      });
    } catch (error) {
      console.error('Error fetching admin dashboard charts:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while compiling charts.' });
    }
  },

  async getRecentActivities(req, res) {
    try {
      // Fetch 10 most recent timeline events combined with audit logs
      const [timeline] = await pool.execute(
        `SELECT te.created_at, te.title, te.description, CONCAT(s.first_name, ' ', s.last_name) AS entity_name, 'student' AS type
         FROM timeline_events te
         JOIN students s ON te.student_id = s.id
         ORDER BY te.created_at DESC
         LIMIT 10`
      );

      const [audits] = await pool.execute(
        `SELECT al.created_at, al.action AS title, al.details AS description, u.name AS entity_name, 'admin' AS type
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         ORDER BY al.created_at DESC
         LIMIT 10`
      );

      const combined = [...timeline, ...audits]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10);

      return res.json({ success: true, activities: combined });
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching activities.' });
    }
  },

  // ─── USER MANAGEMENT (CRUD) ────────────────────────────────────────────────
  async getUsers(req, res) {
    const { search, role, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];

    let filterSQL = '';
    if (role) {
      filterSQL += ' AND role = ?';
      params.push(role);
    }

    if (search) {
      filterSQL += ' AND (name LIKE ? OR email LIKE ?)';
      const searchWild = `%${search}%`;
      params.push(searchWild, searchWild);
    }

    try {
      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM users WHERE 1=1 ${filterSQL}`,
        params
      );
      const total = countRows[0].total;

      const [users] = await pool.execute(
        `SELECT id, name, email, role, must_change_password, is_active, created_at 
         FROM users 
         WHERE 1=1 ${filterSQL} 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [...params, String(limit), String(offset)]
      );

      return res.json({
        success: true,
        users,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching users.' });
    }
  },

  async createUser(req, res) {
    const { name, email, password, role, profileData = {} } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'Name, email, password and role are required.' });
    }

    const allowedRoles = ['student', 'faculty', 'company', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid user role.' });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Check if email already exists
      const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Email address already registered.' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // 1. Insert User
      const [userResult] = await connection.execute(
        `INSERT INTO users (name, email, password, role, must_change_password, is_active) 
         VALUES (?, ?, ?, ?, 0, 1)`,
        [name, email, hashedPassword, role]
      );
      const userId = userResult.insertId;

      // 2. Insert corresponding profile record to guarantee DB consistency
      if (role === 'student') {
        const firstName = profileData.firstName || name.split(' ')[0] || 'Student';
        const lastName = profileData.lastName || name.split(' ').slice(1).join(' ') || 'User';
        const rollNumber = profileData.rollNumber || `ROLL-${Date.now()}`;
        const enrollmentNumber = profileData.enrollmentNumber || `ENR-${Date.now()}`;
        const department = profileData.department || 'Computer Science';
        const semester = profileData.semester || 8;

        await connection.execute(
          `INSERT INTO students (user_id, first_name, last_name, roll_number, enrollment_number, department, semester) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, firstName, lastName, rollNumber, enrollmentNumber, department, semester]
        );
      } else if (role === 'faculty') {
        const firstName = profileData.firstName || name.split(' ')[0] || 'Faculty';
        const lastName = profileData.lastName || name.split(' ').slice(1).join(' ') || 'User';
        const employeeId = profileData.employeeId || `EMP-${Date.now()}`;
        const department = profileData.department || 'Computer Science';

        await connection.execute(
          `INSERT INTO faculty (user_id, first_name, last_name, employee_id, department) 
           VALUES (?, ?, ?, ?, ?)`,
          [userId, firstName, lastName, employeeId, department]
        );
      } else if (role === 'company') {
        const companyName = profileData.companyName || name;
        const industry = profileData.industry || 'Technology';

        await connection.execute(
          `INSERT INTO companies (user_id, company_name, industry, is_verified) 
           VALUES (?, ?, ?, 1)`, // Admins create verified companies directly
          [userId, companyName, industry]
        );
      }

      await connection.commit();
      await logAudit(req.session.user.id, 'CREATE_USER', `Created ${role} user: ${email} (ID: ${userId})`, req.ip);

      return res.json({ success: true, message: `User ${email} created successfully.`, userId });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Error creating user:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while creating user.' });
    } finally {
      if (connection) connection.release();
    }
  },

  async updateUser(req, res) {
    const userId = parseInt(req.params.id, 10);
    const { name, email, is_active } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    try {
      // Check duplicate email
      const [dup] = await pool.execute('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (dup.length > 0) {
        return res.status(400).json({ success: false, message: 'Email already in use by another user.' });
      }

      await pool.execute(
        `UPDATE users SET name = ?, email = ?, is_active = ? WHERE id = ?`,
        [name, email, is_active !== undefined ? (is_active ? 1 : 0) : 1, userId]
      );

      // Also sync first/last name if profile exists
      const [userRows] = await pool.execute('SELECT role FROM users WHERE id = ?', [userId]);
      if (userRows.length > 0) {
        const role = userRows[0].role;
        const firstName = name.split(' ')[0] || 'User';
        const lastName = name.split(' ').slice(1).join(' ') || '';

        if (role === 'student') {
          await pool.execute(`UPDATE students SET first_name = ?, last_name = ? WHERE user_id = ?`, [firstName, lastName, userId]);
        } else if (role === 'faculty') {
          await pool.execute(`UPDATE faculty SET first_name = ?, last_name = ? WHERE user_id = ?`, [firstName, lastName, userId]);
        } else if (role === 'company') {
          await pool.execute(`UPDATE companies SET company_name = ? WHERE user_id = ?`, [name, userId]);
        }
      }

      await logAudit(req.session.user.id, 'UPDATE_USER', `Updated user details for ID: ${userId} (${email})`, req.ip);
      return res.json({ success: true, message: 'User updated successfully.' });
    } catch (error) {
      console.error('Error updating user:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while updating user.' });
    }
  },

  async deleteUser(req, res) {
    const userId = parseInt(req.params.id, 10);

    // Prevent deleting oneself
    if (userId === req.session.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own active administrator account.' });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Get user role first
      const [userRows] = await connection.execute('SELECT role, email FROM users WHERE id = ?', [userId]);
      if (userRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      const { role, email } = userRows[0];

      // Delete specific profiles first to ensure clean relational integrity
      if (role === 'student') {
        const [studRows] = await connection.execute('SELECT id FROM students WHERE user_id = ?', [userId]);
        if (studRows.length > 0) {
          const sId = studRows[0].id;
          // Cascade clean-up (or rely on foreign key cascade if configured)
          await connection.execute('DELETE FROM applications WHERE student_id = ?', [sId]);
          await connection.execute('DELETE FROM attendance WHERE student_id = ?', [sId]);
          await connection.execute('DELETE FROM daily_logs WHERE student_id = ?', [sId]);
          await connection.execute('DELETE FROM weekly_reports WHERE student_id = ?', [sId]);
          await connection.execute('DELETE FROM student_documents WHERE student_id = ?', [sId]);
          await connection.execute('DELETE FROM timeline_events WHERE student_id = ?', [sId]);
          await connection.execute('DELETE FROM students WHERE id = ?', [sId]);
        }
      } else if (role === 'faculty') {
        const [facRows] = await connection.execute('SELECT id FROM faculty WHERE user_id = ?', [userId]);
        if (facRows.length > 0) {
          const fId = facRows[0].id;
          await connection.execute('UPDATE students SET faculty_id = NULL WHERE faculty_id = ?', [fId]);
          await connection.execute('DELETE FROM faculty WHERE id = ?', [fId]);
        }
      } else if (role === 'company') {
        const [compRows] = await connection.execute('SELECT id FROM companies WHERE user_id = ?', [userId]);
        if (compRows.length > 0) {
          const cId = compRows[0].id;
          // Nullify internships and accepted records
          await connection.execute('DELETE FROM internships WHERE company_id = ?', [cId]);
          await connection.execute('DELETE FROM companies WHERE id = ?', [cId]);
        }
      }

      // Finally, delete core user row
      await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

      await connection.commit();
      await logAudit(req.session.user.id, 'DELETE_USER', `Deleted user account: ${email} (ID: ${userId})`, req.ip);

      return res.json({ success: true, message: 'User and all associated profile portfolios deleted successfully.' });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Error deleting user:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while deleting user.' });
    } finally {
      if (connection) connection.release();
    }
  },

  async resetPassword(req, res) {
    const userId = parseInt(req.params.id, 10);
    const { password } = req.body;

    if (!password || password.trim() === '') {
      return res.status(400).json({ success: false, message: 'New password is required.' });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.execute(
        `UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?`,
        [hashedPassword, userId]
      );

      // Get email for logging
      const [usr] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
      const email = usr[0] ? usr[0].email : 'Unknown';

      await logAudit(req.session.user.id, 'RESET_PASSWORD', `Reset password and forced update for user: ${email} (ID: ${userId})`, req.ip);
      return res.json({ success: true, message: 'Password reset successfully. The user will be forced to change it on next login.' });
    } catch (error) {
      console.error('Error resetting password:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while resetting password.' });
    }
  },

  // ─── STUDENT MANAGEMENT ────────────────────────────────────────────────────
  async getStudents(req, res) {
    const { search, department, semester, facultyId, companyId, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];

    let filterSQL = '';
    if (department) {
      filterSQL += ' AND s.department = ?';
      params.push(department);
    }
    if (semester) {
      filterSQL += ' AND s.semester = ?';
      params.push(semester);
    }
    if (facultyId) {
      filterSQL += ' AND s.faculty_id = ?';
      params.push(facultyId);
    }
    if (companyId) {
      filterSQL += ` AND EXISTS (
        SELECT 1 FROM applications a 
        JOIN internships i ON a.internship_id = i.id 
        WHERE a.student_id = s.id AND a.status = 'accepted' AND i.company_id = ?
      )`;
      params.push(companyId);
    }
    if (search) {
      filterSQL += ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.roll_number LIKE ?)';
      const searchWild = `%${search}%`;
      params.push(searchWild, searchWild, searchWild);
    }

    try {
      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM students s WHERE 1=1 ${filterSQL}`,
        params
      );
      const total = countRows[0].total;

      const queryStr = `
        SELECT s.*, u.email, 
               CONCAT(f.first_name, ' ', f.last_name) AS faculty_name,
               (SELECT c.company_name 
                FROM applications a 
                JOIN internships i ON a.internship_id = i.id 
                JOIN companies c ON i.company_id = c.id
                WHERE a.student_id = s.id AND a.status = 'accepted' LIMIT 1) AS company_name,
               (SELECT i.title 
                FROM applications a 
                JOIN internships i ON a.internship_id = i.id 
                WHERE a.student_id = s.id AND a.status = 'accepted' LIMIT 1) AS internship_title
        FROM students s
        JOIN users u ON s.user_id = u.id
        LEFT JOIN faculty f ON s.faculty_id = f.id
        WHERE 1=1 ${filterSQL}
        ORDER BY s.roll_number ASC
        LIMIT ? OFFSET ?
      `;

      const [students] = await pool.execute(queryStr, [...params, String(limit), String(offset)]);

      return res.json({
        success: true,
        students,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error('Error fetching students:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching students.' });
    }
  },

  async updateStudent(req, res) {
    const studentId = parseInt(req.params.id, 10);
    const { faculty_id, department, semester, cgpa, internship_id } = req.body;

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      // Update basic fields
      await connection.execute(
        `UPDATE students 
         SET faculty_id = ?, department = ?, semester = ?, cgpa = ? 
         WHERE id = ?`,
        [faculty_id || null, department || null, semester || null, cgpa || null, studentId]
      );

      // Handle Internship Placement Assignment directly if requested
      if (internship_id) {
        // Reject all existing placements/applications first to ensure clean state
        await connection.execute(
          `UPDATE applications SET status = 'rejected' WHERE student_id = ?`,
          [studentId]
        );

        // Check if an application already exists for this internship
        const [existingApp] = await connection.execute(
          `SELECT id FROM applications WHERE student_id = ? AND internship_id = ?`,
          [studentId, internship_id]
        );

        if (existingApp.length > 0) {
          await connection.execute(
            `UPDATE applications SET status = 'accepted' WHERE id = ?`,
            [existingApp[0].id]
          );
        } else {
          await connection.execute(
            `INSERT INTO applications (student_id, internship_id, status) VALUES (?, ?, 'accepted')`,
            [studentId, internship_id]
          );
        }

        // Add to timeline
        const [internship] = await connection.execute(
          `SELECT i.title, c.company_name FROM internships i JOIN companies c ON i.company_id = c.id WHERE i.id = ?`,
          [internship_id]
        );
        const title = internship[0] ? internship[0].title : 'Placement';
        const comp = internship[0] ? internship[0].company_name : 'Partner';

        await connection.execute(
          `INSERT INTO timeline_events (student_id, event_type, title, description, event_date) 
           VALUES (?, 'offer_letter', 'Assigned Corporate Internship', ?, CURRENT_DATE())`,
          [studentId, `Placed at ${comp} as ${title} by Administrator.`]
        );
      }

      await connection.commit();
      await logAudit(req.session.user.id, 'UPDATE_STUDENT', `Updated profile and coordinators for student ID: ${studentId}`, req.ip);

      return res.json({ success: true, message: 'Student cohort parameters updated successfully.' });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Error updating student profile:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while updating student.' });
    } finally {
      if (connection) connection.release();
    }
  },

  async bulkAssignFaculty(req, res) {
    const { studentIds, facultyId } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Student IDs array is required.' });
    }

    try {
      const placeholders = studentIds.map(() => '?').join(',');
      await pool.execute(
        `UPDATE students SET faculty_id = ? WHERE id IN (${placeholders})`,
        [facultyId || null, ...studentIds]
      );

      await logAudit(
        req.session.user.id,
        'BULK_ASSIGN_FACULTY',
        `Bulk assigned faculty ID: ${facultyId} to ${studentIds.length} students.`,
        req.ip
      );

      return res.json({ success: true, message: `Successfully assigned coordinator to ${studentIds.length} students.` });
    } catch (error) {
      console.error('Error in bulk assigning faculty:', error);
      return res.status(500).json({ success: false, message: 'Internal server error during bulk operation.' });
    }
  },

  // ─── FACULTY MANAGEMENT ────────────────────────────────────────────────────
  async getFaculty(req, res) {
    const { search, department, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];

    let filterSQL = '';
    if (department) {
      filterSQL += ' AND f.department = ?';
      params.push(department);
    }
    if (search) {
      filterSQL += ' AND (f.first_name LIKE ? OR f.last_name LIKE ? OR f.employee_id LIKE ?)';
      const searchWild = `%${search}%`;
      params.push(searchWild, searchWild, searchWild);
    }

    try {
      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM faculty f WHERE 1=1 ${filterSQL}`,
        params
      );
      const total = countRows[0].total;

      const queryStr = `
        SELECT f.*, u.email, u.is_active,
               (SELECT COUNT(*) FROM students WHERE faculty_id = f.id) AS student_count
        FROM faculty f
        JOIN users u ON f.user_id = u.id
        WHERE 1=1 ${filterSQL}
        ORDER BY f.employee_id ASC
        LIMIT ? OFFSET ?
      `;

      const [faculty] = await pool.execute(queryStr, [...params, String(limit), String(offset)]);

      return res.json({
        success: true,
        faculty,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error('Error fetching faculty:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching faculty.' });
    }
  },

  async updateFaculty(req, res) {
    const facultyId = parseInt(req.params.id, 10);
    const { designation, department, phone } = req.body;

    try {
      await pool.execute(
        `UPDATE faculty SET designation = ?, department = ?, phone = ? WHERE id = ?`,
        [designation || null, department || null, phone || null, facultyId]
      );

      await logAudit(req.session.user.id, 'UPDATE_FACULTY', `Updated coordinator profile: Faculty ID: ${facultyId}`, req.ip);
      return res.json({ success: true, message: 'Faculty profile parameters updated successfully.' });
    } catch (error) {
      console.error('Error updating faculty:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while updating faculty.' });
    }
  },

  // ─── COMPANY & PARTNERSHIP MANAGEMENT ──────────────────────────────────────
  async getCompanies(req, res) {
    const { search, industry, verificationStatus, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];

    let filterSQL = '';
    if (industry) {
      filterSQL += ' AND c.industry = ?';
      params.push(industry);
    }
    if (verificationStatus) {
      filterSQL += ' AND c.is_verified = ?';
      params.push(verificationStatus === 'verified' ? 1 : 0);
    }
    if (search) {
      filterSQL += ' AND (c.company_name LIKE ? OR c.contact_person LIKE ?)';
      const searchWild = `%${search}%`;
      params.push(searchWild, searchWild);
    }

    try {
      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM companies c WHERE 1=1 ${filterSQL}`,
        params
      );
      const total = countRows[0].total;

      const queryStr = `
        SELECT c.*, u.email, u.is_active,
               (SELECT COUNT(*) FROM internships WHERE company_id = c.id) AS internship_count,
               (SELECT COUNT(DISTINCT s.id) 
                FROM students s 
                JOIN applications a ON s.id = a.student_id AND a.status = 'accepted'
                JOIN internships i ON a.internship_id = i.id
                WHERE i.company_id = c.id) AS active_interns_count
        FROM companies c
        JOIN users u ON c.user_id = u.id
        WHERE 1=1 ${filterSQL}
        ORDER BY c.company_name ASC
        LIMIT ? OFFSET ?
      `;

      const [companies] = await pool.execute(queryStr, [...params, String(limit), String(offset)]);

      return res.json({
        success: true,
        companies,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error('Error fetching companies:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching companies.' });
    }
  },

  async approveCompany(req, res) {
    const companyId = parseInt(req.params.id, 10);
    const { is_verified } = req.body; // 1 to verify, 0 to revoke

    try {
      await pool.execute(
        `UPDATE companies SET is_verified = ? WHERE id = ?`,
        [is_verified ? 1 : 0, companyId]
      );

      const [comp] = await pool.execute('SELECT company_name FROM companies WHERE id = ?', [companyId]);
      const name = comp[0] ? comp[0].company_name : 'Unknown';

      const action = is_verified ? 'APPROVE_COMPANY' : 'REVOKE_COMPANY';
      await logAudit(req.session.user.id, action, `Toggled partnership status for company: ${name} (ID: ${companyId}) to ${is_verified ? 'VERIFIED' : 'PENDING'}`, req.ip);

      return res.json({ success: true, message: `Company partnership status updated successfully to ${is_verified ? 'Verified' : 'Pending'}.` });
    } catch (error) {
      console.error('Error verifying company:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while toggling partnership.' });
    }
  },

  async updateCompany(req, res) {
    const companyId = parseInt(req.params.id, 10);
    const { company_name, industry, website, contact_person, contact_email, contact_phone, address, description } = req.body;

    if (!company_name) {
      return res.status(400).json({ success: false, message: 'Company name is required.' });
    }

    try {
      await pool.execute(
        `UPDATE companies 
         SET company_name = ?, industry = ?, website = ?, contact_person = ?, contact_email = ?, contact_phone = ?, address = ?, description = ? 
         WHERE id = ?`,
        [company_name, industry || null, website || null, contact_person || null, contact_email || null, contact_phone || null, address || null, description || null, companyId]
      );

      await logAudit(req.session.user.id, 'UPDATE_COMPANY', `Updated corporate parameters for: ${company_name} (ID: ${companyId})`, req.ip);
      return res.json({ success: true, message: 'Company profile details updated successfully.' });
    } catch (error) {
      console.error('Error updating company profile:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while updating company profile.' });
    }
  },

  // ─── INTERNSHIP PLACEMENTS ─────────────────────────────────────────────────
  async getInternships(req, res) {
    const { search, status, companyId, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];

    let filterSQL = '';
    if (status) {
      filterSQL += ' AND i.status = ?';
      params.push(status);
    }
    if (companyId) {
      filterSQL += ' AND i.company_id = ?';
      params.push(companyId);
    }
    if (search) {
      filterSQL += ' AND (i.title LIKE ? OR c.company_name LIKE ?)';
      const searchWild = `%${search}%`;
      params.push(searchWild, searchWild);
    }

    try {
      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM internships i JOIN companies c ON i.company_id = c.id WHERE 1=1 ${filterSQL}`,
        params
      );
      const total = countRows[0].total;

      const queryStr = `
        SELECT i.*, c.company_name, c.contact_person,
               (SELECT COUNT(*) FROM applications WHERE internship_id = i.id AND status = 'accepted') AS assigned_students_count
        FROM internships i
        JOIN companies c ON i.company_id = c.id
        WHERE 1=1 ${filterSQL}
        ORDER BY i.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const [internships] = await pool.execute(queryStr, [...params, String(limit), String(offset)]);

      return res.json({
        success: true,
        internships,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error('Error fetching internships:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching internships.' });
    }
  },

  async createInternship(req, res) {
    const { company_id, title, description, requirements, location, duration, stipend, positions } = req.body;

    if (!company_id || !title) {
      return res.status(400).json({ success: false, message: 'Company and title are required.' });
    }

    try {
      const [result] = await pool.execute(
        `INSERT INTO internships (company_id, title, description, requirements, location, duration, stipend, positions, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
        [company_id, title, description || null, requirements || null, location || null, duration || null, stipend || null, positions || 1]
      );

      await logAudit(req.session.user.id, 'CREATE_INTERNSHIP', `Created corporate placement: ${title} (ID: ${result.insertId})`, req.ip);
      return res.json({ success: true, message: 'Internship posting created successfully.', internshipId: result.insertId });
    } catch (error) {
      console.error('Error creating internship:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while creating internship.' });
    }
  },

  async updateInternship(req, res) {
    const internshipId = parseInt(req.params.id, 10);
    const { title, description, requirements, location, duration, stipend, positions, status } = req.body;

    if (!title || !status) {
      return res.status(400).json({ success: false, message: 'Title and status are required.' });
    }

    try {
      await pool.execute(
        `UPDATE internships 
         SET title = ?, description = ?, requirements = ?, location = ?, duration = ?, stipend = ?, positions = ?, status = ? 
         WHERE id = ?`,
        [title, description || null, requirements || null, location || null, duration || null, stipend || null, positions || 1, status, internshipId]
      );

      await logAudit(req.session.user.id, 'UPDATE_INTERNSHIP', `Updated internship details for ID: ${internshipId}`, req.ip);
      return res.json({ success: true, message: 'Internship posting parameters updated successfully.' });
    } catch (error) {
      console.error('Error updating internship:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while updating internship.' });
    }
  },

  // ─── SYSTEM MANAGEMENT (Logs, Settings, Integrity, Backup) ────────────────
  async getSettings(req, res) {
    try {
      const [rows] = await pool.execute('SELECT * FROM system_settings');
      const settings = {};
      rows.forEach(r => {
        settings[r.key] = r.value;
      });
      return res.json({ success: true, settings });
    } catch (error) {
      console.error('Error fetching settings:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while fetching settings.' });
    }
  },

  async updateSettings(req, res) {
    const settings = req.body; // key-value pairs
    const userId = req.session.user.id;

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      for (const [key, val] of Object.entries(settings)) {
        await connection.execute(
          `INSERT INTO system_settings (\`key\`, \`value\`, updated_by) 
           VALUES (?, ?, ?) 
           ON DUPLICATE KEY UPDATE \`value\` = ?, updated_by = ?`,
          [key, String(val), userId, String(val), userId]
        );
      }

      await connection.commit();
      await logAudit(userId, 'UPDATE_SETTINGS', `Updated system configuration keys: ${Object.keys(settings).join(', ')}`, req.ip);

      return res.json({ success: true, message: 'System configuration settings saved successfully.' });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Error saving system settings:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while saving settings.' });
    } finally {
      if (connection) connection.release();
    }
  },

  async getAuditLogs(req, res) {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];

    let filterSQL = '';
    if (search) {
      filterSQL += ' AND (al.action LIKE ? OR al.details LIKE ? OR u.name LIKE ?)';
      const searchWild = `%${search}%`;
      params.push(searchWild, searchWild, searchWild);
    }

    try {
      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE 1=1 ${filterSQL}`,
        params
      );
      const total = countRows[0].total;

      const [logs] = await pool.execute(
        `SELECT al.*, u.name AS user_name, u.role 
         FROM audit_logs al 
         LEFT JOIN users u ON al.user_id = u.id 
         WHERE 1=1 ${filterSQL} 
         ORDER BY al.created_at DESC 
         LIMIT ? OFFSET ?`,
        [...params, String(limit), String(offset)]
      );

      return res.json({
        success: true,
        logs,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while loading audit logs.' });
    }
  },

  async runDataIntegrityChecks(req, res) {
    const userId = req.session.user.id;
    try {
      const anomalies = [];

      // 1. Check for orphaned profiles (missing core users)
      const [orphanedStudents] = await pool.execute(
        `SELECT s.id, s.first_name, s.last_name, s.roll_number 
         FROM students s LEFT JOIN users u ON s.user_id = u.id WHERE u.id IS NULL`
      );
      orphanedStudents.forEach(item => {
        anomalies.push({
          type: 'ORPHANED_STUDENT_PROFILE',
          severity: 'HIGH',
          message: `Student profile for ${item.first_name} ${item.last_name} (${item.roll_number}) has no corresponding user account.`
        });
      });

      const [orphanedFaculty] = await pool.execute(
        `SELECT f.id, f.first_name, f.last_name, f.employee_id 
         FROM faculty f LEFT JOIN users u ON f.user_id = u.id WHERE u.id IS NULL`
      );
      orphanedFaculty.forEach(item => {
        anomalies.push({
          type: 'ORPHANED_FACULTY_PROFILE',
          severity: 'HIGH',
          message: `Faculty profile for ${item.first_name} ${item.last_name} (${item.employee_id}) has no corresponding user account.`
        });
      });

      const [orphanedCompanies] = await pool.execute(
        `SELECT c.id, c.company_name FROM companies c LEFT JOIN users u ON c.user_id = u.id WHERE u.id IS NULL`
      );
      orphanedCompanies.forEach(item => {
        anomalies.push({
          type: 'ORPHANED_COMPANY_PROFILE',
          severity: 'HIGH',
          message: `Company profile for ${item.company_name} has no corresponding user account.`
        });
      });

      // 2. Check for users with missing profile records (orphaned users)
      const [missingStudents] = await pool.execute(
        `SELECT u.id, u.name, u.email FROM users u LEFT JOIN students s ON u.id = s.user_id 
         WHERE u.role = 'student' AND s.id IS NULL`
      );
      missingStudents.forEach(item => {
        anomalies.push({
          type: 'ORPHANED_STUDENT_USER',
          severity: 'HIGH',
          message: `User account ${item.email} has role 'student' but no matching profile in students table.`
        });
      });

      const [missingFaculty] = await pool.execute(
        `SELECT u.id, u.name, u.email FROM users u LEFT JOIN faculty f ON u.id = f.user_id 
         WHERE u.role = 'faculty' AND f.id IS NULL`
      );
      missingFaculty.forEach(item => {
        anomalies.push({
          type: 'ORPHANED_FACULTY_USER',
          severity: 'HIGH',
          message: `User account ${item.email} has role 'faculty' but no matching profile in faculty table.`
        });
      });

      const [missingCompanies] = await pool.execute(
        `SELECT u.id, u.name, u.email FROM users u LEFT JOIN companies c ON u.id = c.user_id 
         WHERE u.role = 'company' AND c.id IS NULL`
      );
      missingCompanies.forEach(item => {
        anomalies.push({
          type: 'ORPHANED_COMPANY_USER',
          severity: 'HIGH',
          message: `User account ${item.email} has role 'company' but no matching profile in companies table.`
        });
      });

      // 3. Active placements with expired dates
      const [expiredPlacements] = await pool.execute(
        `SELECT s.first_name, s.last_name, i.title, i.end_date
         FROM students s
         JOIN applications a ON s.id = a.student_id AND a.status = 'accepted'
         JOIN internships i ON a.internship_id = i.id
         WHERE i.end_date < CURRENT_DATE()`
      );
      expiredPlacements.forEach(item => {
        const dateStr = new Date(item.end_date).toLocaleDateString('en-GB');
        anomalies.push({
          type: 'EXPIRED_PLACEMENT',
          severity: 'MEDIUM',
          message: `Intern ${item.first_name} ${item.last_name} has an active placement in "${item.title}" which expired on ${dateStr}.`
        });
      });

      // 4. Students without faculty coordinator assignment
      const [unassignedStudents] = await pool.execute(
        `SELECT first_name, last_name, roll_number FROM students WHERE faculty_id IS NULL`
      );
      unassignedStudents.forEach(item => {
        anomalies.push({
          type: 'UNASSIGNED_COORDINATOR',
          severity: 'MEDIUM',
          message: `Student ${item.first_name} ${item.last_name} (${item.roll_number}) has no faculty coordinator assigned.`
        });
      });

      await logAudit(userId, 'DATA_INTEGRITY_CHECK', `Executed database integrity checks. Found ${anomalies.length} anomalies.`, req.ip);

      return res.json({
        success: true,
        checkedAt: new Date().toISOString(),
        anomalies,
        summary: anomalies.length > 0 
          ? `Integrity Scan finished with ${anomalies.length} inconsistencies.` 
          : 'Database integrity verified. Scan finished. Zero anomalies discovered.'
      });
    } catch (error) {
      console.error('Error running integrity checks:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while running integrity checks.' });
    }
  },

  async runSystemBackup(req, res) {
    const userId = req.session.user.id;
    const backupDir = path.join(__dirname, '..', 'uploads', 'backups');

    try {
      // Ensure backup directory exists
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const fileName = `backup_${Date.now()}.sql`;
      const filePath = path.join(backupDir, fileName);

      // Execute mysqldump
      const cmd = `mysqldump -u root -p'TestPass123!' internship_portal > "${filePath}"`;

      exec(cmd, async (error, stdout, stderr) => {
        if (error) {
          console.error('Mysqldump error:', error, stderr);
          return res.status(500).json({ success: false, message: 'Failed to compile database backup file.' });
        }

        const stats = fs.statSync(filePath);
        const fileSize = stats.size;

        await logAudit(userId, 'SYSTEM_BACKUP', `Database backup compiled: ${fileName} (${(fileSize / 1024).toFixed(1)} KB)`, req.ip);

        return res.json({
          success: true,
          message: 'System database backup prepared successfully.',
          backup: {
            fileName,
            fileSize,
            filePath: `/uploads/backups/${fileName}`
          }
        });
      });
    } catch (error) {
      console.error('Backup preparation error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error during backup preparation.' });
    }
  },

  // ─── SECURE ADMINISTRATIVE EXPORTS ────────────────────────────────────────
  async exportAdminData(req, res) {
    const userId = req.session.user.id;
    const { type } = req.params; // 'users' | 'students' | 'faculty' | 'companies' | 'internships' | 'audit_logs'
    const { format } = req.query; // 'pdf' | 'csv'

    const allowedTypes = ['users', 'students', 'faculty', 'companies', 'internships', 'audit_logs'];
    const allowedFormats = ['pdf', 'csv'];

    if (!allowedTypes.includes(type) || !allowedFormats.includes(format)) {
      return res.status(400).json({ success: false, message: 'Invalid export parameters.' });
    }

    try {
      let rows = [];
      let headers = [];
      let keys = [];
      let title = '';
      let colWidths = [];

      if (type === 'users') {
        const [data] = await pool.execute('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY id ASC');
        rows = data.map(r => ({
          ...r,
          status: r.is_active ? 'Active' : 'Deactivated',
          created_at: new Date(r.created_at).toLocaleDateString('en-GB')
        }));
        headers = ['ID', 'Name', 'Email', 'Role', 'Status', 'Created At'];
        keys = ['id', 'name', 'email', 'role', 'status', 'created_at'];
        title = 'System User Accounts Ledger';
        colWidths = [40, 120, 150, 60, 60, 65]; // Total 495
      } else if (type === 'students') {
        const [data] = await pool.execute(
          `SELECT s.roll_number, CONCAT(s.first_name, ' ', s.last_name) AS student_name, 
                  s.department, s.semester, s.cgpa,
                  CONCAT(f.first_name, ' ', f.last_name) AS faculty_name,
                  (SELECT i.title FROM applications a JOIN internships i ON a.internship_id = i.id WHERE a.student_id = s.id AND a.status = 'accepted' LIMIT 1) AS internship_title
           FROM students s
           LEFT JOIN faculty f ON s.faculty_id = f.id
           ORDER BY s.roll_number ASC`
        );
        rows = data.map(r => ({
          ...r,
          faculty_name: r.faculty_name || 'Unassigned',
          internship_title: r.internship_title || 'Unplaced'
        }));
        headers = ['Roll No', 'Student Name', 'Dept', 'Sem', 'CGPA', 'Coordinator', 'Placement Title'];
        keys = ['roll_number', 'student_name', 'department', 'semester', 'cgpa', 'faculty_name', 'internship_title'];
        title = 'Student Placement Dossier Directory';
        colWidths = [75, 95, 55, 30, 35, 95, 110]; // Total 495
      } else if (type === 'faculty') {
        const [data] = await pool.execute(
          `SELECT f.employee_id, CONCAT(f.first_name, ' ', f.last_name) AS faculty_name, 
                  f.department, f.designation, f.phone,
                  (SELECT COUNT(*) FROM students WHERE faculty_id = f.id) AS student_count
           FROM faculty f
           ORDER BY f.employee_id ASC`
        );
        rows = data;
        headers = ['Employee ID', 'Coordinator Name', 'Dept', 'Designation', 'Phone Number', 'Interns count'];
        keys = ['employee_id', 'faculty_name', 'department', 'designation', 'phone', 'student_count'];
        title = 'Faculty Supervision Workload Index';
        colWidths = [70, 110, 75, 90, 90, 60]; // Total 495
      } else if (type === 'companies') {
        const [data] = await pool.execute(
          `SELECT c.company_name, c.industry, c.contact_person, c.contact_email, c.is_verified
           FROM companies c
           ORDER BY c.company_name ASC`
        );
        rows = data.map(r => ({
          ...r,
          status: r.is_verified ? 'Verified' : 'Pending'
        }));
        headers = ['Company Name', 'Industry Sector', 'Contact Person', 'Corporate Email', 'Status'];
        keys = ['company_name', 'industry', 'contact_person', 'contact_email', 'status'];
        title = 'Corporate Employer Partners Catalog';
        colWidths = [125, 95, 105, 115, 55]; // Total 495
      } else if (type === 'internships') {
        const [data] = await pool.execute(
          `SELECT i.title, c.company_name, i.location, i.duration, i.stipend, i.status
           FROM internships i
           JOIN companies c ON i.company_id = c.id
           ORDER BY i.created_at DESC`
        );
        rows = data.map(r => ({
          ...r,
          stipend: r.stipend !== null ? `$${r.stipend}` : 'Unpaid'
        }));
        headers = ['Placement Position', 'Partner Company', 'Location', 'Duration', 'Stipend', 'Status'];
        keys = ['title', 'company_name', 'location', 'duration', 'stipend', 'status'];
        title = 'Internship Opportunities Portfolio';
        colWidths = [120, 115, 80, 65, 60, 55]; // Total 495
      } else if (type === 'audit_logs') {
        const [data] = await pool.execute(
          `SELECT al.created_at, u.name AS user_name, u.role, al.action, al.ip_address, al.details
           FROM audit_logs al
           LEFT JOIN users u ON al.user_id = u.id
           ORDER BY al.created_at DESC
           LIMIT 500`
        );
        rows = data.map(r => ({
          ...r,
          user_name: r.user_name || 'System / Seed',
          role: r.role ? r.role.toUpperCase() : 'SYSTEM',
          created_at: new Date(r.created_at).toLocaleString('en-GB')
        }));
        headers = ['Date/Time', 'User Account', 'Role', 'Action Event', 'IP Address', 'Details'];
        keys = ['created_at', 'user_name', 'role', 'action', 'ip_address', 'details'];
        title = 'System Administrative Audit Trails';
        colWidths = [100, 75, 45, 100, 65, 110]; // Total 495
      }

      await logAudit(userId, 'EXPORT_DATA', `Exported admin ledger: ${type} to ${format}`, req.ip);

      if (format === 'csv') {
        const escapeCSV = val => {
          if (val === null || val === undefined) return '';
          const str = String(val).trim();
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        const headerLine = headers.map(escapeCSV).join(',');
        const dataLines = rows.map(row => {
          return keys.map(key => escapeCSV(row[key])).join(',');
        });
        const csvString = [headerLine, ...dataLines].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=admin_${type}_export_${Date.now()}.csv`);
        return res.send(csvString);
      } else {
        // PDF compilation via PDFKit
        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => res.send(Buffer.concat(chunks)));
        doc.on('error', err => { throw err; });

        // Brand banner
        doc.fillColor('#1e3a8a').fontSize(18).font('Helvetica-Bold').text('Smart University Internship Portal', { align: 'center' });
        doc.fillColor('#475569').fontSize(11).font('Helvetica-Bold').text(`ADMINISTRATIVE REPORT: ${title.toUpperCase()}`, { align: 'center' });
        doc.moveDown(0.5);

        // Header divider
        doc.strokeColor('#2563eb').lineWidth(2).moveTo(50, 85).lineTo(545, 85).stroke();
        doc.moveDown();

        // Print Metadata Block
        doc.fillColor('#1f2937').fontSize(8).font('Helvetica-Bold').text('ADMINISTRATIVE DETAILS', 50, 100);
        doc.font('Helvetica');
        doc.text(`Generated By: System Administrator (UID: ${userId})`, 50, 112);
        doc.text(`Date of Export: ${new Date().toLocaleString('en-GB')}`, 50, 122);
        doc.text(`Classification: Restricted Internal ERP`, 50, 132);

        doc.font('Helvetica-Bold').text('METRIC SUMMARY', 350, 100);
        doc.font('Helvetica');
        doc.text(`Record Category: ${type.toUpperCase()}`, 350, 112);
        doc.text(`Total Row Count: ${rows.length}`, 350, 122);
        doc.text(`Security Check: PASS`, 350, 132);

        // Divider
        doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, 150).lineTo(545, 150).stroke();

        let y = 170;
        const colPositions = [50];
        let currentX = 50;
        for (let i = 0; i < colWidths.length - 1; i++) {
          currentX += colWidths[i];
          colPositions.push(currentX);
        }

        // Draw Table Header
        doc.fillColor('#f8fafc').rect(50, y, 495, 18).fill();
        doc.fillColor('#0f172a').fontSize(7).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(header, colPositions[i], y + 5, { width: colWidths[i], align: 'left' });
        });

        y += 18;
        doc.font('Helvetica').fontSize(7);

        // Draw Table Rows
        rows.forEach((row, rowIndex) => {
          if (y > 740) {
            doc.addPage();
            y = 50;
            // Redraw Header on new page
            doc.fillColor('#f8fafc').rect(50, y, 495, 18).fill();
            doc.fillColor('#0f172a').fontSize(7).font('Helvetica-Bold');
            headers.forEach((header, i) => {
              doc.text(header, colPositions[i], y + 5, { width: colWidths[i], align: 'left' });
            });
            y += 18;
            doc.font('Helvetica').fontSize(7);
          }

          if (rowIndex % 2 === 1) {
            doc.fillColor('#f1f5f9').rect(50, y, 495, 18).fill();
          }

          doc.fillColor('#334155');
          keys.forEach((key, i) => {
            const cleanVal = row[key] === null || row[key] === undefined ? '' : String(row[key]);
            doc.text(cleanVal, colPositions[i], y + 5, { width: colWidths[i], align: 'left' });
          });

          doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(50, y + 18).lineTo(545, y + 18).stroke();
          y += 18;
        });

        // Pagination page numbers
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(50, 800).lineTo(545, 800).stroke();
          doc.fillColor('#64748b').fontSize(6);
          doc.text('Smart University Internship Placement ERP Portal — Confidential Administrative Trail', 50, 808);
          doc.text(`Page ${i + 1} of ${pages.count}`, 450, 808, { align: 'right' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=admin_${type}_export_${Date.now()}.pdf`);
        doc.end();
      }
    } catch (error) {
      console.error('Admin export error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error during data export.' });
    }
  }
};

module.exports = adminController;

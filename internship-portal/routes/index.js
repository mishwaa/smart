/**
 * Index Routes
 * Public-facing page routes, authentication endpoints, and student experience routes
 */

'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const indexController = require('../controllers/indexController');
const authController = require('../controllers/authController');
const studentController = require('../controllers/studentController');
const facultyController = require('../controllers/facultyController');
const companyController = require('../controllers/companyController');
const adminController = require('../controllers/adminController');
const { requireAuth, requireAdmin, requireFaculty, requireCompany, requireStudent, isGuest } = require('../middleware/auth');
const { uploadProfilePhoto, uploadStudentDocument } = require('../config/upload');

// ─── Public Routes ───────────────────────────────────────────────────────────
router.get('/', indexController.getHomePage);
router.get('/health', indexController.healthCheck);

// ─── Guest-Only Authentication Routes ────────────────────────────────────────
router.get('/login', isGuest, authController.getLoginPage);
router.post('/login', isGuest, authController.login);

// ─── Authenticated General Routes ────────────────────────────────────────────
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

router.get('/change-password', requireAuth, authController.getChangePasswordPage);
router.post('/change-password', requireAuth, authController.changePassword);

// ─── Role-Specific Dashboard & Page Modules ──────────────────────────────────
// Admin Portal Views
router.get('/admin/dashboard', requireAuth, requireAdmin, adminController.getDashboard);
router.get('/admin/users', requireAuth, requireAdmin, adminController.getUsersPage);
router.get('/admin/students', requireAuth, requireAdmin, adminController.getStudentsPage);
router.get('/admin/faculty', requireAuth, requireAdmin, adminController.getFacultyPage);
router.get('/admin/companies', requireAuth, requireAdmin, adminController.getCompaniesPage);
router.get('/admin/internships', requireAuth, requireAdmin, adminController.getInternshipsPage);
router.get('/admin/system', requireAuth, requireAdmin, adminController.getSystemPage);

// Faculty Portal Views
router.get('/faculty/dashboard', requireAuth, requireFaculty, facultyController.getDashboard);
router.get('/faculty/students', requireAuth, requireFaculty, facultyController.getStudentsPage);
router.get('/faculty/students/:id/review', requireAuth, requireFaculty, facultyController.getStudentReviewPage);

// Company Portal Views
router.get('/company/dashboard', requireAuth, requireCompany, companyController.getDashboard);
router.get('/company/interns', requireAuth, requireCompany, companyController.getInternsPage);
router.get('/company/interns/:id/review', requireAuth, requireCompany, companyController.getInternReviewPage);

// Student Portal Routes
router.get('/student/dashboard', requireAuth, requireStudent, studentController.getDashboard);
router.get('/student/profile', requireAuth, requireStudent, studentController.getProfilePage);
router.get('/student/internship', requireAuth, requireStudent, studentController.getInternshipPage);
router.get('/student/attendance', requireAuth, requireStudent, studentController.getAttendancePage);
router.get('/student/reports', requireAuth, requireStudent, studentController.getReportsPage);
router.get('/student/documents', requireAuth, requireStudent, studentController.getDocumentsPage);

// ─── Authentication API Endpoints ───────────────────────────────────────────
router.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      name: req.user.name || req.session.user.name,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// ─── Student Portal API Endpoints ───────────────────────────────────────────
router.get('/api/student/profile', requireAuth, requireStudent, studentController.getProfileData);
router.post('/api/student/profile', requireAuth, requireStudent, studentController.updateProfile);
router.post('/api/student/profile/photo', requireAuth, requireStudent, uploadProfilePhoto.single('profilePhoto'), studentController.uploadPhoto);
router.get('/api/student/internship', requireAuth, requireStudent, studentController.getInternshipData);

// Attendance & Leave API
router.get('/api/student/attendance', requireAuth, requireStudent, studentController.getAttendanceData);
router.post('/api/student/attendance/check-in', requireAuth, requireStudent, studentController.checkIn);
router.post('/api/student/attendance/check-out', requireAuth, requireStudent, studentController.checkOut);
router.post('/api/student/attendance/leave', requireAuth, requireStudent, studentController.requestLeave);

// Daily Logs API
router.get('/api/student/logs', requireAuth, requireStudent, studentController.getDailyLogs);
router.post('/api/student/logs', requireAuth, requireStudent, studentController.submitDailyLog);

// Weekly Reports API
router.get('/api/student/reports', requireAuth, requireStudent, studentController.getWeeklyReports);
router.post('/api/student/reports', requireAuth, requireStudent, studentController.createWeeklyReport);
router.put('/api/student/reports/:id', requireAuth, requireStudent, studentController.updateWeeklyReport);
router.delete('/api/student/reports/:id', requireAuth, requireStudent, studentController.deleteWeeklyReport);
router.post('/api/student/reports/:id/submit', requireAuth, requireStudent, studentController.submitWeeklyReport);

// Document Center API
router.get('/api/student/documents', requireAuth, requireStudent, studentController.getDocuments);
router.post('/api/student/documents', requireAuth, requireStudent, uploadStudentDocument.single('document'), studentController.uploadDocument);
router.get('/api/student/documents/:id/download', requireAuth, requireStudent, studentController.downloadDocument);
router.delete('/api/student/documents/:id', requireAuth, requireStudent, studentController.deleteDocument);
router.post('/api/student/documents/:id/replace', requireAuth, requireStudent, uploadStudentDocument.single('document'), studentController.replaceDocument);

// Timeline & Progress API
router.get('/api/student/timeline', requireAuth, requireStudent, studentController.getTimelineData);
router.get('/api/student/history', requireAuth, requireStudent, studentController.getActivityHistory);
router.get('/api/student/progress', requireAuth, requireStudent, studentController.getProgressData);

// Global Search API
router.get('/api/student/search', requireAuth, requireStudent, studentController.getGlobalSearch);

// Notification Center API
router.get('/api/student/notifications', requireAuth, requireStudent, studentController.getNotifications);
router.post('/api/student/notifications/read', requireAuth, requireStudent, studentController.markNotificationsRead);

// Export System API
router.get('/api/student/export/:type', requireAuth, requireStudent, studentController.exportData);

// ─── Faculty Portal API Endpoints ───────────────────────────────────────────
router.get('/api/faculty/profile', requireAuth, requireFaculty, facultyController.getProfileData);
router.get('/api/faculty/stats', requireAuth, requireFaculty, facultyController.getDashboardStats);
router.get('/api/faculty/charts', requireAuth, requireFaculty, facultyController.getDashboardCharts);
router.get('/api/faculty/students', requireAuth, requireFaculty, facultyController.getAssignedStudents);
router.get('/api/faculty/students/:id', requireAuth, requireFaculty, facultyController.getStudentReviewData);

// Reviews & Approvals Workflow API
router.post('/api/faculty/reports/:reportId/review', requireAuth, requireFaculty, facultyController.reviewWeeklyReport);
router.post('/api/faculty/leaves/:attendanceId/review', requireAuth, requireFaculty, facultyController.reviewLeaveRequest);
router.post('/api/faculty/documents/:documentId/review', requireAuth, requireFaculty, facultyController.reviewDocument);

// Feedback & Evaluation API
router.post('/api/faculty/students/:id/feedback', requireAuth, requireFaculty, facultyController.submitFeedback);

// Secure Exports API
router.get('/api/faculty/students/:id/export/:type', requireAuth, requireFaculty, facultyController.exportStudentData);

// ─── Company Portal API Endpoints ───────────────────────────────────────────
router.get('/api/company/profile', requireAuth, requireCompany, companyController.getProfileData);
router.post('/api/company/profile', requireAuth, requireCompany, companyController.updateProfile);
router.get('/api/company/stats', requireAuth, requireCompany, companyController.getDashboardStats);
router.get('/api/company/charts', requireAuth, requireCompany, companyController.getDashboardCharts);
router.get('/api/company/interns', requireAuth, requireCompany, companyController.getAssignedInterns);
router.get('/api/company/interns/:id', requireAuth, requireCompany, companyController.getInternReviewData);

// Reviews & Approvals Workflow API
router.post('/api/company/reports/:reportId/review', requireAuth, requireCompany, companyController.reviewWeeklyReport);
router.post('/api/company/leaves/:attendanceId/review', requireAuth, requireCompany, companyController.reviewLeaveRequest);
router.post('/api/company/documents/:documentId/review', requireAuth, requireCompany, companyController.reviewDocument);
router.post('/api/company/logs/:logId/verify', requireAuth, requireCompany, companyController.verifyDailyLog);

// Feedback & Evaluation API
router.post('/api/company/interns/:id/feedback', requireAuth, requireCompany, companyController.submitFeedback);

// Secure Exports API
router.get('/api/company/interns/:id/export/:type', requireAuth, requireCompany, companyController.exportInternData);

// ─── Admin Portal API Endpoints ─────────────────────────────────────────────
router.get('/api/admin/stats', requireAuth, requireAdmin, adminController.getDashboardStats);
router.get('/api/admin/charts', requireAuth, requireAdmin, adminController.getDashboardCharts);
router.get('/api/admin/recent-activities', requireAuth, requireAdmin, adminController.getRecentActivities);

// User CRUD API
router.get('/api/admin/users', requireAuth, requireAdmin, adminController.getUsers);
router.post('/api/admin/users', requireAuth, requireAdmin, adminController.createUser);
router.put('/api/admin/users/:id', requireAuth, requireAdmin, adminController.updateUser);
router.delete('/api/admin/users/:id', requireAuth, requireAdmin, adminController.deleteUser);
router.post('/api/admin/users/:id/reset-password', requireAuth, requireAdmin, adminController.resetPassword);

// Student Cohort API
router.get('/api/admin/students', requireAuth, requireAdmin, adminController.getStudents);
router.put('/api/admin/students/:id', requireAuth, requireAdmin, adminController.updateStudent);
router.post('/api/admin/students/bulk-assign', requireAuth, requireAdmin, adminController.bulkAssignFaculty);

// Faculty Supervision API
router.get('/api/admin/faculty', requireAuth, requireAdmin, adminController.getFaculty);
router.put('/api/admin/faculty/:id', requireAuth, requireAdmin, adminController.updateFaculty);

// Company & Partnership API
router.get('/api/admin/companies', requireAuth, requireAdmin, adminController.getCompanies);
router.post('/api/admin/companies/:id/approve', requireAuth, requireAdmin, adminController.approveCompany);
router.put('/api/admin/companies/:id', requireAuth, requireAdmin, adminController.updateCompany);

// Internship Placements API
router.get('/api/admin/internships', requireAuth, requireAdmin, adminController.getInternships);
router.post('/api/admin/internships', requireAuth, requireAdmin, adminController.createInternship);
router.put('/api/admin/internships/:id', requireAuth, requireAdmin, adminController.updateInternship);

// System Configuration & Logs API
router.get('/api/admin/settings', requireAuth, requireAdmin, adminController.getSettings);
router.post('/api/admin/settings', requireAuth, requireAdmin, adminController.updateSettings);
router.get('/api/admin/audit-logs', requireAuth, requireAdmin, adminController.getAuditLogs);
router.post('/api/admin/system/integrity', requireAuth, requireAdmin, adminController.runDataIntegrityChecks);
router.post('/api/admin/system/backup', requireAuth, requireAdmin, adminController.runSystemBackup);

// Secure Admin Exports API
router.get('/api/admin/export/:type', requireAuth, requireAdmin, adminController.exportAdminData);

module.exports = router;

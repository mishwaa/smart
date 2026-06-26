/**
 * Faculty ERP Portal Playwright E2E Integration Tests
 * Covers Faculty Login, Dashboard, Cohort Catalog, Review Dossier,
 * Approvals Workflow (weekly reports, leaves, documents), Evaluations, and Security.
 */

require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { pool } = require('../config/database');
const User = require('../models/User');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const path = require('path');
const fs = require('fs');

test.describe.configure({ mode: 'serial' });

let facultyUserId;
let facultyId;
let facultyUser2Id;
let faculty2Id;
let studentUserId;
let studentId;

test.beforeAll(async () => {
  // 1. Clean up existing test accounts to ensure clean state
  await pool.execute('DELETE FROM users WHERE email IN (?, ?, ?)', [
    'faculty@university.com',
    'faculty2@university.com',
    'student@university.com'
  ]);

  // 2. Create Faculty 1 (Main Advisor)
  const facultyUser1 = await User.create({
    name: 'Professor John Smith',
    email: 'faculty@university.com',
    password: 'Faculty@123',
    role: 'faculty',
    must_change_password: false
  });
  facultyUserId = facultyUser1.id;

  const [fac1] = await pool.execute(
    `INSERT INTO faculty (user_id, first_name, last_name, employee_id, department, designation)
     VALUES (?, 'John', 'Smith', 'EMP-SMITH-999', 'Computer Science', 'Professor')`,
    [facultyUserId]
  );
  facultyId = fac1.insertId;

  // 3. Create Faculty 2 (Another Advisor for Security Checks)
  const facultyUser2 = await User.create({
    name: 'Dr. Jane Miller',
    email: 'faculty2@university.com',
    password: 'Faculty@123',
    role: 'faculty',
    must_change_password: false
  });
  facultyUser2Id = facultyUser2.id;

  const [fac2] = await pool.execute(
    `INSERT INTO faculty (user_id, first_name, last_name, employee_id, department, designation)
     VALUES (?, 'Jane', 'Miller', 'EMP-MILLER-888', 'Information Technology', 'Associate Professor')`,
    [facultyUser2Id]
  );
  faculty2Id = fac2.insertId;

  // 4. Create Student
  const studentUser = await User.create({
    name: 'Bob Carter',
    email: 'student@university.com',
    password: 'Student@123',
    role: 'student',
    must_change_password: false
  });
  studentUserId = studentUser.id;

  const [stud] = await pool.execute(
    `INSERT INTO students (user_id, faculty_id, first_name, last_name, roll_number, enrollment_number, department, semester)
     VALUES (?, ?, 'Bob', 'Carter', 'ROLL-BOB-456', 'ENR-BOB-456', 'Computer Science', 8)`,
    [studentUserId, facultyId]
  );
  studentId = stud.insertId;

  // 5. Seed student's active application & internship
  let companyId;
  const [companies] = await pool.execute("SELECT id FROM companies LIMIT 1");
  if (companies.length > 0) {
    companyId = companies[0].id;
  } else {
    const [compUser] = await pool.execute("INSERT INTO users (email, password, role) VALUES ('comp_fac_test@comp.com', 'hashed', 'company')");
    const [compRes] = await pool.execute("INSERT INTO companies (user_id, company_name) VALUES (?, 'Apex Systems')", [compUser.insertId]);
    companyId = compRes.insertId;
  }

  let internshipId;
  const [internships] = await pool.execute("SELECT id FROM internships LIMIT 1");
  if (internships.length > 0) {
    internshipId = internships[0].id;
  } else {
    const [internRes] = await pool.execute(
      `INSERT INTO internships (company_id, title, description, location, duration, start_date, end_date, status) 
       VALUES (?, 'Software Engineer Intern', 'Test Intern', 'Remote', '6 Months', '2026-01-01', '2026-06-30', 'open')`,
      [companyId]
    );
    internshipId = internRes.insertId;
  }

  await pool.execute("INSERT INTO applications (student_id, internship_id, status) VALUES (?, ?, 'accepted')", [studentId, internshipId]);

  // 6. Clean and seed test records for approvals
  await pool.execute("DELETE FROM attendance WHERE student_id = ?", [studentId]);
  await pool.execute("DELETE FROM daily_logs WHERE student_id = ?", [studentId]);
  await pool.execute("DELETE FROM weekly_reports WHERE student_id = ?", [studentId]);
  await pool.execute("DELETE FROM student_documents WHERE student_id = ?", [studentId]);
  await pool.execute("DELETE FROM timeline_events WHERE student_id = ?", [studentId]);
  await pool.execute("DELETE FROM feedback WHERE to_user_id = ?", [studentUserId]);

  // Seed a pending weekly report (Week 1)
  await pool.execute(
    `INSERT INTO weekly_reports (student_id, internship_id, week_number, date_range, report_content, hours_worked, status)
     VALUES (?, ?, 1, '01/06/2026 - 07/06/2026', 'Completed initial setup and ran unit tests.', 40.00, 'submitted')`,
    [studentId, internshipId]
  );

  // Seed a pending leave request
  await pool.execute(
    `INSERT INTO attendance (student_id, internship_id, date, status, leave_reason, leave_status)
     VALUES (?, ?, CURRENT_DATE(), 'leave', 'Doctor appointment checkup.', 'pending')`,
    [studentId, internshipId]
  );

  // Seed a pending document
  await pool.execute(
    `INSERT INTO student_documents (student_id, document_type, file_name, file_path, file_size, status)
     VALUES (?, 'offer_letter', 'Bob_Offer_Letter.pdf', '/uploads/documents/bob_offer.pdf', 25420, 'pending')`,
    [studentId]
  );
});

test.describe('Faculty Coordinator ERP Integration Tests', () => {

  // 1. Faculty Login and Redirect
  test('1. Faculty login succeeds and redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'faculty@university.com');
    await page.fill('#password', 'Faculty@123');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/faculty/dashboard');
    await expect(page).toHaveTitle(/Faculty Dashboard - Smart University Portal/);
    await expect(page.locator('#welcomeUserName')).toContainText('John Smith');
  });

  // 2. Faculty Dashboard Loaded successfully
  test('2. Faculty dashboard counters, charts, and queues load correctly', async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.fill('#email', 'faculty@university.com');
    await page.fill('#password', 'Faculty@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/faculty/dashboard');

    // Check stats counters
    await expect(page.locator('#statSupervised')).toHaveText('1');
    await expect(page.locator('#statActive')).toHaveText('1');
    await expect(page.locator('#statPendingTasks')).toHaveText('3'); // 1 report + 1 leave + 1 doc = 3

    // Check chart canvas elements exist
    await expect(page.locator('#reportsChart')).toBeVisible();
    await expect(page.locator('#companyChart')).toBeVisible();
    await expect(page.locator('#deptChart')).toBeVisible();

    // Check pending approvals table shows our seeded items
    const tableBody = page.locator('#pendingTableBody');
    await expect(tableBody).toContainText('Bob Carter');
    await expect(tableBody).toContainText('REPORT');
    await expect(tableBody).toContainText('LEAVE');
    await expect(tableBody).toContainText('DOCUMENT');
  });

  // 3. Supervised Students directory catalog with search and filters
  test('3. Cohort catalog renders, search and filters function correctly', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'faculty@university.com');
    await page.fill('#password', 'Faculty@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/faculty/dashboard');

    // Navigate to assigned students
    await page.click('text=Assigned Students');
    await page.waitForURL('**/faculty/students');
    await expect(page.locator('h1')).toContainText('Supervised Students Directory');

    // Bob Carter should be listed
    const tableBody = page.locator('#studentTableBody');
    await expect(tableBody).toContainText('Bob Carter');
    await expect(tableBody).toContainText('ROLL-BOB-456');

    // Type a search that doesn't match
    await page.fill('#filterSearch', 'NonexistentStudent');
    await page.click('button:has-text("Apply Filters")');
    await expect(tableBody).toContainText('No students match your filter settings');

    // Reset filters
    await page.click('button:has-text("Reset Filters")');
    await expect(tableBody).toContainText('Bob Carter');
  });

  // 4. Student Dossier Detail tabs review
  test('4. Dossier tabs load and display read-only student details', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'faculty@university.com');
    await page.fill('#password', 'Faculty@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/faculty/dashboard');
    await page.goto('/faculty/students');

    // Click "Open Review Folder"
    await page.click('text=Open Review Folder');
    await page.waitForURL('**/faculty/students/*/review');

    // Validate student dossier header
    await expect(page.locator('#hdrStudentName')).toContainText('Bob Carter');
    await expect(page.locator('#hdrStudentDetails')).toContainText('ROLL-BOB-456');

    // Check tabs switching
    // 1. Profile tab (loaded by default)
    await expect(page.locator('#profEnrollment')).toContainText('ENR-BOB-456');
    await expect(page.locator('#profDept')).toContainText('Computer Science');

    // 2. Attendance tab
    await page.click('#attendance-tab');
    await expect(page.locator('#attPresentDays')).toBeVisible();
    await expect(page.locator('#leaveTableBody')).toContainText('Doctor appointment checkup.');

    // 3. Weekly reports tab
    await page.click('#reports-tab');
    await expect(page.locator('#weeklyReportsBody')).toContainText('Week 1');
    await expect(page.locator('#weeklyReportsBody')).toContainText('Completed initial setup');
  });

  // 5. Weekly Report Review & Approval workflow
  test('5. Weekly report approval workflow functions and sends timeline update', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'faculty@university.com');
    await page.fill('#password', 'Faculty@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/faculty/dashboard');

    // Review from Dashboard
    // Find the row for report and click Review
    const reportRow = page.locator('tr:has-text("REPORT")');
    await reportRow.locator('button:has-text("Review")').click();

    // Verify modal is shown
    const modal = page.locator('#reviewModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#reviewDetailsContainer')).toContainText('Week 1');

    // Fill remarks and Approve
    await page.fill('#reviewRemarks', 'Outstanding weekly report! Code is highly structured.');
    await page.click('button:has-text("Approve / Validate")');

    // Modal should close, and the pending tasks count should decrease
    await expect(modal).not.toBeVisible();
    await expect(page.locator('#statPendingTasks')).toHaveText('2'); // 1 report approved, 2 tasks remain
  });

  // 6. Leave Request Approval workflow
  test('6. Leave request review approves the leave and logs remarks', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'faculty@university.com');
    await page.fill('#password', 'Faculty@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/faculty/dashboard');

    // Find the row for leave and click Review
    const leaveRow = page.locator('tr:has-text("LEAVE")');
    await leaveRow.locator('button:has-text("Review")').click();

    // Fill remarks and Approve
    await page.fill('#reviewRemarks', 'Leave approved. Please catch up on the weekly logs.');
    await page.click('button:has-text("Approve / Validate")');

    // Verify task count is now 1
    await expect(page.locator('#statPendingTasks')).toHaveText('1');
  });

  // 7. Compliance Document Approval workflow
  test('7. Compliance document review rejects the document and requests fix', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'faculty@university.com');
    await page.fill('#password', 'Faculty@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/faculty/dashboard');

    // Find document row and review it
    const docRow = page.locator('tr:has-text("DOCUMENT")');
    await docRow.locator('button:has-text("Review")').click();

    // Fill remarks and Reject
    await page.fill('#reviewRemarks', 'Offer letter signature is missing. Please sign and re-upload.');
    await page.click('button:has-text("Reject / Request Fix")');

    // Verify task count is now 0
    await expect(page.locator('#statPendingTasks')).toHaveText('0');
  });

  // 8. Performance Evaluation rating and remarks
  test('8. Advisor evaluation rating and comments are submitted and saved in history', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'faculty@university.com');
    await page.fill('#password', 'Faculty@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/faculty/dashboard');

    // Navigate directly to student dossier review evaluations tab
    await page.goto(`/faculty/students/${studentId}/review`);
    await page.click('#feedback-tab');

    // Verify form is visible
    await expect(page.locator('#feedbackForm')).toBeVisible();

    // Select 5-star rating (star5)
    await page.locator('label[for="star5"]').click();
    await page.fill('#feedbackComments', 'Bob is performing exceptionally. Strong problem solving and team collaboration.');
    
    // Submit evaluation
    await page.click('button:has-text("Submit Official Evaluation")');

    // Success alert would show, and history table should be updated with the new record
    const historyBody = page.locator('#feedbackHistoryBody');
    await expect(historyBody).toContainText('Bob is performing exceptionally');
    await expect(historyBody).toContainText('5/5');
  });

  // 9. Cross-Faculty Security and Privilege Escalation Prevention
  test('9. Unauthorized faculty advisor is blocked with 403 on accessing another faculty student', async ({ page }) => {
    // Log in as Faculty 2 (Dr. Jane Miller) who is NOT Bob's advisor
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('#email', 'faculty2@university.com');
    await page.fill('#password', 'Faculty@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/faculty/dashboard');

    // 1. Verify Bob is NOT in Faculty 2's dashboard supervised count
    await expect(page.locator('#statSupervised')).toHaveText('0');

    // 2. Try to directly access Bob's dossier review page, should alert and redirect (or display 403 response if fetched)
    // The page alerts and redirects to /faculty/dashboard, or API fetches return 403
    const responsePromise = page.waitForResponse(res => res.url().includes(`/api/faculty/students/${studentId}`) && res.status() === 403);
    await page.goto(`/faculty/students/${studentId}/review`);
    const response = await responsePromise;
    expect(response.status()).toBe(403);
  });

});

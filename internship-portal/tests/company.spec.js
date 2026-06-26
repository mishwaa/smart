/**
 * Company ERP Portal Playwright E2E Integration Tests
 * Covers Company Login, Dashboard, Cohort Catalog, Review Dossier,
 * Approvals Workflow (daily logs, weekly reports, leaves, documents), Evaluations, and Security.
 */

require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { pool } = require('../config/database');
const User = require('../models/User');
const Company = require('../models/Company');
const Student = require('../models/Student');
const path = require('path');
const fs = require('fs');

test.describe.configure({ mode: 'serial' });

let companyUserId;
let companyId;
let companyUser2Id;
let company2Id;
let studentUserId;
let studentId;
let internshipId;
let internship2Id;

test.beforeAll(async () => {
  // 1. Clean up existing test accounts to ensure clean state
  await pool.execute('DELETE FROM users WHERE email IN (?, ?, ?)', [
    'company_rep@ApexSystems.com',
    'company_rep2@OtherTech.com',
    'student_intern@university.com'
  ]);

  // 2. Create Company 1 (Main Employer Partner)
  const companyUser1 = await User.create({
    name: 'Apex Recruiter',
    email: 'company_rep@ApexSystems.com',
    password: 'Company@123',
    role: 'company',
    must_change_password: false
  });
  companyUserId = companyUser1.id;

  const [comp1] = await pool.execute(
    `INSERT INTO companies (user_id, company_name, industry, website, contact_person, contact_email)
     VALUES (?, 'Apex Systems', 'Information Technology', 'https://apexsystems.com', 'Sarah Connor', 'sarah@apex.com')`,
    [companyUserId]
  );
  companyId = comp1.insertId;

  // Create an internship for Company 1
  const [intern1] = await pool.execute(
    `INSERT INTO internships (company_id, title, description, location, duration, start_date, end_date, status) 
     VALUES (?, 'Backend Developer Intern', 'Build REST APIs in Node.js', 'Remote', '6 Months', '2026-01-01', '2026-06-30', 'open')`,
    [companyId]
  );
  internshipId = intern1.insertId;

  // 3. Create Company 2 (Another Employer for Security Checks)
  const companyUser2 = await User.create({
    name: 'Other Recruiter',
    email: 'company_rep2@OtherTech.com',
    password: 'Company@123',
    role: 'company',
    must_change_password: false
  });
  companyUser2Id = companyUser2.id;

  const [comp2] = await pool.execute(
    `INSERT INTO companies (user_id, company_name, industry, website, contact_person, contact_email)
     VALUES (?, 'Other Technologies', 'Hardware', 'https://othertech.com', 'John Connor', 'john@othertech.com')`,
    [companyUser2Id]
  );
  company2Id = comp2.insertId;

  // Create an internship for Company 2
  const [intern2] = await pool.execute(
    `INSERT INTO internships (company_id, title, description, location, duration, start_date, end_date, status) 
     VALUES (?, 'Hardware Engineering Intern', 'Test processors', 'Onsite', '3 Months', '2026-02-01', '2026-05-01', 'open')`,
    [company2Id]
  );
  internship2Id = intern2.insertId;

  // 4. Create Student Intern
  const studentUser = await User.create({
    name: 'Robert Davis',
    email: 'student_intern@university.com',
    password: 'Student@123',
    role: 'student',
    must_change_password: false
  });
  studentUserId = studentUser.id;

  const [stud] = await pool.execute(
    `INSERT INTO students (user_id, first_name, last_name, roll_number, enrollment_number, department, semester)
     VALUES (?, 'Robert', 'Davis', 'ROLL-DAVIS-789', 'ENR-DAVIS-789', 'Computer Science', 8)`,
    [studentUserId]
  );
  studentId = stud.insertId;

  // Seed student's active application with Company 1 (Apex Systems)
  await pool.execute(
    "INSERT INTO applications (student_id, internship_id, status) VALUES (?, ?, 'accepted')",
    [studentId, internshipId]
  );

  // 5. Clean and seed test records for approvals
  await pool.execute("DELETE FROM attendance WHERE student_id = ?", [studentId]);
  await pool.execute("DELETE FROM daily_logs WHERE student_id = ?", [studentId]);
  await pool.execute("DELETE FROM weekly_reports WHERE student_id = ?", [studentId]);
  await pool.execute("DELETE FROM student_documents WHERE student_id = ?", [studentId]);
  await pool.execute("DELETE FROM timeline_events WHERE student_id = ?", [studentId]);
  await pool.execute("DELETE FROM feedback WHERE to_user_id = ?", [studentUserId]);

  // Seed a pending daily log
  await pool.execute(
    `INSERT INTO daily_logs (student_id, internship_id, date, tasks_completed, hours_worked, technology_used, problems_faced, learning_outcome)
     VALUES (?, ?, CURRENT_DATE(), 'Designed database tables and ran migrations.', 8.00, 'MySQL, Node.js', 'MySQL syntax differences.', 'Learned database schema design.')`,
    [studentId, internshipId]
  );

  // Seed a pending weekly report
  await pool.execute(
    `INSERT INTO weekly_reports (student_id, internship_id, week_number, date_range, report_content, hours_worked, status)
     VALUES (?, ?, 1, '01/06/2026 - 07/06/2026', 'Completed initial setup and ran unit tests.', 40.00, 'submitted')`,
    [studentId, internshipId]
  );

  // Seed a pending leave request
  await pool.execute(
    `INSERT INTO attendance (student_id, internship_id, date, status, leave_reason, leave_status)
     VALUES (?, ?, DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY), 'leave', 'Fever recovery.', 'pending')`,
    [studentId, internshipId]
  );

  // Seed a pending document
  await pool.execute(
    `INSERT INTO student_documents (student_id, document_type, file_name, file_path, file_size, status)
     VALUES (?, 'offer_letter', 'Robert_Offer_Letter.pdf', '/uploads/documents/robert_offer.pdf', 25420, 'pending')`,
    [studentId]
  );
});

test.describe('Company Employer ERP Integration Tests', () => {

  // 1. Company Login and Redirect
  test('1. Employer login succeeds and redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'company_rep@ApexSystems.com');
    await page.fill('#password', 'Company@123');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/company/dashboard');
    await expect(page).toHaveTitle(/Company Dashboard - Smart University Portal/);
    await expect(page.locator('#welcomeUserName')).toContainText('Apex Systems');
  });

  // 2. Company Dashboard Loaded successfully
  test('2. Employer dashboard counters, charts, and queues load correctly', async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.fill('#email', 'company_rep@ApexSystems.com');
    await page.fill('#password', 'Company@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/company/dashboard');

    // Check stats counters
    await expect(page.locator('#statInterns')).toHaveText('1');
    await expect(page.locator('#statPendingReviews')).toHaveText('3'); // 1 weekly report + 1 leave + 1 doc = 3

    // Check chart canvas elements exist
    await expect(page.locator('#ratingsChart')).toBeVisible();
    await expect(page.locator('#reportsChart')).toBeVisible();
    await expect(page.locator('#deptChart')).toBeVisible();

    // Check pending approvals table shows our seeded items
    const tableBody = page.locator('#pendingTableBody');
    await expect(tableBody).toContainText('Robert Davis');
    await expect(tableBody).toContainText('REPORT');
    await expect(tableBody).toContainText('LEAVE');
    await expect(tableBody).toContainText('DOCUMENT');
  });

  // 3. Supervised Interns directory catalog with search and filters
  test('3. Employer intern catalog renders, search and filters function correctly', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'company_rep@ApexSystems.com');
    await page.fill('#password', 'Company@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/company/dashboard');

    // Navigate to active interns
    await page.click('text=Active Interns');
    await page.waitForURL('**/company/interns');
    await expect(page.locator('h1')).toContainText('Active Interns Directory');

    // Robert Davis should be listed
    const tableBody = page.locator('#studentTableBody');
    await expect(tableBody).toContainText('Robert Davis');
    await expect(tableBody).toContainText('ROLL-DAVIS-789');

    // Type a search that doesn't match
    await page.fill('#filterSearch', 'NonexistentIntern');
    await page.click('button:has-text("Apply Filters")');
    await expect(tableBody).toContainText('No interns match your filter settings');

    // Reset filters
    await page.click('button:has-text("Reset Filters")');
    await expect(tableBody).toContainText('Robert Davis');
  });

  // 4. Intern Dossier Detail tabs review
  test('4. Dossier tabs load and display read-only student details for employer', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'company_rep@ApexSystems.com');
    await page.fill('#password', 'Company@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/company/dashboard');
    await page.goto('/company/interns');

    // Click "Open Review Folder"
    await page.click('text=Open Review Folder');
    await page.waitForURL('**/company/interns/*/review');

    // Validate student dossier header
    await expect(page.locator('#hdrStudentName')).toContainText('Robert Davis');
    await expect(page.locator('#hdrStudentDetails')).toContainText('ROLL-DAVIS-789');

    // Check tabs switching
    // 1. Profile tab
    await expect(page.locator('#profEnrollment')).toContainText('ENR-DAVIS-789');

    // 2. Daily logs & verification tab
    await page.click('#logs-tab');
    await expect(page.locator('#dailyLogsBody')).toContainText('Designed database tables');
    await expect(page.locator('#dailyLogsBody')).toContainText('Verify');
  });

  // 5. Daily Work Log Verification workflow
  test('5. Mentor daily log verification approves tasks and logs remarks', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'company_rep@ApexSystems.com');
    await page.fill('#password', 'Company@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/company/dashboard');
    await page.goto(`/company/interns/${studentId}/review`);
    await page.click('#logs-tab');

    // Click Verify button in the daily logs table
    await page.click('#dailyLogsBody button:has-text("Verify")');

    // Fill verification remarks
    const modal = page.locator('#verifyLogModal');
    await expect(modal).toBeVisible();
    await page.fill('#verifyLogRemarks', 'Excellent progress. DB tables normalized.');
    await page.click('button:has-text("Verify & Approve Hours")');

    // Modal should close and daily log should display "Verified" status
    await expect(modal).not.toBeVisible();
    await expect(page.locator('#dailyLogsBody')).toContainText('Verified');
    await expect(page.locator('#dailyLogsBody')).toContainText('DB tables normalized');
  });

  // 6. Weekly Report Review workflow
  test('6. Mentor weekly report review logs remarks and sets reviewed status', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'company_rep@ApexSystems.com');
    await page.fill('#password', 'Company@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/company/dashboard');

    // Review report from dashboard
    const reportRow = page.locator('tr:has-text("REPORT")');
    await reportRow.locator('button:has-text("Review")').click();

    // Verify modal and review remarks
    const modal = page.locator('#reviewModal');
    await expect(modal).toBeVisible();
    await page.fill('#reviewRemarks', 'Great weekly summary Bob! Checked code, looks solid.');
    await page.click('button:has-text("Approve / Validate")'); // approves on UI, reviewed status in backend

    // Verify pending tasks count decreased
    await expect(modal).not.toBeVisible();
    await expect(page.locator('#statPendingReviews')).toHaveText('2'); // 1 report reviewed, 2 tasks remain
  });

  // 7. Leave Request Approval workflow
  test('7. Employer leave request review approves leave with remarks', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'company_rep@ApexSystems.com');
    await page.fill('#password', 'Company@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/company/dashboard');

    // Review leave
    const leaveRow = page.locator('tr:has-text("LEAVE")');
    await leaveRow.locator('button:has-text("Review")').click();

    await page.fill('#reviewRemarks', 'Recovery is important. Approved.');
    await page.click('button:has-text("Approve / Validate")');

    await expect(page.locator('#statPendingReviews')).toHaveText('1');
  });

  // 8. Compliance Document Approval workflow
  test('8. Employer document review rejects missing details', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'company_rep@ApexSystems.com');
    await page.fill('#password', 'Company@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/company/dashboard');

    // Review document
    const docRow = page.locator('tr:has-text("DOCUMENT")');
    await docRow.locator('button:has-text("Review")').click();

    await page.fill('#reviewRemarks', 'Signature page missing.');
    await page.click('button:has-text("Reject / Request Fix")');

    await expect(page.locator('#statPendingReviews')).toHaveText('0');
  });

  // 9. Detailed Mentor Evaluation Rating Matrix & Graduation
  test('9. Employer detailed evaluation matrix is submitted successfully', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'company_rep@ApexSystems.com');
    await page.fill('#password', 'Company@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/company/dashboard');
    await page.goto(`/company/interns/${studentId}/review`);

    // Go to evaluations tab
    await page.click('#feedback-tab');
    await expect(page.locator('#feedbackForm')).toBeVisible();

    // Select star ratings
    await page.locator('label[for="rating5"]').click(); // Overall: 5
    await page.locator('label[for="tech5"]').click(); // Tech: 5
    await page.locator('label[for="comm5"]').click(); // Comm: 5
    await page.locator('label[for="prof5"]').click(); // Prof: 5
    await page.locator('label[for="punc5"]').click(); // Punc: 5

    await page.fill('#feedbackComments', 'Robert has been an outstanding intern. Fully committed, skilled, and punctual.');
    await page.check('#recommendCompletion');
    await page.check('#recommendCertificate');
    await page.check('#isFinalEvaluation');

    // Submit
    await page.click('button:has-text("Submit Mentor Evaluation")');

    // Verify history logs show the evaluation
    const historyBody = page.locator('#companyHistoryBody');
    await expect(historyBody).toContainText('Robert has been an outstanding intern');
    await expect(historyBody).toContainText('Overall: ★★★★★');
  });

  // 10. Cross-Company Security and Privilege Escalation Prevention
  test('10. Unauthorized company employer is blocked with 403 on accessing another company intern', async ({ page }) => {
    // Log in as Company 2 (Dr. Jane Miller / Other Technologies) who is NOT Robert's employer
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('#email', 'company_rep2@OtherTech.com');
    await page.fill('#password', 'Company@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/company/dashboard');

    // 1. Verify Robert is NOT in Company 2's active interns supervised count
    await expect(page.locator('#statInterns')).toHaveText('0');

    // 2. Try to directly access Robert's dossier review page, should get blocked with 403 response
    const responsePromise = page.waitForResponse(res => res.url().includes(`/api/company/interns/${studentId}`) && res.status() === 403);
    await page.goto(`/company/interns/${studentId}/review`);
    const response = await responsePromise;
    expect(response.status()).toBe(403);
  });

});

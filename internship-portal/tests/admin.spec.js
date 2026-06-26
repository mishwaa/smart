/**
 * Admin ERP Portal Playwright E2E Integration Tests
 * Covers Admin Login, Dashboard, User CRUD, Student & Faculty Mapping,
 * Company Approvals, Internship CRUD, System settings, Integrity scans, backups, and Exports.
 */

require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { pool } = require('../config/database');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

test.describe.configure({ mode: 'serial' });

let testStudentUserId;
let testStudentId;
let testFacultyUserId;
let testFacultyId;
let testCompanyUserId;
let testCompanyId;

test.beforeAll(async () => {
  // 1. Clean up existing test accounts to ensure clean state
  await pool.execute('DELETE FROM users WHERE email IN (?, ?, ?, ?, ?, ?)', [
    'admin@university.com',
    'company_rep@ApexSystems.com',
    'company_rep2@OtherTech.com',
    'student_intern@university.com',
    'faculty_coor@university.com',
    'admin_test_stud@university.com'
  ]);

  // 2. Create Admin user
  await User.create({
    name: 'System Admin',
    email: 'admin@university.com',
    password: 'Admin@123',
    role: 'admin',
    must_change_password: false
  });

  // 3. Create Faculty
  const facultyUser = await User.create({
    name: 'Sarah Connor',
    email: 'faculty_coor@university.com',
    password: 'Faculty@123',
    role: 'faculty',
    must_change_password: false
  });
  const [fac] = await pool.execute(
    `INSERT INTO faculty (user_id, first_name, last_name, employee_id, department, designation)
     VALUES (?, 'Sarah', 'Connor', 'EMP-CONNOR-123', 'Computer Science', 'Associate Professor')`,
    [facultyUser.id]
  );

  // 4. Create Company 1 (Apex Systems)
  const companyUser1 = await User.create({
    name: 'Apex Recruiter',
    email: 'company_rep@ApexSystems.com',
    password: 'Company@123',
    role: 'company',
    must_change_password: false
  });
  const [comp1] = await pool.execute(
    `INSERT INTO companies (user_id, company_name, industry, website, contact_person, contact_email)
     VALUES (?, 'Apex Systems', 'Information Technology', 'https://apexsystems.com', 'Sarah Connor', 'sarah@apex.com')`,
    [companyUser1.id]
  );
  const companyId = comp1.insertId;

  // Create an internship for Company 1
  const [intern1] = await pool.execute(
    `INSERT INTO internships (company_id, title, description, location, duration, start_date, end_date, status) 
     VALUES (?, 'Backend Developer Intern', 'Build REST APIs in Node.js', 'Remote', '6 Months', '2026-01-01', '2026-06-30', 'open')`,
    [companyId]
  );
  const internshipId = intern1.insertId;

  // 5. Create Student Intern (Robert Davis)
  const studentUser = await User.create({
    name: 'Robert Davis',
    email: 'student_intern@university.com',
    password: 'Student@123',
    role: 'student',
    must_change_password: false
  });
  const [stud] = await pool.execute(
    `INSERT INTO students (user_id, first_name, last_name, roll_number, enrollment_number, department, semester)
     VALUES (?, 'Robert', 'Davis', 'ROLL-DAVIS-789', 'ENR-DAVIS-789', 'Computer Science', 8)`,
    [studentUser.id]
  );
  const studentId = stud.insertId;

  // Seed student's active application with Company 1 (Apex Systems)
  await pool.execute(
    "INSERT INTO applications (student_id, internship_id, status) VALUES (?, ?, 'accepted')",
    [studentId, internshipId]
  );
});

test.describe('Admin ERP Portal Integration Tests', () => {

  // 1. Admin Login and Redirect
  test('1. Administrator login succeeds and redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@university.com');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');

    // Handle forced password change if triggered, or direct redirect
    if (page.url().includes('/change-password')) {
      await page.fill('#newPassword', 'Admin@12345');
      await page.fill('#confirmPassword', 'Admin@12345');
      await page.click('button[type="submit"]');
    }

    await page.waitForURL('**/admin/dashboard');
    await expect(page).toHaveTitle(/Admin Dashboard - Smart University Portal/);
    await expect(page.locator('#welcomeUserName')).toContainText('Administrator');
  });

  // 2. Admin Dashboard Stats and Charts
  test('2. Admin dashboard counters, charts, and parameter cards load correctly', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@university.com');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard');

    // Check stats elements are visible and contain numeric data
    await expect(page.locator('#statStudents')).toBeVisible();
    await expect(page.locator('#statFaculty')).toBeVisible();
    await expect(page.locator('#statCompanies')).toBeVisible();
    await expect(page.locator('#statPlacements')).toBeVisible();

    // Check chart canvas components exist
    await expect(page.locator('#deptChart')).toBeVisible();
    await expect(page.locator('#companyChart')).toBeVisible();
    await expect(page.locator('#reportsChart')).toBeVisible();
    await expect(page.locator('#workloadChart')).toBeVisible();
  });

  // 3. User CRUD Orchestration (User Creation)
  test('3. Administrator can create a new student, coordinator, and recruiter user account', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@university.com');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard');

    // Go to Manage Users
    await page.click('text=Manage Users');
    await page.waitForURL('**/admin/users');

    // Click Create User Account
    await page.click('button:has-text("Create User Account")');
    await expect(page.locator('#createModal')).toBeVisible();

    // 1. Create Student
    await page.fill('#createName', 'Admin Test Student');
    await page.fill('#createEmail', 'admin_test_stud@university.com');
    await page.fill('#createPassword', 'Student@123');
    await page.selectOption('#createRole', 'student');

    // Role-specific fields should become visible
    await expect(page.locator('#studRoll')).toBeVisible();
    await page.fill('#studRoll', 'ROLL-ADMIN-TEST-999');
    await page.fill('#studEnroll', 'ENR-ADMIN-TEST-999');
    await page.fill('#studDept', 'Computer Science');

    // Submit
    await page.click('button:has-text("Register Account")');
    await expect(page.locator('#createModal')).not.toBeVisible();

    // Verify student user appears in list
    const tableBody = page.locator('#usersTableBody');
    await expect(tableBody).toContainText('admin_test_stud@university.com');
  });

  // 4. Student cohort assignments (Mapping faculty and placements)
  test('4. Administrator can edit student profile and assign faculty coordinator', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@university.com');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard');

    // Go to Manage Students
    await page.click('text=Manage Students');
    await page.waitForURL('**/admin/students');

    // Robert Davis should be listed. Click "Assign / Edit"
    const row = page.locator('tr:has-text("Robert Davis")');
    await row.locator('button:has-text("Assign / Edit")').click();

    // Verify modal is visible
    const modal = page.locator('#editModal');
    await expect(modal).toBeVisible();

    // Change Department and Semester, select faculty coordinator
    await page.selectOption('#editDept', 'Information Technology');
    await page.fill('#editSemester', '8');
    await page.fill('#editCgpa', '9.25');
    
    // Select the first coordinator from options
    await page.selectOption('#editFacultyId', { index: 1 });

    // Submit
    await page.click('button:has-text("Update Student Portfolio")');
    await expect(modal).not.toBeVisible();

    // Verify student row reflects the changes
    await expect(row).toContainText('Information Technology');
    await expect(row).toContainText('Semester 8');
  });

  // 5. Faculty workload catalog
  test('5. Faculty workload coordination catalog loads successfully', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@university.com');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard');

    await page.click('text=Manage Faculty');
    await page.waitForURL('**/admin/faculty');

    // Verify faculty list has items and shows workloads
    await expect(page.locator('#facultyTableBody')).toContainText('Interns');
  });

  // 6. Company partnership approvals
  test('6. Employer partnership verify and revoke workflows function correctly', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@university.com');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard');

    await page.click('text=Manage Companies');
    await page.waitForURL('**/admin/companies');

    // Verify company table shows companies
    const tableBody = page.locator('#companiesTableBody');
    await expect(tableBody).toContainText('Apex Systems');

    // Revoke partnership
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    const row = page.locator('tr:has-text("Apex Systems")');
    if (await row.locator('button:has-text("Revoke")').count() > 0) {
      await row.locator('button:has-text("Revoke")').click();
      await expect(row).toContainText('Pending Review');
    }

    // Approve partnership
    if (await row.locator('button:has-text("Approve")').count() > 0) {
      await row.locator('button:has-text("Approve")').click();
      await expect(row).toContainText('Approved Partner');
    }
  });

  // 7. Internship opportunity CRUD
  test('7. Administrator can publish a new corporate internship posting', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@university.com');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard');

    await page.click('text=Manage Internships');
    await page.waitForURL('**/admin/internships');

    // Click Create Internship
    await page.click('button:has-text("Create Internship Posting")');
    const modal = page.locator('#createModal');
    await expect(modal).toBeVisible();

    // Fill form
    await page.selectOption('#createCompanyId', { index: 1 });
    await page.fill('#createTitle', 'Systems Analyst Admin Test Intern');
    await page.fill('#createLocation', 'Remote / Hybrid');
    await page.fill('#createDuration', '3 Months');
    await page.fill('#createStipend', '2000');
    await page.fill('#createPositions', '2');
    await page.fill('#createDescription', 'Administrative test internship description details.');

    // Submit
    await page.click('button:has-text("Publish Opportunity")');
    await expect(modal).not.toBeVisible();

    // Verify listed
    await expect(page.locator('#internshipsTableBody')).toContainText('Systems Analyst Admin Test Intern');
  });

  // 8. System Management (settings, scans, backups)
  test('8. System parameters updates, integrity scans, and backups execute successfully', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@university.com');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard');

    await page.click('text=System Management');
    await page.waitForURL('**/admin/system');

    // 1. Update portal title setting
    await page.fill('#settBrandInput', 'Smart University Placement ERP Platform');
    await page.click('button:has-text("Save Parameters")');
    
    // Check alert or success is handled
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('success');
      await dialog.accept();
    });

    // 2. Run Data Integrity scan
    await page.click('#integrity-tab');
    await page.click('button:has-text("Run Integrity Audit Scan")');
    await expect(page.locator('#integritySummary')).toContainText('Scan finished');

    // 3. Run Database Backup
    await page.click('#backup-tab');
    await page.click('button:has-text("Run Database Backup")');
    await expect(page.locator('#backupSummary')).toContainText('prepared successfully');
  });

  // 9. Administrative exports
  test('9. Administrative data exports stream CSV/PDF ledgers successfully', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@university.com');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard');

    await page.click('text=Manage Users');
    await page.waitForURL('**/admin/users');

    // Check export buttons trigger download or open new page
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("Export CSV")')
    ]);

    expect(download.suggestedFilename()).toContain('admin_users_export');
  });

});

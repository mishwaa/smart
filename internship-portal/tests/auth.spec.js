require('dotenv').config();
const { test, expect } = require('@playwright/test');
const User = require('../models/User');
const { pool } = require('../config/database');

test.describe.configure({ mode: 'serial' }); // Run tests in order since they share database state

test.beforeAll(async () => {
  // Ensure we have a clean test database state
  // Delete existing test users to prevent duplicate key errors
  await pool.execute('DELETE FROM users WHERE email IN (?, ?, ?, ?)', [
    'admin@university.com',
    'student@university.com',
    'faculty@university.com',
    'company@university.com'
  ]);

  // 1. Seed Default Admin (must_change_password = true)
  await User.create({
    name: 'System Admin',
    email: 'admin@university.com',
    password: 'Admin@123',
    role: 'admin',
    must_change_password: true
  });

  // 2. Seed Student (must_change_password = false)
  await User.create({
    name: 'Jane Doe',
    email: 'student@university.com',
    password: 'Student@123',
    role: 'student',
    must_change_password: false
  });

  // 3. Seed Faculty (must_change_password = false)
  await User.create({
    name: 'Dr. John Smith',
    email: 'faculty@university.com',
    password: 'Faculty@123',
    role: 'faculty',
    must_change_password: false
  });

  // 4. Seed Company (must_change_password = false)
  await User.create({
    name: 'TechCorp Recruiter',
    email: 'company@university.com',
    password: 'Company@123',
    role: 'company',
    must_change_password: false
  });
});

test.afterAll(async () => {
  // Close database pool when done to prevent process hang
  await pool.end();
});

test.describe('Authentication and Session Tests', () => {

  // 1. Login Page Loads
  test('1. Login Page Loads successfully', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Login - Smart University/);
    
    // Verify essential elements are visible
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const rememberCheckbox = page.locator('#remember');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(rememberCheckbox).toBeVisible();
    await expect(submitBtn).toBeVisible();
  });

  // 3. Invalid Email
  test('3. Invalid Email shows validation error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'nonexistent@university.com');
    await page.fill('#password', 'WrongPassword123');
    await page.click('button[type="submit"]');

    // Verify error message alert
    const alert = page.locator('.alert-danger');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/Invalid email or password/);
  });

  // 4. Invalid Password
  test('4. Invalid Password shows validation error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@university.com');
    await page.fill('#password', 'WrongPassword123');
    await page.click('button[type="submit"]');

    const alert = page.locator('.alert-danger');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/Invalid email or password/);
  });

  // 5. Missing Fields
  test('5. Missing Fields shows client-side validation styles', async ({ page }) => {
    await page.goto('/login');
    // Click submit without filling anything
    await page.click('button[type="submit"]');

    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');

    // Bootstrap is-invalid class should be added
    await expect(emailInput).toHaveClass(/is-invalid/);
    await expect(passwordInput).toHaveClass(/is-invalid/);
  });

  // 12. Admin First Login Flow & 11. Change Password Flow
  test('12. Admin First Login Flow forces password change and redirects', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@university.com');
    await page.fill('#password', 'Admin@123');
    await page.click('button[type="submit"]');

    // Should redirect to change password page
    await page.waitForURL('**/change-password');
    await expect(page).toHaveTitle(/Change Password - Smart University/);
    await expect(page.locator('.alert-warning')).toBeVisible();

    // Fill in weak new password (fails regex check)
    await page.fill('#currentPassword', 'Admin@123');
    await page.fill('#newPassword', 'weakpass');
    await page.fill('#confirmPassword', 'weakpass');
    await page.click('button[type="submit"]');

    // Should show complexity error alert
    await expect(page.locator('.alert-danger')).toBeVisible();
    await expect(page.locator('.alert-danger')).toContainText(/complexity/i);

    // Fill in mismatched passwords
    await page.fill('#newPassword', 'Admin@1234');
    await page.fill('#confirmPassword', 'Mismatched@1234');
    await page.click('button[type="submit"]');

    await expect(page.locator('.alert-danger')).toBeVisible();
    await expect(page.locator('.alert-danger')).toContainText(/match/i);

    // Fill in correct details (New password: Admin@1234)
    await page.fill('#newPassword', 'Admin@1234');
    await page.fill('#confirmPassword', 'Admin@1234');
    await page.click('button[type="submit"]');

    // Should redirect to admin dashboard
    await page.waitForURL('**/admin/dashboard');
    await expect(page).toHaveTitle(/Admin Dashboard - Smart University/);
    await expect(page.locator('#welcomeUserName')).toContainText('System Admin');
  });

  // 2. Successful Admin Login (subsequent login with new password)
  test('2. Successful Admin Login without password change force', async ({ page }) => {
    // Clear cookies first to log out previous session
    await page.context().clearCookies();

    await page.goto('/login');
    await page.fill('#email', 'admin@university.com');
    await page.fill('#password', 'Admin@1234'); // Use the new password
    await page.click('button[type="submit"]');

    // Should redirect directly to admin dashboard
    await page.waitForURL('**/admin/dashboard');
    await expect(page.locator('#welcomeUserName')).toContainText('System Admin');
  });

  // 6. Logout Works & 9. Session Destruction
  test('6. Logout Works and destroys session', async ({ page }) => {
    // Logged in as admin, now navigate to logout
    await page.goto('/logout');
    await page.waitForURL('**/login');

    // Try to access protected dashboard route, should redirect to login
    await page.goto('/admin/dashboard');
    await page.waitForURL('**/login');
  });

  // 7. Protected Route Access (Role Authorization)
  test('7. Protected Route Access is blocked and returns 403', async ({ page }) => {
    // Log in as student
    await page.goto('/login');
    await page.fill('#email', 'student@university.com');
    await page.fill('#password', 'Student@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/student/dashboard');

    // Try to access admin dashboard, should get 403 Forbidden page
    await page.goto('/admin/dashboard');
    const title = await page.title();
    expect(title).toContain('403 Forbidden');
    await expect(page.locator('h1')).toContainText('Access Denied');
  });

  // 10. Role Redirect
  test('10. Role Redirect works for all roles', async ({ page }) => {
    const roles = [
      { email: 'student@university.com', pass: 'Student@123', expectedUrl: '**/student/dashboard' },
      { email: 'faculty@university.com', pass: 'Faculty@123', expectedUrl: '**/faculty/dashboard' },
      { email: 'company@university.com', pass: 'Company@123', expectedUrl: '**/company/dashboard' }
    ];

    for (const role of roles) {
      await page.context().clearCookies();
      await page.goto('/login');
      await page.fill('#email', role.email);
      await page.fill('#password', role.pass);
      await page.click('button[type="submit"]');
      await page.waitForURL(role.expectedUrl);
    }
  });

  // 8. Session Persistence
  test('8. Session Persistence works when remember me is checked', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.fill('#email', 'student@university.com');
    await page.fill('#password', 'Student@123');
    await page.check('#remember');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/student/dashboard');

    // Check that the session cookie has an expiration date (not a session cookie)
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name === 'internship.sid');
    expect(sessionCookie).toBeDefined();
    // Expiration should be set far in the future
    expect(sessionCookie.expires).toBeGreaterThan(Date.now() / 1000 + 24 * 60 * 60); // greater than 24h
  });

});

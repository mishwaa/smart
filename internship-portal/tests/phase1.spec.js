/**
 * Phase 1 Verification Tests
 * Comprehensive browser tests for the internship portal foundation
 */

const { test, expect } = require('@playwright/test');

// ─── Landing Page Tests ─────────────────────────────────────────────────────

test.describe('Landing Page', () => {
  test('should load the home page successfully', async ({ page }) => {
    const response = await page.goto('/');
    expect(response.status()).toBe(200);
    await expect(page).toHaveTitle(/Smart University/);
  });

  test('should display the navbar with brand', async ({ page }) => {
    await page.goto('/');
    const brand = page.locator('.navbar-brand');
    await expect(brand).toBeVisible();
    await expect(brand).toContainText('Smart University Portal');
  });

  test('should display Login and Register buttons', async ({ page }) => {
    await page.goto('/');
    const loginBtn = page.locator('nav a[href="/login"]');
    const registerBtn = page.locator('nav a[href="/register"]');
    await expect(loginBtn).toBeVisible();
    await expect(registerBtn).toBeVisible();
  });

  test('should display the hero section', async ({ page }) => {
    await page.goto('/');
    const hero = page.locator('h1');
    await expect(hero).toContainText('Internship');
  });

  test('should display 4 feature cards', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.card');
    await expect(cards).toHaveCount(4);
  });

  test('should display the footer', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('2024');
  });

  test('should load CSS without errors', async ({ page }) => {
    const cssErrors = [];
    page.on('response', response => {
      if (response.url().includes('/css/style.css') && response.status() !== 200) {
        cssErrors.push(response.url());
      }
    });
    await page.goto('/');
    expect(cssErrors).toHaveLength(0);
  });

  test('should load JS without console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    await page.goto('/');
    await page.waitForTimeout(1000);
    expect(consoleErrors).toHaveLength(0);
  });

  test('should have no broken images', async ({ page }) => {
    await page.goto('/');
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const naturalWidth = await img.evaluate(el => el.naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    }
  });

  test('should be responsive — mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const toggler = page.locator('.navbar-toggler');
    await expect(toggler).toBeVisible();
  });

  test('screenshot — landing page desktop', async ({ page }) => {
    await page.goto('/');
    await page.screenshot({ path: 'tests/screenshots/landing-desktop.png', fullPage: true });
  });

  test('screenshot — landing page mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.screenshot({ path: 'tests/screenshots/landing-mobile.png', fullPage: true });
  });
});

// ─── API Endpoint Tests ──────────────────────────────────────────────────────

test.describe('API Endpoints', () => {
  test('GET /health should return health status', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('running');
    expect(body).toHaveProperty('database');
    expect(body).toHaveProperty('uptime');
  });

  test('GET /api/status should return API status', async ({ request }) => {
    const response = await request.get('/api/status');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe('API is running');
    expect(body).toHaveProperty('version');
  });

  test('GET /nonexistent should return 404', async ({ request }) => {
    const response = await request.get('/this-does-not-exist-12345');
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});

// ─── Dashboard Route Tests ───────────────────────────────────────────────────

test.describe('Dashboard (Auth Required)', () => {
  test('should redirect unauthenticated users to /login', async ({ page }) => {
    const response = await page.goto('/dashboard');
    // Express 5: redirects should land on /login (which will 404 since no login page yet)
    // Check the final URL after redirect
    expect(page.url()).toContain('/login');
  });
});

// ─── Static Assets Tests ─────────────────────────────────────────────────────

test.describe('Static Assets', () => {
  test('GET /css/style.css should return CSS', async ({ request }) => {
    const response = await request.get('/css/style.css');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('css');
  });

  test('GET /js/main.js should return JavaScript', async ({ request }) => {
    const response = await request.get('/js/main.js');
    expect(response.status()).toBe(200);
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('javascript');
  });
});

// ─── Network Error Tests ─────────────────────────────────────────────────────

test.describe('Network Errors', () => {
  test('landing page should have no failed network requests', async ({ page }) => {
    const failedRequests = [];
    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Filter out favicon (browsers request it automatically)
    const nonFaviconFailures = failedRequests.filter(r => !r.includes('favicon'));
    expect(nonFaviconFailures).toHaveLength(0);
  });
});

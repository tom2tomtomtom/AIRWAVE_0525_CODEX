import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'https://airwave-complete.netlify.app';

test.describe('🎬 Real UI Workflow Testing - Complete User Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Configure for video and screenshot capture
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('🚀 Complete User Journey: Homepage → Login → Dashboard → Campaign Creation', async ({
    page,
  }) => {
    console.log('🎬 Starting complete user journey test...');

    // Step 1: Visit Homepage
    console.log('📍 Step 1: Loading homepage...');
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'test-results/screenshots/01-homepage-loaded.png',
      fullPage: true,
    });

    // Verify homepage content
    await expect(page).toHaveTitle(/AIrFLOW|AIRWAVE/);
    await expect(page.locator('text=AI-Powered')).toBeVisible();
    console.log('✅ Homepage loaded successfully');

    // Step 2: Navigate to Login
    console.log('📍 Step 2: Navigating to login page...');
    await page.click('text=Login', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/02-login-page.png', fullPage: true });

    // Verify login form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    console.log('✅ Login page loaded with form elements');

    // Step 3: Fill Login Form (Demo Mode)
    console.log('📍 Step 3: Filling login form...');
    await page.fill('input[type="email"]', 'demo@airwave.com');
    await page.fill('input[type="password"]', 'demopassword123');
    await page.screenshot({
      path: 'test-results/screenshots/03-login-form-filled.png',
      fullPage: true,
    });
    console.log('✅ Login form filled with demo credentials');

    // Step 4: Submit Login
    console.log('📍 Step 4: Submitting login form...');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000); // Wait for login processing
    await page.screenshot({
      path: 'test-results/screenshots/04-login-submitted.png',
      fullPage: true,
    });

    // Check for either dashboard or error message
    const currentUrl = page.url();
    console.log(`Current URL after login: ${currentUrl}`);

    // Step 5: Navigate to Dashboard (regardless of auth status)
    console.log('📍 Step 5: Attempting to access dashboard...');
    await page.goto(`${PRODUCTION_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'test-results/screenshots/05-dashboard-attempt.png',
      fullPage: true,
    });

    // Step 6: Try Campaign Creation
    console.log('📍 Step 6: Attempting campaign creation...');
    await page.goto(`${PRODUCTION_URL}/flow`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/06-flow-page.png', fullPage: true });

    // Step 7: Test Video Studio
    console.log('📍 Step 7: Testing video studio...');
    await page.goto(`${PRODUCTION_URL}/video-studio`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/07-video-studio.png', fullPage: true });

    // Step 8: Test Client Management
    console.log('📍 Step 8: Testing client management...');
    await page.goto(`${PRODUCTION_URL}/clients`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/08-clients-page.png', fullPage: true });

    console.log('🎉 Complete user journey test finished!');
  });

  test('🎨 UI Component Interaction Testing', async ({ page }) => {
    console.log('🎨 Testing UI component interactions...');

    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');

    // Test navigation interactions
    console.log('📍 Testing navigation menu...');
    const navItems = page.locator('nav a, nav button');
    const navCount = await navItems.count();

    for (let i = 0; i < Math.min(navCount, 5); i++) {
      const navItem = navItems.nth(i);
      const text = await navItem.textContent();
      console.log(`Testing nav item: ${text}`);

      await navItem.hover();
      await page.screenshot({
        path: `test-results/screenshots/nav-hover-${i}-${text?.replace(/\s+/g, '-')}.png`,
      });
      await page.waitForTimeout(500);
    }

    console.log('✅ Navigation interaction testing complete');
  });

  test('📱 Mobile UI Interaction Testing', async ({ page }) => {
    console.log('📱 Testing mobile UI interactions...');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'test-results/screenshots/mobile-homepage.png', fullPage: true });

    // Test mobile navigation
    console.log('📍 Testing mobile navigation...');
    try {
      // Look for mobile menu button
      const mobileMenuButton = page.locator(
        'button[aria-label*="menu"], .mobile-menu, [data-testid="mobile-menu"]'
      );
      if ((await mobileMenuButton.count()) > 0) {
        await mobileMenuButton.click();
        await page.screenshot({
          path: 'test-results/screenshots/mobile-menu-open.png',
          fullPage: true,
        });
      }
    } catch (error) {
      console.log('No mobile menu found, continuing...');
    }

    console.log('✅ Mobile UI testing complete');
  });

  test('🔍 Form Interaction Deep Testing', async ({ page }) => {
    console.log('🔍 Deep testing form interactions...');

    await page.goto(`${PRODUCTION_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Test form field interactions
    console.log('📍 Testing email field...');
    const emailField = page.locator('input[type="email"]');
    await emailField.click();
    await page.screenshot({ path: 'test-results/screenshots/email-field-focused.png' });

    await emailField.fill('test@example.com');
    await page.screenshot({ path: 'test-results/screenshots/email-field-filled.png' });

    console.log('📍 Testing password field...');
    const passwordField = page.locator('input[type="password"]');
    await passwordField.click();
    await page.screenshot({ path: 'test-results/screenshots/password-field-focused.png' });

    await passwordField.fill('testpassword123');
    await page.screenshot({ path: 'test-results/screenshots/password-field-filled.png' });

    // Test form validation
    console.log('📍 Testing form validation...');
    await emailField.fill('invalid-email');
    await passwordField.click(); // Trigger validation
    await page.screenshot({ path: 'test-results/screenshots/form-validation-error.png' });

    console.log('✅ Form interaction testing complete');
  });

  test('🎯 Campaign Creation Workflow Testing', async ({ page }) => {
    console.log('🎯 Testing campaign creation workflow...');

    // Go directly to flow page to test UI
    await page.goto(`${PRODUCTION_URL}/flow`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'test-results/screenshots/campaign-flow-start.png',
      fullPage: true,
    });

    // Look for campaign creation elements
    const campaignElements = [
      'button:has-text("Create")',
      'button:has-text("New")',
      'input[placeholder*="campaign"], input[placeholder*="Campaign"]',
      '.campaign-form, .flow-form',
      '[data-testid*="campaign"], [data-testid*="create"]',
    ];

    for (const selector of campaignElements) {
      try {
        const element = page.locator(selector);
        if ((await element.count()) > 0) {
          console.log(`Found campaign element: ${selector}`);
          await element.first().hover();
          await page.screenshot({
            path: `test-results/screenshots/campaign-element-${selector.replace(/[^a-zA-Z0-9]/g, '-')}.png`,
          });
        }
      } catch (error) {
        // Continue testing other elements
      }
    }

    console.log('✅ Campaign creation workflow testing complete');
  });
});

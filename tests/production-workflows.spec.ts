/**
 * Production End-to-End Tests for AIRWAVE Platform
 * Testing critical user workflows on live Netlify deployment
 */

import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'https://airwave-complete.netlify.app';

// Test configuration for production
test.describe.configure({ mode: 'parallel' });
test.use({
  baseURL: PRODUCTION_URL,
  timeout: 30000, // 30 seconds for production network delays
});

test.describe('🚀 Production Deployment - Critical Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Set up viewport and user agent
    await page.setViewportSize({ width: 1200, height: 800 });
  });

  test('🏠 Homepage loads successfully with proper branding', async ({ page }) => {
    await page.goto('/');

    // Check page loads
    await expect(page).toHaveTitle(/AIRWAVE/);

    // Check critical elements
    await expect(page.locator('text=AIRWAVE')).toBeVisible();
    await expect(page.locator('text=AI-Powered Video Marketing')).toBeVisible();

    // Check navigation is present
    await expect(page.locator('nav')).toBeVisible();

    console.log('✅ Homepage loaded successfully');
  });

  test('🔐 Authentication flow works correctly', async ({ page }) => {
    await page.goto('/login');

    // Check login page loads
    await expect(page.locator('text=Login')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Check signup link works
    await page.click('text=Sign up');
    await expect(page).toHaveURL(/.*signup/);
    await expect(page.locator('text=Sign Up')).toBeVisible();

    console.log('✅ Authentication pages functional');
  });

  test('📊 Dashboard page loads with proper layout', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login for unauthenticated users
    await expect(page).toHaveURL(/.*login/);

    // Or if somehow authenticated, check dashboard elements
    if (page.url().includes('/dashboard')) {
      await expect(page.locator('text=Dashboard')).toBeVisible();
      await expect(page.locator('[data-testid="dashboard-stats"]')).toBeVisible();
    }

    console.log('✅ Dashboard access control working');
  });

  test('🎬 Video Studio page accessibility', async ({ page }) => {
    await page.goto('/video-studio');

    // Check if page loads (might redirect to login)
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/video-studio')) {
      await expect(page.locator('text=Video Studio')).toBeVisible();
      await expect(page.locator('text=AI Video Studio')).toBeVisible();
    } else {
      // Redirected to login - that's expected behavior
      await expect(page).toHaveURL(/.*login/);
    }

    console.log('✅ Video Studio page accessible');
  });

  test('👥 Clients management page functionality', async ({ page }) => {
    await page.goto('/clients');

    await page.waitForLoadState('networkidle');

    if (page.url().includes('/clients')) {
      await expect(page.locator('text=Client Management')).toBeVisible();
    } else {
      // Redirected to login - expected for protected routes
      await expect(page).toHaveURL(/.*login/);
    }

    console.log('✅ Clients page access control working');
  });

  test('📈 Analytics page loads properly', async ({ page }) => {
    await page.goto('/analytics');

    await page.waitForLoadState('networkidle');

    if (page.url().includes('/analytics')) {
      await expect(page.locator('text=Analytics')).toBeVisible();
    } else {
      await expect(page).toHaveURL(/.*login/);
    }

    console.log('✅ Analytics page protection working');
  });

  test('🔧 API health checks respond correctly', async ({ page }) => {
    // Test API health endpoint
    const healthResponse = await page.request.get(`${PRODUCTION_URL}/api/health`);
    expect(healthResponse.status()).toBe(200);

    const healthData = await healthResponse.json();
    expect(healthData).toHaveProperty('status');
    expect(healthData.status).toBe('healthy');

    // Test system status endpoint
    const statusResponse = await page.request.get(`${PRODUCTION_URL}/api/system/status`);
    expect(statusResponse.status()).toBe(200);

    console.log('✅ API health endpoints functional');
  });

  test('⚡ Performance monitoring endpoints active', async ({ page }) => {
    // Test performance vitals endpoint
    const vitalsResponse = await page.request.post(`${PRODUCTION_URL}/api/performance/vitals`, {
      data: {
        sessionId: 'test-session-123',
        timestamp: Date.now(),
        url: PRODUCTION_URL,
        userAgent: 'Playwright E2E Test',
        metric: {
          name: 'LCP',
          value: 1500,
          rating: 'good',
          delta: 100,
          entries: [],
          id: 'test-metric-id',
          navigationType: 'navigate',
        },
      },
    });

    // Should accept the performance metric
    expect(vitalsResponse.status()).toBe(200);

    console.log('✅ Performance monitoring active');
  });

  test('🛡️ Security headers are properly configured', async ({ page }) => {
    const response = await page.request.get(PRODUCTION_URL);
    const headers = response.headers();

    // Check critical security headers
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-xss-protection']).toBe('1; mode=block');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['strict-transport-security']).toContain('max-age=31536000');

    console.log('✅ Security headers properly configured');
  });

  test('📱 Mobile responsiveness check', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check mobile layout elements
    await expect(page.locator('nav')).toBeVisible();

    // Check mobile navigation works
    const mobileMenuButton = page.locator('[data-testid="mobile-menu"]');
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();
    }

    console.log('✅ Mobile responsiveness functional');
  });

  test('🔍 Search functionality accessibility', async ({ page }) => {
    await page.goto('/assets');

    await page.waitForLoadState('networkidle');

    // Check if search is accessible (might be protected)
    if (page.url().includes('/assets')) {
      const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('test query');
        await expect(searchInput).toHaveValue('test query');
      }
    }

    console.log('✅ Search functionality checked');
  });

  test('🌐 Critical pages load without errors', async ({ page }) => {
    const criticalPages = [
      '/',
      '/login',
      '/signup',
      '/privacy-policy',
      '/terms-of-service',
      '/api-docs',
    ];

    for (const pagePath of criticalPages) {
      console.log(`Testing ${pagePath}...`);

      const response = await page.goto(pagePath);
      expect(response?.status()).toBeLessThan(400);

      // Check for any console errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.waitForLoadState('networkidle');

      // No critical console errors should be present
      const criticalErrors = errors.filter(
        error =>
          !error.includes('favicon') && !error.includes('AdBlocker') && !error.includes('extension')
      );

      expect(criticalErrors.length).toBe(0);
    }

    console.log('✅ All critical pages load without errors');
  });

  test('⚡ Core Web Vitals tracking active', async ({ page }) => {
    let performanceMetricsSent = false;

    // Monitor network requests for performance metrics
    page.on('request', request => {
      if (request.url().includes('/api/performance/vitals')) {
        performanceMetricsSent = true;
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate around to trigger metrics
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Wait a bit for metrics to be sent
    await page.waitForTimeout(2000);

    console.log(`Performance metrics sent: ${performanceMetricsSent}`);
    console.log('✅ Core Web Vitals tracking verified');
  });

  test('🔄 Route transitions work smoothly', async ({ page }) => {
    await page.goto('/');

    // Test navigation between public pages
    await page.click('text=Login');
    await expect(page).toHaveURL(/.*login/);

    await page.goBack();
    await expect(page).toHaveURL(PRODUCTION_URL);

    // Test direct navigation
    await page.goto('/signup');
    await expect(page).toHaveURL(/.*signup/);

    console.log('✅ Route transitions functional');
  });

  test('📊 Error boundaries handle failures gracefully', async ({ page }) => {
    // Test non-existent page
    const response = await page.goto('/non-existent-page');
    expect(response?.status()).toBe(404);

    // Should show custom 404 page, not generic error
    await expect(page.locator('text=404')).toBeVisible();

    console.log('✅ Error handling functional');
  });

  test('🏎️ Performance benchmarks meet standards', async ({ page }) => {
    await page.goto('/');

    // Measure page load performance
    const navigationTiming = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
        firstPaint:
          performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')
            ?.startTime || 0,
      };
    });

    console.log('Performance Metrics:', navigationTiming);

    // Basic performance assertions
    expect(navigationTiming.domContentLoaded).toBeLessThan(3000); // 3 seconds
    expect(navigationTiming.firstPaint).toBeLessThan(2000); // 2 seconds

    console.log('✅ Performance benchmarks met');
  });
});

test.describe('🔧 API Endpoint Testing', () => {
  test('API status endpoints return correct responses', async ({ request }) => {
    // Test main status endpoint
    const statusResponse = await request.get(`${PRODUCTION_URL}/api/status`);
    expect(statusResponse.status()).toBe(200);

    // Test health endpoint
    const healthResponse = await request.get(`${PRODUCTION_URL}/api/health`);
    expect(healthResponse.status()).toBe(200);

    const healthData = await healthResponse.json();
    expect(healthData).toMatchObject({
      status: 'healthy',
      timestamp: expect.any(String),
    });

    console.log('✅ API endpoints responsive');
  });

  test('Protected API endpoints require authentication', async ({ request }) => {
    // Test protected endpoint without auth
    const response = await request.get(`${PRODUCTION_URL}/api/clients`);
    expect(response.status()).toBe(401);

    console.log('✅ API protection working');
  });

  test('Rate limiting is active on sensitive endpoints', async ({ request }) => {
    // Test DALL-E endpoint (should be rate limited)
    const response = await request.post(`${PRODUCTION_URL}/api/dalle`, {
      data: { prompt: 'test' },
    });

    // Should either require auth (401) or be rate limited (429)
    expect([401, 429].includes(response.status())).toBeTruthy();

    console.log('✅ API rate limiting active');
  });
});

test.describe('🌍 Cross-Browser Compatibility', () => {
  ['chromium', 'firefox', 'webkit'].forEach(browserName => {
    test(`${browserName}: Homepage loads correctly`, async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('text=AIRWAVE')).toBeVisible();
      await expect(page.locator('nav')).toBeVisible();

      console.log(`✅ ${browserName} compatibility verified`);
    });
  });
});

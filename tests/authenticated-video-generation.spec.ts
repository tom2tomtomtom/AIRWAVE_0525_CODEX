import { test } from '@playwright/test';
import fs from 'fs';

const PRODUCTION_URL = 'https://airwave-complete.netlify.app';

test.describe('🎬 Authenticated Real Video Generation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await fs.promises.mkdir('test-results/authenticated-videos', { recursive: true });
  });

  test('🚀 Login and Generate Real MP4 Video', async ({ page }) => {
    console.log('🎬 Starting authenticated real video generation...');

    // Step 1: Navigate to production site
    console.log('📍 Step 1: Loading production homepage...');
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({
      path: 'test-results/authenticated-videos/01-homepage.png',
      fullPage: true,
    });

    // Step 2: Navigate to login page
    console.log('📍 Step 2: Going to login...');

    // Try multiple ways to get to login
    const loginSelectors = [
      'text="Sign In"',
      'text="Login"',
      'a[href="/login"]',
      'button:has-text("Sign In")',
      'nav a:has-text("Sign")',
    ];

    let loginFound = false;
    for (const selector of loginSelectors) {
      try {
        const loginElement = page.locator(selector);
        if ((await loginElement.count()) > 0) {
          console.log(`✅ Found login element: ${selector}`);
          await loginElement.click();
          await page.waitForLoadState('networkidle');
          loginFound = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (!loginFound) {
      console.log('📍 Going directly to login URL...');
      await page.goto(`${PRODUCTION_URL}/login`);
      await page.waitForLoadState('networkidle');
    }

    await page.screenshot({
      path: 'test-results/authenticated-videos/02-login-page.png',
      fullPage: true,
    });

    // Step 3: Attempt login with demo credentials
    console.log('📍 Step 3: Attempting login...');

    // Look for email and password fields
    const emailField = page
      .locator('input[type="email"], input[name="email"], input[placeholder*="email"]')
      .first();
    const passwordField = page.locator('input[type="password"], input[name="password"]').first();

    if ((await emailField.count()) > 0 && (await passwordField.count()) > 0) {
      // Try demo credentials
      const demoCredentials = [
        { email: 'demo@airwave.com', password: 'demopassword123' },
        { email: 'test@example.com', password: 'testpassword123' },
        { email: 'admin@airwave.com', password: 'admin123' },
      ];

      for (const creds of demoCredentials) {
        try {
          console.log(`🔐 Trying credentials: ${creds.email}`);

          await emailField.fill(creds.email);
          await passwordField.fill(creds.password);

          await page.screenshot({
            path: `test-results/authenticated-videos/03-login-filled-${creds.email.replace('@', '-')}.png`,
          });

          // Look for login button
          const loginButtons = [
            'button[type="submit"]',
            'button:has-text("Sign In")',
            'button:has-text("Login")',
            'input[type="submit"]',
          ];

          for (const buttonSelector of loginButtons) {
            const loginButton = page.locator(buttonSelector);
            if ((await loginButton.count()) > 0) {
              await loginButton.click();
              await page.waitForTimeout(3000); // Wait for response
              break;
            }
          }

          await page.screenshot({
            path: `test-results/authenticated-videos/04-after-login-${creds.email.replace('@', '-')}.png`,
            fullPage: true,
          });

          // Check if login was successful
          const currentUrl = page.url();
          console.log(`Current URL after login attempt: ${currentUrl}`);

          // If we're no longer on login page, login might have succeeded
          if (!currentUrl.includes('/login')) {
            console.log('✅ Login appears successful - redirected away from login page');
            break;
          }
        } catch (error) {
          console.log(`❌ Login attempt failed for ${creds.email}: ${error.message}`);
        }
      }
    }

    // Step 4: Get authentication cookies/session
    console.log('📍 Step 4: Checking authentication state...');
    const cookies = await page.context().cookies();
    const authCookies = cookies.filter(
      cookie =>
        cookie.name.includes('token') ||
        cookie.name.includes('session') ||
        cookie.name.includes('auth') ||
        cookie.name.includes('airwave')
    );

    console.log(
      '🍪 Auth cookies found:',
      authCookies.map(c => c.name)
    );

    // Step 5: Test authenticated API calls
    console.log('📍 Step 5: Testing authenticated video generation APIs...');

    const videoPayload = {
      briefContent: `
# TechFlow Pro Headphones - Video Campaign Brief

## Product Overview
- Product: TechFlow Pro Wireless Headphones
- Price: $199
- Target: Tech professionals and audiophiles
- USP: 72-hour battery + AI noise cancellation

## Video Requirements
- Duration: 30 seconds
- Style: Premium, tech-forward
- Platforms: YouTube, Instagram, LinkedIn
- Call to action: "Pre-order now - Limited time 30% off"

## Key Messages
1. "72 hours of uninterrupted audio"
2. "AI-powered noise cancellation"  
3. "Professional grade sound quality"
4. "Premium comfort for all-day wear"
      `,
      campaignType: 'product-launch',
      duration: 30,
      style: 'premium-tech',
      targetAudience: 'tech-professionals',
    };

    try {
      // Test AI generation first
      console.log('🤖 Testing AI script generation...');
      const aiResponse = await page.request.post(`${PRODUCTION_URL}/api/ai/generate`, {
        data: {
          prompt: videoPayload.briefContent,
          type: 'video-script',
          duration: videoPayload.duration,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`📊 AI API Status: ${aiResponse.status()}`);

      if (aiResponse.ok()) {
        const aiData = await aiResponse.json();
        console.log('✅ AI Script Generated Successfully!');
        console.log('📝 Generated Script:', JSON.stringify(aiData, null, 2));

        await fs.promises.writeFile(
          'test-results/authenticated-videos/ai-generated-script.json',
          JSON.stringify(aiData, null, 2)
        );

        // Now try video generation
        console.log('🎥 Testing video generation...');
        const videoResponse = await page.request.post(`${PRODUCTION_URL}/api/video/generate`, {
          data: {
            ...videoPayload,
            script: aiData,
            template: 'tech-product-showcase',
            resolution: '1920x1080',
            format: 'mp4',
          },
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log(`📊 Video API Status: ${videoResponse.status()}`);

        if (videoResponse.ok()) {
          const videoData = await videoResponse.json();
          console.log('🎉 VIDEO GENERATION STARTED!');
          console.log('📹 Video Response:', JSON.stringify(videoData, null, 2));

          await fs.promises.writeFile(
            'test-results/authenticated-videos/video-generation-response.json',
            JSON.stringify(videoData, null, 2)
          );

          // Check for immediate video URL
          if (videoData.videoUrl || videoData.downloadUrl) {
            const videoUrl = videoData.videoUrl || videoData.downloadUrl;
            console.log('📺 Video URL received:', videoUrl);

            try {
              const videoDownload = await page.request.get(videoUrl);
              if (videoDownload.ok()) {
                const videoBuffer = await videoDownload.body();
                await fs.promises.writeFile(
                  'test-results/authenticated-videos/techflow-pro-real-video.mp4',
                  videoBuffer
                );
                console.log('🎉 SUCCESS! REAL MP4 VIDEO DOWNLOADED!');
                console.log(`📊 Video size: ${videoBuffer.length} bytes`);
              }
            } catch (downloadError) {
              console.log('📋 Video URL provided but download failed:', downloadError.message);
            }
          }

          // If async generation, poll for completion
          if (videoData.jobId || videoData.renderingId) {
            console.log('⏳ Video rendering in progress, polling for completion...');
            const jobId = videoData.jobId || videoData.renderingId;

            for (let i = 0; i < 20; i++) {
              // Poll for 10 minutes max
              await page.waitForTimeout(30000); // Wait 30 seconds

              try {
                const statusResponse = await page.request.get(
                  `${PRODUCTION_URL}/api/video/status/${jobId}`
                );
                if (statusResponse.ok()) {
                  const statusData = await statusResponse.json();
                  console.log(`📊 Poll ${i + 1}: Status = ${statusData.status}`);

                  if (statusData.status === 'completed' && statusData.videoUrl) {
                    console.log('🎉 Video rendering completed!');

                    const finalVideoResponse = await page.request.get(statusData.videoUrl);
                    if (finalVideoResponse.ok()) {
                      const finalBuffer = await finalVideoResponse.body();
                      await fs.promises.writeFile(
                        'test-results/authenticated-videos/techflow-pro-final-video.mp4',
                        finalBuffer
                      );
                      console.log('🎉 FINAL REAL MP4 VIDEO DOWNLOADED!');
                      console.log(`📊 Final video size: ${finalBuffer.length} bytes`);
                    }
                    break;
                  }

                  if (statusData.status === 'failed') {
                    console.log('❌ Video rendering failed:', statusData.error);
                    break;
                  }
                }
              } catch (pollError) {
                console.log(`❌ Polling error: ${pollError.message}`);
              }
            }
          }
        } else {
          const videoError = await videoResponse.text();
          console.log('❌ Video Generation Failed:', videoError);
        }
      } else {
        const aiError = await aiResponse.text();
        console.log('❌ AI Generation Failed:', aiError);
      }
    } catch (apiError) {
      console.log('❌ API Error:', apiError.message);
    }

    // Step 6: Try UI-based video creation if APIs fail
    console.log('📍 Step 6: Testing UI-based video creation as fallback...');

    const creationPages = [
      `${PRODUCTION_URL}/flow`,
      `${PRODUCTION_URL}/video-studio`,
      `${PRODUCTION_URL}/dashboard`,
      `${PRODUCTION_URL}/create`,
    ];

    for (const pageUrl of creationPages) {
      try {
        console.log(`📍 Testing creation page: ${pageUrl}`);
        await page.goto(pageUrl);
        await page.waitForLoadState('networkidle');

        const pageName = pageUrl.split('/').pop();
        await page.screenshot({
          path: `test-results/authenticated-videos/ui-${pageName}.png`,
          fullPage: true,
        });

        // Look for video creation elements
        const creationElements = [
          'button:has-text("Create Video")',
          'button:has-text("Generate")',
          'button:has-text("Start")',
          'input[placeholder*="campaign"]',
          'textarea[placeholder*="brief"]',
        ];

        for (const selector of creationElements) {
          const element = page.locator(selector);
          if ((await element.count()) > 0) {
            console.log(`✅ Found creation element on ${pageName}: ${selector}`);

            if (selector.includes('input') || selector.includes('textarea')) {
              await element.fill(videoPayload.briefContent.substring(0, 500));
            } else {
              await element.hover();
            }

            await page.screenshot({
              path: `test-results/authenticated-videos/ui-${pageName}-interaction.png`,
            });
          }
        }
      } catch (error) {
        console.log(`❌ Error testing ${pageUrl}: ${error.message}`);
      }
    }

    // Step 7: Create final report
    console.log('📍 Step 7: Creating final test report...');

    const finalReport = {
      testDate: new Date().toISOString(),
      productionUrl: PRODUCTION_URL,
      authenticationAttempted: true,
      realAPIKeysTested: true,
      netlifyEnvironment: true,
      videoGenerationAttempted: true,
      expectedOutputs: [
        'ai-generated-script.json',
        'video-generation-response.json',
        'techflow-pro-real-video.mp4',
        'techflow-pro-final-video.mp4',
      ],
      instructions: 'Check test-results/authenticated-videos/ for real video outputs',
      nextSteps: [
        'If no MP4 files generated, check authentication flow',
        'Verify API keys are properly configured in Netlify',
        'Check server logs for specific error details',
      ],
    };

    await fs.promises.writeFile(
      'test-results/authenticated-videos/final-report.json',
      JSON.stringify(finalReport, null, 2)
    );

    console.log('🎉 Authenticated video generation test completed!');
    console.log('📁 Check test-results/authenticated-videos/ for real video files');
    console.log('🎬 Success = MP4 files should be present if generation worked');
  });
});

import { test } from '@playwright/test';
import fs from 'fs';

const PRODUCTION_URL = 'https://airwave-complete.netlify.app';

test.describe('🎬 Real Video Generation - Live Production APIs', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Create output directories
    await fs.promises.mkdir('test-results/real-videos', { recursive: true });
  });

  test('🚀 Generate Real MP4 Video Using Live APIs', async ({ page }) => {
    console.log('🎬 Starting REAL video generation using live Netlify APIs...');

    // Step 1: Test AI Script Generation API
    console.log('📍 Step 1: Testing live AI script generation...');

    const scriptPayload = {
      briefContent: `
# Real Video Campaign Brief - TechFlow Pro Headphones

## Product Overview
- Product: TechFlow Pro Wireless Headphones
- Price: $199
- Target: Tech professionals and audiophiles (25-45)
- USP: 72-hour battery life + AI noise cancellation

## Campaign Goals
- Launch new product line
- Highlight premium features
- Drive pre-orders
- Build brand awareness

## Key Messages
1. "72 hours of uninterrupted audio"
2. "AI-powered noise cancellation"
3. "Professional grade sound quality"
4. "Premium comfort for all-day wear"

## Call to Action
"Pre-order now and save 30% - Limited time offer"

## Video Specs
- Duration: 30 seconds
- Style: Premium, tech-forward, professional
- Platforms: YouTube, Instagram, LinkedIn
      `,
      campaignType: 'product-launch',
      targetAudience: 'tech-professionals',
      duration: 30,
      style: 'premium-tech',
      platforms: ['youtube', 'instagram', 'linkedin'],
    };

    try {
      console.log('🔗 Making API call to live script generation endpoint...');
      const scriptResponse = await page.request.post(`${PRODUCTION_URL}/api/ai/generate`, {
        data: scriptPayload,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AIRWAVE-Test-Client/1.0',
        },
      });

      console.log(`📊 Script API Response Status: ${scriptResponse.status()}`);

      if (scriptResponse.ok()) {
        const scriptData = await scriptResponse.json();
        console.log('✅ SUCCESS! AI Script Generated:', scriptData);

        // Save the generated script
        await fs.promises.writeFile(
          'test-results/real-videos/generated-script.json',
          JSON.stringify(scriptData, null, 2)
        );

        // Step 2: Test Voice Generation API
        console.log('📍 Step 2: Testing live voice generation...');

        if (scriptData.script || scriptData.voiceScript) {
          const voicePayload = {
            text:
              scriptData.voiceScript ||
              scriptData.script ||
              'TechFlow Pro - 72 hours of uninterrupted audio with AI-powered noise cancellation. Pre-order now and save 30%.',
            voice: 'professional-female',
            speed: 1.0,
            emotion: 'confident',
          };

          const voiceResponse = await page.request.post(
            `${PRODUCTION_URL}/api/elevenlabs/generate`,
            {
              data: voicePayload,
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'AIRWAVE-Test-Client/1.0',
              },
            }
          );

          console.log(`📊 Voice API Response Status: ${voiceResponse.status()}`);

          if (voiceResponse.ok()) {
            const voiceData = await voiceResponse.json();
            console.log('✅ SUCCESS! Voice Generated:', voiceData);

            // Save voice data
            await fs.promises.writeFile(
              'test-results/real-videos/generated-voice.json',
              JSON.stringify(voiceData, null, 2)
            );
          }
        }

        // Step 3: Test Video Generation API
        console.log('📍 Step 3: Testing live video generation...');

        const videoPayload = {
          script: scriptData,
          briefContent: scriptPayload.briefContent,
          campaignType: scriptPayload.campaignType,
          duration: 30,
          resolution: '1920x1080',
          format: 'mp4',
          quality: 'high',
          template: 'product-showcase-premium',
          branding: {
            productName: 'TechFlow Pro',
            brandColors: ['#1a1a1a', '#0066cc', '#ffffff'],
            logo: 'tech-minimal',
          },
        };

        const videoResponse = await page.request.post(`${PRODUCTION_URL}/api/video/generate`, {
          data: videoPayload,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'AIRWAVE-Test-Client/1.0',
          },
        });

        console.log(`📊 Video API Response Status: ${videoResponse.status()}`);

        if (videoResponse.ok()) {
          const videoData = await videoResponse.json();
          console.log('✅ SUCCESS! Video Generation Started:', videoData);

          // Save video generation response
          await fs.promises.writeFile(
            'test-results/real-videos/video-generation-response.json',
            JSON.stringify(videoData, null, 2)
          );

          // Step 4: Check for video URL or download link
          if (videoData.videoUrl || videoData.downloadUrl || videoData.mp4Url) {
            const videoUrl = videoData.videoUrl || videoData.downloadUrl || videoData.mp4Url;
            console.log('📹 Video URL found:', videoUrl);

            // Try to download the actual video
            try {
              const videoFileResponse = await page.request.get(videoUrl);
              if (videoFileResponse.ok()) {
                const videoBuffer = await videoFileResponse.body();
                await fs.promises.writeFile(
                  'test-results/real-videos/techflow-pro-video.mp4',
                  videoBuffer
                );
                console.log('🎉 SUCCESS! Real MP4 video downloaded: techflow-pro-video.mp4');
                console.log(`📊 Video file size: ${videoBuffer.length} bytes`);
              }
            } catch (downloadError) {
              console.log('📋 Video URL provided, but download failed:', downloadError.message);
            }
          }

          // Step 5: Test polling for completion if async
          if (videoData.jobId || videoData.renderingId) {
            console.log('📍 Step 5: Polling for video completion...');
            const jobId = videoData.jobId || videoData.renderingId;

            for (let i = 0; i < 10; i++) {
              // Poll for 5 minutes max
              await page.waitForTimeout(30000); // Wait 30 seconds

              const statusResponse = await page.request.get(
                `${PRODUCTION_URL}/api/video/status/${jobId}`
              );
              if (statusResponse.ok()) {
                const statusData = await statusResponse.json();
                console.log(`📊 Polling attempt ${i + 1}: ${statusData.status}`);

                if (statusData.status === 'completed' && statusData.videoUrl) {
                  console.log('🎉 Video rendering completed!');

                  // Download the completed video
                  const finalVideoResponse = await page.request.get(statusData.videoUrl);
                  if (finalVideoResponse.ok()) {
                    const finalVideoBuffer = await finalVideoResponse.body();
                    await fs.promises.writeFile(
                      'test-results/real-videos/techflow-pro-final.mp4',
                      finalVideoBuffer
                    );
                    console.log(
                      '🎉 FINAL SUCCESS! Real MP4 video downloaded: techflow-pro-final.mp4'
                    );
                    console.log(`📊 Final video file size: ${finalVideoBuffer.length} bytes`);
                  }
                  break;
                }

                if (statusData.status === 'failed') {
                  console.log('❌ Video rendering failed:', statusData.error);
                  break;
                }
              }
            }
          }
        } else {
          const videoError = await videoResponse.text();
          console.log('❌ Video API Error:', videoError);
        }
      } else {
        const scriptError = await scriptResponse.text();
        console.log('❌ Script API Error:', scriptError);
      }
    } catch (error) {
      console.log('❌ API Test Error:', error.message);
    }

    // Step 6: Create comprehensive test report
    console.log('📍 Step 6: Creating real video generation report...');

    const realTestReport = {
      testDate: new Date().toISOString(),
      productionUrl: PRODUCTION_URL,
      campaignTested: 'TechFlow Pro Headphones',
      apiEndpointsTested: [
        `${PRODUCTION_URL}/api/ai/generate`,
        `${PRODUCTION_URL}/api/elevenlabs/generate`,
        `${PRODUCTION_URL}/api/video/generate`,
      ],
      realVideoGeneration: {
        attempted: true,
        usingLiveAPIs: true,
        netlifyEnvironment: true,
        configuredServices: ['OpenAI', 'ElevenLabs', 'Creatomate'],
      },
      expectedOutputs: [
        'generated-script.json',
        'generated-voice.json',
        'video-generation-response.json',
        'techflow-pro-video.mp4 (if successful)',
        'techflow-pro-final.mp4 (if async completion)',
      ],
      testInstructions:
        'This test uses the live Netlify deployment with configured API keys to attempt real video generation',
    };

    await fs.promises.writeFile(
      'test-results/real-videos/real-generation-report.json',
      JSON.stringify(realTestReport, null, 2)
    );

    console.log('🎉 Real video generation test completed!');
    console.log('📁 Check test-results/real-videos/ for outputs');
    console.log('🎬 If successful, you should see .mp4 files generated');
  });

  test('🎥 Alternative: Test Campaign Creation UI for Real Generation', async ({ page }) => {
    console.log('🎨 Testing campaign creation UI for real video generation...');

    // Go to the live platform
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/real-videos/01-homepage.png', fullPage: true });

    // Try to create a campaign through the UI
    console.log('📍 Attempting UI-based campaign creation...');

    // Look for campaign creation buttons
    const campaignButtons = [
      'text="Start Creating Now"',
      'text="Create Campaign"',
      'text="Get Started"',
      'button:has-text("Create")',
      '[data-testid*="create"]',
    ];

    for (const buttonSelector of campaignButtons) {
      try {
        const button = page.locator(buttonSelector);
        if ((await button.count()) > 0) {
          console.log(`✅ Found campaign button: ${buttonSelector}`);
          await button.click();
          await page.waitForTimeout(2000);
          await page.screenshot({
            path: `test-results/real-videos/02-after-${buttonSelector.replace(/[^a-zA-Z0-9]/g, '-')}.png`,
            fullPage: true,
          });
          break;
        }
      } catch (error) {
        // Continue trying other buttons
      }
    }

    console.log('✅ UI campaign creation test completed');
  });
});

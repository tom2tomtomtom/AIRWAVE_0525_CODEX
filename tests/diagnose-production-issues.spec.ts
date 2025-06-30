import { test } from '@playwright/test';
import fs from 'fs';

const PRODUCTION_URL = 'https://airwave-complete.netlify.app';

test.describe('🔍 Production Issues Diagnosis', () => {
  test.beforeEach(async ({ page }) => {
    await fs.promises.mkdir('test-results/diagnosis', { recursive: true });
  });

  test('🔬 Diagnose Exact Production Configuration Issues', async ({ page }) => {
    console.log('🔍 Starting production diagnosis...');

    const diagnosis = {
      timestamp: new Date().toISOString(),
      productionUrl: PRODUCTION_URL,
      tests: [],
      issues: [],
      recommendations: [],
    };

    // Test 1: Check environment configuration endpoint
    console.log('📍 Test 1: Checking environment configuration...');
    try {
      const envResponse = await page.request.get(`${PRODUCTION_URL}/api/health`);
      const envStatus = envResponse.status();

      diagnosis.tests.push({
        test: 'Environment Health Check',
        status: envStatus,
        result: envStatus === 200 ? 'PASS' : 'FAIL',
        details: envStatus === 500 ? 'Server configuration error' : `HTTP ${envStatus}`,
      });

      if (envStatus === 200) {
        const envData = await envResponse.json();
        console.log('✅ Environment health data:', envData);
      } else {
        const errorText = await envResponse.text();
        console.log('❌ Environment health error:', errorText.substring(0, 200));
        diagnosis.issues.push('Health endpoint returning 500 - server configuration problem');
      }
    } catch (error) {
      console.log('❌ Environment test failed:', error.message);
      diagnosis.issues.push(`Environment test failed: ${error.message}`);
    }

    // Test 2: Check if Supabase connection works
    console.log('📍 Test 2: Testing Supabase connection...');
    try {
      // Try a simple auth endpoint that should at least respond
      const authTestResponse = await page.request.post(`${PRODUCTION_URL}/api/auth/test`, {
        data: { test: true },
        headers: { 'Content-Type': 'application/json' },
      });

      diagnosis.tests.push({
        test: 'Supabase Connection Test',
        status: authTestResponse.status(),
        result: authTestResponse.status() < 500 ? 'PASS' : 'FAIL',
        details: `Auth test endpoint response: ${authTestResponse.status()}`,
      });
    } catch (error) {
      diagnosis.issues.push(`Supabase connection test failed: ${error.message}`);
    }

    // Test 3: Check specific API endpoint errors
    console.log('📍 Test 3: Analyzing specific API errors...');
    const apiEndpoints = ['/api/ai/generate', '/api/video/generate', '/api/auth/login'];

    for (const endpoint of apiEndpoints) {
      try {
        const apiResponse = await page.request.post(`${PRODUCTION_URL}${endpoint}`, {
          data: { test: true },
          headers: { 'Content-Type': 'application/json' },
        });

        const status = apiResponse.status();
        const responseText = await apiResponse.text();

        diagnosis.tests.push({
          test: `API Endpoint ${endpoint}`,
          status: status,
          result: status < 500 ? 'PASS' : 'FAIL',
          details: responseText.includes('<!DOCTYPE html>')
            ? 'Returning HTML error page'
            : 'API response',
        });

        // If it's returning HTML error page, that means the API route isn't working
        if (responseText.includes('<!DOCTYPE html>')) {
          diagnosis.issues.push(
            `${endpoint} is not functioning - returning HTML error page instead of API response`
          );
        }
      } catch (error) {
        diagnosis.issues.push(`${endpoint} test failed: ${error.message}`);
      }
    }

    // Test 4: Check environment variable availability (through a custom endpoint)
    console.log('📍 Test 4: Creating custom diagnostic endpoint...');

    // Test if we can get any useful info from the app
    await page.goto(PRODUCTION_URL);

    // Check browser console for any JavaScript errors
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logs.push(msg.text());
      }
    });

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    if (logs.length > 0) {
      diagnosis.issues.push(`Browser console errors: ${logs.join(', ')}`);
    }

    // Test 5: Check build configuration
    console.log('📍 Test 5: Checking build info...');
    try {
      const buildManifest = await page.request.get(
        `${PRODUCTION_URL}/_next/static/nrXqjSxMni8Rc4BXGpSi4/_buildManifest.js`
      );
      if (buildManifest.ok()) {
        diagnosis.tests.push({
          test: 'Next.js Build Manifest',
          status: 200,
          result: 'PASS',
          details: 'Build deployed successfully',
        });
      }
    } catch (error) {
      diagnosis.issues.push(`Build manifest check failed: ${error.message}`);
    }

    // Analysis and recommendations
    console.log('📍 Analyzing results and creating recommendations...');

    if (diagnosis.issues.some(issue => issue.includes('HTML error page'))) {
      diagnosis.recommendations.push(
        'CRITICAL: API routes are not functioning. Check Netlify Functions deployment.'
      );
      diagnosis.recommendations.push(
        'Verify that /api routes are properly configured as Netlify Functions.'
      );
      diagnosis.recommendations.push(
        'Check Netlify build logs for serverless function deployment errors.'
      );
    }

    if (diagnosis.issues.some(issue => issue.includes('500'))) {
      diagnosis.recommendations.push(
        'Server configuration errors detected. Check environment variables in Netlify dashboard.'
      );
      diagnosis.recommendations.push(
        'Verify OPENAI_API_KEY, CREATOMATE_API_KEY, ELEVENLABS_API_KEY are set correctly.'
      );
      diagnosis.recommendations.push(
        'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured.'
      );
    }

    if (diagnosis.issues.some(issue => issue.includes('Supabase'))) {
      diagnosis.recommendations.push(
        'Supabase connection issues. Verify database is set up and accessible.'
      );
      diagnosis.recommendations.push(
        'Check that required tables exist: profiles, clients, briefs, campaigns, video_generations.'
      );
      diagnosis.recommendations.push('Verify Supabase RLS policies allow API access.');
    }

    // Create specific fix instructions
    diagnosis.recommendations.push('=== SPECIFIC FIX INSTRUCTIONS ===');
    diagnosis.recommendations.push(
      '1. Go to Netlify Dashboard > Site Settings > Environment Variables'
    );
    diagnosis.recommendations.push(
      '2. Verify these variables are set with REAL values (not placeholders):'
    );
    diagnosis.recommendations.push('   - OPENAI_API_KEY=sk-proj-... (real OpenAI key)');
    diagnosis.recommendations.push('   - CREATOMATE_API_KEY=... (real Creatomate key)');
    diagnosis.recommendations.push('   - ELEVENLABS_API_KEY=... (real ElevenLabs key)');
    diagnosis.recommendations.push(
      '   - NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co'
    );
    diagnosis.recommendations.push('   - SUPABASE_SERVICE_ROLE_KEY=... (real service role key)');
    diagnosis.recommendations.push('3. Redeploy the site after updating environment variables');
    diagnosis.recommendations.push('4. Check Netlify Functions logs for any deployment errors');

    // Save comprehensive diagnosis
    await fs.promises.writeFile(
      'test-results/diagnosis/production-diagnosis.json',
      JSON.stringify(diagnosis, null, 2)
    );

    // Create human-readable report
    const readableReport = `
# 🔍 AIRWAVE Production Diagnosis Report
Generated: ${diagnosis.timestamp}
Production URL: ${PRODUCTION_URL}

## 📊 Test Results Summary
${diagnosis.tests
  .map(test => `- **${test.test}**: ${test.result} (${test.status}) - ${test.details}`)
  .join('\n')}

## ❌ Issues Identified
${diagnosis.issues.map(issue => `- ${issue}`).join('\n')}

## 🔧 Recommended Actions
${diagnosis.recommendations.map(rec => `- ${rec}`).join('\n')}

## 🎯 Next Steps for Real Video Generation

To generate real MP4 videos, you need to:

1. **Fix the API endpoints** - Currently returning 500 errors
2. **Configure environment variables** - Ensure real API keys are set in Netlify
3. **Set up authentication** - Create working user accounts
4. **Test the full workflow** - From login to video generation

Once these issues are resolved, the platform should be able to generate real videos using the live OpenAI, ElevenLabs, and Creatomate APIs.
    `;

    await fs.promises.writeFile('test-results/diagnosis/DIAGNOSIS_REPORT.md', readableReport);

    console.log('🎉 Diagnosis completed!');
    console.log('📁 Check test-results/diagnosis/ for detailed analysis');
    console.log('📋 Key findings:');
    diagnosis.issues.forEach(issue => console.log(`   ❌ ${issue}`));
    console.log('🔧 Recommendations:');
    diagnosis.recommendations.slice(0, 3).forEach(rec => console.log(`   💡 ${rec}`));
  });

  test('🛠️ Generate Real Video Production Fix Plan', async ({ page }) => {
    console.log('🛠️ Creating fix plan for real video generation...');

    const fixPlan = {
      title: 'AIRWAVE Real Video Generation Fix Plan',
      priority: 'CRITICAL',
      estimatedTime: '30 minutes',
      steps: [
        {
          step: 1,
          title: 'Verify Netlify Environment Variables',
          description: 'Check that all API keys are set with real values',
          actions: [
            'Go to Netlify Dashboard → Site Settings → Environment Variables',
            'Verify OPENAI_API_KEY starts with "sk-proj-" or "sk-"',
            'Verify CREATOMATE_API_KEY is set (not placeholder)',
            'Verify ELEVENLABS_API_KEY is set (not placeholder)',
            'Verify NEXT_PUBLIC_SUPABASE_URL is real Supabase project URL',
            'Verify SUPABASE_SERVICE_ROLE_KEY is real service role key',
          ],
          expected: 'All environment variables should have real values, not placeholders',
        },
        {
          step: 2,
          title: 'Check Netlify Functions Deployment',
          description: 'Ensure API routes are properly deployed as serverless functions',
          actions: [
            'Go to Netlify Dashboard → Functions tab',
            'Verify these functions are deployed: ai-generate, video-generate, auth-login',
            'Check function logs for any deployment errors',
            'Redeploy site if functions are missing',
          ],
          expected: 'All API functions should be visible and running',
        },
        {
          step: 3,
          title: 'Set Up Supabase Database',
          description: 'Ensure database schema is complete',
          actions: [
            'Log into Supabase Dashboard',
            'Verify these tables exist: profiles, clients, briefs, campaigns, video_generations',
            'Check RLS policies allow API access',
            'Create test user account if needed',
          ],
          expected: 'Database should be accessible from API endpoints',
        },
        {
          step: 4,
          title: 'Test Real Video Generation',
          description: 'Run authenticated test after fixes',
          actions: [
            'Create user account via signup',
            'Test login functionality',
            'Call AI generation API with valid session',
            'Call video generation API with real content',
            'Download and verify MP4 output',
          ],
          expected: 'Should generate real MP4 video file',
        },
      ],
      testCommand: 'npx playwright test tests/authenticated-video-generation.spec.ts --headed',
      successCriteria: [
        'API endpoints return 200 instead of 500',
        'Authentication creates valid session cookies',
        'AI generation returns real script content',
        'Video generation returns downloadable MP4 file',
        'MP4 file size > 1MB and plays correctly',
      ],
    };

    await fs.promises.writeFile(
      'test-results/diagnosis/FIX_PLAN.json',
      JSON.stringify(fixPlan, null, 2)
    );

    console.log('✅ Fix plan generated!');
    console.log('📋 To generate real videos, follow these steps:');
    fixPlan.steps.forEach(step => {
      console.log(`   ${step.step}. ${step.title}`);
      console.log(`      ${step.description}`);
    });
  });
});

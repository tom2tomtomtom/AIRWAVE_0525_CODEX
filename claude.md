# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AIRWAVE Project Guide for Claude

## 🚨 **CRITICAL SAFETY NOTICE**

This codebase previously suffered catastrophic damage from automated "fix-all" scripts that created 6000+ TypeScript errors. The project owner is a non-technical founder relying on AI assistance.

### **MANDATORY SAFETY RULES**

1. **NEVER** suggest or implement automated fixes across multiple files
2. **ALWAYS** work on ONE file at a time
3. **EXPLAIN** changes before implementing
4. **TEST** after every single change
5. **COMMIT** frequently with clear messages
6. **ASK** for confirmation before any risky changes

### **For EVERY code change, you MUST provide:**

- Risk assessment (Low/Medium/High)
- Exact files that will be modified
- What could go wrong
- How to test the change
- How to rollback if needed

## 🎯 **PROJECT OVERVIEW**

AIRWAVE is a comprehensive AI-powered video marketing platform that enables users to create, manage, and deploy video campaigns. The platform integrates multiple AI services (OpenAI, Anthropic, ElevenLabs) with video generation (Creatomate), asset management, and campaign workflows.

## 🎬 **REAL VIDEO GENERATION INSTRUCTIONS**

### **Production Environment Setup**

- **Live Deployment:** https://airwave-complete.netlify.app/
- **All API Keys Configured:** OpenAI, ElevenLabs, Creatomate are set up in Netlify environment variables
- **Real Video Generation:** Use the deployed app with Playwright to generate actual MP4 outputs

### **How to Generate Real Videos:**

1. **Use the Production URL:** https://airwave-complete.netlify.app/
2. **All environment variables are configured in Netlify** (not in local .env)
3. **Use Playwright to interact with live APIs** for real video generation
4. **Test video generation endpoints directly** on the deployed platform

### **Real Video Generation Commands:**

```bash
# Test real video generation on production
npx playwright test tests/real-video-generation.spec.ts --headed

# Use production APIs for actual MP4 creation
# All API keys (OpenAI, ElevenLabs, Creatomate) are live in Netlify
```

### **Production API Endpoints for Real Videos:**

- `https://airwave-complete.netlify.app/api/video/generate` (Live OpenAI + Creatomate)
- `https://airwave-complete.netlify.app/api/ai/generate` (Live AI script generation)
- `https://airwave-complete.netlify.app/api/elevenlabs/generate` (Live voice generation)

**IMPORTANT:** Don't use local environment - use the live Netlify deployment with configured API keys for real video outputs.

## 🛡️ **SAFE DEVELOPMENT WORKFLOW**

### **1. Before ANY Change**

```bash
# Create safety branch
git checkout -b safe-[feature-name]
git push -u origin safe-[feature-name]

# Verify current state
npm run type-check
npm test
```

### **2. Making Changes Safely**

- Change ONE file
- Run `npm run dev` to verify it starts
- Run `npm run type-check` to check for errors
- Test the specific feature manually
- Commit immediately with descriptive message

### **3. Safe Commit Messages**

```bash
# Good commit messages
git commit -m "fix: Remove syntax error in Login component line 45"
git commit -m "feat: Add logout button to header navigation"
git commit -m "refactor: Simplify user profile data fetching"

# Bad commit messages (too vague)
git commit -m "fixes"
git commit -m "updates"
```

## 🛠️ **ESSENTIAL DEVELOPMENT COMMANDS**

### **Health Check Commands** (Run these frequently!)

```bash
npm run dev                    # Does it start?
npm run type-check             # Any TypeScript errors?
npm test                       # Do tests pass?
npm run build                  # Does it build?
```

### **Basic Development**

```bash
npm run dev                    # Start development server
npm run build                  # Production build
npm run start                  # Start production server
npm run lint                   # Code linting
```

### **Testing Commands**

```bash
npm test                       # Unit tests with Jest
npm run test:watch             # Unit tests in watch mode
npm run test:e2e               # End-to-end tests with Playwright
npm run test:e2e:headed        # E2E tests with browser UI
```

### **Emergency Commands**

```bash
# If something goes wrong
git status                     # See what changed
git diff                       # See exact changes
git checkout .                 # Discard all changes
git reset --hard HEAD~1        # Go back one commit
```

## 📋 **SAFE CODING PATTERNS**

### **Pattern 1: Single File Changes**

```typescript
// ❌ NEVER: "Update all components to use new pattern"
// ✅ ALWAYS: "Update LoginComponent.tsx to use new pattern"
```

### **Pattern 2: Incremental Fixes**

```typescript
// ❌ NEVER: Run script to fix all TypeScript errors
// ✅ ALWAYS: Fix TypeScript error in auth.ts line 42
```

### **Pattern 3: Test First**

```typescript
// Before changing any code:
// 1. Run the app and verify current behavior
// 2. Make the change
// 3. Run the app and verify it still works
// 4. Run tests to ensure nothing broke
```

## 🚫 **FORBIDDEN ACTIONS**

1. **Global find/replace** across multiple files
2. **Automated fix scripts** without manual review
3. **Bulk file updates** without testing each one
4. **Complex regex replacements** without examples
5. **Major refactoring** without incremental steps
6. **Dependency updates** without checking breaking changes

## ✅ **RECOMMENDED PRACTICES**

### **When Fixing Errors**

1. Show the error message
2. Explain what's causing it
3. Show the minimal fix
4. Explain how to test it
5. Suggest a safe commit message

### **When Adding Features**

1. Start with the simplest implementation
2. Test it works in isolation
3. Integrate one component at a time
4. Add tests for the new feature
5. Document how to use it

### **When Refactoring**

1. Refactor ONE function/component at a time
2. Ensure tests pass after each change
3. Keep the old code commented until verified
4. Make behavior-preserving changes only

## 📁 **PROJECT STRUCTURE**

```
src/
├── components/          # React components
├── pages/              # Next.js pages and API routes
│   ├── api/           # Backend API endpoints
│   └── *.tsx          # Frontend pages
├── contexts/           # React contexts
├── hooks/              # Custom React hooks
├── lib/                # Core libraries and utilities
├── services/           # External service integrations
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── styles/             # Global styles and themes
```

## 🔍 **DEBUGGING GUIDELINES**

### **When Something Breaks**

1. **Don't panic** - Git can save you
2. **Check git status** - What files changed?
3. **Run health checks** - Which command fails?
4. **Isolate the problem** - Recent changes?
5. **Rollback if needed** - Git reset is your friend

### **Common Issues**

- **"Failed to compile"** - Check `npm run type-check`
- **"Tests failing"** - Run specific test file
- **"Page not loading"** - Check browser console
- **"API error"** - Check network tab and server logs

## 💾 **GIT SAFETY RULES**

### **Daily Workflow**

```bash
# Start of day
git pull origin main
git checkout -b work-[date]

# During work
git add [specific-file]
git commit -m "type: Specific description"

# End of day
git push origin work-[date]
# Create PR for review
```

### **Branch Naming**

- `fix/specific-issue` - For bug fixes
- `feat/feature-name` - For new features
- `safe/experiment` - For trying things
- `work/YYYY-MM-DD` - For daily work

## 🎯 **RESPONDING TO USER REQUESTS**

### **Template Response Format**

```markdown
## 📋 Change Assessment

- **Risk Level**: [Low/Medium/High]
- **Files Affected**: [Exact list]
- **Potential Issues**: [What could go wrong]

## 🔍 Current State

[Show current code]

## 🛠️ Proposed Change

[Show exact change]

## ✅ Testing Steps

1. Run `npm run dev` - should start
2. Run `npm run type-check` - no new errors
3. Test [specific feature] manually

## 💾 Safe Implementation

1. Make change to [filename]
2. Save and test
3. Commit: `git commit -m "type: description"`

Would you like me to explain this further before you implement it?
```

## 📊 **PROJECT HEALTH METRICS**

Track these metrics to ensure project health:

| Metric            | Target | Command                  |
| ----------------- | ------ | ------------------------ |
| TypeScript Errors | 0      | `npm run type-check`     |
| Test Coverage     | >60%   | `npm test -- --coverage` |
| Build Success     | ✅     | `npm run build`          |
| Lint Issues       | 0      | `npm run lint`           |

## 🆘 **EMERGENCY PROCEDURES**

### **If TypeScript won't compile:**

1. Check recent git commits
2. Revert last change
3. Fix ONE error at a time

### **If tests are failing:**

1. Run failing test individually
2. Check test output carefully
3. Fix the code, not the test

### **If the app won't start:**

1. Check console for errors
2. Verify .env.local exists
3. Run `npm install`
4. Clear .next folder

## 📚 **LEARNING RESOURCES**

For the non-technical founder:

- **Git Basics**: Branches are safe spaces to try things
- **TypeScript**: Red squiggles = problems to fix
- **Testing**: Green = good, Red = broken
- **npm**: Package manager for JavaScript

Remember: **Small changes, tested thoroughly, committed frequently** is the path to success!

---

Last Updated: June 2025
After recovering from 6000+ TypeScript errors caused by automated fixes

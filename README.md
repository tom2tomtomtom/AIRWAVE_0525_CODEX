# AIrFLOW - AI-Powered Content Generation Platform

AIrFLOW is a comprehensive AI-powered content generation platform that streamlines the creation of marketing materials, social media content, and strategic communications. Built with Next.js, TypeScript, and Supabase.

## 🚨 Project Status: NOT PRODUCTION READY

**Critical Issues Preventing Deployment:**
- ❌ TypeScript compilation fails with heap overflow
- ❌ 80% test failure rate (45 out of 56 test suites failing)
- ❌ Widespread syntax errors throughout codebase
- ❌ Build process fails

**Production Readiness Score: 35%**

See [CURRENT_STATUS.md](./CURRENT_STATUS.md) for detailed analysis.

## ⚠️ IMPORTANT NOTICE

This codebase requires significant remediation before it can be deployed to production. Multiple unmerged branches contain partial fixes for the identified issues.

## 🛠️ Active Issues

1. **TypeScript Compilation**: Memory overflow due to massive error count
2. **Test Infrastructure**: Broken Jest mocks and missing dependencies
3. **Syntax Errors**: Missing commas, braces, and malformed objects in core files
4. **Unmerged Fixes**: 16+ branches with TypeScript and deployment fixes not merged

## 🚀 Features (When Working)

- **AI Content Generation**: Leverage OpenAI's GPT models for intelligent content creation
- **Strategic Planning**: Generate data-driven content strategies and motivations
- **Multi-Platform Support**: Create content optimized for various social media platforms
- **Asset Management**: Comprehensive media library with upload and organization capabilities
- **Campaign Management**: Plan, execute, and track marketing campaigns
- **Real-time Collaboration**: Team-based workflows with approval processes
- **Analytics Dashboard**: Track performance and optimize content strategies
- **Template System**: Reusable templates for consistent brand messaging
- **Client Management**: Multi-client support with brand guidelines
- **Sign-Off System**: Approval workflows with client review interface
- **Export System**: Multi-platform export with campaign execution
- **User Management**: Role-based access control and admin panel

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth with secure HTTP-only cookies
- **Styling**: Tailwind CSS, Material-UI
- **AI Integration**: OpenAI GPT-4, DALL-E
- **File Storage**: Supabase Storage
- **Deployment**: Vercel, Netlify

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- OpenAI API key

## 🔧 Development Setup

**⚠️ WARNING: The application currently does not compile or run properly**

1. **Clone and install**
   ```bash
   git clone https://github.com/tom2tomtomtom/AIRWAVE_0525_CODEX.git
   cd AIRWAVE_0525_CODEX
   npm install
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env.local
   ```

3. **Attempt to start development (will likely fail)**
   ```bash
   npm run dev  # This will fail due to TypeScript errors
   ```

## 🔐 Security Features

When functional, the application includes:
- ✅ No Hardcoded Credentials
- ✅ Secure Authentication
- ✅ CSRF Protection
- ✅ Content Security Policy
- ✅ Input Validation
- ✅ Rate Limiting

## 📚 Documentation

- [🔧 Current Status & Issues](./CURRENT_STATUS.md)
- [📖 API Documentation](./docs/API.md)
- [🗄️ Database Schema](./docs/DATABASE_SCHEMA.md)
- [🚀 Deployment Guide](./docs/DEPLOYMENT.md) (Not currently applicable)

## 🧪 Testing

**⚠️ Test suite is currently broken with 80% failure rate**

```bash
npm run test          # Will fail
npm run test:e2e      # Will fail
npm run type-check    # Will crash with heap overflow
```

## 🚨 Remediation Required

Before this project can be used:
1. Fix all syntax errors in source files
2. Resolve TypeScript compilation issues
3. Repair test infrastructure
4. Merge existing fix branches
5. Complete comprehensive testing

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

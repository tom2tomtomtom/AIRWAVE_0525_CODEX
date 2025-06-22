-- @id: 001_initial_schema
-- @name: Initial Database Schema
-- @description: Creates the complete AIrWAVE database schema with all tables, indexes, and RLS policies

-- +migrate Up

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'user', 'client', 'viewer');
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE client_user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE project_status AS ENUM ('active', 'completed', 'paused', 'cancelled');
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed', 'cancelled');
CREATE TYPE campaign_type AS ENUM ('social', 'email', 'web', 'video', 'mixed');
CREATE TYPE workflow_status AS ENUM ('draft', 'active', 'completed', 'failed');
CREATE TYPE workflow_type AS ENUM ('brief-to-copy', 'asset-generation', 'campaign-creation', 'custom');
CREATE TYPE step_type AS ENUM ('upload', 'review', 'generate', 'select', 'finalize');
CREATE TYPE step_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'skipped');
CREATE TYPE asset_type AS ENUM ('image', 'video', 'audio', 'document', 'text');
CREATE TYPE copy_type AS ENUM ('headline', 'body', 'cta', 'caption', 'script');
CREATE TYPE generation_type AS ENUM ('text', 'image', 'video', 'audio', 'motivation', 'copy');
CREATE TYPE ai_provider AS ENUM ('openai', 'anthropic', 'elevenlabs', 'runway', 'other');
CREATE TYPE generation_status AS ENUM ('success', 'failed', 'partial');
CREATE TYPE metric_type AS ENUM ('counter', 'gauge', 'histogram', 'timer');
CREATE TYPE value_type AS ENUM ('string', 'number', 'boolean', 'json');
CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning', 'error');
CREATE TYPE social_platform AS ENUM ('facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'youtube');
CREATE TYPE email_status AS ENUM ('sent', 'delivered', 'bounced', 'failed');
CREATE TYPE email_provider AS ENUM ('resend', 'sendgrid', 'ses');

-- Core user profiles
CREATE TABLE profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    role user_role DEFAULT 'user' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    email_verified BOOLEAN DEFAULT false NOT NULL,
    last_login TIMESTAMPTZ,
    preferences JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- User session management
CREATE TABLE user_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_activity TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- User permissions
CREATE TABLE user_permissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    granted BOOLEAN DEFAULT true NOT NULL,
    granted_by UUID REFERENCES profiles(id) NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Client/organization management
CREATE TABLE clients (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    industry VARCHAR(100),
    website VARCHAR(255),
    logo_url TEXT,
    settings JSONB DEFAULT '{}' NOT NULL,
    subscription_tier subscription_tier DEFAULT 'free' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Client-user relationships
CREATE TABLE client_users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    role client_user_role DEFAULT 'member' NOT NULL,
    permissions TEXT[] DEFAULT '{}' NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(client_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_clients_slug ON clients(slug);
CREATE INDEX idx_client_users_client_id ON client_users(client_id);
CREATE INDEX idx_client_users_user_id ON client_users(user_id);

-- Enable RLS on sensitive tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for tables with updated_at columns
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_client_users_updated_at BEFORE UPDATE ON client_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- +migrate Down

-- Drop triggers
DROP TRIGGER IF EXISTS update_client_users_updated_at ON client_users;
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS client_users;
DROP TABLE IF EXISTS user_permissions;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS profiles;

-- Drop types
DROP TYPE IF EXISTS email_provider;
DROP TYPE IF EXISTS email_status;
DROP TYPE IF EXISTS social_platform;
DROP TYPE IF EXISTS notification_type;
DROP TYPE IF EXISTS value_type;
DROP TYPE IF EXISTS metric_type;
DROP TYPE IF EXISTS generation_status;
DROP TYPE IF EXISTS ai_provider;
DROP TYPE IF EXISTS generation_type;
DROP TYPE IF EXISTS copy_type;
DROP TYPE IF EXISTS asset_type;
DROP TYPE IF EXISTS step_status;
DROP TYPE IF EXISTS step_type;
DROP TYPE IF EXISTS workflow_type;
DROP TYPE IF EXISTS workflow_status;
DROP TYPE IF EXISTS campaign_type;
DROP TYPE IF EXISTS campaign_status;
DROP TYPE IF EXISTS project_status;
DROP TYPE IF EXISTS client_user_role;
DROP TYPE IF EXISTS subscription_tier;
DROP TYPE IF EXISTS user_role;
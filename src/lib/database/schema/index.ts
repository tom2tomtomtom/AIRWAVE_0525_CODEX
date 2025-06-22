// Database schema definitions for AIrWAVE
// This file defines the complete database structure using TypeScript interfaces
// and SQL schema definitions for Supabase/PostgreSQL

export interface DatabaseSchema {
  // User Management
  profiles: Profile;
  user_sessions: UserSession;
  user_permissions: UserPermission;
  
  // Client Management
  clients: Client;
  client_users: ClientUser;
  
  // Project & Campaign Management
  projects: Project;
  campaigns: Campaign;
  campaign_assets: CampaignAsset;
  
  // Workflow & Content
  workflows: Workflow;
  workflow_steps: WorkflowStep;
  briefs: Brief;
  motivations: Motivation;
  copy_variations: CopyVariation;
  
  // Asset Management
  assets: Asset;
  asset_tags: AssetTag;
  asset_versions: AssetVersion;
  
  // AI & Generation
  ai_generations: AIGeneration;
  ai_usage_logs: AIUsageLog;
  ai_cost_tracking: AICostTracking;
  
  // Analytics & Metrics
  analytics_events: AnalyticsEvent;
  performance_metrics: PerformanceMetric;
  user_activity_logs: UserActivityLog;
  
  // System & Configuration
  feature_flags: FeatureFlag;
  system_settings: SystemSetting;
  audit_logs: AuditLog;
  
  // Integrations
  social_accounts: SocialAccount;
  api_keys: APIKey;
  webhooks: Webhook;
  
  // Notifications & Communications
  notifications: Notification;
  email_templates: EmailTemplate;
  email_logs: EmailLog;
}

// Core user profile
export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  role: 'admin' | 'user' | 'client' | 'viewer';
  is_active: boolean;
  email_verified: boolean;
  last_login?: string;
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// User session management
export interface UserSession {
  id: string;
  user_id: string;
  session_id: string;
  device_id: string;
  ip_address: string;
  user_agent: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
  last_activity: string;
}

// User permissions and roles
export interface UserPermission {
  id: string;
  user_id: string;
  resource: string;
  action: string;
  granted: boolean;
  granted_by: string;
  expires_at?: string;
  created_at: string;
}

// Client/organization management
export interface Client {
  id: string;
  name: string;
  slug: string;
  description?: string;
  industry?: string;
  website?: string;
  logo_url?: string;
  settings: Record<string, any>;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Client-user relationships
export interface ClientUser {
  id: string;
  client_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  permissions: string[];
  is_active: boolean;
  joined_at: string;
  updated_at: string;
}

// Project management
export interface Project {
  id: string;
  client_id: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  start_date?: string;
  end_date?: string;
  budget?: number;
  settings: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Campaign management
export interface Campaign {
  id: string;
  project_id: string;
  client_id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  campaign_type: 'social' | 'email' | 'web' | 'video' | 'mixed';
  target_audience: Record<string, any>;
  platforms: string[];
  objectives: string[];
  budget?: number;
  start_date?: string;
  end_date?: string;
  metrics: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Campaign assets relationship
export interface CampaignAsset {
  id: string;
  campaign_id: string;
  asset_id: string;
  asset_type: 'image' | 'video' | 'text' | 'voice' | 'document';
  usage_context: string;
  is_primary: boolean;
  created_at: string;
}

// Workflow definition
export interface Workflow {
  id: string;
  client_id: string;
  name: string;
  description?: string;
  workflow_type: 'brief-to-copy' | 'asset-generation' | 'campaign-creation' | 'custom';
  status: 'draft' | 'active' | 'completed' | 'failed';
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  current_step: number;
  total_steps: number;
  progress_percentage: number;
  error_message?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// Workflow step tracking
export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_number: number;
  step_name: string;
  step_type: 'upload' | 'review' | 'generate' | 'select' | 'finalize';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  duration_ms?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

// Creative brief storage
export interface Brief {
  id: string;
  workflow_id: string;
  client_id: string;
  title: string;
  description: string;
  objectives: string[];
  target_audience: Record<string, any>;
  key_messages: string[];
  tone_of_voice: string;
  brand_guidelines: Record<string, any>;
  platforms: string[];
  deliverables: string[];
  timeline: Record<string, any>;
  budget?: number;
  file_url?: string;
  parsed_content: Record<string, any>;
  is_confirmed: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// AI-generated motivations
export interface Motivation {
  id: string;
  brief_id: string;
  workflow_id: string;
  title: string;
  description: string;
  reasoning: string;
  confidence_score: number;
  is_selected: boolean;
  ai_model: string;
  generation_params: Record<string, any>;
  created_at: string;
}

// AI-generated copy variations
export interface CopyVariation {
  id: string;
  brief_id: string;
  workflow_id: string;
  motivation_ids: string[];
  platform: string;
  copy_type: 'headline' | 'body' | 'cta' | 'caption' | 'script';
  content: string;
  character_count: number;
  word_count: number;
  is_selected: boolean;
  quality_score: number;
  ai_model: string;
  generation_params: Record<string, any>;
  created_at: string;
}

// Asset management
export interface Asset {
  id: string;
  client_id: string;
  name: string;
  description?: string;
  asset_type: 'image' | 'video' | 'audio' | 'document' | 'text';
  mime_type: string;
  file_size: number;
  file_url: string;
  thumbnail_url?: string;
  cdn_url?: string;
  dimensions?: Record<string, number>;
  duration?: number;
  metadata: Record<string, any>;
  is_public: boolean;
  is_archived: boolean;
  folder_path?: string;
  tags: string[];
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

// Asset tagging system
export interface AssetTag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  client_id?: string;
  usage_count: number;
  created_at: string;
}

// Asset version control
export interface AssetVersion {
  id: string;
  asset_id: string;
  version_number: number;
  file_url: string;
  file_size: number;
  changes_description?: string;
  created_by: string;
  created_at: string;
}

// AI generation tracking
export interface AIGeneration {
  id: string;
  user_id: string;
  client_id: string;
  generation_type: 'text' | 'image' | 'video' | 'audio' | 'motivation' | 'copy';
  ai_provider: 'openai' | 'anthropic' | 'elevenlabs' | 'runway' | 'other';
  model_name: string;
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost_usd?: number;
  duration_ms: number;
  status: 'success' | 'failed' | 'partial';
  error_message?: string;
  created_at: string;
}

// AI usage and cost tracking
export interface AIUsageLog {
  id: string;
  user_id: string;
  client_id: string;
  date: string; // YYYY-MM-DD format
  ai_provider: string;
  model_name: string;
  total_requests: number;
  total_tokens: number;
  total_cost_usd: number;
  generation_types: Record<string, number>; // type -> count
  created_at: string;
  updated_at: string;
}

// AI cost tracking and budgets
export interface AICostTracking {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  budget_limit_usd?: number;
  total_spent_usd: number;
  spending_by_provider: Record<string, number>;
  spending_by_user: Record<string, number>;
  spending_by_type: Record<string, number>;
  alerts_sent: number;
  is_budget_exceeded: boolean;
  created_at: string;
  updated_at: string;
}

// Analytics and event tracking
export interface AnalyticsEvent {
  id: string;
  user_id?: string;
  client_id?: string;
  session_id?: string;
  event_name: string;
  event_category: string;
  event_properties: Record<string, any>;
  page_url?: string;
  referrer?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// Performance metrics
export interface PerformanceMetric {
  id: string;
  metric_name: string;
  metric_type: 'counter' | 'gauge' | 'histogram' | 'timer';
  value: number;
  tags: Record<string, string>;
  timestamp: string;
  created_at: string;
}

// User activity logging
export interface UserActivityLog {
  id: string;
  user_id: string;
  client_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// Feature flags
export interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description?: string;
  is_enabled: boolean;
  rollout_percentage: number;
  target_users?: string[];
  target_clients?: string[];
  conditions: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// System settings
export interface SystemSetting {
  id: string;
  key: string;
  value: any;
  value_type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  is_public: boolean;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

// Audit logging
export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// Social media account integrations
export interface SocialAccount {
  id: string;
  client_id: string;
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin' | 'tiktok' | 'youtube';
  account_id: string;
  account_name: string;
  access_token: string; // encrypted
  refresh_token?: string; // encrypted
  token_expires_at?: string;
  permissions: string[];
  is_active: boolean;
  last_used_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// API key management
export interface APIKey {
  id: string;
  client_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  permissions: string[];
  is_active: boolean;
  expires_at?: string;
  last_used_at?: string;
  usage_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Webhook management
export interface Webhook {
  id: string;
  client_id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  retry_count: number;
  last_triggered_at?: string;
  last_status: 'success' | 'failed';
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Notification system
export interface Notification {
  id: string;
  user_id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  action_url?: string;
  is_read: boolean;
  expires_at?: string;
  created_at: string;
  read_at?: string;
}

// Email template management
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  text_content?: string;
  variables: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Email sending logs
export interface EmailLog {
  id: string;
  template_id?: string;
  recipient_email: string;
  subject: string;
  status: 'sent' | 'delivered' | 'bounced' | 'failed';
  provider: 'resend' | 'sendgrid' | 'ses';
  provider_id?: string;
  error_message?: string;
  sent_at: string;
  delivered_at?: string;
}
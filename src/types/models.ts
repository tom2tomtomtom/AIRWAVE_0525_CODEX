// Base model with common fields
export interface BaseModel {
  id: string;
  dateCreated: string;
  lastModified: string;
  createdBy: string;
  version: number;
  metadata: Record<string, unknown>;
}

// Client Model
export interface Client extends BaseModel {
  name: string;
  industry: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  description: string;
  website: string;
  socialMedia: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    tiktok?: string;
    youtube?: string;
  };
  contacts: Contact[];
  brandGuidelines: BrandGuidelines;
  tenantId: string;
  isActive: boolean;
}

// Contact Model
export interface Contact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone?: string;
  isActive: boolean;
}

// Brand Guidelines Model
export interface BrandGuidelines {
  voiceTone: string;
  targetAudience: string;
  keyMessages: string[];
  colors?: {
    primary: string;
    secondary: string;
    accent?: string;
    background?: string;
    text?: string;
  };
  typography?: {
    headingFont: string;
    bodyFont: string;
    sizes?: Record<string, string>;
  };
  logoUsage?: string;
  dosDonts?: {
    dos: string[];
    donts: string[];
  };
}

// Campaign Model
export interface Campaign extends BaseModel {
  name: string;
  description: string;
  clientId: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  schedule?: CampaignSchedule;
  budget?: {
    total: number;
    spent: number;
    currency: string;
  };
  targeting: CampaignTarget;
  content: CampaignContent[];
  performance?: CampaignPerformance;
  strategyId?: string;
  tags?: string[];
  objective?: string;
  approvalStatus?: {
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
    approvalDate?: string;
    comments?: string;
  };
}

// Campaign Schedule Model
export interface CampaignSchedule {
  startDate: string;
  endDate?: string;
  timezone?: string;
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly';
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, etc.
  timeOfDay?: string; // HH:MM format
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endAfterOccurrences?: number;
    endDate?: string;
  };
}

// Campaign Target Model
export interface CampaignTarget {
  platforms: string[];
  demographics?: {
    ageRanges?: string[];
    genders?: string[];
    incomes?: string[];
    educationLevels?: string[];
  };
  locations?: {
    countries?: string[];
    regions?: string[];
    cities?: string[];
    postalCodes?: string[];
    radius?: {
      lat: number;
      lng: number;
      distance: number;
      unit: 'km' | 'mi';
    };
  };
  interests?: string[];
  behaviors?: string[];
  devices?: string[];
  languages?: string[];
  customAudiences?: string[];
  exclusions?: {
    demographics?: unknown;
    locations?: unknown;
    interests?: string[];
    behaviors?: string[];
  };
}

// Campaign Content Model
export interface CampaignContent {
  id: string;
  type: 'post' | 'story' | 'ad' | 'video' | 'email' | 'banner';
  platform: string;
  matrixId?: string;
  combinationId?: string;
  assetIds?: string[];
  caption?: string;
  headline?: string;
  description?: string;
  callToAction?: string;
  url?: string;
  status: 'draft' | 'ready' | 'scheduled' | 'published' | 'failed';
  schedule?: {
    publishDate: string;
    timezone: string;
  };
  performance?: {
    impressions: number;
    engagement: number;
    clicks: number;
    conversions: number;
    reach: number;
    shares: number;
    comments: number;
    likes: number;
  };
  metadata?: Record<string, unknown>;
}

// Campaign Performance Model
export interface CampaignPerformance {
  impressions: number;
  clicks: number;
  conversions: number;
  engagement: number;
  reach: number;
  ctr: number;
  cpc?: number;
  cpm?: number;
  conversionRate: number;
  engagementRate: number;
  roi?: number;
  spend?: number;
  revenue?: number;
  costPerAcquisition?: number;
  averageOrderValue?: number;
  lastUpdated: string;
  byPlatform?: Record<string, Partial<CampaignPerformance>>;
  byContent?: Record<string, Partial<CampaignPerformance>>;
  byDate?: Record<string, Partial<CampaignPerformance>>;
}

// Asset Model
export interface Asset extends BaseModel {
  name: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'copy';
  url: string;
  thumbnail?: string;
  clientId: string;
  tags: string[];
  status: 'active' | 'archived' | 'deleted';
  permissions: {
    public: boolean;
    userIds: string[];
    roleIds: string[];
  };
  metadata: AssetMetadata;
}

// Asset Metadata Model
export interface AssetMetadata {
  fileSize?: string;
  dimensions?: string;
  duration?: string;
  format?: string;
  source?: string;
  copyright?: string;
  expiryDate?: string;
  aiGenerated?: boolean;
  aiPrompt?: string;
  [key: string]: unknown;
}

// Template Model
export interface Template extends BaseModel {
  name: string;
  platform: string;
  aspectRatio: string;
  description: string;
  thumbnail: string;
  category: string;
  industry: string;
  contentType: string;
  dimensions: string;
  recommendedUsage: string;
  usageCount: number;
  performance: {
    views: number;
    engagement: number;
    conversion: number;
    score: number;
  };
  dynamicFields: DynamicField[];
  isCreatomate: boolean;
  creatomateId?: string;
  isOwner?: boolean;
  isShared?: boolean;
  clientId: string;
}

// Dynamic Field Model
export interface DynamicField {
  id: string;
  name: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'color';
  required: boolean;
  description: string;
  defaultValue?: string;
  constraints?: {
    minLength?: number;
    maxLength?: number;
    regex?: string;
    options?: string[];
  };
}

// Strategy Model
export interface Strategy extends BaseModel {
  name: string;
  description: string;
  clientId: string;
  objectives: string[];
  targetAudience: {
    demographics: string[];
    interests: string[];
    behaviors: string[];
  };
  keyMessages: string[];
  contentPlan: {
    platforms: string[];
    contentTypes: string[];
    frequency: string;
    timeline: string;
  };
  kpis: string[];
  budget?: number;
  status: 'draft' | 'active' | 'archived';
}

// Matrix Model
export interface Matrix extends BaseModel {
  name: string;
  description?: string;
  clientId: string;
  templateId: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  variations: Variation[];
  combinations: VariationCombination[];
  fieldAssignments: Record<string, FieldAssignment>;
  approvalStatus?: {
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
    approvalDate?: string;
    comments?: string;
  };
}

// Variation Model
export interface Variation {
  id: string;
  name: string;
  isActive: boolean;
  isDefault?: boolean;
}

// Variation Combination Model
export interface VariationCombination {
  id: string;
  name: string;
  variationIds: string[];
  isSelected: boolean;
  performanceScore?: number;
}

// Field Assignment Model
export interface FieldAssignment {
  status: 'empty' | 'in-progress' | 'completed';
  content?: ContentVariation[];
  assets?: AssetVariation[];
}

// Content Variation Model
export interface ContentVariation {
  id: string;
  variationId: string;
  content: string;
}

// Asset Variation Model
export interface AssetVariation {
  variationId: string;
  assetId: string;
}

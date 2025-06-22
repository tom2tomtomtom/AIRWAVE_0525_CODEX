import { createClient } from '@/lib/supabase/server';
import { loggers } from '@/lib/logger';
import { Profile, Client, Project, Campaign, FeatureFlag } from '../schema';

export interface SeederOptions {
  environment: 'development' | 'test' | 'staging';
  reset?: boolean; // Clear existing data before seeding
  verbose?: boolean;
}

export interface SeedResult {
  success: boolean;
  created: {
    profiles: number;
    clients: number;
    projects: number;
    campaigns: number;
    featureFlags: number;
  };
  errors: string[];
  duration: number;
}

export class DatabaseSeeder {
  private supabase = createClient();
  
  async seed(options: SeederOptions): Promise<SeedResult> {
    const startTime = Date.now();
    const result: SeedResult = {
      success: true,
      created: {
        profiles: 0,
        clients: 0,
        projects: 0,
        campaigns: 0,
        featureFlags: 0
      },
      errors: [],
      duration: 0
    };
    
    try {
      loggers.general.info('Starting database seeding', options);
      
      if (options.reset) {
        await this.resetDatabase();
      }
      
      // Seed in dependency order
      await this.seedProfiles(result, options);
      await this.seedClients(result, options);
      await this.seedProjects(result, options);
      await this.seedCampaigns(result, options);
      await this.seedFeatureFlags(result, options);
      
      result.duration = Date.now() - startTime;
      
      loggers.general.info('Database seeding completed', {
        environment: options.environment,
        duration: result.duration,
        created: result.created,
        errors: result.errors.length
      });
      
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.duration = Date.now() - startTime;
      
      loggers.general.error('Database seeding failed', error);
    }
    
    return result;
  }
  
  private async resetDatabase(): Promise<void> {
    loggers.general.info('Resetting database for seeding');
    
    const tables = [
      'campaigns', 'projects', 'client_users', 'clients', 
      'user_permissions', 'user_sessions', 'profiles',
      'feature_flags', 'system_settings'
    ];
    
    for (const table of tables) {
      try {
        const { error } = await this.supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all except system records
        
        if (error) {
          loggers.general.warn(`Failed to clear table ${table}`, error);
        }
      } catch (error) {
        loggers.general.warn(`Error clearing table ${table}`, error);
      }
    }
  }
  
  private async seedProfiles(result: SeedResult, options: SeederOptions): Promise<void> {
    const profiles = this.getProfileSeeds(options.environment);
    
    for (const profile of profiles) {
      try {
        const { error } = await this.supabase
          .from('profiles')
          .insert(profile);
        
        if (error) {
          result.errors.push(`Failed to create profile ${profile.email}: ${error.message}`);
        } else {
          result.created.profiles++;
          if (options.verbose) {
            loggers.general.info(`Created profile: ${profile.email}`);
          }
        }
      } catch (error) {
        result.errors.push(`Error creating profile ${profile.email}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  
  private async seedClients(result: SeedResult, options: SeederOptions): Promise<void> {
    const clients = this.getClientSeeds(options.environment);
    
    for (const client of clients) {
      try {
        const { error } = await this.supabase
          .from('clients')
          .insert(client);
        
        if (error) {
          result.errors.push(`Failed to create client ${client.name}: ${error.message}`);
        } else {
          result.created.clients++;
          if (options.verbose) {
            loggers.general.info(`Created client: ${client.name}`);
          }
        }
      } catch (error) {
        result.errors.push(`Error creating client ${client.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  
  private async seedProjects(result: SeedResult, options: SeederOptions): Promise<void> {
    const projects = this.getProjectSeeds(options.environment);
    
    for (const project of projects) {
      try {
        const { error } = await this.supabase
          .from('projects')
          .insert(project);
        
        if (error) {
          result.errors.push(`Failed to create project ${project.name}: ${error.message}`);
        } else {
          result.created.projects++;
          if (options.verbose) {
            loggers.general.info(`Created project: ${project.name}`);
          }
        }
      } catch (error) {
        result.errors.push(`Error creating project ${project.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  
  private async seedCampaigns(result: SeedResult, options: SeederOptions): Promise<void> {
    const campaigns = this.getCampaignSeeds(options.environment);
    
    for (const campaign of campaigns) {
      try {
        const { error } = await this.supabase
          .from('campaigns')
          .insert(campaign);
        
        if (error) {
          result.errors.push(`Failed to create campaign ${campaign.name}: ${error.message}`);
        } else {
          result.created.campaigns++;
          if (options.verbose) {
            loggers.general.info(`Created campaign: ${campaign.name}`);
          }
        }
      } catch (error) {
        result.errors.push(`Error creating campaign ${campaign.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  
  private async seedFeatureFlags(result: SeedResult, options: SeederOptions): Promise<void> {
    const flags = this.getFeatureFlagSeeds(options.environment);
    
    for (const flag of flags) {
      try {
        const { error } = await this.supabase
          .from('feature_flags')
          .insert(flag);
        
        if (error) {
          result.errors.push(`Failed to create feature flag ${flag.key}: ${error.message}`);
        } else {
          result.created.featureFlags++;
          if (options.verbose) {
            loggers.general.info(`Created feature flag: ${flag.key}`);
          }
        }
      } catch (error) {
        result.errors.push(`Error creating feature flag ${flag.key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  
  // Seed data generators
  private getProfileSeeds(environment: string): Omit<Profile, 'created_at' | 'updated_at'>[] {
    const baseProfiles = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'admin@airwave.dev',
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin' as const,
        is_active: true,
        email_verified: true,
        preferences: { theme: 'dark', notifications: true }
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'demo@client.com',
        first_name: 'Demo',
        last_name: 'Client',
        role: 'client' as const,
        is_active: true,
        email_verified: true,
        preferences: { theme: 'light', notifications: true }
      }
    ];
    
    if (environment === 'test') {
      return [
        ...baseProfiles,
        {
          id: '33333333-3333-3333-3333-333333333333',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          role: 'user' as const,
          is_active: true,
          email_verified: true,
          preferences: {}
        }
      ];
    }
    
    return baseProfiles;
  }
  
  private getClientSeeds(environment: string): Omit<Client, 'created_at' | 'updated_at'>[] {
    const baseClients = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Demo Client Corp',
        slug: 'demo-client',
        description: 'A demo client for testing and development',
        industry: 'Technology',
        website: 'https://democlient.com',
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          branding: { primaryColor: '#0066cc' }
        },
        subscription_tier: 'pro' as const,
        is_active: true
      }
    ];
    
    if (environment === 'development') {
      return [
        ...baseClients,
        {
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          name: 'Acme Corporation',
          slug: 'acme-corp',
          description: 'Classic demo client corporation',
          industry: 'Manufacturing',
          website: 'https://acme.com',
          settings: { timezone: 'America/New_York', currency: 'USD' },
          subscription_tier: 'enterprise' as const,
          is_active: true
        }
      ];
    }
    
    return baseClients;
  }
  
  private getProjectSeeds(environment: string): Omit<Project, 'created_at' | 'updated_at'>[] {
    return [
      {
        id: '11111111-2222-3333-4444-555555555555',
        client_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Q1 2024 Campaign',
        description: 'First quarter marketing campaign',
        status: 'active' as const,
        start_date: '2024-01-01',
        end_date: '2024-03-31',
        budget: 50000,
        settings: { approval_workflow: true },
        created_by: '22222222-2222-2222-2222-222222222222'
      },
      {
        id: '22222222-3333-4444-5555-666666666666',
        client_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Product Launch',
        description: 'New product launch campaign',
        status: 'draft' as const,
        start_date: '2024-04-01',
        budget: 75000,
        settings: { approval_workflow: false },
        created_by: '22222222-2222-2222-2222-222222222222'
      }
    ];
  }
  
  private getCampaignSeeds(environment: string): Omit<Campaign, 'created_at' | 'updated_at'>[] {
    return [
      {
        id: '33333333-4444-5555-6666-777777777777',
        project_id: '11111111-2222-3333-4444-555555555555',
        client_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Social Media Awareness',
        description: 'Build brand awareness through social media',
        status: 'active' as const,
        campaign_type: 'social' as const,
        target_audience: {
          age_range: '25-45',
          interests: ['technology', 'business'],
          location: 'North America'
        },
        platforms: ['facebook', 'instagram', 'linkedin'],
        objectives: ['awareness', 'engagement'],
        budget: 25000,
        start_date: '2024-01-15',
        end_date: '2024-02-15',
        metrics: {},
        created_by: '22222222-2222-2222-2222-222222222222'
      }
    ];
  }
  
  private getFeatureFlagSeeds(environment: string): Omit<FeatureFlag, 'created_at' | 'updated_at'>[] {
    const baseFlags = [
      {
        id: '44444444-5555-6666-7777-888888888888',
        name: 'AI Generation v2',
        key: 'ai_generation_v2',
        description: 'Enable the new AI generation pipeline',
        is_enabled: environment === 'development',
        rollout_percentage: environment === 'development' ? 100 : 0,
        conditions: {}
      },
      {
        id: '55555555-6666-7777-8888-999999999999',
        name: 'Advanced Analytics',
        key: 'advanced_analytics',
        description: 'Enable advanced analytics dashboard',
        is_enabled: true,
        rollout_percentage: 100,
        conditions: {}
      }
    ];
    
    if (environment === 'test') {
      return [
        ...baseFlags,
        {
          id: '66666666-7777-8888-9999-aaaaaaaaaaaa',
          name: 'Test Feature',
          key: 'test_feature',
          description: 'Feature for testing purposes',
          is_enabled: true,
          rollout_percentage: 100,
          conditions: {}
        }
      ];
    }
    
    return baseFlags;
  }
}

// Singleton instance
let seederInstance: DatabaseSeeder | null = null;

export const getDatabaseSeeder = (): DatabaseSeeder => {
  if (!seederInstance) {
    seederInstance = new DatabaseSeeder();
  }
  return seederInstance;
};

// CLI helper functions
export const seedDatabase = async (options: SeederOptions): Promise<SeedResult> => {
  const seeder = getDatabaseSeeder();
  return seeder.seed(options);
};

export const resetAndSeed = async (environment: 'development' | 'test' | 'staging'): Promise<SeedResult> => {
  return seedDatabase({
    environment,
    reset: true,
    verbose: true
  });
};
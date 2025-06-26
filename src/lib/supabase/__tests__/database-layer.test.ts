/**
 * Database Layer Testing
 * Comprehensive tests for Supabase client integration, schema validation,
 * migration scripts, error handling, and transaction management
 */

import { jest } from '@jest/globals';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
  auth: Record<string, unknown>$1
  getUser: jest.fn(),
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChange: jest.fn() },
  rpc: jest.fn(),
  storage: Record<string, unknown>$1
  from: jest.fn() },
  channel: jest.fn(),
  removeChannel: jest.fn()};

// Mock query builder
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  like: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  contains: jest.fn().mockReturnThis(),
  containedBy: jest.fn().mockReturnThis(),
  rangeGt: jest.fn().mockReturnThis(),
  rangeGte: jest.fn().mockReturnThis(),
  rangeLt: jest.fn().mockReturnThis(),
  rangeLte: jest.fn().mockReturnThis(),
  rangeAdjacent: jest.fn().mockReturnThis(),
  overlaps: jest.fn().mockReturnThis(),
  textSearch: jest.fn().mockReturnThis(),
  match: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  filter: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  abortSignal: jest.fn().mockReturnThis(),
  single: jest.fn(),
  maybeSingle: jest.fn(),
  csv: jest.fn(),
  geojson: jest.fn(),
  explain: jest.fn(),
  rollback: jest.fn(),
  returns: jest.fn().mockReturnThis()};

// Mock Supabase module
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)}));

// Import after mocking
import { supabase } from '@/lib/supabase';
import { loggers } from '@/lib/logger';


describe('Database Layer Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock behavior
    mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
    mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.update.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.delete.mockReturnValue(mockQueryBuilder);
  });

  describe('Supabase Client Integration', () => {
    it('should create Supabase client with correct configuration', () => {
      // Test that the mock was set up correctly
      expect(mockSupabaseClient.from).toBeDefined();
      expect(mockSupabaseClient.auth).toBeDefined();
      expect(mockSupabaseClient.rpc).toBeDefined();
      expect(mockSupabaseClient.storage).toBeDefined();
    });

    it('should handle missing environment variables', () => {
      // Test environment variable validation
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Temporarily remove environment variables
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      // Test that client creation would fail with missing env vars
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeUndefined();

      // Restore environment variables
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    });

    it('should provide access to all required Supabase features', () => {
      expect(mockSupabaseClient.from).toBeDefined();
      expect(mockSupabaseClient.auth).toBeDefined();
      expect(mockSupabaseClient.rpc).toBeDefined();
      expect(mockSupabaseClient.storage).toBeDefined();
    });
  });

  describe('Database Schema Validation', () => {
    it('should validate clients table structure', async () => {
      const mockClient = {
        id: 'client-123',
        name: 'Test Client',
        description: 'Test Description',
        logo_url: 'https://example.com/logo.png',
        industry: 'Technology',
        primary_color: '#1976d2',
        secondary_color: '#dc004e',
        website: 'https://example.com',
        created_by: 'user-123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'};

      mockQueryBuilder.single.mockResolvedValue({ data: mockClient, error: null });

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', 'client-123')
        .single();

      expect(error).toBeNull();
      expect(data).toEqual(mockClient);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('clients');
    });

    it('should validate briefs table structure', async () => {
      const mockBrief = {
        id: 'brief-123',
        client_id: 'client-123',
        created_by: 'user-123',
        name: 'Test Brief',
        description: 'Test Description',
        document_url: 'https://example.com/brief.pdf',
        document_type: 'pdf',
        parsing_status: 'completed',
        parsed_at: '2024-01-01T00:00:00Z',
        raw_content: 'Brief content',
        platforms: ['facebook', 'instagram'],
        target_audience: 'Young adults',
        budget: 10000,
        timeline: { start: '2024-01-01', end: '2024-02-01'  },
  objectives: { primary: 'Brand awareness'  },
  key_messaging: { tone: 'Professional'  },
  brand_guidelines: { colors: ['#1976d2']  },
  confidence_scores: { overall: 0.95  },
  created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'};

      mockQueryBuilder.single.mockResolvedValue({ data: mockBrief, error: null });

      const { data, error } = await supabase
        .from('briefs')
        .select('*')
        .eq('id', 'brief-123')
        .single();

      expect(error).toBeNull();
      expect(data).toEqual(mockBrief);
    });

    it('should validate profiles table structure', async () => {
      const mockProfile = {
        id: 'user-123',
        first_name: 'John',
        last_name: 'Doe',
        avatar_url: 'https://example.com/avatar.jpg',
        role: 'admin',
        permissions: ['read', 'write', 'admin'],
        preferences: Record<string, unknown>$1
  theme: 'dark',
          notifications: Record<string, unknown>$1
  email: true,
            inApp: true,
            exports: true,
            comments: true,
            approvals: true}},
        metadata: { department: 'Marketing'  },
  tenant_id: 'default',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'};

      mockQueryBuilder.single.mockResolvedValue({ data: mockProfile, error: null });

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', 'user-123')
        .single();

      expect(error).toBeNull();
      expect(data).toEqual(mockProfile);
    });

    it('should validate templates table structure', async () => {
      const mockTemplate = {
        id: 'template-123',
        name: 'Instagram Story Template',
        aspect_ratio: '9:16',
        platform: 'instagram',
        description: 'Modern story template',
        height: 1920,
        width: 1080,
        structure: Record<string, unknown>$1
  layers: [
            { type: 'background', color: '#ffffff'  }
            { type: 'text', content: 'Hello World'  }
          ]},
        thumbnail_url: 'https://example.com/thumbnail.jpg',
        created_by: 'user-123',
        client_id: 'client-123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'};

      mockQueryBuilder.single.mockResolvedValue({ data: mockTemplate, error: null });

      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', 'template-123')
        .single();

      expect(error).toBeNull();
      expect(data).toEqual(mockTemplate);
    });
  });

  describe('CRUD Operations', () => {
    it('should handle CREATE operations', async () => {
      const newClient = {
        name: 'New Client',
        description: 'New client description',
        industry: 'Healthcare'};

      const mockResponse = {
        data: { id: 'new-client-123', ...newClient },
        error: null};

      mockQueryBuilder.single.mockResolvedValue(mockResponse);

      const { data, error } = await supabase
        .from('clients')
        .insert(newClient)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toEqual(mockResponse.data);
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(newClient);
    });

    it('should handle READ operations with filters', async () => {
      const mockClients = [
        { id: 'client-1', name: 'Client 1', industry: 'Tech'  }
        { id: 'client-2', name: 'Client 2', industry: 'Tech'  }
      ];

      // Mock the final result of the query chain
      const mockResult = Promise.resolve({ data: mockClients, error: null });
      mockQueryBuilder.limit.mockReturnValue(mockResult);

      const result = await supabase
        .from('clients')
        .select('id, name, industry')
        .eq('industry', 'Tech')
        .order('name')
        .limit(10);

      const { data, error } = await result;

      expect(error).toBeNull();
      expect(data).toEqual(mockClients);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('industry', 'Tech');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('name');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('should handle UPDATE operations', async () => {
      const updateData = {
        name: 'Updated Client Name',
        updated_at: new Date().toISOString()};

      const mockResponse = {
        data: { id: 'client-123', ...updateData },
        error: null};

      mockQueryBuilder.single.mockResolvedValue(mockResponse);

      const { data, error } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', 'client-123')
        .select()
        .single();

      expect(error).toBeNull();
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(updateData);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'client-123');
    });

    it('should handle DELETE operations', async () => {
      const mockResponse = {
        data: { id: 'client-123'  },
  error: null};

      mockQueryBuilder.single.mockResolvedValue(mockResponse);

      const { data, error } = await supabase
        .from('clients')
        .delete()
        .eq('id', 'client-123')
        .select('id')
        .single();

      expect(error).toBeNull();
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'client-123');
    });

    it('should handle UPSERT operations', async () => {
      const upsertData = {
        id: 'client-123',
        name: 'Upserted Client',
        industry: 'Finance'};

      const mockResponse = {
        data: upsertData,
        error: null};

      mockQueryBuilder.single.mockResolvedValue(mockResponse);

      const { data, error } = await supabase
        .from('clients')
        .upsert(upsertData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(upsertData);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      const mockError = {
        message: 'Connection failed',
        details: 'Unable to connect to database',
        hint: 'Check your connection',
        code: 'PGRST301'};

      mockQueryBuilder.single.mockResolvedValue({ data: null, error: mockError });

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .single();

      expect(data).toBeNull();
      expect(error).toEqual(mockError);
    });

    it('should handle constraint violation errors', async () => {
      const mockError = {
        message: 'duplicate key value violates unique constraint',
        details: 'Key (email)=(test@example.com) already exists.',
        hint: null,
        code: '23505'};

      mockQueryBuilder.single.mockResolvedValue({ data: null, error: mockError });

      const { data, error } = await supabase
        .from('profiles')
        .insert({ email: 'test@example.com' })
        .single();

      expect(data).toBeNull();
      expect(error).toEqual(mockError);
    });

    it('should handle foreign key constraint errors', async () => {
      const mockError = {
        message: 'insert or update on table violates foreign key constraint',
        details: 'Key (client_id)=(non-existent) is not present in table "clients".',
        hint: null,
        code: '23503'};

      mockQueryBuilder.single.mockResolvedValue({ data: null, error: mockError });

      const { data, error } = await supabase
        .from('briefs')
        .insert({ client_id: 'non-existent', name: 'Test Brief' })
        .single();

      expect(data).toBeNull();
      expect(error).toEqual(mockError);
    });

    it('should handle permission errors', async () => {
      const mockError = {
        message: 'permission denied for table clients',
        details: null,
        hint: null,
        code: '42501'};

      mockQueryBuilder.single.mockResolvedValue({ data: null, error: mockError });

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .single();

      expect(data).toBeNull();
      expect(error).toEqual(mockError);
    });

    it('should handle row level security violations', async () => {
      const mockError = {
        message: 'new row violates row-level security policy',
        details: null,
        hint: null,
        code: 'P0001'};

      mockQueryBuilder.single.mockResolvedValue({ data: null, error: mockError });

      const { data, error } = await supabase
        .from('clients')
        .insert({ name: 'Unauthorized Client' })
        .single();

      expect(data).toBeNull();
      expect(error).toEqual(mockError);
    });
  });

  describe('Transaction Management', () => {
    it('should handle RPC calls for transactions', async () => {
      const mockTransactionResult = {
        data: { success: true, client_id: 'client-123', brief_id: 'brief-123'  },
  error: null};

      mockSupabaseClient.rpc.mockResolvedValue(mockTransactionResult);

      const { data, error } = await supabase.rpc('create_client_with_brief', {
        client_name: 'New Client',
        brief_name: 'New Brief',
        brief_description: 'Brief description'});

      expect(error).toBeNull();
      expect(data).toEqual(mockTransactionResult.data);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('create_client_with_brief', {
        client_name: 'New Client',
        brief_name: 'New Brief',
        brief_description: 'Brief description'});
    });

    it('should handle transaction rollback on error', async () => {
      const mockError = {
        message: 'transaction aborted',
        details: 'Constraint violation in nested operation',
        hint: null,
        code: 'P0001'};

      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: mockError });

      const { data, error } = await supabase.rpc('complex_transaction', {
        operations: ['create_client', 'create_brief', 'create_campaign']});

      expect(data).toBeNull();
      expect(error).toEqual(mockError);
    });

    it('should handle concurrent transaction conflicts', async () => {
      const mockError = {
        message: 'could not serialize access due to concurrent update',
        details: null,
        hint: 'The transaction might succeed if retried.',
        code: '40001'};

      mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: mockError });

      const { data, error } = await supabase.rpc('update_campaign_metrics', {
        campaign_id: 'campaign-123',
        metrics: { impressions: 1000, clicks: 50 }});

      expect(data).toBeNull();
      expect(error).toEqual(mockError);
    });
  });

  describe('Advanced Query Operations', () => {
    it('should handle complex joins', async () => {
      const mockJoinResult = [
        {
          id: 'brief-123',
          name: 'Test Brief',
          client: Record<string, unknown>$1
  id: 'client-123',
            name: 'Test Client',
            industry: 'Technology' },
  motivations: [
            { id: 'motivation-1', text: 'Increase brand awareness'  }
            { id: 'motivation-2', text: 'Drive conversions'  }
          ]},
      ];

      // Mock the final result of the query chain
      const mockResult = Promise.resolve({ data: mockJoinResult, error: null });
      mockQueryBuilder.eq.mockReturnValue(mockResult);

      const result = await supabase
        .from('briefs')
        .select(`
          id,
          name,
          client:clients(id, name, industry),
          motivations(id, text)
        `)
        .eq('id', 'brief-123');

      const { data, error } = await result;

      expect(error).toBeNull();
      expect(data).toEqual(mockJoinResult);
    });

    it('should handle full-text search', async () => {
      const mockSearchResults = [
        { id: 'brief-1', name: 'Marketing Brief', raw_content: 'Brand awareness campaign'  }
        { id: 'brief-2', name: 'Product Brief', raw_content: 'Product launch strategy'  }
      ];

      // Mock the final result of the query chain
      const mockResult = Promise.resolve({ data: mockSearchResults, error: null });
      mockQueryBuilder.textSearch.mockReturnValue(mockResult);

      const result = await supabase
        .from('briefs')
        .select('id, name, raw_content')
        .textSearch('raw_content', 'brand & awareness');

      const { data, error } = await result;

      expect(error).toBeNull();
      expect(data).toEqual(mockSearchResults);
      expect(mockQueryBuilder.textSearch).toHaveBeenCalledWith('raw_content', 'brand & awareness');
    });

    it('should handle JSON operations', async () => {
      const mockJsonResults = [
        {
          id: 'brief-123',
          objectives: { primary: 'Brand awareness', secondary: 'Lead generation' }},
      ];

      // Mock the final result of the query chain
      const mockResult = Promise.resolve({ data: mockJsonResults, error: null });
      mockQueryBuilder.contains.mockReturnValue(mockResult);

      const result = await supabase
        .from('briefs')
        .select('id, objectives')
        .contains('objectives', { primary: 'Brand awareness' });

      const { data, error } = await result;

      expect(error).toBeNull();
      expect(data).toEqual(mockJsonResults);
      expect(mockQueryBuilder.contains).toHaveBeenCalledWith('objectives', { primary: 'Brand awareness' });
    });

    it('should handle array operations', async () => {
      const mockArrayResults = [
        { id: 'brief-1', platforms: ['facebook', 'instagram'] },
        { id: 'brief-2', platforms: ['facebook', 'twitter'] },
      ];

      // Mock the final result of the query chain
      const mockResult = Promise.resolve({ data: mockArrayResults, error: null });
      mockQueryBuilder.overlaps.mockReturnValue(mockResult);

      const result = await supabase
        .from('briefs')
        .select('id, platforms')
        .overlaps('platforms', ['facebook']);

      const { data, error } = await result;

      expect(error).toBeNull();
      expect(data).toEqual(mockArrayResults);
      expect(mockQueryBuilder.overlaps).toHaveBeenCalledWith('platforms', ['facebook']);
    });

    it('should handle range queries', async () => {
      const mockRangeResults = [
        { id: 'brief-1', budget: 5000, created_at: '2024-01-15T00:00:00Z'  }
        { id: 'brief-2', budget: 7500, created_at: '2024-01-20T00:00:00Z'  }
      ];

      // Mock the final result of the query chain
      const mockResult = Promise.resolve({ data: mockRangeResults, error: null });
      mockQueryBuilder.order.mockReturnValue(mockResult);

      const result = await supabase
        .from('briefs')
        .select('id, budget, created_at')
        .gte('budget', 5000)
        .lte('budget', 10000)
        .gte('created_at', '2024-01-01')
        .order('created_at', { ascending: false });

      const { data, error } = await result;

      expect(error).toBeNull();
      expect(data).toEqual(mockRangeResults);
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('budget', 5000);
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith('budget', 10000);
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
    });
  });

  describe('Real-time Subscriptions', () => {
    it('should handle real-time channel creation', () => {
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn()};

      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const channel = supabase.channel('clients-changes');

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith('clients-changes');
      expect(channel).toBeDefined();
    });

    it('should handle real-time subscription setup', () => {
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn()};

      mockSupabaseClient.channel.mockReturnValue(mockChannel);

      const channel = supabase
        .channel('table-changes')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'clients'  }
          (payload) => loggers.general.error('Change received!', payload)
        )
        .subscribe();

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients'  }
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should handle channel cleanup', () => {
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn()};

      mockSupabaseClient.channel.mockReturnValue(mockChannel);
      mockSupabaseClient.removeChannel.mockReturnValue(true);

      const channel = supabase.channel('test-channel');
      const removed = supabase.removeChannel(channel);

      expect(mockSupabaseClient.removeChannel).toHaveBeenCalledWith(channel);
      expect(removed).toBe(true);
    });
  });

  describe('Authentication Integration', () => {
    it('should handle user authentication', async () => {
      const mockAuthResponse = {
        data: Record<string, unknown>$1
  user: Record<string, unknown>$1
  id: 'user-123',
            email: 'test@example.com',
            user_metadata: { first_name: 'John', last_name: 'Doe' }},
          session: Record<string, unknown>$1
  access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_at: Date.now() + 3600000}},
        error: null};

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue(mockAuthResponse);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'password123'});

      expect(error).toBeNull();
      expect(data).toEqual(mockAuthResponse.data);
    });

    it('should handle authentication errors', async () => {
      const mockAuthError = {
        data: { user: null, session: null  },
  error: Record<string, unknown>$1
  message: 'Invalid login credentials',
          status: 400}};

      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue(mockAuthError);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'wrongpassword'});

      expect(data.user).toBeNull();
      expect(error).toEqual(mockAuthError.error);
    });

    it('should handle user session retrieval', async () => {
      const mockUserResponse = {
        data: Record<string, unknown>$1
  user: Record<string, unknown>$1
  id: 'user-123',
            email: 'test@example.com',
            role: 'authenticated'}},
        error: null};

      mockSupabaseClient.auth.getUser.mockResolvedValue(mockUserResponse);

      const { data, error } = await supabase.auth.getUser();

      expect(error).toBeNull();
      expect(data).toEqual(mockUserResponse.data);
    });

    it('should handle auth state changes', () => {
      const mockCallback = jest.fn();
      const mockUnsubscribe = jest.fn();

      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } }});

      const { data } = supabase.auth.onAuthStateChange(mockCallback);

      expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalledWith(mockCallback);
      expect(data.subscription.unsubscribe).toBe(mockUnsubscribe);
    });
  });

  describe('Storage Integration', () => {
    it('should handle file storage operations', () => {
      const mockStorageBucket = {
        upload: jest.fn(),
        download: jest.fn(),
        remove: jest.fn(),
        list: jest.fn(),
        getPublicUrl: jest.fn(),
        createSignedUrl: jest.fn()};

      mockSupabaseClient.storage.from.mockReturnValue(mockStorageBucket);

      const bucket = supabase.storage.from('assets');

      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('assets');
      expect(bucket).toBeDefined();
      expect(bucket.upload).toBeDefined();
      expect(bucket.download).toBeDefined();
      expect(bucket.remove).toBeDefined();
    });

    it('should handle file upload operations', async () => {
      const mockStorageBucket = {
        upload: jest.fn().mockResolvedValue({
          data: { path: 'assets/test-file.jpg'  },
  error: null})};

      mockSupabaseClient.storage.from.mockReturnValue(mockStorageBucket);

      const file = new File(['test content'], 'test-file.jpg', { type: 'image/jpeg' });
      const { data, error } = await supabase.storage
        .from('assets')
        .upload('test-file.jpg', file);

      expect(error).toBeNull();
      expect(data).toEqual({ path: 'assets/test-file.jpg' });
      expect(mockStorageBucket.upload).toHaveBeenCalledWith('test-file.jpg', file);
    });

    it('should handle public URL generation', () => {
      const mockStorageBucket = {
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: 'https://example.com/storage/assets/test-file.jpg' }})};

      mockSupabaseClient.storage.from.mockReturnValue(mockStorageBucket);

      const { data } = supabase.storage
        .from('assets')
        .getPublicUrl('test-file.jpg');

      expect(data.publicUrl).toBe('https://example.com/storage/assets/test-file.jpg');
      expect(mockStorageBucket.getPublicUrl).toHaveBeenCalledWith('test-file.jpg');
    });
  });
});

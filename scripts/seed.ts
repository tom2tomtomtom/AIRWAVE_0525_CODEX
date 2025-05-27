// scripts/seed.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { faker } from '@faker-js/faker';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedDatabase() {
  console.log('Seeding database...');
  
  try {
    // Create test clients
    const clients = [];
    for (let i = 0; i < 5; i++) {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: faker.company.name(),
          description: faker.company.catchPhrase(),
          industry: faker.helpers.arrayElement(['Technology', 'Retail', 'Finance', 'Healthcare', 'Education'])
        })
        .select()
        .single();
        
      if (error) throw error;
      clients.push(data);
      console.log(`✓ Created client: ${data.name}`);
    }
    
    // Create test users/profiles
    const testUsers = [
      { email: 'admin@test.com', role: 'admin', password: 'Test123!' },
      { email: 'user@test.com', role: 'user', password: 'Test123!' }
    ];
    
    for (const user of testUsers) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true
      });
      
      if (authError) {
        console.warn(`User ${user.email} might already exist:`, authError.message);
        continue;
      }
      
      // Create profile
      await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          first_name: faker.person.firstName(),
          last_name: faker.person.lastName(),
          role: user.role
        });
        
      console.log(`✓ Created user: ${user.email} (${user.role})`);
    }
    
    // Create sample templates
    const platforms = ['facebook', 'instagram', 'youtube', 'tiktok'];
    const aspectRatios = ['1:1', '4:5', '16:9', '9:16'];
    
    for (const platform of platforms) {
      for (const aspectRatio of aspectRatios) {
        const [width, height] = aspectRatio.split(':').map(n => parseInt(n) * 100);
        
        await supabase
          .from('templates')
          .insert({
            name: `${faker.commerce.productAdjective()} ${platform} Template`,
            description: faker.commerce.productDescription(),
            platform,
            aspect_ratio: aspectRatio,
            width,
            height,
            structure: {
              elements: [],
              duration: 15
            }
          });
      }
    }
    
    console.log('✓ Created sample templates');
    
    // Create sample assets for each client
    for (const client of clients) {
      const assetTypes = ['image', 'video', 'audio', 'text'];
      
      for (const type of assetTypes) {
        for (let i = 0; i < 3; i++) {
          await supabase
            .from('assets')
            .insert({
              client_id: client.id,
              name: `${faker.commerce.productName()} ${type}`,
              type,
              url: faker.image.url(),
              thumbnail_url: type === 'video' || type === 'image' ? faker.image.url() : null,
              size_bytes: faker.number.int({ min: 1000, max: 10000000 }),
              mime_type: `${type}/sample`,
              tags: faker.helpers.arrayElements(['hero', 'product', 'lifestyle', 'logo', 'cta'], 2)
            });
        }
      }
      
      console.log(`✓ Created assets for client: ${client.name}`);
    }
    
    console.log('\n✅ Database seeding completed successfully');
    console.log('\nTest credentials:');
    console.log('Admin: admin@test.com / Test123!');
    console.log('User: user@test.com / Test123!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding
seedDatabase();
/**
 * Profile utilities for consistent user profile handling
 * Ensures all profile operations use the correct database schema
 */

import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/database';
import { loggers } from '@/lib/logger';


export interface CreateProfileData {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

export interface ProfileResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
}

/**
 * Parse a full name into first and last name components
 */
export function parseFullName(fullName: string): { firstName: string; lastName: string | null } {
  const nameParts = fullName.trim().split(' ');
  const firstName = nameParts[0] || fullName;
  const lastName = nameParts.slice(1).join(' ') || null;

  return { firstName, lastName };
}

/**
 * Format first and last name into a full name
 */
export function formatFullName(firstName: string | null, lastName: string | null): string {
  const first = firstName?.trim() || '';
  const last = lastName?.trim() || '';
  return `${first} ${last}`.trim() || 'User';
}

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string): Promise<Profile | null> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
}

/**
 * Create a new user profile with consistent schema
 */
export async function createUserProfile(profileData: CreateProfileData): Promise<Profile | null> {
  const { firstName, lastName } = parseFullName(profileData.name);

  if (!supabase) {
    loggers.general.error('Supabase client not available in server context');
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: profileData.id,
      first_name: firstName,
      last_name: lastName,
      role: profileData.role || 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    console.error('Error creating user profile:', error);
    return null;
  }

  return data;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<{ name: string; role: string; [key: string]: any }>
): Promise<Profile | null> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }
  const profileUpdates: any = {
    updated_at: new Date().toISOString() };

  // Handle name updates
  if (updates.name) {
    const { firstName, lastName } = parseFullName(updates.name);
    profileUpdates.first_name = firstName;
    profileUpdates.last_name = lastName;
  }

  // Handle other updates
  Object.keys(updates).forEach((key: any) => {
    if (key !== 'name' && updates[key] !== undefined) {
      profileUpdates[key] = updates[key];
    }
  });

  const { data, error } = await supabase
    .from('profiles')
    .update(profileUpdates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user profile:', error);
    return null;
  }

  return data;
}

/**
 * Convert a profile to a standardized response format
 */
export function formatProfileResponse(profile: Profile, email: string): ProfileResponse {
  return {
    id: profile.id,
    email: email,
    name: formatFullName(profile.first_name, profile.last_name),
    role: profile.role,
    first_name: profile.first_name,
    last_name: profile.last_name };
}

/**
 * Get or create user profile (used during authentication)
 */
export async function getOrCreateUserProfile(
  userId: string,
  userData: { name?: string; email?: string }
): Promise<ProfileResponse | null> {
  // Try to get existing profile
  let profile = await getUserProfile(userId);

  // If profile doesn't exist, create it
  if (!profile) {
    const name = userData.name || userData.email?.split('@')[0] || 'User';
    profile = await createUserProfile({
      id: userId,
      name: name,
      email: userData.email || 'unknown@email.com' });
  }

  if (!profile) {
    return null;
  }

  return formatProfileResponse(profile, userData.email || '');
}

/**
 * Validate profile data before database operations
 */
export function validateProfileData(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.id || typeof data.id !== 'string') {
    errors.push('Profile ID is required and must be a string');
  }

  if (data.first_name && typeof data.first_name !== 'string') {
    errors.push('First name must be a string');
  }

  if (data.last_name && typeof data.last_name !== 'string') {
    errors.push('Last name must be a string');
  }

  if (data.role && !['user', 'admin', 'client'].includes(data.role)) {
    errors.push('Role must be one of: user, admin, client');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Migrate legacy profile data (if needed)
 * This function can be used to migrate profiles that might have old schema formats
 */
export async function migrateLegacyProfile(userId: string): Promise<boolean> {
  try {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return false;
    }

    // Check if profile needs migration (has full_name but no first_name/last_name)
    if ((profile as any).full_name && !profile.first_name && !profile.last_name) {
      const { firstName, lastName } = parseFullName((profile as any).full_name);

      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) {
        console.error('Error migrating legacy profile:', updateError);
        return false;
      }

      if (process.env.NODE_ENV === 'development') {
        loggers.general.error(`Migrated legacy profile for user ${userId}`);
      }
    }

    return true;
  } catch (error: any) {
    console.error('Error during profile migration:', error);
    return false;
  }
}

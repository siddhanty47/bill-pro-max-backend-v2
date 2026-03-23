/**
 * @file Supabase configuration settings
 * @description Configuration for Supabase Auth integration
 */

export const supabaseConfig = {
  url: process.env.SUPABASE_URL || '',
  anonKey: process.env.SUPABASE_ANON_KEY || '',
  jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};

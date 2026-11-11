import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

const environment = loadEnv('development', fileURLToPath(new URL('../', import.meta.url)), 'VITE_');
export const supabaseUrl = (environment.VITE_SUPABASE_URL || '').replace(/\/$/, '');
export const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY || '';
export const backend = `${supabaseUrl}/functions/v1/lpg-api/api`;

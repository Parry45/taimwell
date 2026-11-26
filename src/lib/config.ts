// These values are public by design (they ship to the browser). Environment variables
// on Vercel override them; the fallbacks keep the first deploy working with zero setup.
const env = import.meta.env;

export const SUPABASE_URL: string = env.VITE_SUPABASE_URL || 'https://sazomxsuuovsddohdspy.supabase.co';
export const SUPABASE_ANON_KEY: string =
  env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhem9teHN1dW92c2Rkb2hkc3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2NTEyNzksImV4cCI6MjExMTIyNzI3OX0.7Ci2PI99ny2tCOLrBhEVewxcPFfySsW84aS9eJPOy7w';
export const GOOGLE_CLIENT_ID: string =
  env.VITE_GOOGLE_CLIENT_ID || '843538932658-rm7tegj5trvm581rg4boqi3l69iu1p6i.apps.googleusercontent.com';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const isGoogleConfigured = Boolean(GOOGLE_CLIENT_ID);

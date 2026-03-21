// ===== SUPABASE CONFIG =====

const SUPABASE_URL = 'https://umueucsxowjaurlaubwa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtdWV1Y3N4b3dqYXVybGF1YndhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTQwMjAsImV4cCI6MjA4ODc5MDAyMH0.qUSPM1NO5UkUEf-p81k1Kw93C0BCJBrbJzkHL9Ai3mk';
let supa = null;
function initSupabase() {
  supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window._supabaseKey = SUPABASE_KEY; // ใช้สำหรับเรียก Edge Functions
  return supa;
}
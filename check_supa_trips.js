const SUPABASE_URL = 'https://rfyzoepziojejsyevmch.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmeXpvZXB6aW9qZWpzeWV2bWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3OTczNTEsImV4cCI6MjEwNTM3MzM1MX0.iUbltRh81ofe3TFehNeFiGUoYeFDWIJHlO9MccVeU4k';

async function checkTrips() {
  const headers = { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trips?select=*`, { headers });
  const data = await res.json();
  console.log('Trips in Supabase:', data);
}

checkTrips();

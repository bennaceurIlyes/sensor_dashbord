export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServiceSupabase, supabase } from '@/lib/supabase';

// Helper to ensure valid device API key
function isValidApiKey(request: Request) {
  const apiKey = process.env.DEVICE_API_KEY;
  if (!apiKey) return false;
  
  // Try to get from header or body (if GET, headers only)
  const headerKey = request.headers.get('x-api-key');
  if (headerKey === apiKey) return true;
  return false;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Auth validation
    const serverApiKey = process.env.DEVICE_API_KEY;
    if (!serverApiKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const clientApiKey = body.apiKey || request.headers.get('x-api-key');
    if (clientApiKey !== serverApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deviceId, readings } = body;

    if (!deviceId || !Array.isArray(readings)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Map readings to Supabase rows
    const rows = readings.map((r: any) => ({
      device_id: deviceId,
      sensor: r.sensor,
      temperature: r.temperature,
      humidity: r.humidity,
    }));

    // Use service role to bypass RLS for inserting
    const supabaseAdmin = getServiceSupabase();
    
    const { error } = await supabaseAdmin
      .from('sensor_readings')
      .insert(rows);

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: rows.length });
  } catch (err: any) {
    console.error('POST /api/readings error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId') || 'sechoir-solaire-esp32';
    const range = searchParams.get('range') || '1h'; // 1h, 24h, 7d, all

    const supabaseAdmin = getServiceSupabase();
    let query = supabaseAdmin
      .from('sensor_readings')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false });

    if (range !== 'all') {
      let hours = 1;
      if (range === '24h') hours = 24;
      else if (range === '7d') hours = 24 * 7;
      const timeAgo = new Date();
      timeAgo.setHours(timeAgo.getHours() - hours);
      query = query.gte('created_at', timeAgo.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Database fetch error' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

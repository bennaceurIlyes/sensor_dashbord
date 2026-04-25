export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { format } from 'date-fns';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const deviceId = searchParams.get('deviceId') || 'sechoir-solaire-esp32';

    // Because each pivoted row consists of ~8 raw readings,
    // we multiply the limits and offsets by 8.
    const rawLimit = limit * 8;
    const rawOffset = (page - 1) * rawLimit;

    const supabaseAdmin = getServiceSupabase();
    
    // Get total count
    const { count, error: countError } = await supabaseAdmin
      .from('sensor_readings')
      .select('*', { count: 'exact', head: true })
      .eq('device_id', deviceId);

    if (countError) throw countError;
    const totalRaw = count || 0;
    const totalPivoted = Math.ceil(totalRaw / 8);
    const totalPages = Math.ceil(totalPivoted / limit);

    // Get paginated raw data
    const { data, error } = await supabaseAdmin
      .from('sensor_readings')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .range(rawOffset, rawOffset + rawLimit - 1);

    if (error) throw error;

    // Pivot data
    const grouped: Record<string, any> = {};
    data?.forEach((r) => {
      const ts = new Date(r.created_at).getTime();
      const key = Math.round(ts / 1000) * 1000;
      if (!grouped[key]) {
        grouped[key] = {
          date: format(new Date(key), "yyyy-MM-dd"),
          time: format(new Date(key), "HH:mm:ss"),
          timestamp: key,
        };
      }
      grouped[key][`${r.sensor}_temp`] = r.temperature;
      grouped[key][`${r.sensor}_hum`] = r.humidity;
    });

    const pivotedRows = Object.values(grouped).sort((a: any, b: any) => b.timestamp - a.timestamp);

    return NextResponse.json({
      data: pivotedRows,
      totalRecords: totalPivoted,
      totalPages: totalPages,
      currentPage: page
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

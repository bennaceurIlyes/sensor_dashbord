export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { format } from 'date-fns';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId') || 'sechoir-solaire-esp32';

    const supabaseAdmin = getServiceSupabase();
    
    const allData = [];
    let from = 0;
    const step = 1000;
    const MAX_ROWS = 100000;

    let query = supabaseAdmin
      .from('sensor_readings')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false });

    while (allData.length < MAX_ROWS) {
      const { data, error } = await query.range(from, from + step - 1);
      if (error) break;
      if (data && data.length > 0) {
        allData.push(...data);
        if (data.length < step) break;
        from += step;
      } else {
        break;
      }
    }

    // Pivot Data
    const grouped: Record<string, any> = {};
    allData.forEach((r) => {
      const ts = new Date(r.created_at).getTime();
      const key = Math.round(ts / 1000) * 1000;
      const dateObj = new Date(key);
      // Adjust to UTC+1 for Algeria (Université Béchar)
      const localTime = new Date(dateObj.getTime() + 3600000);
      
      if (!grouped[key]) {
        grouped[key] = {
          date: format(localTime, "yyyy-MM-dd"),
          time: format(localTime, "HH:mm:ss"),
          timestamp: key,
        };
      }
      grouped[key][`${r.sensor}_temp`] = r.temperature;
      grouped[key][`${r.sensor}_hum`] = r.humidity;
    });

    const pivotData = Object.values(grouped).sort((a: any, b: any) => b.timestamp - a.timestamp);

    // Build CSV
    const SENSORS = ["DHT1", "DHT2", "DHT3", "DHT4", "DHT5", "DHT6", "DHT7", "DHT8"];
    const headers = ["Date", "Heure"];
    SENSORS.forEach((s) => {
      headers.push(`${s} T(°C)`, `${s} H(%)`);
    });

    const rows = pivotData.map((row: any) => {
      const cols: (string | number)[] = [row.date, row.time];
      SENSORS.forEach((s) => {
        cols.push(
          row[`${s}_temp`] !== undefined ? Number(row[`${s}_temp`]) : "",
          row[`${s}_hum`] !== undefined ? Number(row[`${s}_hum`]) : ""
        );
      });
      return cols.join(";");
    });

    const csv = [headers.join(";"), ...rows].join("\n");
    const BOM = "\uFEFF";

    return new NextResponse(BOM + csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv;charset=utf-8;',
        'Content-Disposition': `attachment; filename="sechoir_solaire_complet_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

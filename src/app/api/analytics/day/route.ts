export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { format } from 'date-fns';

const SENSORS = ["DHT1", "DHT2", "DHT3", "DHT4", "DHT5", "DHT6", "DHT7", "DHT8"] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || format(new Date(Date.now() + 3600000), 'yyyy-MM-dd'); // Default to local today in Algeria
    const deviceId = searchParams.get('deviceId') || 'sechoir-solaire-esp32';

    // Establish timezone boundaries for Algeria (UTC+1)
    const startOfDay = new Date(`${date}T00:00:00+01:00`);
    const endOfDay = new Date(`${date}T23:59:59.999+01:00`);

    if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const supabaseAdmin = getServiceSupabase();

    // Query all records for this local day using high-speed paginated retrieval
    const allData = [];
    let from = 0;
    const step = 1000;
    const MAX_ROWS = 100000;

    let query = supabaseAdmin
      .from('sensor_readings')
      .select('created_at, sensor, temperature, humidity')
      .eq('device_id', deviceId)
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: true });

    while (allData.length < MAX_ROWS) {
      const { data, error } = await query.range(from, from + step - 1);

      if (error) {
        console.error('Supabase query error:', error);
        return NextResponse.json({ error: 'Database fetch error' }, { status: 500 });
      }

      if (data && data.length > 0) {
        allData.push(...data);
        if (data.length < step) break; // End of database rows
        from += step;
      } else {
        break;
      }
    }

    if (allData.length === 0) {
      return NextResponse.json({
        data: [],
        summary: null
      });
    }

    // 1. Calculate physical-validated extreme metrics and overall statistics
    let maxTemp = -Infinity;
    let maxTempSensor = '';
    let maxTempTime = '';
    let minTemp = Infinity;
    let minTempSensor = '';
    let minTempTime = '';

    let totalTemp = 0;
    let countTemp = 0;
    let totalHum = 0;
    let countHum = 0;

    allData.forEach((r) => {
      const t = Number(r.temperature);
      const h = Number(r.humidity);

      // Data quality filtering: discard DHT22 erroneous reading spikes (0°C, 165°C, or H < 1%)
      if (t < 5 || t > 85 || h < 1 || h > 100) return;

      const ts = new Date(r.created_at);
      // Convert to UTC+1 local time for presentation
      const localTime = new Date(ts.getTime() + 3600000);
      const timeStr = format(localTime, 'HH:mm:ss');

      if (t > maxTemp) {
        maxTemp = t;
        maxTempSensor = r.sensor;
        maxTempTime = timeStr;
      }
      if (t < minTemp) {
        minTemp = t;
        minTempSensor = r.sensor;
        minTempTime = timeStr;
      }

      totalTemp += t;
      countTemp++;
      totalHum += h;
      countHum++;
    });

    const avgTemp = countTemp > 0 ? parseFloat((totalTemp / countTemp).toFixed(2)) : 0;
    const avgHum = countHum > 0 ? parseFloat((totalHum / countHum).toFixed(2)) : 0;

    // 2. Aggregate into 10-minute buckets for rendering a clean chart
    const bucketMinutes = 10;
    const bucketMs = bucketMinutes * 60 * 1000;
    const buckets: Record<string, any> = {};

    allData.forEach((r) => {
      const t = Number(r.temperature);
      const h = Number(r.humidity);

      // Filter noise
      if (t < 5 || t > 85 || h < 1 || h > 100) return;

      const ts = new Date(r.created_at).getTime();
      const localTs = ts + 3600000; // Algeria offset
      const bucketTs = Math.floor(localTs / bucketMs) * bucketMs;

      // Format bucket key as local time string HH:mm
      const key = format(new Date(bucketTs), 'HH:mm');

      if (!buckets[key]) {
        buckets[key] = {
          time: key,
          timestamp: bucketTs - 3600000, // True UTC
        };
      }

      const s = r.sensor;
      const tKey = `${s}_temp`;
      const hKey = `${s}_hum`;

      if (!buckets[key][tKey]) {
        buckets[key][`${tKey}_sum`] = 0;
        buckets[key][`${tKey}_count`] = 0;
        buckets[key][`${hKey}_sum`] = 0;
        buckets[key][`${hKey}_count`] = 0;
      }

      buckets[key][`${tKey}_sum`] += t;
      buckets[key][`${tKey}_count`]++;
      buckets[key][`${hKey}_sum`] += h;
      buckets[key][`${hKey}_count`]++;
    });

    let maxGradient = 0;
    let maxGradientTime = '';

    const bucketData = Object.values(buckets).map((b: any) => {
      const row: any = { time: b.time, timestamp: b.timestamp };
      
      let bMaxT = -Infinity;
      let bMinT = Infinity;

      SENSORS.forEach((s) => {
        const tKey = `${s}_temp`;
        const hKey = `${s}_hum`;

        if (b[`${tKey}_count`] > 0) {
          const avgSensorTemp = b[`${tKey}_sum`] / b[`${tKey}_count`];
          row[tKey] = parseFloat(avgSensorTemp.toFixed(2));
          
          if (avgSensorTemp > bMaxT) bMaxT = avgSensorTemp;
          if (avgSensorTemp < bMinT) bMinT = avgSensorTemp;
        }

        if (b[`${hKey}_count`] > 0) {
          row[hKey] = parseFloat((b[`${hKey}_sum`] / b[`${hKey}_count`]).toFixed(2));
        }
      });

      // Compute instantaneous thermal gradient inside the solar dryer
      if (bMaxT !== -Infinity && bMinT !== Infinity) {
        const grad = parseFloat((bMaxT - bMinT).toFixed(2));
        row.gradient = grad;
        
        if (grad > maxGradient) {
          maxGradient = grad;
          maxGradientTime = b.time;
        }
      } else {
        row.gradient = 0;
      }

      return row;
    }).sort((a: any, b: any) => a.timestamp - b.timestamp);

    const summary = {
      avgTemp,
      avgHum,
      maxTemp: maxTemp !== -Infinity ? maxTemp : null,
      maxTempSensor,
      maxTempTime,
      minTemp: minTemp !== Infinity ? minTemp : null,
      minTempSensor,
      minTempTime,
      maxGradient,
      maxGradientTime,
      totalRawRows: allData.length,
      device_id: deviceId,
      date
    };

    return NextResponse.json({
      data: bucketData,
      summary
    });
  } catch (err: any) {
    console.error('GET /api/analytics/day error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

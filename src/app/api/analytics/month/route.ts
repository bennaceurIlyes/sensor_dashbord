export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { format } from 'date-fns';

const SENSORS = ["DHT1", "DHT2", "DHT3", "DHT4", "DHT5", "DHT6", "DHT7", "DHT8"] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || format(new Date(Date.now() + 3600000), 'yyyy-MM'); // Default to local current month in Algeria
    const deviceId = searchParams.get('deviceId') || 'sechoir-solaire-esp32';

    // Establish boundaries for the chosen month in local time (UTC+1)
    const startDate = new Date(`${month}-01T00:00:00+01:00`);
    const nextMonth = new Date(startDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const endDate = new Date(nextMonth.getTime() - 1);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid month format' }, { status: 400 });
    }

    const supabaseAdmin = getServiceSupabase();

    // 1. Get total record count for the date range to calculate pagination pages
    const { count, error: countError } = await supabaseAdmin
      .from('sensor_readings')
      .select('*', { count: 'exact', head: true })
      .eq('device_id', deviceId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (countError) {
      console.error('Count query error:', countError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const totalRows = count || 0;
    if (totalRows === 0) {
      return NextResponse.json({
        data: [],
        summary: null
      });
    }

    // 2. Query all pages concurrently using Promise.all (Parallel Fetching)
    const pageSize = 1000;
    // Cap total pages to prevent overloading memory (max 150,000 rows fetched concurrently)
    const totalPages = Math.min(Math.ceil(totalRows / pageSize), 150);
    
    const pagePromises = [];
    for (let i = 0; i < totalPages; i++) {
      const from = i * pageSize;
      const to = from + pageSize - 1;
      pagePromises.push(
        supabaseAdmin
          .from('sensor_readings')
          .select('created_at, sensor, temperature, humidity')
          .eq('device_id', deviceId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: true })
          .range(from, to)
      );
    }

    const results = await Promise.all(pagePromises);

    const allData = [];
    for (const res of results) {
      if (res.error) {
        console.error('Database fetch error in parallel pages:', res.error);
        return NextResponse.json({ error: 'Database fetch error' }, { status: 500 });
      }
      if (res.data) {
        allData.push(...res.data);
      }
    }

    // 3. Physical quality filter and group by local date (YYYY-MM-DD)
    const dailyGroups: Record<string, any> = {};

    let absoluteMaxTemp = -Infinity;
    let absoluteMaxTempSensor = '';
    let absoluteMaxTempDate = '';
    
    let absoluteMinTemp = Infinity;
    let absoluteMinTempSensor = '';
    let absoluteMinTempDate = '';

    let grandTotalTemp = 0;
    let grandCountTemp = 0;
    let grandTotalHum = 0;
    let grandCountHum = 0;

    allData.forEach((r) => {
      const t = Number(r.temperature);
      const h = Number(r.humidity);

      // Data quality filtering: ignore anomalies (DHT22 errors)
      if (t < 5 || t > 85 || h < 1 || h > 100) return;

      const ts = new Date(r.created_at);
      const localTs = new Date(ts.getTime() + 3600000); // UTC+1 Shift
      const dateKey = format(localTs, 'yyyy-MM-dd');

      if (t > absoluteMaxTemp) {
        absoluteMaxTemp = t;
        absoluteMaxTempSensor = r.sensor;
        absoluteMaxTempDate = dateKey;
      }
      if (t < absoluteMinTemp) {
        absoluteMinTemp = t;
        absoluteMinTempSensor = r.sensor;
        absoluteMinTempDate = dateKey;
      }

      grandTotalTemp += t;
      grandCountTemp++;
      grandTotalHum += h;
      grandCountHum++;

      if (!dailyGroups[dateKey]) {
        dailyGroups[dateKey] = {
          date: dateKey,
          timestamp: new Date(`${dateKey}T00:00:00+01:00`).getTime(),
        };
      }

      const s = r.sensor;
      const tKey = `${s}_temp`;
      const hKey = `${s}_hum`;

      if (!dailyGroups[dateKey][tKey]) {
        dailyGroups[dateKey][`${tKey}_sum`] = 0;
        dailyGroups[dateKey][`${tKey}_count`] = 0;
        dailyGroups[dateKey][`${hKey}_sum`] = 0;
        dailyGroups[dateKey][`${hKey}_count`] = 0;
      }

      dailyGroups[dateKey][`${tKey}_sum`] += t;
      dailyGroups[dateKey][`${tKey}_count`]++;
      dailyGroups[dateKey][`${hKey}_sum`] += h;
      dailyGroups[dateKey][`${hKey}_count`]++;
    });

    const avgTemp = grandCountTemp > 0 ? parseFloat((grandTotalTemp / grandCountTemp).toFixed(2)) : 0;
    const avgHum = grandCountHum > 0 ? parseFloat((grandTotalHum / grandCountHum).toFixed(2)) : 0;

    let activeOperationalDays = 0;

    const dailyPivotedList = Object.values(dailyGroups).map((d: any) => {
      const row: any = { date: d.date, timestamp: d.timestamp };
      
      let dayTempSum = 0;
      let dayTempCount = 0;

      SENSORS.forEach((s) => {
        const tKey = `${s}_temp`;
        const hKey = `${s}_hum`;

        if (d[`${tKey}_count`] > 0) {
          const sAvg = d[`${tKey}_sum`] / d[`${tKey}_count`];
          row[tKey] = parseFloat(sAvg.toFixed(2));
          dayTempSum += sAvg;
          dayTempCount++;
        }

        if (d[`${hKey}_count`] > 0) {
          row[hKey] = parseFloat((d[`${hKey}_sum`] / d[`${hKey}_count`]).toFixed(2));
        }
      });

      // Track active operational solar drying day:
      // If the day average temperature across sensors exceeds 35°C,
      // it means the solar dryer was operating and heating successfully.
      if (dayTempCount > 0) {
        const dayAvg = dayTempSum / dayTempCount;
        if (dayAvg > 35) {
          activeOperationalDays++;
        }
      }

      return row;
    }).sort((a: any, b: any) => a.timestamp - b.timestamp);

    const summary = {
      avgTemp,
      avgHum,
      maxTemp: absoluteMaxTemp !== -Infinity ? absoluteMaxTemp : null,
      maxTempSensor: absoluteMaxTempSensor,
      maxTempDate: absoluteMaxTempDate,
      minTemp: absoluteMinTemp !== Infinity ? absoluteMinTemp : null,
      minTempSensor: absoluteMinTempSensor,
      minTempDate: absoluteMinTempDate,
      activeOperationalDays,
      totalActiveDays: dailyPivotedList.length,
      totalRawRows: allData.length,
      device_id: deviceId,
      month
    };

    return NextResponse.json({
      data: dailyPivotedList,
      summary
    });
  } catch (err: any) {
    console.error('GET /api/analytics/month error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

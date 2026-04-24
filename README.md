# ESP32 Solar Dryer Dashboard

A complete Next.js IoT dashboard to visualize data from 8 DHT22 sensors via an ESP32 microcontroller, replacing ThingSpeak. Built with Next.js App Router, Tailwind CSS, Recharts, and Supabase.

## Features
- Real-time updates every 10 seconds.
- Single JSON payload for all 8 sensors.
- Historical charts and data table.
- Time range filtering (1h, 24h, 7d).
- Responsive, modern UI.

## 1. Supabase Setup

1. Create a new project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor** and run the following code:

```sql
create table sensor_readings (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  sensor text not null,
  temperature numeric,
  humidity numeric,
  created_at timestamptz default now()
);

create index sensor_readings_created_at_idx on sensor_readings(created_at desc);
create index sensor_readings_device_sensor_idx on sensor_readings(device_id, sensor);
```

3. Go to **Project Settings > API** and copy:
   - `Project URL`
   - `anon` `public` key
   - `service_role` `secret` key

## 2. Vercel Deployment

1. Push this repository to GitHub.
2. Go to [Vercel](https://vercel.com) and create a new project from your GitHub repo.
3. Add the following Environment Variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`: (Your Supabase Project URL)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (Your Supabase Anon Key)
   - `SUPABASE_SERVICE_ROLE_KEY`: (Your Supabase Service Role Key)
   - `DEVICE_API_KEY`: (Create a secure secret password to authenticate your ESP32)
4. Click **Deploy**.

## 3. Local Development

To run locally, create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DEVICE_API_KEY=your_secret_device_key
```

Then run:

```bash
npm run dev
```

## 4. Testing the API

You can test the POST endpoint with `curl` using the JSON format the ESP32 will send:

```bash
curl -X POST http://localhost:3000/api/readings \
  -H "Content-Type: application/json" \
  -d '{
  "deviceId": "sechoir-solaire-esp32",
  "apiKey": "your_secret_device_key",
  "readings": [
    { "sensor": "DHT1", "temperature": 24.5, "humidity": 60.2 },
    { "sensor": "DHT2", "temperature": 25.1, "humidity": 61.4 },
    { "sensor": "DHT3", "temperature": 26.0, "humidity": 59.8 },
    { "sensor": "DHT4", "temperature": 24.8, "humidity": 62.0 },
    { "sensor": "DHT5", "temperature": 27.2, "humidity": 58.1 },
    { "sensor": "DHT6", "temperature": 28.0, "humidity": 57.5 },
    { "sensor": "DHT7", "temperature": 26.7, "humidity": 59.0 },
    { "sensor": "DHT8", "temperature": 25.9, "humidity": 60.7 }
  ]
}'
```

## 5. ESP32 Setup

1. Open the `arduino/esp32_api_client.ino` file in the Arduino IDE.
2. Update the `ssid` and `password` with your WiFi credentials.
3. Update `serverUrl` with your Vercel deployment URL (e.g., `https://your-project.vercel.app/api/readings`).
4. Update `deviceApiKey` to match the `DEVICE_API_KEY` you set in Vercel.
5. Upload the code to your ESP32.

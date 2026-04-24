"use client";

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Thermometer, Droplets, RefreshCw, Clock, Download } from 'lucide-react';
import { format } from 'date-fns';

type SensorReading = {
  id: string;
  device_id: string;
  sensor: string;
  temperature: number;
  humidity: number;
  created_at: string;
};

export default function Dashboard() {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('1h');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchReadings = async () => {
    try {
      const res = await fetch(`/api/readings?range=${timeRange}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      if (json.data) {
        setReadings(json.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => {
    fetchReadings();
    const interval = setInterval(fetchReadings, 10000); // Auto refresh every 10s
    return () => clearInterval(interval);
  }, [timeRange]);

  const downloadCSV = () => {
    if (readings.length === 0) return;
    
    const headers = ['Time', 'Sensor', 'Temperature (°C)', 'Humidity (%)'];
    const rows = readings.map(r => [
      format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss'),
      r.sensor,
      r.temperature,
      r.humidity
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sensor_data_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Process data for charts
  const processChartData = () => {
    // Group by timestamp
    const grouped: Record<string, any> = {};
    readings.forEach(r => {
      const time = new Date(r.created_at).getTime();
      const key = format(new Date(r.created_at), 'HH:mm:ss');
      if (!grouped[key]) {
        grouped[key] = { time: key, timestamp: time };
      }
      grouped[key][`${r.sensor}_temp`] = r.temperature;
      grouped[key][`${r.sensor}_hum`] = r.humidity;
    });

    return Object.values(grouped).sort((a, b) => a.timestamp - b.timestamp);
  };

  const chartData = processChartData();

  // Get latest readings for the cards
  const latestReadings = readings.reduce((acc, curr) => {
    if (!acc[curr.sensor] || new Date(curr.created_at) > new Date(acc[curr.sensor].created_at)) {
      acc[curr.sensor] = curr;
    }
    return acc;
  }, {} as Record<string, SensorReading>);

  const sensorsList = ['DHT1', 'DHT2', 'DHT3', 'DHT4', 'DHT5', 'DHT6', 'DHT7', 'DHT8'];
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">
              Université Béchar - Séchoir Solaire
            </h1>
            <p className="text-gray-500 mt-1 flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Last updated: {lastRefreshed ? lastRefreshed.toLocaleTimeString() : '...'}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button
              onClick={downloadCSV}
              disabled={readings.length === 0}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Excel/CSV
            </button>
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-full sm:w-auto justify-center">
              {['1h', '24h', '7d'].map((range) => (
                <button
                  key={range}
                  onClick={() => { setLoading(true); setTimeRange(range); }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    timeRange === range 
                      ? 'bg-white text-orange-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sensor Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sensorsList.map((sensor, idx) => {
            const data = latestReadings[sensor];
            return (
              <div key={sensor} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[idx] }} />
                    {sensor}
                  </h3>
                  {data && <span className="text-xs text-gray-400">{format(new Date(data.created_at), 'HH:mm')}</span>}
                </div>
                
                {data ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-orange-50 rounded-lg text-orange-500">
                        <Thermometer className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xl font-bold">{data.temperature}°C</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-50 rounded-lg text-blue-500">
                        <Droplets className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xl font-bold">{data.humidity}%</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center text-gray-400 text-sm">No data</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
              <Thermometer className="text-orange-500" /> Temperature History
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} tickMargin={10} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  {sensorsList.map((sensor, idx) => (
                    <Line 
                      key={sensor}
                      type="monotone" 
                      dataKey={`${sensor}_temp`} 
                      name={sensor} 
                      stroke={colors[idx]} 
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
              <Droplets className="text-blue-500" /> Humidity History
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} tickMargin={10} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  {sensorsList.map((sensor, idx) => (
                    <Line 
                      key={sensor}
                      type="monotone" 
                      dataKey={`${sensor}_hum`} 
                      name={sensor} 
                      stroke={colors[idx]} 
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Clock className="text-gray-500" /> Recent Readings
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Sensor</th>
                  <th className="px-6 py-3">Temperature (°C)</th>
                  <th className="px-6 py-3">Humidity (%)</th>
                </tr>
              </thead>
              <tbody>
                {readings.slice(0, 40).map((reading) => (
                  <tr key={reading.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                      {format(new Date(reading.created_at), 'yyyy-MM-dd HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4">{reading.sensor}</td>
                    <td className="px-6 py-4">
                      <span className="text-orange-600 font-medium">{reading.temperature}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-blue-600 font-medium">{reading.humidity}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
      </div>
    </div>
  );
}

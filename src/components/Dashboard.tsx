"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Thermometer,
  Droplets,
  RefreshCw,
  Clock,
  Download,
  Wifi,
  WifiOff,
  Sun,
  Activity,
} from "lucide-react";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

/* ---------- Types ---------- */
type SensorReading = {
  id: string;
  device_id: string;
  sensor: string;
  temperature: number;
  humidity: number;
  created_at: string;
};

/* Pivoted row: one row per timestamp with DHT1‒DHT8 columns */
type PivotRow = {
  time: string;
  timestamp: number;
  [key: string]: string | number;
};

/* ---------- Constants ---------- */
const SENSORS = [
  "DHT1",
  "DHT2",
  "DHT3",
  "DHT4",
  "DHT5",
  "DHT6",
  "DHT7",
  "DHT8",
] as const;

const SENSOR_COLORS: Record<string, string> = {
  DHT1: "#ef4444",
  DHT2: "#f97316",
  DHT3: "#eab308",
  DHT4: "#22c55e",
  DHT5: "#06b6d4",
  DHT6: "#3b82f6",
  DHT7: "#8b5cf6",
  DHT8: "#d946ef",
};

/* ---------- Helpers ---------- */

/** Group raw readings into pivot rows: each row = one timestamp,
 *  columns = DHT1_temp, DHT1_hum, …, DHT8_temp, DHT8_hum */
function pivotReadings(readings: SensorReading[]): PivotRow[] {
  const grouped: Record<string, PivotRow> = {};

  readings.forEach((r) => {
    const ts = new Date(r.created_at).getTime();
    // Round to nearest second so rows that arrive together are grouped
    const key = Math.round(ts / 1000) * 1000;

    if (!grouped[key]) {
      grouped[key] = {
        time: format(new Date(key), "HH:mm:ss"),
        timestamp: key,
      };
    }
    grouped[key][`${r.sensor}_temp`] = r.temperature;
    grouped[key][`${r.sensor}_hum`] = r.humidity;
  });

  return Object.values(grouped).sort((a, b) => a.timestamp - b.timestamp);
}

/** Build a proper CSV where each row = one timestamp and each DHT
 *  has its own temperature & humidity column. */
function buildCSV(pivotData: PivotRow[]): string {
  // Header
  const headers = ["Date", "Heure"];
  SENSORS.forEach((s) => {
    headers.push(`${s} T(°C)`, `${s} H(%)`);
  });

  const rows = pivotData.map((row) => {
    const dt = new Date(row.timestamp);
    const cols: (string | number)[] = [
      format(dt, "yyyy-MM-dd"),
      format(dt, "HH:mm:ss"),
    ];
    SENSORS.forEach((s) => {
      cols.push(
        row[`${s}_temp`] !== undefined ? Number(row[`${s}_temp`]) : "",
        row[`${s}_hum`] !== undefined ? Number(row[`${s}_hum`]) : ""
      );
    });
    return cols.join(";"); // semicolon delimiter – opens natively in Excel
  });

  return [headers.join(";"), ...rows].join("\n");
}

/* ================================================================== */
/*                          DASHBOARD                                 */
/* ================================================================== */

export default function Dashboard() {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("1h");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  /* ---------- Fetch ---------- */
  const fetchReadings = useCallback(async () => {
    try {
      const res = await fetch(`/api/readings?range=${timeRange}`);
      if (!res.ok) throw new Error("Fetch error");
      const json = await res.json();
      if (json.data) setReadings(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  }, [timeRange]);

  useEffect(() => {
    setLoading(true);
    fetchReadings();
    const id = setInterval(fetchReadings, 10_000);
    return () => clearInterval(id);
  }, [fetchReadings]);

  /* ---------- Derived data ---------- */
  const pivotData = pivotReadings(readings);

  const latestReadings = readings.reduce(
    (acc, curr) => {
      if (
        !acc[curr.sensor] ||
        new Date(curr.created_at) > new Date(acc[curr.sensor].created_at)
      ) {
        acc[curr.sensor] = curr;
      }
      return acc;
    },
    {} as Record<string, SensorReading>
  );

  const averagesBySensor = SENSORS.reduce((acc, sensor) => {
    const sensorReadings = readings.filter((r) => r.sensor === sensor);
    if (sensorReadings.length > 0) {
      const avgT = sensorReadings.reduce((s, r) => s + r.temperature, 0) / sensorReadings.length;
      const avgH = sensorReadings.reduce((s, r) => s + r.humidity, 0) / sensorReadings.length;
      acc[sensor] = { temperature: avgT, humidity: avgH };
    }
    return acc;
  }, {} as Record<string, { temperature: number; humidity: number }>);

  const activeSensors = Object.keys(latestReadings).length;
  const avgTemp =
    activeSensors > 0
      ? Object.values(latestReadings).reduce(
          (s, r) => s + r.temperature,
          0
        ) / activeSensors
      : 0;
  const avgHum =
    activeSensors > 0
      ? Object.values(latestReadings).reduce((s, r) => s + r.humidity, 0) /
        activeSensors
      : 0;

  /* ---------- CSV download ---------- */
  const downloadCSV = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/readings?range=all`);
      if (!res.ok) throw new Error("Fetch error");
      const json = await res.json();
      if (json.data) {
        const allPivotData = pivotReadings(json.data);
        if (allPivotData.length === 0) return;
        const csv = buildCSV(allPivotData);
        const BOM = "\uFEFF"; // UTF-8 BOM for Excel
        const blob = new Blob([BOM + csv], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sechoir_solaire_complet_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

  /* ======================= RENDER ======================= */
  return (
    <div className="min-h-screen bg-background">
      {/* ──── Top Bar ──── */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sun className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight sm:text-xl">
                Séchoir Solaire
              </h1>
              <p className="text-xs text-muted-foreground">
                Université Béchar – Dashboard IoT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={activeSensors > 0 ? "default" : "destructive"}
              className="gap-1.5 text-xs"
            >
              {activeSensors > 0 ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              {activeSensors > 0 ? "En ligne" : "Hors ligne"}
            </Badge>
            <span className="hidden text-xs text-muted-foreground sm:inline-flex items-center gap-1">
              <RefreshCw
                className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
              />
              {lastRefreshed
                ? format(lastRefreshed, "HH:mm:ss")
                : "…"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* ──── Controls ──── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={timeRange}
            onValueChange={(v) => setTimeRange(v)}
            className="w-full sm:w-auto"
          >
            <TabsList>
              <TabsTrigger value="1h">1 Heure</TabsTrigger>
              <TabsTrigger value="24h">24 Heures</TabsTrigger>
              <TabsTrigger value="7d">7 Jours</TabsTrigger>
              <TabsTrigger value="all">Tout</TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            onClick={downloadCSV}
            disabled={isDownloading || pivotData.length === 0}
            variant="outline"
            className="gap-2"
          >
            {isDownloading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Exporter CSV / Excel
          </Button>
        </div>

        {/* ──── Summary strip ──── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="rounded-lg bg-orange-100 p-2.5 text-orange-600">
                <Thermometer className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Temp. moy.</p>
                <p className="text-xl font-bold tabular-nums">
                  {avgTemp > 0 ? avgTemp.toFixed(1) : "—"}
                  <span className="text-sm font-normal text-muted-foreground">
                    °C
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="rounded-lg bg-blue-100 p-2.5 text-blue-600">
                <Droplets className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Humidité moy.</p>
                <p className="text-xl font-bold tabular-nums">
                  {avgHum > 0 ? avgHum.toFixed(1) : "—"}
                  <span className="text-sm font-normal text-muted-foreground">
                    %
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="rounded-lg bg-emerald-100 p-2.5 text-emerald-600">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Capteurs actifs</p>
                <p className="text-xl font-bold tabular-nums">
                  {activeSensors}
                  <span className="text-sm font-normal text-muted-foreground">
                    /8
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <div className="rounded-lg bg-violet-100 p-2.5 text-violet-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lectures</p>
                <p className="text-xl font-bold tabular-nums">
                  {pivotData.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ──── Sensor cards grid ──── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SENSORS.map((sensor) => {
            const data = latestReadings[sensor];
            const avgData = averagesBySensor[sensor];
            const color = SENSOR_COLORS[sensor];
            return (
              <Card
                key={sensor}
                className="group transition-shadow hover:shadow-lg"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {sensor}
                  </CardTitle>
                  {data && (
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(data.created_at), "HH:mm")}
                    </span>
                  )}
                </CardHeader>
                <CardContent>
                  {data ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <div className="rounded-md bg-orange-50 p-1.5 text-orange-500">
                            <Thermometer className="h-4 w-4" />
                          </div>
                          <span className="text-lg font-bold tabular-nums">
                            {data.temperature}
                            <span className="text-xs font-normal text-muted-foreground">
                              °C
                            </span>
                          </span>
                        </div>
                        {avgData && (
                          <span className="text-[10px] text-muted-foreground mt-1 ml-8">
                            Moy: {avgData.temperature.toFixed(1)}°C
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <div className="rounded-md bg-blue-50 p-1.5 text-blue-500">
                            <Droplets className="h-4 w-4" />
                          </div>
                          <span className="text-lg font-bold tabular-nums">
                            {data.humidity}
                            <span className="text-xs font-normal text-muted-foreground">
                              %
                            </span>
                          </span>
                        </div>
                        {avgData && (
                          <span className="text-[10px] text-muted-foreground mt-1 ml-8">
                            Moy: {avgData.humidity.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="py-3 text-center text-sm text-muted-foreground">
                      Pas de données
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ──── Charts ──── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Temperature */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Thermometer className="h-5 w-5 text-orange-500" />
                Historique Température
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pivotData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--color-border)"
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11 }}
                      tickMargin={8}
                      stroke="var(--color-muted-foreground)"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="var(--color-muted-foreground)"
                      domain={["auto", "auto"]}
                      unit="°C"
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow:
                          "0 4px 12px rgb(0 0 0 / 0.08)",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: "11px",
                        paddingTop: "8px",
                      }}
                    />
                    {SENSORS.map((s) => (
                      <Line
                        key={s}
                        type="monotone"
                        dataKey={`${s}_temp`}
                        name={s}
                        stroke={SENSOR_COLORS[s]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Humidity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Droplets className="h-5 w-5 text-blue-500" />
                Historique Humidité
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pivotData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--color-border)"
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11 }}
                      tickMargin={8}
                      stroke="var(--color-muted-foreground)"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="var(--color-muted-foreground)"
                      domain={["auto", "auto"]}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow:
                          "0 4px 12px rgb(0 0 0 / 0.08)",
                        fontSize: "12px",
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: "11px",
                        paddingTop: "8px",
                      }}
                    />
                    {SENSORS.map((s) => (
                      <Line
                        key={s}
                        type="monotone"
                        dataKey={`${s}_hum`}
                        name={s}
                        stroke={SENSOR_COLORS[s]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ──── Data Table (pivoted) ──── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Dernières Mesures
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 z-10 bg-muted/50 font-semibold">
                      Heure
                    </TableHead>
                    {SENSORS.map((s) => (
                      <TableHead
                        key={s}
                        colSpan={2}
                        className="text-center font-semibold"
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: SENSOR_COLORS[s],
                            }}
                          />
                          {s}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="bg-muted/30">
                    <TableHead className="sticky left-0 z-10 bg-muted/30" />
                    {SENSORS.map((s) => (
                      <React.Fragment key={s}>
                        <TableHead className="text-center text-[11px] text-orange-600">
                          °C
                        </TableHead>
                        <TableHead className="text-center text-[11px] text-blue-600">
                          %
                        </TableHead>
                      </React.Fragment>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...pivotData]
                    .reverse()
                    .map((row, i) => (
                      <TableRow key={i} className="hover:bg-muted/30">
                        <TableCell className="sticky left-0 z-10 bg-background font-mono text-xs font-medium">
                          {row.time}
                        </TableCell>
                        {SENSORS.map((s) => (
                          <React.Fragment key={s}>
                            <TableCell className="text-center tabular-nums text-sm">
                              {row[`${s}_temp`] !== undefined
                                ? row[`${s}_temp`]
                                : "—"}
                            </TableCell>
                            <TableCell className="text-center tabular-nums text-sm">
                              {row[`${s}_hum`] !== undefined
                                ? row[`${s}_hum`]
                                : "—"}
                            </TableCell>
                          </React.Fragment>
                        ))}
                      </TableRow>
                    ))}
                  {pivotData.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={1 + SENSORS.length * 2}
                        className="py-12 text-center text-muted-foreground"
                      >
                        Aucune donnée pour cette période
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ──── Footer ──── */}
        <footer className="py-4 text-center text-xs text-muted-foreground">
          Université Béchar — Séchoir Solaire © {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
}

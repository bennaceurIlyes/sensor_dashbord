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
  ChevronLeft,
  ChevronRight,
  MoreHorizontal
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
import { Separator } from "@/components/ui/separator";

/* ---------- Types ---------- */
type PivotRow = {
  date: string;
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

/* ================================================================== */
/*                          DASHBOARD                                 */
/* ================================================================== */

export default function Dashboard() {
  const [paginatedData, setPaginatedData] = useState<PivotRow[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const rowsPerPage = 50;

  /* ---------- Fetch ---------- */
  const fetchPage = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data?page=${page}&limit=${rowsPerPage}`);
      if (!res.ok) throw new Error("Fetch error");
      const json = await res.json();
      if (json.data) {
        setPaginatedData(json.data);
        setTotalPages(json.totalPages || 1);
        setTotalRecords(json.totalRecords || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  }, [rowsPerPage]);

  useEffect(() => {
    fetchPage(currentPage);
    const id = setInterval(() => fetchPage(currentPage), 30_000);
    return () => clearInterval(id);
  }, [fetchPage, currentPage]);

  /* ---------- CSV download ---------- */
  const downloadCSV = () => {
    // Navigating to the export endpoint will trigger a file download natively
    // without freezing the frontend browser memory.
    window.location.href = '/api/data/export';
  };

  /* ---------- Derived data (Current Page) ---------- */
  const chartData = [...paginatedData].reverse(); // Oldest to newest for chart
  const latestRow = paginatedData[0];

  const activeSensors = latestRow
    ? SENSORS.filter((s) => latestRow[`${s}_temp`] !== undefined).length
    : 0;

  let totalTemp = 0,
    totalHum = 0,
    countTemp = 0,
    countHum = 0;

  paginatedData.forEach((row) => {
    SENSORS.forEach((s) => {
      if (row[`${s}_temp`] !== undefined) {
        totalTemp += Number(row[`${s}_temp`]);
        countTemp++;
      }
      if (row[`${s}_hum`] !== undefined) {
        totalHum += Number(row[`${s}_hum`]);
        countHum++;
      }
    });
  });

  const avgTemp = countTemp > 0 ? totalTemp / countTemp : 0;
  const avgHum = countHum > 0 ? totalHum / countHum : 0;

  const latestReadings: Record<string, any> = {};
  if (latestRow) {
    SENSORS.forEach((s) => {
      if (latestRow[`${s}_temp`] !== undefined) {
        latestReadings[s] = {
          temperature: latestRow[`${s}_temp`],
          humidity: latestRow[`${s}_hum`],
          time: latestRow.time,
        };
      }
    });
  }

  const averagesBySensor: Record<string, any> = {};
  SENSORS.forEach((s) => {
    let sTemp = 0,
      sHum = 0,
      sCount = 0;
    paginatedData.forEach((row) => {
      if (row[`${s}_temp`] !== undefined) {
        sTemp += Number(row[`${s}_temp`]);
        sHum += Number(row[`${s}_hum`]);
        sCount++;
      }
    });
    if (sCount > 0) {
      averagesBySensor[s] = {
        temperature: sTemp / sCount,
        humidity: sHum / sCount,
      };
    }
  });

  // Generate pagination buttons
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
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
              {lastRefreshed ? format(lastRefreshed, "HH:mm:ss") : "…"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* ──── Controls ──── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Vue d'ensemble</h2>
            <p className="text-sm text-muted-foreground">
              Affichage des données paginées depuis le serveur ({totalRecords} enregistrements)
            </p>
          </div>

          <Button
            onClick={downloadCSV}
            variant="default"
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Download className="h-4 w-4" />
            Exporter Tout (Excel)
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
                <p className="text-xs text-muted-foreground">Temp. moy. (Page)</p>
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
                <p className="text-xs text-muted-foreground">Hum. moy. (Page)</p>
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
                <p className="text-xs text-muted-foreground">Lectures (Total)</p>
                <p className="text-xl font-bold tabular-nums">
                  {totalRecords}
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
                      {data.time}
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
                Historique Température (Page Actuelle)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
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
                        boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
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
                Historique Humidité (Page Actuelle)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
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
                        boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
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
              Données (Page {currentPage} / {totalPages})
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 z-10 bg-muted/50 font-semibold">
                      Date & Heure
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
                  {loading && paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={1 + SENSORS.length * 2} className="py-12 text-center text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Chargement des données...
                      </TableCell>
                    </TableRow>
                  ) : paginatedData.map((row, i) => (
                    <TableRow key={i} className="hover:bg-muted/30">
                      <TableCell className="sticky left-0 z-10 bg-background whitespace-nowrap font-mono text-xs font-medium">
                        {row.date} {row.time}
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
                  {!loading && paginatedData.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={1 + SENSORS.length * 2}
                        className="py-12 text-center text-muted-foreground"
                      >
                        Aucune donnée disponible
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t gap-4">
                <p className="text-sm text-muted-foreground">
                  Affichage de {paginatedData.length} lignes sur un total de {totalRecords}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {getPageNumbers().map(num => (
                    <Button
                      key={num}
                      variant={currentPage === num ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(num)}
                      disabled={loading}
                      className="w-9 h-9"
                    >
                      {num}
                    </Button>
                  ))}

                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <Button variant="outline" size="sm" disabled className="w-9 h-9 opacity-50">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={loading}
                        className="w-9 h-9"
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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

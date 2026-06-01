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
  MoreHorizontal,
  Calendar,
  TrendingUp,
  Database,
  Info,
  Sliders,
  TrendingDown,
  FileText,
  AlertTriangle,
  ShieldCheck,
  CheckCircle
} from "lucide-react";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DHT1: "#ef4444", // Red
  DHT2: "#f97316", // Orange
  DHT3: "#f59e0b", // Amber
  DHT4: "#10b981", // Emerald
  DHT5: "#06b6d4", // Cyan
  DHT6: "#3b82f6", // Blue
  DHT7: "#6366f1", // Indigo
  DHT8: "#d946ef", // Fuchsia
};

// Helper for physical data validation (DHT22 sensor noise filter)
const isValidTemp = (t: any) => t !== undefined && t !== null && Number(t) >= 5 && Number(t) <= 85;
const isValidHum = (h: any) => h !== undefined && h !== null && Number(h) >= 1 && Number(h) <= 100;

export default function Dashboard() {
  /* ---------- Sidebar Active Page Routing State ---------- */
  const [activeView, setActiveView] = useState<"analyse" | "logs">("analyse");

  /* ---------- Real-Time Logs / Explorer States ---------- */
  const [paginatedData, setPaginatedData] = useState<PivotRow[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [anomaliesCount, setAnomaliesCount] = useState(0);
  const rowsPerPage = 50;

  /* ---------- Chart Grid Toggle ---------- */
  const [showChartGrid, setShowChartGrid] = useState(true);

  /* ---------- Custom Date Range States (Day-by-Day Trends) ---------- */
  const [rangeStart, setRangeStart] = useState<string>("2026-05-15");
  const [rangeEnd, setRangeEnd] = useState<string>("2026-06-01");
  const [rangeData, setRangeData] = useState<any[]>([]);
  const [rangeSummary, setRangeSummary] = useState<any>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);

  /* ---------- Daily Profile States ---------- */
  const [selectedDate, setSelectedDate] = useState<string>("2026-06-01");
  const [dayData, setDayData] = useState<any[]>([]);
  const [daySummary, setDaySummary] = useState<any>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);

  /* ---------- Monthly Analytics States ---------- */
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-05");
  const [monthData, setMonthData] = useState<any[]>([]);
  const [monthSummary, setMonthSummary] = useState<any>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);

  /* ---------- Fetch: Real-time Live Log ---------- */
  const fetchPage = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data?page=${page}&limit=${rowsPerPage}`);
      if (!res.ok) throw new Error("Fetch error");
      const json = await res.json();
      if (json.data) {
        let localFilterCount = 0;
        const cleanedData = json.data.map((row: PivotRow) => {
          const newRow: PivotRow = {
            ...row,
            date: format(new Date(row.timestamp), "yyyy-MM-dd"),
            time: format(new Date(row.timestamp), "HH:mm:ss"),
          };
          SENSORS.forEach(s => {
            const tKey = `${s}_temp`;
            const hKey = `${s}_hum`;
            if (row[tKey] !== undefined && !isValidTemp(row[tKey])) {
              delete newRow[tKey];
              localFilterCount++;
            }
            if (row[hKey] !== undefined && !isValidHum(row[hKey])) {
              delete newRow[hKey];
              localFilterCount++;
            }
          });
          return newRow;
        });

        if (localFilterCount > 0) {
          setAnomaliesCount(prev => prev + localFilterCount);
        }

        setPaginatedData(cleanedData);
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

  /* ---------- Fetch: Date Range Trends (Day-by-Day) ---------- */
  const fetchRangeAnalytics = useCallback(async (start: string, end: string) => {
    setRangeLoading(true);
    setRangeError(null);
    try {
      const res = await fetch(`/api/analytics/range?start=${start}&end=${end}`);
      if (!res.ok) throw new Error("Range fetch error");
      const json = await res.json();
      setRangeData(json.data || []);
      setRangeSummary(json.summary || null);
    } catch (err) {
      console.error(err);
      setRangeError("Impossible de charger les tendances physiques pour cette période.");
    } finally {
      setRangeLoading(false);
    }
  }, []);

  /* ---------- Fetch: Daily Analytics ---------- */
  const fetchDayAnalytics = useCallback(async (date: string) => {
    setDayLoading(true);
    setDayError(null);
    try {
      const res = await fetch(`/api/analytics/day?date=${date}`);
      if (!res.ok) throw new Error("Day fetch error");
      const json = await res.json();
      setDayData(json.data || []);
      setDaySummary(json.summary || null);
    } catch (err) {
      console.error(err);
      setDayError("Impossible de charger les analyses pour ce jour.");
    } finally {
      setDayLoading(false);
    }
  }, []);

  /* ---------- Fetch: Monthly Analytics ---------- */
  const fetchMonthAnalytics = useCallback(async (month: string) => {
    setMonthLoading(true);
    setMonthError(null);
    try {
      const res = await fetch(`/api/analytics/month?month=${month}`);
      if (!res.ok) throw new Error("Month fetch error");
      const json = await res.json();
      setMonthData(json.data || []);
      setMonthSummary(json.summary || null);
    } catch (err) {
      console.error(err);
      setMonthError("Impossible de charger les analyses pour ce mois.");
    } finally {
      setMonthLoading(false);
    }
  }, []);

  /* ---------- Effects ---------- */
  // Real-time polling active
  useEffect(() => {
    fetchPage(currentPage);
    const id = setInterval(() => {
      fetchPage(currentPage);
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchPage, currentPage]);

  // Range analytics trigger
  useEffect(() => {
    fetchRangeAnalytics(rangeStart, rangeEnd);
  }, [fetchRangeAnalytics, rangeStart, rangeEnd]);

  // Day analytics trigger
  useEffect(() => {
    if (activeView === "analyse") {
      fetchDayAnalytics(selectedDate);
    }
  }, [activeView, selectedDate, fetchDayAnalytics]);

  // Month analytics trigger
  useEffect(() => {
    if (activeView === "analyse") {
      fetchMonthAnalytics(selectedMonth);
    }
  }, [activeView, selectedMonth, fetchMonthAnalytics]);

  /* ---------- CSV download ---------- */
  const downloadCSV = () => {
    window.location.href = '/api/data/export';
  };

  /* ---------- Derived data (Current Page) ---------- */
  const latestRow = paginatedData[0];

  const activeSensors = latestRow
    ? SENSORS.filter((s) => latestRow[`${s}_temp`] !== undefined).length
    : 0;

  const latestReadings: Record<string, any> = {};
  if (latestRow) {
    SENSORS.forEach((s) => {
      if (latestRow[`${s}_temp`] !== undefined && isValidTemp(latestRow[`${s}_temp`])) {
        latestReadings[s] = {
          temperature: latestRow[`${s}_temp`],
          humidity: latestRow[`${s}_hum`],
          time: latestRow.time,
        };
      }
    });
  }

  /* ---------- Thermodynamic color interpolation mapping helper ---------- */
  const getChamberColor = (temp: number | undefined) => {
    if (temp === undefined) return "rgba(148, 163, 184, 0.05)";
    const minT = 20;
    const maxT = 60;
    const t = Math.min(Math.max(temp, minT), maxT);
    const ratio = (t - minT) / (maxT - minT);
    const hue = 210 - ratio * 195;
    return `hsla(${hue}, 85%, 50%, 0.12)`;
  };

  const getChamberBorderColor = (temp: number | undefined) => {
    if (temp === undefined) return "rgba(148, 163, 184, 0.15)";
    const minT = 20;
    const maxT = 60;
    const t = Math.min(Math.max(temp, minT), maxT);
    const ratio = (t - minT) / (maxT - minT);
    const hue = 210 - ratio * 195;
    return `hsla(${hue}, 85%, 50%, 0.35)`;
  };

  const getSensorHealthRating = (temp: number | undefined) => {
    if (temp === undefined) return "Câblage Déconnecté";
    if (temp > 45) return "Opérationnel (Actif)";
    return "Opérationnel (Veille)";
  };

  // Pagination controls
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

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col md:flex-row font-sans">
      
      {/* ──── Left Sidebar Navigation ──── */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-100 flex flex-col justify-between p-5 border-r border-slate-800 md:h-screen md:sticky md:top-0 shadow-md">
        <div className="space-y-6">
          {/* Top Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600/10 text-orange-400 border border-orange-500/20">
              <Sun className="h-5.5 w-5.5 stroke-[1.8]" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-wider uppercase text-white leading-none">
                Séchoir Solaire
              </h1>
              <span className="text-[10px] text-slate-400 font-medium tracking-tight">
                Univ Béchar • IoT Platform
              </span>
            </div>
          </div>

          <Separator className="bg-slate-800" />

          {/* Operational Signal Badge */}
          <div className="space-y-2">
            <Badge
              variant={activeSensors > 0 ? "default" : "destructive"}
              className={`w-full gap-1.5 text-xs font-semibold py-1.5 px-3 flex justify-center items-center shadow-inner rounded-lg ${
                activeSensors > 0
                  ? "bg-emerald-600 hover:bg-emerald-600"
                  : "bg-red-650"
              }`}
            >
              {activeSensors > 0 ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              {activeSensors > 0 ? "Système En Ligne" : "Système Hors Ligne"}
            </Badge>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveView("analyse")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
                activeView === "analyse"
                  ? "bg-orange-600 text-white shadow-md hover:bg-orange-700"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <TrendingUp className="h-4.5 w-4.5" />
              Analyse de Données
            </button>
            
            <button
              onClick={() => setActiveView("logs")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
                activeView === "logs"
                  ? "bg-orange-600 text-white shadow-md hover:bg-orange-700"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
              }`}
            >
              <Database className="h-4.5 w-4.5" />
              Historique & Export
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 font-medium">
          Université Béchar © {new Date().getFullYear()}
          <br />
          Dépt de Physique Énergétique
        </div>
      </aside>

      {/* ──── Right Panel: Content View Area ──── */}
      <div className="flex-1 flex flex-col min-h-screen">
        
        {/* Right Header Diagnostics */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 py-3 px-6 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-sm">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500 animate-pulse" />
              {activeView === "analyse" ? "Espace d'Analyse Thermodynamique" : "Visualisation de Base de Données"}
            </h2>
            <p className="text-[11px] text-slate-400 leading-none mt-1 font-medium">
              Suivi et cartographie thermique fine en direct • Capteurs DHT22
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Badge
              variant="outline"
              className="flex gap-1.5 py-1 px-3 font-mono text-[10px] uppercase border-slate-200 text-slate-500 bg-slate-50"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Signal: Stable • {anomaliesCount} Filtrés
            </Badge>

            <span className="hidden sm:inline-flex text-[11px] text-slate-450 font-mono items-center gap-1.5 bg-slate-100 py-1 px-2.5 rounded-md border border-slate-200">
              Refresh: <span className="font-bold text-slate-700">{lastRefreshed ? format(lastRefreshed, "HH:mm:ss") : "…"}</span>
            </span>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 p-6 space-y-6">
          
          {/* ========================================== */}
          {/* PAGE 1: TELEMETRY ANALYSIS (activeView === "analyse") */}
          {/* ========================================== */}
          {activeView === "analyse" && (
            <div className="space-y-6 animate-fade-in">
              {/* Grid 2D Chamber Map + Live Probes */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Convection 2D grid map */}
                <Card className="border-slate-200 bg-white shadow-sm flex flex-col justify-between">
                  <CardHeader className="pb-1.5">
                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Sun className="h-4.5 w-4.5 text-orange-500" />
                      Chambre Thermique 2D (Convection Map)
                    </CardTitle>
                    <CardDescription className="text-[11px] leading-relaxed">
                      Cartographie physique du gradient de température dans le séchoir.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-center items-center py-4 px-3">
                    <div className="w-full max-w-[280px] border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 flex flex-col gap-2 relative">
                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider px-1">
                        <span>Intake Collecteur (Air Chaud)</span>
                        <TrendingDown className="h-3 w-3 text-red-500 rotate-180 animate-bounce" />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        {/* Upper Chamber */}
                        <div 
                          className="rounded border p-2 flex flex-col justify-center items-center transition-all duration-300 shadow-sm hover:scale-105"
                          style={{
                            backgroundColor: getChamberColor(latestReadings["DHT1"]?.temperature),
                            borderColor: getChamberBorderColor(latestReadings["DHT1"]?.temperature)
                          }}
                        >
                          <span className="text-[9px] text-slate-400 font-bold uppercase">DHT1</span>
                          <span className="text-xs font-black tabular-nums">{latestReadings["DHT1"] ? `${latestReadings["DHT1"].temperature.toFixed(1)}°` : "—"}</span>
                        </div>
                        <div 
                          className="rounded border p-2 flex flex-col justify-center items-center transition-all duration-300 shadow-sm hover:scale-105"
                          style={{
                            backgroundColor: getChamberColor(latestReadings["DHT2"]?.temperature),
                            borderColor: getChamberBorderColor(latestReadings["DHT2"]?.temperature)
                          }}
                        >
                          <span className="text-[9px] text-slate-400 font-bold uppercase">DHT2</span>
                          <span className="text-xs font-black tabular-nums">{latestReadings["DHT2"] ? `${latestReadings["DHT2"].temperature.toFixed(1)}°` : "—"}</span>
                        </div>
                        <div 
                          className="rounded border p-2 flex flex-col justify-center items-center transition-all duration-300 shadow-sm hover:scale-105"
                          style={{
                            backgroundColor: getChamberColor(latestReadings["DHT3"]?.temperature),
                            borderColor: getChamberBorderColor(latestReadings["DHT3"]?.temperature)
                          }}
                        >
                          <span className="text-[9px] text-slate-400 font-bold uppercase">DHT3</span>
                          <span className="text-xs font-black tabular-nums">{latestReadings["DHT3"] ? `${latestReadings["DHT3"].temperature.toFixed(1)}°` : "—"}</span>
                        </div>

                        {/* Mid Plateaus */}
                        <div 
                          className="rounded border p-2 flex flex-col justify-center items-center transition-all duration-300 shadow-sm hover:scale-105"
                          style={{
                            backgroundColor: getChamberColor(latestReadings["DHT4"]?.temperature),
                            borderColor: getChamberBorderColor(latestReadings["DHT4"]?.temperature)
                          }}
                        >
                          <span className="text-[9px] text-slate-400 font-bold uppercase">DHT4</span>
                          <span className="text-xs font-black tabular-nums">{latestReadings["DHT4"] ? `${latestReadings["DHT4"].temperature.toFixed(1)}°` : "—"}</span>
                        </div>
                        <div 
                          className="rounded border p-2 flex flex-col justify-center items-center transition-all duration-300 shadow-sm hover:scale-105"
                          style={{
                            backgroundColor: getChamberColor(latestReadings["DHT5"]?.temperature),
                            borderColor: getChamberBorderColor(latestReadings["DHT5"]?.temperature)
                          }}
                        >
                          <span className="text-[9px] text-slate-400 font-bold uppercase">DHT5</span>
                          <span className="text-xs font-black tabular-nums">{latestReadings["DHT5"] ? `${latestReadings["DHT5"].temperature.toFixed(1)}°` : "—"}</span>
                        </div>
                        <div 
                          className="rounded border p-2 flex flex-col justify-center items-center transition-all duration-300 shadow-sm hover:scale-105"
                          style={{
                            backgroundColor: getChamberColor(latestReadings["DHT6"]?.temperature),
                            borderColor: getChamberBorderColor(latestReadings["DHT6"]?.temperature)
                          }}
                        >
                          <span className="text-[9px] text-slate-400 font-bold uppercase">DHT6</span>
                          <span className="text-xs font-black tabular-nums">{latestReadings["DHT6"] ? `${latestReadings["DHT6"].temperature.toFixed(1)}°` : "—"}</span>
                        </div>

                        {/* Lower Outflow */}
                        <div 
                          className="rounded border p-2 flex flex-col justify-center items-center transition-all duration-300 shadow-sm hover:scale-105"
                          style={{
                            backgroundColor: getChamberColor(latestReadings["DHT7"]?.temperature),
                            borderColor: getChamberBorderColor(latestReadings["DHT7"]?.temperature)
                          }}
                        >
                          <span className="text-[9px] text-slate-400 font-bold uppercase">DHT7</span>
                          <span className="text-xs font-black tabular-nums">{latestReadings["DHT7"] ? `${latestReadings["DHT7"].temperature.toFixed(1)}°` : "—"}</span>
                        </div>
                        <div className="bg-transparent border-none" />
                        <div 
                          className="rounded border p-2 flex flex-col justify-center items-center transition-all duration-300 shadow-sm hover:scale-105"
                          style={{
                            backgroundColor: getChamberColor(latestReadings["DHT8"]?.temperature),
                            borderColor: getChamberBorderColor(latestReadings["DHT8"]?.temperature)
                          }}
                        >
                          <span className="text-[9px] text-slate-400 font-bold uppercase">DHT8</span>
                          <span className="text-xs font-black tabular-nums">{latestReadings["DHT8"] ? `${latestReadings["DHT8"].temperature.toFixed(1)}°` : "—"}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider px-1 border-t pt-1 mt-1">
                        <span>Sortie d'Air (Humide)</span>
                        <TrendingDown className="h-3 w-3 text-blue-500 animate-bounce" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Live Probes health parameters */}
                <Card className="border-slate-200 bg-white shadow-sm lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Sliders className="h-4.5 w-4.5 text-orange-500" />
                      DHT22 Live Telemetry Diagnostics (8 Capteurs)
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      Données réelles lues par les sondes physiques.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {SENSORS.map((sensor) => {
                        const data = latestReadings[sensor];
                        const color = SENSOR_COLORS[sensor];
                        const health = getSensorHealthRating(data?.temperature);
                        
                        return (
                          <div
                            key={sensor}
                            className="group border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 p-2.5 rounded-lg transition-all duration-200 hover:scale-[1.02] flex flex-col justify-between"
                          >
                            <div className="flex items-center justify-between border-b pb-1.5 mb-1.5">
                              <span className="text-[10px] font-black uppercase flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                                {sensor}
                              </span>
                              {data && (
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 py-0.5 px-1.5 rounded-full">LIVE</span>
                              )}
                            </div>

                            {data ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-medium">Temp:</span>
                                  <span className="font-extrabold font-mono text-slate-800">
                                    {data.temperature.toFixed(1)}°C
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-medium">Humid:</span>
                                  <span className="font-extrabold font-mono text-slate-800">
                                    {data.humidity.toFixed(1)}%
                                  </span>
                                </div>
                                <span className="text-[8px] font-bold block leading-none pt-1 border-t uppercase text-slate-400">
                                  {health}
                                </span>
                              </div>
                            ) : (
                              <div className="py-2 text-center text-red-500 font-bold uppercase text-[9px]">
                                Déconnecté
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* SECTION A: DATE RANGE GRAPH (DAYS NOT SECONDS) */}
              <div className="space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1">
                      <TrendingUp className="h-4.5 w-4.5 text-orange-500" />
                      1. Courbes Historiques par Période (Graphique en Jours)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Rapport d'évolution globale quotidienne (Visualisation à l'échelle des **Jours**, pas des secondes).
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      className="h-8 rounded-md border border-slate-250 bg-white px-2.5 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm text-slate-800"
                    />
                    <span className="text-xs text-slate-400 font-bold">à</span>
                    <input
                      type="date"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      className="h-8 rounded-md border border-slate-250 bg-white px-2.5 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm text-slate-800"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => fetchRangeAnalytics(rangeStart, rangeEnd)}
                      disabled={rangeLoading}
                    >
                      <RefreshCw className={`h-4.5 w-4.5 ${rangeLoading ? "animate-spin text-orange-500" : ""}`} />
                    </Button>
                  </div>
                </div>

                {rangeLoading ? (
                  <div className="py-16 text-center flex flex-col items-center justify-center gap-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
                    <p className="text-sm font-semibold text-slate-500">Calcul thermodynamique par jours des relevés...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Temperature Range */}
                    <Card className="border-slate-200 bg-white shadow-sm">
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                            Températures Moyennes Journalières
                          </CardTitle>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowChartGrid(!showChartGrid)}
                          className="text-[10px] h-7 gap-1 font-semibold border-slate-200"
                        >
                          Grid: {showChartGrid ? "ON" : "OFF"}
                        </Button>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="h-[260px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={rangeData} margin={{ left: -10, right: 10, bottom: 0, top: 5 }}>
                              {showChartGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />}
                              <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 9 }} 
                                tickMargin={8} 
                                stroke="#94a3b8" 
                                tickFormatter={(str) => str.substring(8, 10) + "/" + str.substring(5, 7)}
                              />
                              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={["auto", "auto"]} unit="°C" />
                              <Tooltip contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderRadius: "8px", border: "none", color: "#f8fafc", fontSize: "11px" }} />
                              <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} iconType="circle" />
                              {SENSORS.map((s) => (
                                <Line key={s} type="monotone" dataKey={`${s}_temp`} name={s} stroke={SENSOR_COLORS[s]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Humidity Range */}
                    <Card className="border-slate-200 bg-white shadow-sm">
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                            Humidités Moyennes Journalières
                          </CardTitle>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowChartGrid(!showChartGrid)}
                          className="text-[10px] h-7 gap-1 font-semibold border-slate-200"
                        >
                          Grid: {showChartGrid ? "ON" : "OFF"}
                        </Button>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="h-[260px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={rangeData} margin={{ left: -10, right: 10, bottom: 0, top: 5 }}>
                              {showChartGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />}
                              <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 9 }} 
                                tickMargin={8} 
                                stroke="#94a3b8"
                                tickFormatter={(str) => str.substring(8, 10) + "/" + str.substring(5, 7)}
                              />
                              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={["auto", "auto"]} unit="%" />
                              <Tooltip contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderRadius: "8px", border: "none", color: "#f8fafc", fontSize: "11px" }} />
                              <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} iconType="circle" />
                              {SENSORS.map((s) => (
                                <Line key={s} type="monotone" dataKey={`${s}_hum`} name={s} stroke={SENSOR_COLORS[s]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>

              {/* SECTION B: DAILY PHYSICS PROFILE */}
              <div className="space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1">
                      <Calendar className="h-4.5 w-4.5 text-orange-500" />
                      2. Courbes Détaillées d'une Journée d'Étude (intervalles 10 min)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Zoomez sur une journée pour étudier la courbe fine de convection et les extrema.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="h-8 rounded-md border border-slate-250 bg-white px-2.5 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm text-slate-800"
                    />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => fetchDayAnalytics(selectedDate)} 
                      disabled={dayLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${dayLoading ? "animate-spin text-orange-500" : ""}`} />
                    </Button>
                  </div>
                </div>

                {dayLoading ? (
                  <div className="py-16 text-center flex flex-col items-center justify-center gap-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
                    <p className="text-sm font-semibold text-slate-500">Extraction et alignement à 10 minutes des lectures...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Temp Day */}
                    <Card className="border-slate-200 bg-white shadow-sm">
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          Profil Thermique de la Journée ({selectedDate})
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={() => setShowChartGrid(!showChartGrid)} className="text-[10px] h-7 gap-1 font-semibold border-slate-200">
                          Grid: {showChartGrid ? "ON" : "OFF"}
                        </Button>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="h-[260px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dayData} margin={{ left: -10, right: 10, bottom: 0, top: 5 }}>
                              {showChartGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />}
                              <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={8} stroke="#94a3b8" />
                              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={["auto", "auto"]} unit="°C" />
                              <Tooltip contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderRadius: "8px", border: "none", color: "#f8fafc", fontSize: "11px" }} />
                              <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} iconType="circle" />
                              {SENSORS.map((s) => (
                                <Line key={s} type="monotone" dataKey={`${s}_temp`} name={s} stroke={SENSOR_COLORS[s]} strokeWidth={1.8} dot={false} activeDot={{ r: 4 }} connectNulls />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Hum Day */}
                    <Card className="border-slate-200 bg-white shadow-sm">
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          Profil Hygrométrique de la Journée ({selectedDate})
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={() => setShowChartGrid(!showChartGrid)} className="text-[10px] h-7 gap-1 font-semibold border-slate-200">
                          Grid: {showChartGrid ? "ON" : "OFF"}
                        </Button>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="h-[260px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dayData} margin={{ left: -10, right: 10, bottom: 0, top: 5 }}>
                              {showChartGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />}
                              <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={8} stroke="#94a3b8" />
                              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={["auto", "auto"]} unit="%" />
                              <Tooltip contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderRadius: "8px", border: "none", color: "#f8fafc", fontSize: "11px" }} />
                              <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} iconType="circle" />
                              {SENSORS.map((s) => (
                                <Line key={s} type="monotone" dataKey={`${s}_hum`} name={s} stroke={SENSOR_COLORS[s]} strokeWidth={1.8} dot={false} activeDot={{ r: 4 }} connectNulls />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>

              {/* SECTION C: MONTHLY CLIMATOLOGY TRENDS */}
              <div className="space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1">
                      <TrendingUp className="h-4.5 w-4.5 text-orange-500" />
                      3. Rendement et Évolutions Moyennes Mensuelles
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Rapport global de productivité calculé par jours sur un mois civil d'étude.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="h-8 rounded-md border border-slate-250 bg-white px-2.5 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm text-slate-800"
                    />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => fetchMonthAnalytics(selectedMonth)} 
                      disabled={monthLoading}
                    >
                      <RefreshCw className={`h-4.5 w-4.5 ${monthLoading ? "animate-spin text-orange-500" : ""}`} />
                    </Button>
                  </div>
                </div>

                {monthLoading ? (
                  <div className="py-16 text-center flex flex-col items-center justify-center gap-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
                    <p className="text-sm font-semibold text-slate-500">Intégration et moyennes thermodynamiques du mois...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Temp Month */}
                    <Card className="border-slate-200 bg-white shadow-sm">
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          Courbes Thermiques Mensuelles Moyennes (Mois: {selectedMonth})
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={() => setShowChartGrid(!showChartGrid)} className="text-[10px] h-7 gap-1 font-semibold border-slate-200">
                          Grid: {showChartGrid ? "ON" : "OFF"}
                        </Button>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="h-[260px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={monthData} margin={{ left: -10, right: 10, bottom: 0, top: 5 }}>
                              {showChartGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />}
                              <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 9 }} 
                                tickMargin={8} 
                                stroke="#94a3b8" 
                                tickFormatter={(str) => str.substring(8, 10) + "/" + str.substring(5, 7)}
                              />
                              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={["auto", "auto"]} unit="°C" />
                              <Tooltip contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderRadius: "8px", border: "none", color: "#f8fafc", fontSize: "11px" }} />
                              <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} iconType="circle" />
                              {SENSORS.map((s) => (
                                <Line key={s} type="monotone" dataKey={`${s}_temp`} name={s} stroke={SENSOR_COLORS[s]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Hum Month */}
                    <Card className="border-slate-200 bg-white shadow-sm">
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          Courbes Hygrométriques Mensuelles Moyennes (Mois: {selectedMonth})
                        </CardTitle>
                        <Button variant="outline" size="sm" onClick={() => setShowChartGrid(!showChartGrid)} className="text-[10px] h-7 gap-1 font-semibold border-slate-200">
                          Grid: {showChartGrid ? "ON" : "OFF"}
                        </Button>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="h-[260px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={monthData} margin={{ left: -10, right: 10, bottom: 0, top: 5 }}>
                              {showChartGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />}
                              <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 9 }} 
                                tickMargin={8} 
                                stroke="#94a3b8"
                                tickFormatter={(str) => str.substring(8, 10) + "/" + str.substring(5, 7)}
                              />
                              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={["auto", "auto"]} unit="%" />
                              <Tooltip contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", borderRadius: "8px", border: "none", color: "#f8fafc", fontSize: "11px" }} />
                              <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} iconType="circle" />
                              {SENSORS.map((s) => (
                                <Line key={s} type="monotone" dataKey={`${s}_hum`} name={s} stroke={SENSOR_COLORS[s]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* PAGE 2: LOGS DATABASE & EXPORT             */}
          {/* ========================================== */}
          {activeView === "logs" && (
            <div className="space-y-6 animate-fade-in">
              {/* Context + Universal Excel Exporter split */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {/* Academic Context */}
                <Card className="border-slate-200 bg-white shadow-sm md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Info className="h-4.5 w-4.5 text-orange-500" />
                      Contexte de Recherche Physique & Solaire
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Ce projet constitue le <strong>Système d'Acquisition Spatialisé en Temps Réel</strong> du séchoir solaire expérimental de l'<strong>Université de Béchar</strong>. Les 8 capteurs physiques <strong>DHT22</strong> sont distribués à des hauteurs et positions stratégiques à l'intérieur du collecteur solaire et de la chambre de séchage. 
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Cette disposition permet d'analyser le <strong>transfert thermique tridimensionnel</strong>, de cartographier les gradients de convection et d'évaluer le taux d'évaporation hygrométrique des produits en phase de traitement. Les données sont indispensables pour modéliser le coefficient thermodynamique global du séchoir solaire.
                    </p>
                  </CardContent>
                </Card>

                {/* Database export trigger */}
                <Card className="border-slate-200 bg-white shadow-sm flex flex-col justify-between overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-full h-[4px] bg-green-500" />
                  <CardHeader className="pb-1 pt-4">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-green-600 flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      Téléchargement Intégral
                    </CardTitle>
                    <CardDescription className="text-slate-500 text-[10px] uppercase font-mono">
                      {totalRecords} Enregistrements Pivotés
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-4 flex-1 flex flex-col justify-between pt-2">
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Téléchargez l'intégralité de la base de données au format CSV optimisé pour Microsoft Excel (séparateur point-virgule <code>;</code> et BOM UTF-8).
                    </p>
                    <Button
                      onClick={downloadCSV}
                      variant="default"
                      className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase"
                    >
                      <Download className="h-4 w-4" />
                      Télécharger Excel (CSV)
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Data Table */}
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                      <Clock className="h-4.5 w-4.5 text-slate-500" />
                      Base de Données Historique (Pivotée par Heures)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Recherches fines par horodatages locaux (Date & Heure locales de Béchar).
                    </CardDescription>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 border-b border-slate-200">
                          <TableHead className="sticky left-0 z-10 bg-slate-50 font-bold text-xs text-slate-500 whitespace-nowrap">
                            Date & Heure
                          </TableHead>
                          {SENSORS.map((s) => (
                            <TableHead
                              key={s}
                              colSpan={2}
                              className="text-center font-bold text-xs text-slate-505 border-l border-slate-200/60"
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
                        <TableRow className="bg-slate-50/40 border-b border-slate-200">
                          <TableHead className="sticky left-0 z-10 bg-slate-50/40" />
                          {SENSORS.map((s) => (
                            <React.Fragment key={s}>
                              <TableHead className="text-center text-[10px] font-bold text-orange-600 border-l border-slate-200/60 uppercase">
                                T (°C)
                              </TableHead>
                              <TableHead className="text-center text-[10px] font-bold text-blue-600 uppercase">
                                H (%)
                              </TableHead>
                            </React.Fragment>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading && paginatedData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={1 + SENSORS.length * 2} className="py-16 text-center text-slate-400">
                              <RefreshCw className="h-7 w-7 animate-spin mx-auto mb-2 text-orange-500" />
                              Chargement de la base de données...
                            </TableCell>
                          </TableRow>
                        ) : paginatedData.map((row, i) => (
                          <TableRow key={i} className="hover:bg-slate-50/50 border-b border-slate-100">
                            <TableCell className="sticky left-0 z-10 bg-white whitespace-nowrap font-mono text-xs font-semibold text-slate-600 shadow-[2px_0_5px_rgba(0,0,0,0.01)]">
                              {row.date} {row.time}
                            </TableCell>
                            {SENSORS.map((s) => (
                              <React.Fragment key={s}>
                                <TableCell className="text-center tabular-nums text-xs border-l border-slate-100">
                                  {row[`${s}_temp`] !== undefined
                                    ? Number(row[`${s}_temp`]).toFixed(1)
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-center tabular-nums text-xs">
                                  {row[`${s}_hum`] !== undefined
                                    ? Number(row[`${s}_hum`]).toFixed(1)
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
                              className="py-16 text-center text-slate-400"
                            >
                              Aucun enregistrement trouvé dans Supabase.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination Controls */}
                  {totalPages > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-200 gap-4 bg-slate-50/50">
                      <p className="text-xs font-semibold text-slate-500">
                        Affichage de {paginatedData.length} lignes sur un total de {totalRecords} lignes pivotées
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 border-slate-200"
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
                            className="w-8 h-8 font-semibold text-xs border-slate-200"
                          >
                            {num}
                          </Button>
                        ))}

                        {totalPages > 5 && currentPage < totalPages - 2 && (
                          <>
                            <Button variant="outline" size="sm" disabled className="w-8 h-8 opacity-40 border-slate-200">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(totalPages)}
                              disabled={loading}
                              className="w-8 h-8 font-semibold text-xs border-slate-200"
                            >
                              {totalPages}
                            </Button>
                          </>
                        )}

                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 border-slate-200"
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
            </div>
          )}
        </div>
        
        {/* Footer */}
        <footer className="py-6 text-center text-[10px] font-medium text-slate-400 border-t border-slate-200 bg-white">
          Université de Béchar • Département de Physique & Énergies Renouvelables • Dispositif IoT Séchoir Solaire © {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}

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
  Moon,
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
  CheckCircle,
  HelpCircle
} from "lucide-react";
import { format } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  /* ---------- Theme Switcher State ---------- */
  const [theme, setTheme] = useState<"light" | "dark">("light");

  /* ---------- Tab State ---------- */
  const [activeTab, setActiveTab] = useState<string>("realtime");

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

  /* ---------- Theme Effects & Handlers ---------- */
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const initialTheme = savedTheme || systemTheme;
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  /* ---------- Fetch: Real-time Live Log ---------- */
  const fetchPage = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data?page=${page}&limit=${rowsPerPage}`);
      if (!res.ok) throw new Error("Fetch error");
      const json = await res.json();
      if (json.data) {
        let localFilterCount = 0;
        // Clean real-time data from severe sensor physical anomalies
        const cleanedData = json.data.map((row: PivotRow) => {
          const newRow: PivotRow = {
            ...row,
            date: format(new Date(row.timestamp), "yyyy-MM-dd"),
            time: format(new Date(row.timestamp), "HH:mm:ss"),
          };
          // Filter out physical sensor noise for display consistency
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
    if (activeTab === "day") {
      fetchDayAnalytics(selectedDate);
    }
  }, [activeTab, selectedDate, fetchDayAnalytics]);

  // Month analytics trigger
  useEffect(() => {
    if (activeTab === "month") {
      fetchMonthAnalytics(selectedMonth);
    }
  }, [activeTab, selectedMonth, fetchMonthAnalytics]);

  /* ---------- CSV download ---------- */
  const downloadCSV = () => {
    window.location.href = '/api/data/export';
  };

  /* ---------- Derived data (Current Page) ---------- */
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
      if (row[`${s}_temp`] !== undefined && isValidTemp(row[`${s}_temp`])) {
        totalTemp += Number(row[`${s}_temp`]);
        countTemp++;
      }
      if (row[`${s}_hum`] !== undefined && isValidHum(row[`${s}_hum`])) {
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
      if (latestRow[`${s}_temp`] !== undefined && isValidTemp(latestRow[`${s}_temp`])) {
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
      if (row[`${s}_temp`] !== undefined && isValidTemp(row[`${s}_temp`])) {
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

  /* ---------- Thermodynamic color interpolation mapping helper ---------- */
  const getChamberColor = (temp: number | undefined) => {
    if (temp === undefined) return "rgba(148, 163, 184, 0.05)";
    // Interpolate HSL hue between 210 (blue-gray) at 20°C and 15 (orange-red) at 60°C
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
    <div className="min-h-screen bg-slate-50/70 dark:bg-[#0c1220] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      {/* ──── Header ──── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
              <Sun className="h-6 w-6 stroke-[1.8] dark:hidden" />
              <Moon className="h-6 w-6 stroke-[1.8] hidden dark:block text-orange-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight sm:text-lg uppercase">
                  Séchoir Solaire Connecté
                </h1>
                <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-200 border-none font-semibold text-[10px]">
                  BÉCHAR UTC+1
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Laboratoire d'Acquisition Énergétique & de Physique Thermique • Université Béchar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Real-time Diagnostics Shield */}
            <Badge
              variant="outline"
              className="hidden lg:flex gap-1.5 py-1 px-2.5 font-mono text-[10px] uppercase border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Signaux: 100% • {anomaliesCount} Anomalies Filtrées
            </Badge>

            <Badge
              variant={activeSensors > 0 ? "default" : "destructive"}
              className={`gap-1.5 text-xs font-semibold py-1 px-3 transition-colors ${
                activeSensors > 0
                  ? "bg-emerald-600 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-600"
                  : "bg-red-650 dark:bg-red-500"
              }`}
            >
              {activeSensors > 0 ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              {activeSensors > 0 ? "Dispositif Connecté" : "Hors Ligne"}
            </Badge>

            {/* Rotating Theme Switcher */}
            <Button
              onClick={toggleTheme}
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60"
              title="Changer de thème visuel"
            >
              <Sun className="h-[18px] w-[18px] stroke-[1.8] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 dark:text-orange-400" />
              <Moon className="absolute h-[18px] w-[18px] stroke-[1.8] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-slate-200" />
            </Button>
          </div>
        </div>
      </header>

      {/* ──── Tabs Controller & Main Layout ──── */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <Tabs defaultValue="realtime" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2">
            <TabsList className="bg-slate-200/50 dark:bg-slate-900 p-1 border dark:border-slate-800 rounded-lg flex w-fit">
              <TabsTrigger
                value="realtime"
                className="gap-2 px-3 py-1.5 text-xs font-semibold transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
              >
                <Activity className="h-3.5 w-3.5" />
                Surveillance & Tendances
              </TabsTrigger>
              <TabsTrigger
                value="day"
                className="gap-2 px-3 py-1.5 text-xs font-semibold transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
              >
                <Calendar className="h-3.5 w-3.5" />
                Profil Journalier
              </TabsTrigger>
              <TabsTrigger
                value="month"
                className="gap-2 px-3 py-1.5 text-xs font-semibold transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Tendances Mensuelles
              </TabsTrigger>
              <TabsTrigger
                value="explorer"
                className="gap-2 px-3 py-1.5 text-xs font-semibold transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm"
              >
                <Database className="h-3.5 w-3.5" />
                Explorateur & Export
              </TabsTrigger>
            </TabsList>

            <span className="hidden md:inline-flex text-xs text-slate-500 dark:text-slate-400 font-mono items-center gap-1.5 bg-slate-100 dark:bg-slate-900 py-1 px-2.5 rounded-md border dark:border-slate-800">
              Mise à jour: <span className="font-semibold text-slate-800 dark:text-slate-200">{lastRefreshed ? format(lastRefreshed, "HH:mm:ss") : "…"}</span>
            </span>
          </div>

          {/* ======================================================== */}
          {/* TAB 1: SURVEILLANCE & TENDANCES                          */}
          {/* ======================================================== */}
          <TabsContent value="realtime" className="space-y-6 outline-none focus:ring-0">
            {/* Split Top Layout: Convection 2D Map + Live Grid Sensors */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Live Convection 2D map */}
              <Card className="border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm md:col-span-1 flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Sun className="h-4.5 w-4.5 text-orange-500" />
                    Chambre Thermique 2D (Convection Map)
                  </CardTitle>
                  <CardDescription className="text-[11px] leading-relaxed">
                    Visualisation physique du gradient de température dans le séchoir solaire.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center items-center py-4 px-3">
                  <div className="w-full max-w-[280px] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50/50 dark:bg-slate-950 flex flex-col gap-2 relative">
                    {/* Hot air intake indicator */}
                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider px-1">
                      <span>Collecteur Solaire (Air Chaud)</span>
                      <TrendingDown className="h-3 w-3 text-red-500 rotate-180 animate-bounce" />
                    </div>
                    
                    {/* 2D Convection Grid Representation */}
                    <div className="grid grid-cols-3 gap-2">
                      {/* Level 1: Upper Chamber */}
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

                      {/* Level 2: Mid Chamber */}
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

                      {/* Level 3: Outflow */}
                      <div 
                        className="rounded border p-2 flex flex-col justify-center items-center transition-all duration-300 shadow-sm hover:scale-105 col-span-1.5"
                        style={{
                          backgroundColor: getChamberColor(latestReadings["DHT7"]?.temperature),
                          borderColor: getChamberBorderColor(latestReadings["DHT7"]?.temperature)
                        }}
                      >
                        <span className="text-[9px] text-slate-400 font-bold uppercase">DHT7</span>
                        <span className="text-xs font-black tabular-nums">{latestReadings["DHT7"] ? `${latestReadings["DHT7"].temperature.toFixed(1)}°` : "—"}</span>
                      </div>
                      <div className="col-span-1 bg-transparent border-none" />
                      <div 
                        className="rounded border p-2 flex flex-col justify-center items-center transition-all duration-300 shadow-sm hover:scale-105 col-span-1.5"
                        style={{
                          backgroundColor: getChamberColor(latestReadings["DHT8"]?.temperature),
                          borderColor: getChamberBorderColor(latestReadings["DHT8"]?.temperature)
                        }}
                      >
                        <span className="text-[9px] text-slate-400 font-bold uppercase">DHT8</span>
                        <span className="text-xs font-black tabular-nums">{latestReadings["DHT8"] ? `${latestReadings["DHT8"].temperature.toFixed(1)}°` : "—"}</span>
                      </div>
                    </div>

                    {/* Moist air outflow indicator */}
                    <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider px-1 border-t dark:border-slate-800 pt-1 mt-1">
                      <span>Ventilation (Air Humide)</span>
                      <TrendingDown className="h-3 w-3 text-blue-500 animate-bounce" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Live Sensors Grid Cards */}
              <Card className="border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm lg:col-span-2">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Sliders className="h-4.5 w-4.5 text-orange-500" />
                      Relevés Physiques DHT22 (8 Capteurs Connectés)
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      Données en direct transmises par l'ESP32 avec validation et diagnostics intégrés.
                    </CardDescription>
                  </div>
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
                          className="group border border-slate-100 hover:border-slate-200 dark:border-slate-850 dark:hover:border-slate-700 bg-slate-50/50 hover:bg-slate-100/50 dark:bg-slate-950/60 dark:hover:bg-slate-950 p-2.5 rounded-lg transition-all duration-200 hover:scale-[1.02] flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between border-b dark:border-slate-800/80 pb-1.5 mb-1.5">
                            <span className="text-[10px] font-black uppercase flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                              {sensor}
                            </span>
                            {data && (
                              <CheckCircle className="h-3 w-3 text-emerald-500" />
                            )}
                          </div>

                          {data ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400 font-medium">Temp:</span>
                                <span className="font-extrabold font-mono text-slate-800 dark:text-slate-200">
                                  {data.temperature.toFixed(1)}°C
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400 font-medium">Humid:</span>
                                <span className="font-extrabold font-mono text-slate-800 dark:text-slate-200">
                                  {data.humidity.toFixed(1)}%
                                </span>
                              </div>
                              <span className="text-[8px] font-bold block leading-none pt-1 border-t dark:border-slate-850 uppercase text-slate-400">
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

            {/* ──── Dynamic Range Selector Row ──── */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-805 shadow-sm mt-4 transition-colors">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Profil Énergétique sur Période Personnalisée
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Définissez une plage de dates pour tracer les tendances quotidiennes moyennes (Courbes par <strong>Jours</strong>, pas par secondes).
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs h-9 px-3 gap-1.5 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10 font-bold uppercase text-slate-505 dark:text-slate-400">
                  <Calendar className="h-3.5 w-3.5 text-orange-500" />
                  Période:
                </Badge>
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm text-slate-800 dark:text-slate-200"
                />
                <span className="text-xs text-slate-400 font-bold">à</span>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm text-slate-800 dark:text-slate-200"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  onClick={() => fetchRangeAnalytics(rangeStart, rangeEnd)}
                  disabled={rangeLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${rangeLoading ? "animate-spin text-orange-500" : ""}`} />
                </Button>
              </div>
            </div>

            {/* ──── Range Analytics Content ──── */}
            {rangeLoading ? (
              <div className="py-24 text-center flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-808 shadow-sm">
                <RefreshCw className="h-9 w-9 animate-spin text-orange-500" />
                <p className="text-sm font-semibold text-slate-500">Regroupement thermodynamique et calcul par jours...</p>
              </div>
            ) : rangeError ? (
              <div className="py-20 text-center border rounded-xl bg-red-50/20 dark:bg-red-950/10 border-red-200/50 flex flex-col items-center justify-center gap-2">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                <p className="text-sm font-bold text-red-600 dark:text-red-400">{rangeError}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => fetchRangeAnalytics(rangeStart, rangeEnd)}>Réessayer</Button>
              </div>
            ) : rangeData.length === 0 ? (
              <div className="py-20 text-center border border-dashed rounded-xl flex flex-col items-center justify-center gap-2 bg-slate-50/30">
                <Info className="h-6 w-6 text-slate-400" />
                <p className="text-sm font-bold text-slate-655">Aucun relevé trouvé pour cette période</p>
                <p className="text-xs text-slate-400">Essayez une autre plage de dates.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Dynamically Recalculated Period Metrics */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Moyenne Température</span>
                      <p className="text-xl font-black tracking-tight tabular-nums text-slate-800 dark:text-slate-100 mt-1.5">
                        {rangeSummary?.avgTemp !== null ? `${rangeSummary.avgTemp.toFixed(1)} °C` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-450 dark:text-slate-400 mt-2 font-medium">
                        Calcul thermique sur la période.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Moyenne Humidité</span>
                      <p className="text-xl font-black tracking-tight tabular-nums text-slate-800 dark:text-slate-100 mt-1.5">
                        {rangeSummary?.avgHum !== null ? `${rangeSummary.avgHum.toFixed(1)} %` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-450 dark:text-slate-400 mt-2 font-medium">
                        Humidité relative de la période.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 dark:border-slate-808 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Pic Chaud de la Période</span>
                      <p className="text-lg font-black tracking-tight tabular-nums text-orange-655 mt-1">
                        {rangeSummary?.maxTemp !== null ? `${rangeSummary.maxTemp.toFixed(1)} °C` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-455 dark:text-slate-400 mt-1.5 font-medium leading-normal bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded border dark:border-slate-800">
                        Le: <span className="font-bold">{rangeSummary?.maxTempDate}</span>
                        <br />
                        Sur: <span className="font-bold">{rangeSummary?.maxTempSensor}</span>
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 dark:border-slate-808 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Jours de Séchage Actifs</span>
                      <p className="text-lg font-black tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                        {rangeSummary?.activeOperationalDays !== null ? `${rangeSummary.activeOperationalDays} jours` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-455 dark:text-slate-450 mt-1.5 font-medium leading-normal bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded border dark:border-slate-800">
                        Moyenne quotidienne &gt; 35°C
                        <br />
                        Sur un total de <span className="font-bold">{rangeSummary?.totalActiveDays} jours</span> de mesure.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Day-by-Day Charts */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Temperature daily averages */}
                  <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          <Thermometer className="h-4.5 w-4.5 text-red-500" />
                          Évolution Thermique Quotidienne (Graphique en Jours)
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Moyenne globale journalière de température pour chacun des 8 capteurs DHT22
                        </CardDescription>
                      </div>
                      
                      {/* Grid Toggle Control */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowChartGrid(!showChartGrid)}
                        className="text-[10px] h-7 gap-1 font-semibold uppercase tracking-wider border-slate-200 dark:border-slate-800"
                      >
                        <Sliders className="h-3 w-3" />
                        Grid: {showChartGrid ? "ON" : "OFF"}
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={rangeData} margin={{ left: -10, right: 10, bottom: 0, top: 5 }}>
                            {showChartGrid && (
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />
                            )}
                            <XAxis 
                              dataKey="date" 
                              tick={{ fontSize: 9 }} 
                              tickMargin={8} 
                              stroke="#94a3b8" 
                              tickFormatter={(str) => {
                                try { return str.substring(8, 10) + "/" + str.substring(5, 7); }
                                catch(e) { return str; }
                              }}
                            />
                            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={["auto", "auto"]} unit="°C" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "rgba(15, 23, 42, 0.95)",
                                borderRadius: "8px",
                                border: "none",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                                fontSize: "11px",
                                color: "#f8fafc"
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }} iconType="circle" />
                            {SENSORS.map((s) => (
                              <Line
                                key={s}
                                type="monotone"
                                dataKey={`${s}_temp`}
                                name={s}
                                stroke={SENSOR_COLORS[s]}
                                strokeWidth={2}
                                dot={{ r: 2 }}
                                activeDot={{ r: 4 }}
                                connectNulls
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Humidity daily averages */}
                  <Card className="border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          <Droplets className="h-4.5 w-4.5 text-blue-500" />
                          Évolution Hygrométrique Quotidienne (Graphique en Jours)
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Moyenne globale journalière d'humidité relative pour chacun des 8 capteurs
                        </CardDescription>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowChartGrid(!showChartGrid)}
                        className="text-[10px] h-7 gap-1 font-semibold uppercase tracking-wider border-slate-200 dark:border-slate-808"
                      >
                        <Sliders className="h-3 w-3" />
                        Grid: {showChartGrid ? "ON" : "OFF"}
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={rangeData} margin={{ left: -10, right: 10, bottom: 0, top: 5 }}>
                            {showChartGrid && (
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />
                            )}
                            <XAxis 
                              dataKey="date" 
                              tick={{ fontSize: 9 }} 
                              tickMargin={8} 
                              stroke="#94a3b8"
                              tickFormatter={(str) => {
                                try { return str.substring(8, 10) + "/" + str.substring(5, 7); }
                                catch(e) { return str; }
                              }}
                            />
                            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={["auto", "auto"]} unit="%" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "rgba(15, 23, 42, 0.95)",
                                borderRadius: "8px",
                                border: "none",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                                fontSize: "11px",
                                color: "#f8fafc"
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }} iconType="circle" />
                            {SENSORS.map((s) => (
                              <Line
                                key={s}
                                type="monotone"
                                dataKey={`${s}_hum`}
                                name={s}
                                stroke={SENSOR_COLORS[s]}
                                strokeWidth={2}
                                dot={{ r: 2 }}
                                activeDot={{ r: 4 }}
                                connectNulls
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ========================================================= */}
          {/* TAB 2: PROFIL JOURNALIER                                 */}
          {/* ========================================================= */}
          <TabsContent value="day" className="space-y-6 outline-none focus:ring-0">
            {/* Study Selector Row */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Profil Physique Thermique Quotidien
                </h3>
                <p className="text-xs text-slate-500">
                  Visualisez les courbes de température de toute une journée à intervalles fins de 10 min.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs h-9 px-3 gap-1.5 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10 font-bold uppercase text-slate-500">
                  <Calendar className="h-3.5 w-3.5 text-orange-500" />
                  Date de Recherche:
                </Badge>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-800 dark:text-slate-200 shadow-sm"
                />
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  onClick={() => fetchDayAnalytics(selectedDate)} 
                  disabled={dayLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${dayLoading ? "animate-spin text-orange-500" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Daily Summaries */}
            {dayLoading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
                <p className="text-sm font-semibold text-slate-500">Compilation de la journée en cours (intervalles de 10 min)...</p>
              </div>
            ) : dayError ? (
              <div className="py-20 text-center border rounded-xl bg-red-50/20 dark:bg-red-950/10 border-red-200/50 flex flex-col items-center justify-center gap-2">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                <p className="text-sm font-bold text-red-600 dark:text-red-400">{dayError}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => fetchDayAnalytics(selectedDate)}>Réessayer</Button>
              </div>
            ) : dayData.length === 0 ? (
              <div className="py-20 text-center border border-dashed rounded-xl flex flex-col items-center justify-center gap-2 bg-slate-50/30">
                <Info className="h-6 w-6 text-slate-400" />
                <p className="text-sm font-bold text-slate-650">Aucune donnée disponible pour le {selectedDate}</p>
                <p className="text-xs text-slate-400">Le système n'a enregistré aucune lecture ce jour-là.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Température Maximale</span>
                      <p className="text-xl font-black tracking-tight tabular-nums text-red-650 dark:text-red-400 mt-1">
                        {daySummary?.maxTemp !== null ? `${daySummary.maxTemp.toFixed(1)} °C` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-455 dark:text-slate-400 mt-1.5 font-medium leading-normal bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded border dark:border-slate-800">
                        Capteur: <span className="font-bold">{daySummary?.maxTempSensor}</span>
                        <br />
                        Heure: <span className="font-bold">{daySummary?.maxTempTime}</span>
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Température Minimale</span>
                      <p className="text-xl font-black tracking-tight tabular-nums text-blue-650 dark:text-blue-400 mt-1">
                        {daySummary?.minTemp !== null ? `${daySummary.minTemp.toFixed(1)} °C` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-455 dark:text-slate-400 mt-1.5 font-medium leading-normal bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded border dark:border-slate-800">
                        Capteur: <span className="font-bold">{daySummary?.minTempSensor}</span>
                        <br />
                        Heure: <span className="font-bold">{daySummary?.minTempTime}</span>
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 dark:border-slate-808 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Moyennes Quotidiennes</span>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase font-medium">Température</span>
                          <p className="text-base font-extrabold tracking-tight tabular-nums">
                            {daySummary?.avgTemp?.toFixed(1)}°C
                          </p>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase font-medium">Humidité</span>
                          <p className="text-base font-extrabold tracking-tight tabular-nums">
                            {daySummary?.avgHum?.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 font-medium">
                        Calculé sur {daySummary?.totalRawRows} mesures physiques nettoyées.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Day Charts */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Temperature Chart */}
                  <Card className="border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          <Thermometer className="h-4.5 w-4.5 text-red-500" />
                          Distribution Thermique Fine ({selectedDate})
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Données consolidées toutes les 10 minutes pour les 8 capteurs DHT22
                        </CardDescription>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowChartGrid(!showChartGrid)}
                        className="text-[10px] h-7 gap-1 font-semibold uppercase tracking-wider border-slate-200 dark:border-slate-808"
                      >
                        <Sliders className="h-3 w-3" />
                        Grid: {showChartGrid ? "ON" : "OFF"}
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dayData} margin={{ left: -10, right: 10, bottom: 0, top: 5 }}>
                            {showChartGrid && (
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />
                            )}
                            <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={8} stroke="#94a3b8" />
                            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={["auto", "auto"]} unit="°C" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "rgba(15, 23, 42, 0.95)",
                                borderRadius: "8px",
                                border: "none",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                                fontSize: "11px",
                                color: "#f8fafc"
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }} iconType="circle" />
                            {SENSORS.map((s) => (
                              <Line
                                key={s}
                                type="monotone"
                                dataKey={`${s}_temp`}
                                name={s}
                                stroke={SENSOR_COLORS[s]}
                                strokeWidth={1.8}
                                dot={false}
                                activeDot={{ r: 4 }}
                                connectNulls
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Humidity Chart */}
                  <Card className="border-slate-200 dark:border-slate-808 bg-white dark:bg-slate-900 shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          <Droplets className="h-4.5 w-4.5 text-blue-500" />
                          Distribution Hygrométrique Fine ({selectedDate})
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Profil d'humidité relative absolue compilé sur 10 minutes d'intervalle
                        </CardDescription>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowChartGrid(!showChartGrid)}
                        className="text-[10px] h-7 gap-1 font-semibold uppercase tracking-wider border-slate-200 dark:border-slate-800"
                      >
                        <Sliders className="h-3 w-3" />
                        Grid: {showChartGrid ? "ON" : "OFF"}
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dayData} margin={{ left: -10, right: 10, bottom: 0, top: 5 }}>
                            {showChartGrid && (
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />
                            )}
                            <XAxis dataKey="time" tick={{ fontSize: 10 }} tickMargin={8} stroke="#94a3b8" />
                            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={["auto", "auto"]} unit="%" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "rgba(15, 23, 42, 0.95)",
                                borderRadius: "8px",
                                border: "none",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                                fontSize: "11px",
                                color: "#f8fafc"
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }} iconType="circle" />
                            {SENSORS.map((s) => (
                              <Line
                                key={s}
                                type="monotone"
                                dataKey={`${s}_hum`}
                                name={s}
                                stroke={SENSOR_COLORS[s]}
                                strokeWidth={1.8}
                                dot={false}
                                activeDot={{ r: 4 }}
                                connectNulls
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ======================================================== */}
          {/* TAB 3: TENDANCES MENSUELLES                              */}
          {/* ======================================================== */}
          <TabsContent value="month" className="space-y-6 outline-none focus:ring-0">
            {/* Study Selector Row */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-808 shadow-sm">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-850">
                  Analyse de Rendement Mensuel
                </h3>
                <p className="text-xs text-slate-500">
                  Visualisez l'évolution des moyennes quotidiennes et le nombre de journées actives à haut rendement (Température moyenne &gt; 35°C).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs h-9 px-3 gap-1.5 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 font-bold uppercase text-slate-500">
                  <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
                  Mois de Recherche:
                </Badge>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-800 dark:text-slate-200 shadow-sm"
                />
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  onClick={() => fetchMonthAnalytics(selectedMonth)} 
                  disabled={monthLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${monthLoading ? "animate-spin text-orange-500" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Monthly Summaries */}
            {monthLoading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
                <p className="text-sm font-semibold text-slate-500">Compilation thermodynamique mensuelle (Calcul en cours)...</p>
              </div>
            ) : monthError ? (
              <div className="py-20 text-center border rounded-xl bg-red-50/20 dark:bg-red-950/10 border-red-200/50 flex flex-col items-center justify-center gap-2">
                <AlertTriangle className="h-6 w-6 text-red-500" />
                <p className="text-sm font-bold text-red-650 dark:text-red-400">{monthError}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => fetchMonthAnalytics(selectedMonth)}>Réessayer</Button>
              </div>
            ) : monthData.length === 0 ? (
              <div className="py-20 text-center border border-dashed rounded-xl flex flex-col items-center justify-center gap-2 bg-slate-50/30">
                <Info className="h-6 w-6 text-slate-400" />
                <p className="text-sm font-bold text-slate-650">Aucune donnée disponible pour le mois sélectionné</p>
                <p className="text-xs text-slate-400">Le système n'a pas enregistré de données pendant cette période.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Statistics Cards */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Température Moyenne</span>
                      <p className="text-xl font-black tracking-tight tabular-nums text-slate-800 dark:text-slate-100 mt-1.5">
                        {monthSummary?.avgTemp !== null ? `${monthSummary.avgTemp.toFixed(1)} °C` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-2 font-medium">
                        Moyenne globale mensuelle.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Humidité Moyenne</span>
                      <p className="text-xl font-black tracking-tight tabular-nums text-slate-800 dark:text-slate-100 mt-1.5">
                        {monthSummary?.avgHum !== null ? `${monthSummary.avgHum.toFixed(1)} %` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-450 dark:text-slate-400 mt-2 font-medium">
                        Humidité relative moyenne mensuelle.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 dark:border-slate-808 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Pic Chaud Mensuel</span>
                      <p className="text-lg font-black tracking-tight tabular-nums text-orange-655 mt-1">
                        {monthSummary?.maxTemp !== null ? `${monthSummary.maxTemp.toFixed(1)} °C` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-450 dark:text-slate-450 mt-1.5 font-medium leading-normal bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded border dark:border-slate-800">
                        Le: <span className="font-bold">{monthSummary?.maxTempDate}</span>
                        <br />
                        Sur: <span className="font-bold">{monthSummary?.maxTempSensor}</span>
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 dark:border-slate-808 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wide">Jours de Séchage Actifs</span>
                      <p className="text-lg font-black tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                        {monthSummary?.activeOperationalDays !== null ? `${monthSummary.activeOperationalDays} jours` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-455 dark:text-slate-455 mt-1.5 font-medium leading-normal bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded border dark:border-slate-800">
                        Moyenne quotidienne &gt; 35°C
                        <br />
                        Sur un total de <span className="font-bold">{monthSummary?.totalActiveDays} jours</span> de mesure.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Monthly Charts */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Temperature daily averages */}
                  <Card className="border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          <Thermometer className="h-4.5 w-4.5 text-red-500" />
                          Rendement Thermique Quotidien (Moyennes en Jours)
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Évolution journalière des moyennes de température de chaque capteur
                        </CardDescription>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowChartGrid(!showChartGrid)}
                        className="text-[10px] h-7 gap-1 font-semibold uppercase tracking-wider border-slate-200 dark:border-slate-808"
                      >
                        <Sliders className="h-3 w-3" />
                        Grid: {showChartGrid ? "ON" : "OFF"}
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthData} margin={{ left: -10, right: 10, bottom: 0, top: 5 }}>
                            {showChartGrid && (
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />
                            )}
                            <XAxis 
                              dataKey="date" 
                              tick={{ fontSize: 9 }} 
                              tickMargin={8} 
                              stroke="#94a3b8" 
                              tickFormatter={(str) => {
                                try { return str.substring(8, 10) + "/" + str.substring(5, 7); }
                                catch(e) { return str; }
                              }}
                            />
                            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={["auto", "auto"]} unit="°C" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "rgba(15, 23, 42, 0.95)",
                                borderRadius: "8px",
                                border: "none",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                                fontSize: "11px",
                                color: "#f8fafc"
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }} iconType="circle" />
                            {SENSORS.map((s) => (
                              <Line
                                key={s}
                                type="monotone"
                                dataKey={`${s}_temp`}
                                name={s}
                                stroke={SENSOR_COLORS[s]}
                                strokeWidth={2}
                                dot={{ r: 2 }}
                                activeDot={{ r: 4 }}
                                connectNulls
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Humidity daily averages */}
                  <Card className="border-slate-200 dark:border-slate-808 bg-white dark:bg-slate-900 shadow-sm">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          <Droplets className="h-4.5 w-4.5 text-blue-500" />
                          Rendement Hygrométrique Quotidien (Moyennes en Jours)
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Évolution journalière des moyennes d'humidité de chaque capteur
                        </CardDescription>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowChartGrid(!showChartGrid)}
                        className="text-[10px] h-7 gap-1 font-semibold uppercase tracking-wider border-slate-200 dark:border-slate-800"
                      >
                        <Sliders className="h-3 w-3" />
                        Grid: {showChartGrid ? "ON" : "OFF"}
                      </Button>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={monthData} margin={{ left: -10, right: 10, bottom: 0, top: 5 }}>
                            {showChartGrid && (
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />
                            )}
                            <XAxis 
                              dataKey="date" 
                              tick={{ fontSize: 9 }} 
                              tickMargin={8} 
                              stroke="#94a3b8"
                              tickFormatter={(str) => {
                                try { return str.substring(8, 10) + "/" + str.substring(5, 7); }
                                catch(e) { return str; }
                              }}
                            />
                            <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" domain={["auto", "auto"]} unit="%" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "rgba(15, 23, 42, 0.95)",
                                borderRadius: "8px",
                                border: "none",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                                fontSize: "11px",
                                color: "#f8fafc"
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }} iconType="circle" />
                            {SENSORS.map((s) => (
                              <Line
                                key={s}
                                type="monotone"
                                dataKey={`${s}_hum`}
                                name={s}
                                stroke={SENSOR_COLORS[s]}
                                strokeWidth={2}
                                dot={{ r: 2 }}
                                activeDot={{ r: 4 }}
                                connectNulls
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ========================================== */}
          {/* TAB 4: EXPLORATEUR DE DONNÉES & EXPORT     */}
          {/* ========================================== */}
          <TabsContent value="explorer" className="space-y-6 outline-none focus:ring-0">
            {/* Split Section: Info Card + Export Control */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Scientific Context */}
              <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Info className="h-4.5 w-4.5 text-orange-500" />
                    Contexte de Recherche Physique & Solaire
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Ce projet constitue le <strong>Système d'Acquisition Spatialisé en Temps Réel</strong> du séchoir solaire expérimental de l'<strong>Université de Béchar</strong>. Les 8 capteurs physiques <strong>DHT22</strong> sont distribués à des hauteurs et positions stratégiques à l'intérieur du collecteur solaire et de la chambre de séchage. 
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Cette disposition permet d'analyser le <strong>transfert thermique tridimensionnel</strong>, de cartographier les gradients de convection et d'évaluer le taux d'évaporation hygrométrique des produits en phase de traitement. Les données sont indispensables pour modéliser le coefficient thermodynamique global du séchoir solaire.
                  </p>
                </CardContent>
              </Card>

              {/* Action: Export Excel */}
              <Card className="border-slate-200 dark:border-slate-800 bg-slate-900 text-white shadow-sm flex flex-col justify-between overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-[4px] bg-green-500" />
                <CardHeader className="pb-1 pt-4">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-green-400 flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    Base de Données Complète
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-[10px] uppercase font-mono">
                    {totalRecords} Enregistrements Pivotés
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-4 space-y-4 flex-1 flex flex-col justify-between pt-2">
                  <p className="text-[11px] text-slate-350 leading-normal">
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

            {/* ──── Data Table (pivoted) ──── */}
            <Card className="border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900 shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    <Clock className="h-4.5 w-4.5 text-slate-500" />
                    Historique Brut & Navigation
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Parcourez les colonnes de chaque capteur (DHT1 à DHT8) par horodatage exact (Algeria Time)
                  </CardDescription>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
                        <TableHead className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-900 font-bold text-xs text-slate-500 whitespace-nowrap">
                          Horodatage Local
                        </TableHead>
                        {SENSORS.map((s) => (
                          <TableHead
                            key={s}
                            colSpan={2}
                            className="text-center font-bold text-xs text-slate-500 border-l border-slate-200/60 dark:border-slate-800/60"
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
                      <TableRow className="bg-slate-50/40 dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-800">
                        <TableHead className="sticky left-0 z-10 bg-slate-50/40 dark:bg-slate-900" />
                        {SENSORS.map((s) => (
                          <React.Fragment key={s}>
                            <TableHead className="text-center text-[10px] font-bold text-orange-655 border-l border-slate-200/60 dark:border-slate-800/60 uppercase">
                              T (°C)
                            </TableHead>
                            <TableHead className="text-center text-[10px] font-bold text-blue-655 uppercase">
                              H (%)
                            </TableHead>
                          </React.Fragment>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading && paginatedData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={1 + SENSORS.length * 2} className="py-16 text-center text-slate-450 dark:text-slate-400">
                            <RefreshCw className="h-7 w-7 animate-spin mx-auto mb-2 text-orange-500" />
                            Chargement des relevés en cours...
                          </TableCell>
                        </TableRow>
                      ) : paginatedData.map((row, i) => (
                        <TableRow key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/80">
                          <TableCell className="sticky left-0 z-10 bg-white dark:bg-slate-900 whitespace-nowrap font-mono text-xs font-semibold text-slate-600 dark:text-slate-400 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            {row.date} {row.time}
                          </TableCell>
                          {SENSORS.map((s) => (
                            <React.Fragment key={s}>
                              <TableCell className="text-center tabular-nums text-xs border-l border-slate-100 dark:border-slate-800/40">
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
                            className="py-16 text-center text-slate-455 dark:text-slate-400"
                          >
                            Aucune lecture physique n'a été enregistrée
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Pagination Controls */}
                {totalPages > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 gap-4 bg-slate-50/50 dark:bg-slate-800/10">
                    <p className="text-xs font-semibold text-slate-500">
                      Affichage de {paginatedData.length} lignes sur un total de {totalRecords} lignes pivotées
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-slate-200 dark:border-slate-800"
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
                          className="w-8 h-8 font-semibold text-xs border-slate-200 dark:border-slate-800"
                        >
                          {num}
                        </Button>
                      ))}

                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <>
                          <Button variant="outline" size="sm" disabled className="w-8 h-8 opacity-40 border-slate-200 dark:border-slate-800">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={loading}
                            className="w-8 h-8 font-semibold text-xs border-slate-200 dark:border-slate-800"
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-slate-200 dark:border-slate-800"
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
          </TabsContent>
        </Tabs>

        {/* ──── Footer ──── */}
        <footer className="py-8 text-center text-[11px] font-medium text-slate-450 border-t border-slate-200 dark:border-slate-800 mt-6">
          Université de Béchar • Département de Physique & Énergie Solaire • Système de Télémétrie Séchoir Solaire Connecté © {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
}

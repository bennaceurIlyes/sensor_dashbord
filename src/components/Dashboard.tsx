"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
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
  FileText,
  AlertTriangle,
  ShieldCheck
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

const SENSOR_INFO: Record<string, { x: number; y: number; name: string }> = {
  DHT1: { x: 86, y: 13, name: "Entrée Capteur Solaire (Haut)" },
  DHT2: { x: 38, y: 13, name: "Milieu Capteur Solaire" },
  DHT3: { x: 10, y: 25, name: "Sortie Capteur Solaire (Bas)" },
  DHT4: { x: 10, y: 66, name: "Entrée Chambre Séchage" },
  DHT5: { x: 42, y: 89, name: "Milieu Chambre Séchage" },
  DHT6: { x: 62, y: 39, name: "Plafond Chambre Séchage" },
  DHT7: { x: 74, y: 89, name: "Bas Chambre Séchage" },
  DHT8: { x: 88, y: 67, name: "Sortie Chambre Séchage" },
};

// Helper for physical data validation (DHT22 sensor noise filter)
const isValidTemp = (t: any) => t !== undefined && t !== null && Number(t) >= 5 && Number(t) <= 85;
const isValidHum = (h: any) => h !== undefined && h !== null && Number(h) >= 1 && Number(h) <= 100;

// Algorithm to compute histogram data & statistics from readings
const computeHistogramData = (
  data: any[],
  metric: "temp" | "hum",
  sensor: string,
  binCount: number
) => {
  const values: number[] = [];
  data.forEach((row) => {
    if (sensor === "ALL") {
      SENSORS.forEach((s) => {
        const val = row[`${s}_${metric}`];
        if (metric === "temp" ? isValidTemp(val) : isValidHum(val)) {
          values.push(Number(val));
        }
      });
    } else {
      const val = row[`${sensor}_${metric}`];
      if (metric === "temp" ? isValidTemp(val) : isValidHum(val)) {
        values.push(Number(val));
      }
    }
  });

  if (values.length === 0) {
    return {
      bins: [],
      stats: { min: 0, max: 0, avg: 0, median: 0, count: 0 },
    };
  }

  // Calculate statistics
  values.sort((a, b) => a - b);
  const count = values.length;
  const min = values[0];
  const max = values[count - 1];
  const sum = values.reduce((acc, v) => acc + v, 0);
  const avg = sum / count;
  
  // Median
  const mid = Math.floor(count / 2);
  const median = count % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;

  // Set bin ranges
  let binMin = min;
  let binMax = max;
  if (binMin === binMax) {
    binMin -= 1;
    binMax += 1;
  }

  const binWidth = (binMax - binMin) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => {
    const start = binMin + i * binWidth;
    const end = start + binWidth;
    return {
      binStart: start,
      binEnd: end,
      label: `${start.toFixed(1)} - ${end.toFixed(1)}`,
      count: 0,
      percentage: 0,
    };
  });

  // Distribute values into bins
  values.forEach((v) => {
    for (let i = 0; i < binCount; i++) {
      const isLast = i === binCount - 1;
      const start = bins[i].binStart;
      const end = bins[i].binEnd;
      if (v >= start && (isLast ? v <= end : v < end)) {
        bins[i].count++;
        break;
      }
    }
  });

  bins.forEach((b) => {
    b.percentage = parseFloat(((b.count / count) * 100).toFixed(1));
  });

  return {
    bins,
    stats: {
      min,
      max,
      avg: parseFloat(avg.toFixed(1)),
      median: parseFloat(median.toFixed(1)),
      count,
    },
  };
};

// Helper to get thermodynamic colors dynamically for each histogram class/bin
const getBinColor = (bin: any, metric: "temp" | "hum", sensor: string) => {
  if (sensor !== "ALL") {
    return SENSOR_COLORS[sensor] || "#f97316";
  }
  
  const avgVal = (bin.binStart + bin.binEnd) / 2;
  
  if (metric === "temp") {
    // Dynamic color scaling for solar dryer temperature (Cool blue to hot red)
    if (avgVal < 25) return "#3b82f6"; // Cool Blue
    if (avgVal < 38) return "#10b981"; // Emerald
    if (avgVal < 50) return "#f59e0b"; // Warm Amber
    if (avgVal < 62) return "#f97316"; // Bright Orange
    return "#ef4444"; // Intense Red
  } else {
    // Dynamic color scaling for humidity (dry light-blue to highly humid dark-navy)
    if (avgVal < 30) return "#a5f3fc"; // Very dry (Cyan)
    if (avgVal < 50) return "#06b6d4"; // Cyan
    if (avgVal < 75) return "#3b82f6"; // Blue
    return "#1e3a8a"; // Highly humid (Deep Blue)
  }
};

export default function Dashboard() {
  /* ---------- Sidebar Active Page Routing State ---------- */
  const [activeView, setActiveView] = useState<"analyse" | "logs">("analyse");

  /* ---------- Interactive Sensor Diagram States ---------- */
  const [hoveredSensor, setHoveredSensor] = useState<string | null>(null);

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

  /* ---------- Visible Sensors (Comparison Filters) ---------- */
  const [visibleSensors, setVisibleSensors] = useState<string[]>([
    "DHT1", "DHT2", "DHT3", "DHT4", "DHT5", "DHT6", "DHT7", "DHT8"
  ]);

  /* ---------- Histogram Analysis States ---------- */
  const [histoSource, setHistoSource] = useState<"day" | "range" | "month">("day");
  const [histoMetric, setHistoMetric] = useState<"temp" | "hum">("temp");
  const [histoSensor, setHistoSensor] = useState<string>("ALL");
  const [histoBins, setHistoBins] = useState<number>(10);

  /* ---------- Database Clean Actions Confirmation States ---------- */
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  // Reset delete confirmation state after 5 seconds
  useEffect(() => {
    if (deleteConfirm) {
      const timer = setTimeout(() => setDeleteConfirm(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [deleteConfirm]);

  const handleDeleteAllData = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/data", { method: "DELETE" });
      if (!res.ok) throw new Error("Delete request failed");

      setPaginatedData([]);
      setTotalRecords(0);
      setTotalPages(1);
      setCurrentPage(1);
      setAnomaliesCount(0);
      setDeleteConfirm(false);
      alert("Base de données réinitialisée avec succès ! Tous les relevés ont été supprimés.");
      
      // Re-trigger visual analytics refreshes
      fetchPage(1);
      fetchRangeAnalytics(rangeStart, rangeEnd);
      fetchDayAnalytics(selectedDate);
      fetchMonthAnalytics(selectedMonth);
    } catch (err) {
      console.error(err);
      alert("Impossible de réinitialiser la base de données.");
    } finally {
      setDeleting(false);
    }
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

  /* ---------- Histogram Calculations ---------- */
  const activeHistoData = 
    histoSource === "day" 
      ? dayData 
      : histoSource === "month" 
      ? monthData 
      : rangeData;

  const { bins: histoBinsData, stats: histoStats } = computeHistogramData(
    activeHistoData,
    histoMetric,
    histoSensor,
    histoBins
  );

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
      
      {/* ──── Left Sidebar Navigation (LIGHT THEME) ──── */}
      <aside className="w-full md:w-64 bg-white text-slate-800 flex flex-col justify-between p-5 border-r border-slate-200 md:h-screen md:sticky md:top-0 shadow-sm">
        <div className="space-y-6">
          {/* Top Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600/10 text-orange-600 border border-orange-200 shadow-sm">
              <Sun className="h-5.5 w-5.5 stroke-[1.8]" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-wider uppercase text-slate-900 leading-none">
                Séchoir Solaire
              </h1>
              <span className="text-[10px] text-slate-400 font-medium tracking-tight">
                Univ Béchar • IoT Platform
              </span>
            </div>
          </div>

          <Separator className="bg-slate-200" />

          {/* Operational Signal Badge */}
          <div className="space-y-2">
            <Badge
              variant="outline"
              className={`w-full gap-1.5 text-xs font-extrabold py-2 px-3 flex justify-center items-center shadow-sm rounded-lg border ${
                activeSensors > 0
                  ? "bg-emerald-55/80 text-emerald-700 border-emerald-200/80"
                  : "bg-red-50 text-red-700 border-red-200"
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
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 border cursor-pointer ${
                activeView === "analyse"
                  ? "bg-orange-50 border-orange-200/80 text-orange-600 shadow-sm"
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              <TrendingUp className="h-4.5 w-4.5" />
              Analyse de Données
            </button>
            
            <button
              onClick={() => setActiveView("logs")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 border cursor-pointer ${
                activeView === "logs"
                  ? "bg-orange-50 border-orange-200/80 text-orange-600 shadow-sm"
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              <Database className="h-4.5 w-4.5" />
              Historique & Export
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400 font-semibold leading-relaxed">
          Université Béchar © {new Date().getFullYear()}
          <br />
          Dépt de Physique Énergétique
        </div>
      </aside>

      {/* ──── Right Panel: Content View Area ──── */}
      <div className="flex-1 flex flex-col min-h-screen">
        
        {/* Right Header Diagnostics */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 py-3 px-6 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-sm">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-500 animate-pulse" />
              {activeView === "analyse" ? "Espace d'Analyse Thermodynamique" : "Visualisation de Base de Données"}
            </h2>
            <p className="text-[11px] text-slate-400 leading-none mt-1 font-medium">
              Suivi et cartographie thermique en direct • Capteurs DHT22
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
          {/* PAGE 1: TELEMETRY ANALYSIS                 */}
          {/* ========================================== */}
          {activeView === "analyse" && (
            <div className="space-y-6 animate-fade-in">
              {/* INTERACTIVE 3D SOLAR DRYER DIAGRAM OVERVIEW */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Left side: Interactive Diagram (3/4 width on desktop) */}
                <Card className="lg:col-span-3 border-slate-200 bg-white shadow-sm flex flex-col justify-between overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                      <div>
                        <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Sliders className="h-4.5 w-4.5 text-orange-500" />
                          Synoptique Interactif du Séchoir Solaire
                        </CardTitle>
                        <CardDescription className="text-[11px]">
                          Survolez ou cliquez sur un capteur (ou sa légende) pour localiser sa position et visualiser ses données en direct.
                        </CardDescription>
                      </div>
                      {hoveredSensor && (
                        <div className="flex items-center gap-1.5 text-[10px] bg-slate-100 py-1 px-2.5 rounded-md border border-slate-200 animate-fade-in font-bold text-slate-700">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SENSOR_COLORS[hoveredSensor] }} />
                          {hoveredSensor} : {SENSOR_INFO[hoveredSensor].name}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2 pb-6 flex items-center justify-center">
                    <div className="w-full relative aspect-square max-w-[620px] bg-white rounded-xl border border-slate-150 overflow-hidden shadow-inner p-1">
                      
                      {/* Diagram Image */}
                      <img 
                        src="/clean_solar_dryer.png" 
                        alt="Diagramme Séchoir Solaire" 
                        className="w-full h-full object-contain pointer-events-none select-none transition-all duration-300"
                        style={{
                          opacity: hoveredSensor ? 0.95 : 1,
                        }}
                      />
                      
                      {/* 8 Sensor Widgets / Markers */}
                      {SENSORS.map((sensor) => {
                        const data = latestReadings[sensor];
                        const isConnected = !!data;
                        const isHovered = hoveredSensor === sensor;
                        const isDimmed = hoveredSensor !== null && !isHovered;
                        const color = SENSOR_COLORS[sensor];
                        const pos = SENSOR_INFO[sensor];
                        
                        return (
                          <div
                            key={sensor}
                            className="absolute transition-all duration-300"
                            style={{
                              left: `${pos.x}%`,
                              top: `${pos.y}%`,
                              transform: "translate(-50%, -50%)",
                              zIndex: isHovered ? 40 : 20,
                            }}
                          >
                            {/* --- MOBILE MARKER (Pulsing Dot) --- */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setHoveredSensor(isHovered ? null : sensor);
                              }}
                              className={`md:hidden flex items-center justify-center w-8 h-8 rounded-full border-2 bg-white shadow-md transition-all duration-205 cursor-pointer select-none relative ${
                                isHovered 
                                  ? "scale-125 ring-4 ring-orange-500/35 opacity-100" 
                                  : isDimmed 
                                  ? "opacity-30 scale-90" 
                                  : "opacity-95 hover:scale-105"
                              }`}
                              style={{
                                borderColor: color,
                                color: isHovered ? "#ea580c" : color,
                                fontWeight: 900,
                              }}
                            >
                              {sensor.replace("DHT", "")}
                              {isConnected ? (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white"></span>
                                </span>
                              ) : (
                                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border border-white" />
                              )}
                            </button>

                            {/* --- MOBILE TOOLTIP / DETAIL PANEL --- */}
                            {isHovered && (
                              <div 
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900/95 backdrop-blur-md text-white rounded-xl p-3 shadow-xl border border-slate-800 animate-fade-in pointer-events-none md:hidden z-50 text-[10px]"
                                style={{
                                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                                }}
                              >
                                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1.5">
                                  <span className="font-black tracking-wider uppercase text-orange-400">{sensor}</span>
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isConnected ? "#10b981" : "#ef4444" }} />
                                </div>
                                <div className="text-[9px] text-slate-400 font-semibold mb-2 leading-tight">
                                  {pos.name}
                                </div>
                                {isConnected ? (
                                  <div className="space-y-1.5 font-medium">
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-400 flex items-center gap-1"><Thermometer className="h-3 w-3 text-orange-500" /> Température</span>
                                      <span className="font-extrabold text-white">{Number(data.temperature).toFixed(1)} °C</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-400 flex items-center gap-1"><Droplets className="h-3 w-3 text-blue-500" /> Humidité</span>
                                      <span className="font-extrabold text-white">{Number(data.humidity).toFixed(1)} %</span>
                                    </div>
                                    <div className="flex justify-between text-[9px] text-slate-500 pt-1.5 border-t border-slate-800/80 font-mono">
                                      <span>Mis à jour</span>
                                      <span>{data.time || "—"}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-red-400 font-bold uppercase text-[9px] tracking-wider py-1 flex items-center gap-1">
                                    Capteur Déconnecté
                                  </div>
                                )}
                              </div>
                            )}

                            {/* --- DESKTOP WIDGET (Mini LCD Screen) --- */}
                            <div
                              onMouseEnter={() => setHoveredSensor(sensor)}
                              onMouseLeave={() => setHoveredSensor(null)}
                              className={`hidden md:flex flex-col p-1.5 rounded-lg bg-white/20 backdrop-blur-[1px] border border-white/30 shadow-sm transition-all duration-300 pointer-events-auto cursor-pointer select-none relative ${
                                isHovered
                                  ? "ring-2 ring-orange-500/70 shadow-[0_4px_15px_rgba(249,115,22,0.18)] scale-[1.03] z-30 bg-white/50 backdrop-blur-md border-white/50"
                                  : isDimmed
                                  ? "opacity-30 scale-95 border-white/20"
                                  : "opacity-[0.93] hover:opacity-100 hover:scale-[1.01]"
                              }`}
                              style={{
                                width: "90px",
                              }}
                            >
                              {/* Glowing pointer/arrow overlay when active */}
                              {isHovered && (
                                <div 
                                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rotate-45 border-r border-b border-orange-500/70"
                                  style={{ backgroundColor: "rgba(255, 255, 255, 0.55)", backdropFilter: "blur(12px)", zIndex: -1 }}
                                />
                              )}
                              
                              <div className="flex items-center justify-between text-[8px] font-black tracking-wider text-slate-600 uppercase pb-0.5 border-b border-slate-200/50">
                                <span className="flex items-center gap-0.5">
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                                  {sensor}
                                </span>
                                <span className={`h-1 w-1 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                              </div>

                              {isConnected ? (
                                <div className="mt-1 space-y-0.5">
                                  {/* Temp Row */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-0.5 text-slate-500">
                                      <Thermometer className="h-3 w-3 text-orange-500" />
                                    </div>
                                    <span className="text-[11px] font-black tracking-tight tabular-nums text-slate-800">
                                      {Number(data.temperature).toFixed(1)}
                                      <span className="text-[8.5px] font-bold text-slate-500 ml-0.5">°C</span>
                                    </span>
                                  </div>
                                  
                                  {/* Hum Row */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-0.5 text-slate-500">
                                      <Droplets className="h-3 w-3 text-blue-500" />
                                    </div>
                                    <span className="text-[11px] font-black tracking-tight tabular-nums text-slate-800">
                                      {Number(data.humidity).toFixed(0)}
                                      <span className="text-[8.5px] font-bold text-slate-500 ml-0.5">%</span>
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1 py-0.5 text-center text-red-650 font-extrabold uppercase text-[7px] tracking-wider bg-red-50/70 border border-red-100 rounded">
                                  Hors Ligne
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Right side: Interactive Legend (1/4 width on desktop) */}
                <Card className="lg:col-span-1 border-slate-200 bg-white shadow-sm flex flex-col justify-between overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Légende & Signaux
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      Liste physique des sondes d'acquisition.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 pb-4 flex-1">
                    <div className="flex flex-col gap-2">
                      {SENSORS.map((sensor) => {
                        const data = latestReadings[sensor];
                        const isConnected = !!data;
                        const isHovered = hoveredSensor === sensor;
                        const isDimmed = hoveredSensor !== null && !isHovered;
                        const color = SENSOR_COLORS[sensor];
                        
                        return (
                          <div
                            key={sensor}
                            onMouseEnter={() => setHoveredSensor(sensor)}
                            onMouseLeave={() => setHoveredSensor(null)}
                            onClick={() => setHoveredSensor(isHovered ? null : sensor)}
                            className={`flex items-center justify-between p-2.5 rounded-lg border transition-all duration-200 cursor-pointer select-none ${
                              isHovered
                                ? "bg-orange-50/40 border-orange-300 shadow-sm scale-[1.01]"
                                : isDimmed
                                ? "opacity-35 scale-[0.98] border-slate-100"
                                : "bg-white border-slate-150 hover:bg-slate-50/50 hover:border-slate-300"
                            }`}
                            style={{
                              borderLeftWidth: "4px",
                              borderLeftColor: color,
                            }}
                          >
                            <div className="flex flex-col gap-0.5 overflow-hidden">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-black uppercase text-slate-800 leading-none">{sensor}</span>
                                <span className="text-[9px] text-slate-400 font-semibold truncate max-w-[110px]" title={SENSOR_INFO[sensor].name}>
                                  {SENSOR_INFO[sensor].name}
                                </span>
                              </div>
                              <span className="text-[9px] font-bold text-slate-450 uppercase leading-none">
                                {isConnected ? "Connecté" : "Déconnecté"}
                              </span>
                            </div>
                            
                            {isConnected ? (
                              <div className="flex items-center gap-2 text-slate-700 shrink-0">
                                <div className="flex items-center gap-0.5">
                                  <Thermometer className="h-3 w-3 text-orange-500" />
                                  <span className="text-[11px] font-black tabular-nums">{Number(data.temperature).toFixed(1)}°</span>
                                </div>
                                <div className="flex items-center gap-0.5 border-l border-slate-100 pl-1.5">
                                  <Droplets className="h-3 w-3 text-blue-500" />
                                  <span className="text-[11px] font-black tabular-nums">{Number(data.humidity).toFixed(0)}%</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[8px] font-black uppercase text-red-500 bg-red-50 px-1 py-0.5 rounded shrink-0">
                                NC
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>


              {/* INTERACTIVE SENSOR COMPARISON FILTER BAR */}
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardContent className="py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Sliders className="h-4.5 w-4.5 text-orange-500" />
                      Filtres de comparaison des capteurs (Graphiques)
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Cochez ou décochez les capteurs ci-dessous pour filtrer et comparer leurs courbes en temps réel.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {SENSORS.map((sensor) => {
                      const isVisible = visibleSensors.includes(sensor);
                      const color = SENSOR_COLORS[sensor];
                      
                      return (
                        <button
                          key={sensor}
                          onClick={() => {
                            if (isVisible) {
                              if (visibleSensors.length > 1) {
                                setVisibleSensors(visibleSensors.filter((s) => s !== sensor));
                              }
                            } else {
                              setVisibleSensors([...visibleSensors, sensor]);
                            }
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-150 border cursor-pointer ${
                            isVisible
                              ? "bg-slate-50 shadow-sm border-slate-300 text-slate-800"
                              : "bg-transparent border-slate-100 text-slate-400 hover:border-slate-250 hover:bg-slate-50/50"
                          }`}
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full border border-white transition-all duration-150 ${
                              isVisible ? "opacity-100 scale-100" : "opacity-30 scale-75"
                            }`}
                            style={{ backgroundColor: isVisible ? color : "#94a3b8" }}
                          />
                          {sensor}
                        </button>
                      );
                    })}

                    <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVisibleSensors([...SENSORS])}
                      className="text-[10px] font-extrabold uppercase text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2 h-7 cursor-pointer"
                    >
                      Tout afficher
                    </Button>
                  </div>
                </CardContent>
              </Card>

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
                              {SENSORS.filter((s) => visibleSensors.includes(s)).map((s) => (
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
                              {SENSORS.filter((s) => visibleSensors.includes(s)).map((s) => (
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
                      className="h-8 rounded-md border border-slate-255 bg-white px-2.5 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm text-slate-800"
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
                              {SENSORS.filter((s) => visibleSensors.includes(s)).map((s) => (
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
                              {SENSORS.filter((s) => visibleSensors.includes(s)).map((s) => (
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
                      className="h-8 rounded-md border border-slate-255 bg-white px-2.5 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm text-slate-800"
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
                              {SENSORS.filter((s) => visibleSensors.includes(s)).map((s) => (
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
                              {SENSORS.filter((s) => visibleSensors.includes(s)).map((s) => (
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

              {/* SECTION D: THERMODYNAMIC HISTOGRAM */}
              <div className="space-y-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Sliders className="h-4.5 w-4.5 text-orange-500" />
                      4. Analyse de Distribution & Fréquences (Histogramme)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Visualisez la distribution statistique et la concentration des relevés thermiques et hygrométriques.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Source Selector */}
                    <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 shadow-sm">
                      <button
                        onClick={() => setHistoSource("day")}
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded transition-all cursor-pointer ${
                          histoSource === "day"
                            ? "bg-white text-orange-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        Journée
                      </button>
                      <button
                        onClick={() => setHistoSource("range")}
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded transition-all cursor-pointer ${
                          histoSource === "range"
                            ? "bg-white text-orange-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        Période
                      </button>
                      <button
                        onClick={() => setHistoSource("month")}
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded transition-all cursor-pointer ${
                          histoSource === "month"
                            ? "bg-white text-orange-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        Mois
                      </button>
                    </div>

                    {/* Metric Selector */}
                    <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 shadow-sm">
                      <button
                        onClick={() => setHistoMetric("temp")}
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded transition-all cursor-pointer ${
                          histoMetric === "temp"
                            ? "bg-orange-500 text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        Temp (°C)
                      </button>
                      <button
                        onClick={() => setHistoMetric("hum")}
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded transition-all cursor-pointer ${
                          histoMetric === "hum"
                            ? "bg-blue-500 text-white shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        Hum (%)
                      </button>
                    </div>
                  </div>
                </div>

                <Card className="border-slate-205 bg-white shadow-sm">
                  <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-4">
                      {/* Sensor Dropdown */}
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Capteur Analysé</span>
                        <select
                          value={histoSensor}
                          onChange={(e) => setHistoSensor(e.target.value)}
                          className="h-8 rounded-md border border-slate-250 bg-white px-2 py-0.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm text-slate-800"
                        >
                          <option value="ALL">Tous les capteurs</option>
                          {SENSORS.map((s) => (
                            <option key={s} value={s}>
                              {s} (Séchoir)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Bins Selector */}
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Résolution (Classes)</span>
                        <select
                          value={histoBins}
                          onChange={(e) => setHistoBins(Number(e.target.value))}
                          className="h-8 rounded-md border border-slate-250 bg-white px-2 py-0.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-sm text-slate-800"
                        >
                          <option value={5}>5 Intervalles (Large)</option>
                          <option value={8}>8 Intervalles</option>
                          <option value={10}>10 Intervalles (Standard)</option>
                          <option value={12}>12 Intervalles</option>
                          <option value={15}>15 Intervalles (Fidèle)</option>
                          <option value={20}>20 Intervalles (Haute-Fidélité)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-mono text-[10px] py-1 border border-slate-200 shadow-sm">
                        Échantillon : {histoStats.count} Lectures
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-6">
                    {histoBinsData.length === 0 ? (
                      <div className="py-16 text-center text-slate-400">
                        Aucune donnée disponible pour les filtres sélectionnés. Veuillez vérifier les données sur d'autres périodes ou d'autres capteurs.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Summary Stats Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 content-start">
                          <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Moyenne</span>
                            <span className="text-xl font-black tracking-tight text-slate-850 tabular-nums mt-1">
                              {histoStats.avg.toFixed(1)}
                              <span className="text-xs font-normal text-slate-400 ml-0.5">
                                {histoMetric === "temp" ? "°C" : "%"}
                              </span>
                            </span>
                          </div>
                          
                          <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Médiane</span>
                            <span className="text-xl font-black tracking-tight text-slate-850 tabular-nums mt-1">
                              {histoStats.median.toFixed(1)}
                              <span className="text-xs font-normal text-slate-400 ml-0.5">
                                {histoMetric === "temp" ? "°C" : "%"}
                              </span>
                            </span>
                          </div>

                          <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Min / Max</span>
                            <span className="text-sm font-black tracking-tight text-slate-850 tabular-nums mt-1.5 flex justify-between">
                              <span className="text-emerald-600 font-extrabold">{histoStats.min.toFixed(1)}</span>
                              <span className="text-slate-350">|</span>
                              <span className="text-rose-600 font-extrabold">{histoStats.max.toFixed(1)}</span>
                              <span className="text-[10px] font-normal text-slate-400 ml-0.5">
                                {histoMetric === "temp" ? "°C" : "%"}
                              </span>
                            </span>
                          </div>

                          <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Amplitude Thermique</span>
                            <span className="text-xl font-black tracking-tight text-orange-600 tabular-nums mt-1">
                              {(histoStats.max - histoStats.min).toFixed(1)}
                              <span className="text-xs font-normal text-slate-400 ml-0.5">
                                {histoMetric === "temp" ? "°C" : "%"}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Chart Area */}
                        <div className="lg:col-span-3 h-[300px] border border-slate-100 rounded-xl p-4 bg-slate-50/20 relative shadow-sm">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={histoBinsData} margin={{ left: -10, right: 10, bottom: 5, top: 5 }}>
                              {showChartGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.12)" />}
                              <XAxis 
                                dataKey="label" 
                                tick={{ fontSize: 9, fontWeight: 600 }} 
                                tickMargin={8} 
                                stroke="#94a3b8" 
                              />
                              <YAxis 
                                tick={{ fontSize: 10 }} 
                                stroke="#94a3b8" 
                                unit="%" 
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: "rgba(15, 23, 42, 0.95)", 
                                  borderRadius: "12px", 
                                  border: "none", 
                                  color: "#f8fafc", 
                                  fontSize: "11px",
                                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
                                }}
                                formatter={(value: any, name: any, props: any) => {
                                  if (name === "percentage") {
                                    const count = props.payload?.count ?? 0;
                                    return [`${value}% des lectures (${count} fois)`, "Proportion"];
                                  }
                                  return [value, name];
                                }}
                              />
                              <Bar 
                                dataKey="percentage" 
                                radius={[6, 6, 0, 0]}
                              >
                                {histoBinsData.map((entry, index) => (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={getBinColor(entry, histoMetric, histoSensor)}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* PAGE 2: LOGS DATABASE & EXPORT             */}
          {/* ========================================== */}
          {activeView === "logs" && (
            <div className="space-y-6 animate-fade-in">
              {/* Split Section */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
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

                {/* Exporter */}
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
                      className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                      Télécharger Excel (CSV)
                    </Button>
                  </CardContent>
                </Card>

                {/* Administration / Réinitialisation */}
                <Card className="border-slate-200 bg-white shadow-sm flex flex-col justify-between overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-full h-[4px] bg-red-500" />
                  <CardHeader className="pb-1 pt-4">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
                      Maintenance Système
                    </CardTitle>
                    <CardDescription className="text-slate-500 text-[10px] uppercase font-mono">
                      Réinitialisation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4 space-y-4 flex-1 flex flex-col justify-between pt-2">
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Supprimez tous les enregistrements de la base pour réinitialiser le séchoir solaire expérimental (nouvelle campagne).
                    </p>
                    <Button
                      onClick={handleDeleteAllData}
                      disabled={deleting}
                      variant="outline"
                      className={`w-full gap-2 font-bold text-xs uppercase cursor-pointer border transition-all duration-300 ${
                        deleteConfirm
                          ? "bg-red-50 border-red-300 text-red-600 hover:bg-red-100"
                          : "border-red-200 text-red-500 hover:bg-red-50"
                      }`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                      {deleting
                        ? "Suppression..."
                        : deleteConfirm
                        ? "Confirmer ?"
                        : "Réinitialiser les données"}
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

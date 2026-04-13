"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from "recharts";
import { 
  ChevronLeft, ChevronRight, BookOpen, Clock, Layers, Star, TrendingUp, Calendar
} from "lucide-react";

interface DailyStat {
  date: string;
  pages: number;
  minutes: number;
}

interface DistributionStat {
  label: string;
  value: number;
}

interface CurrentWorkProgress {
  id: number;
  title: string;
  thumbnail_url?: string;
  page_count: number;
  current_page: number;
  progress_percentage: number;
}

interface StatsData {
  summary: {
    total_books: int;
    finished_books: int;
    total_pages_period: int;
    total_minutes_period: int;
    average_rating: number;
  };
  daily_activity: DailyStat[];
  tag_distribution: DistributionStat[];
  rating_distribution: DistributionStat[];
  currently_reading: CurrentWorkProgress[];
}

type RangeType = "1m" | "3m" | "6m" | "1y" | "all";

export default function More() {
  const [rangeType, setRangeType] = useState<RangeType>("1m");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize dates
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  }, []);

  const fetchStats = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/stats?start_date=${startDate}&end_date=${endDate}`;
      const res = await fetch(url);
      if (res.ok) {
        const stats = await res.json();
        setData(stats);
      }
    } catch (err) {
      console.error("Failed to fetch stats", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [startDate, endDate]);

  const handleRangeChange = (type: RangeType) => {
    setRangeType(type);
    const end = new Date();
    const start = new Date();

    if (type === "all") {
      setStartDate("1970-01-01"); // Effectively all time
      setEndDate(end.toISOString().split('T')[0]);
      return;
    }

    const months = type === "1m" ? 1 : type === "3m" ? 3 : type === "6m" ? 6 : 12;
    start.setMonth(end.getMonth() - months);
    
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  };

  const shiftRange = (direction: "prev" | "next") => {
    if (rangeType === "all") return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const months = rangeType === "1m" ? 1 : rangeType === "3m" ? 3 : rangeType === "6m" ? 6 : 12;

    if (direction === "prev") {
      start.setMonth(start.getMonth() - months);
      end.setMonth(end.getMonth() - months);
    } else {
      start.setMonth(start.getMonth() + months);
      end.setMonth(end.getMonth() + months);
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const formattedRange = useMemo(() => {
    if (!startDate || !endDate) return "";
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const s = new Date(startDate).toLocaleDateString(undefined, options);
    const e = new Date(endDate).toLocaleDateString(undefined, options);
    return `${s} — ${e}`;
  }, [startDate, endDate]);

  const COLORS = ['#5E7153', '#768A6A', '#92A289', '#AEC0A8', '#CADCC7'];

  if (!data && loading) return <div style={{ textAlign: 'center', padding: '10rem 0' }}>Analyzing your library...</div>;

  return (
    <div className="fade-in-up">
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>Insights</span></h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>Your reading journey, quantified.</p>
      </header>

      {/* Date Controls */}
      <div className="date-control-bar">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            className="date-nav-btn" 
            onClick={() => shiftRange("prev")} 
            disabled={rangeType === "all"}
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="range-selector">
            {(["1m", "3m", "6m", "1y", "all"] as RangeType[]).map((type) => (
              <button
                key={type}
                className={`range-btn ${rangeType === type ? "active" : ""}`}
                onClick={() => handleRangeChange(type)}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>

          <button 
            className="date-nav-btn" 
            onClick={() => shiftRange("next")}
            disabled={rangeType === "all" || new Date(endDate) >= new Date()}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="current-range-display">
          {rangeType === "all" ? "All Time" : formattedRange}
        </div>
      </div>

      {data && (
        <>
          {/* Summary Cards */}
          <div className="stats-grid">
            <div className="stats-card">
              <span className="stats-label">Pages Read</span>
              <div className="stats-value">
                {data.summary.total_pages_period.toLocaleString()}
                <span className="stats-unit">pgs</span>
              </div>
              <div style={{ position: 'absolute', right: '1rem', bottom: '0.5rem', opacity: 0.1 }}>
                <BookOpen size={40} />
              </div>
            </div>

            <div className="stats-card">
              <span className="stats-label">Time Spent</span>
              <div className="stats-value">
                {Math.round(data.summary.total_minutes_period / 60)}
                <span className="stats-unit">hrs</span>
              </div>
              <div style={{ position: 'absolute', right: '1rem', bottom: '0.5rem', opacity: 0.1 }}>
                <Clock size={40} />
              </div>
            </div>

            <div className="stats-card">
              <span className="stats-label">Library Size</span>
              <div className="stats-value">
                {data.summary.total_books}
                <span className="stats-unit">books</span>
              </div>
              <div style={{ position: 'absolute', right: '1rem', bottom: '0.5rem', opacity: 0.1 }}>
                <Layers size={40} />
              </div>
            </div>

            <div className="stats-card">
              <span className="stats-label">Avg Rating</span>
              <div className="stats-value">
                {data.summary.average_rating || "—"}
                {data.summary.average_rating > 0 && <span className="stats-unit">/ 10</span>}
              </div>
              <div style={{ position: 'absolute', right: '1rem', bottom: '0.5rem', opacity: 0.1 }}>
                <Star size={40} />
              </div>
            </div>
          </div>

          {/* Activity Chart */}
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <h3 className="chart-title">Reading Activity</h3>
                <p className="chart-subtitle">Pages and minutes read across this period.</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: 10, height: 10, background: 'var(--accent)', borderRadius: 2 }} /> Pages
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: 10, height: 10, background: 'var(--muted)', borderRadius: 2 }} /> Minutes
                </div>
              </div>
            </div>
            
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily_activity}>
                  <defs>
                    <linearGradient id="colorPages" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis 
                    dataKey="date" 
                    hide={rangeType === "1y" || rangeType === "all"}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--muted)' }}
                    tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="custom-tooltip">
                            <p className="tooltip-date">{new Date(label).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                            <div className="tooltip-value" style={{ color: 'var(--accent)' }}>
                              <BookOpen size={12} /> {payload[0].value} pages
                            </div>
                            <div className="tooltip-value" style={{ color: 'var(--muted)' }}>
                              <Clock size={12} /> {payload[1]?.value} minutes
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="pages" 
                    stroke="var(--accent)" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorPages)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="minutes" 
                    stroke="var(--muted)" 
                    strokeWidth={1}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
            {/* Tag Distribution */}
            <div className="chart-card" style={{ marginBottom: 0 }}>
              <h3 className="chart-title">Top Genres</h3>
              <p className="chart-subtitle" style={{ marginBottom: '1.5rem' }}>Based on your tag distribution.</p>
              
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.tag_distribution.length > 0 ? data.tag_distribution : [{label: 'None', value: 0}]} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="label" 
                      type="category" 
                      width={80} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fontWeight: 500, fill: 'var(--foreground)' }} 
                    />
                    <Tooltip cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {data.tag_distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Rating Distribution */}
            <div className="chart-card" style={{ marginBottom: 0 }}>
              <h3 className="chart-title">Rating Curve</h3>
              <p className="chart-subtitle" style={{ marginBottom: '1.5rem' }}>How you've rated your library.</p>
              
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.rating_distribution.length > 0 ? data.rating_distribution : [{label: '?', value: 0}]}>
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                    <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Currently Reading */}
          {data.currently_reading.length > 0 && (
            <section style={{ marginBottom: '4rem' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <TrendingUp size={20} style={{ color: 'var(--accent)' }} /> 
                Currently Reading Progress
              </h2>
              
              <div className="progress-list">
                {data.currently_reading.map(book => (
                  <div key={book.id} className="progress-card">
                    {book.thumbnail_url ? (
                      <img src={book.thumbnail_url} alt={book.title} className="progress-thumb" />
                    ) : (
                      <div className="progress-thumb" style={{ background: 'var(--muted-background)', border: '1px solid var(--border)' }} />
                    )}
                    <div className="progress-info">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{book.title}</div>
                        <div className="progress-percent">{book.progress_percentage}%</div>
                      </div>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${book.progress_percentage}%` }} />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {book.current_page} of {book.page_count} pages
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Insights Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
            <div style={{ padding: '1.5rem', border: '1px dashed var(--border)', borderRadius: '16px', textAlign: 'center' }}>
              <Calendar size={24} style={{ color: 'var(--accent)', marginBottom: '0.75rem' }} />
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Daily Velocity</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {Math.round(data.summary.total_pages_period / (data.daily_activity.length || 1))} 
                <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--muted)', marginLeft: '0.25rem' }}>pgs/day</span>
              </div>
            </div>
            
            <div style={{ padding: '1.5rem', border: '1px dashed var(--border)', borderRadius: '16px', textAlign: 'center' }}>
              <Star size={24} style={{ color: 'var(--accent)', marginBottom: '0.75rem' }} />
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Books Finished</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{data.summary.finished_books} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--muted)', marginLeft: '0.25rem' }}>titles</span></div>
            </div>
          </div>
        </>
      )}

      {data && data.daily_activity.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '6rem 2rem', color: 'var(--muted)', fontStyle: 'italic' }}>
          No reading activity logged for this period. Start tracking in the Tracking tab!
        </div>
      )}
    </div>
  );
}

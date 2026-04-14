"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from "recharts";
import { 
  ChevronLeft, ChevronRight, BookOpen, Clock, Layers, Star, TrendingUp, Calendar, Book, Inbox, Zap, Timer
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
    total_books: number;
    finished_books: number;
    total_pages_period: number;
    total_minutes_period: number;
    average_rating: number;
    total_pages_all_time: number;
    total_minutes_all_time: number;
    total_sessions_all_time: number;
    tsundoku_count: number;
  };
  daily_activity: DailyStat[];
  tag_distribution: DistributionStat[];
  rating_distribution: DistributionStat[];
  currently_reading: CurrentWorkProgress[];
}

type RangeType = "1m" | "3m" | "6m" | "1y" | "all" | "custom";

export default function Stats() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [rangeType, setRangeType] = useState<RangeType>("1m");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const handleBookClick = (id: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("book_id", id.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  // Helper to get YYYY-MM-DD in local time
  const getLocalYMD = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Initialize dates
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setEndDate(getLocalYMD(end));
    setStartDate(getLocalYMD(start));
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
    
    if (type === "custom") {
      return;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (type === "all") {
      setStartDate("1970-01-01"); // Effectively all time
      setEndDate(getLocalYMD(now));
      return;
    }

    let start = new Date();
    let end = new Date();

    if (type === "1m") {
      start = new Date(currentYear, currentMonth, 1);
      end = new Date(currentYear, currentMonth + 1, 0);
    } else if (type === "3m") {
      const qMonth = currentMonth - (currentMonth % 3);
      start = new Date(currentYear, qMonth, 1);
      end = new Date(currentYear, qMonth + 3, 0);
    } else if (type === "6m") {
      const hMonth = currentMonth < 6 ? 0 : 6;
      start = new Date(currentYear, hMonth, 1);
      end = new Date(currentYear, hMonth + 6, 0);
    } else if (type === "1y") {
      start = new Date(currentYear, 0, 1);
      end = new Date(currentYear, 12, 0);
    }
    
    setEndDate(getLocalYMD(end));
    setStartDate(getLocalYMD(start));
  };

  const shiftRange = (direction: "prev" | "next") => {
    if (rangeType === "all" || rangeType === "custom") return;

    const [startYear, startMonth] = startDate.split('-').map(Number);
    const [endYear, endMonth] = endDate.split('-').map(Number);
    
    let sDate = new Date(startYear, startMonth - 1, 1);
    let eDate = new Date(endYear, endMonth - 1, 1);

    const months = rangeType === "1m" ? 1 : rangeType === "3m" ? 3 : rangeType === "6m" ? 6 : 12;

    if (direction === "prev") {
      sDate.setMonth(sDate.getMonth() - months);
      eDate.setMonth(eDate.getMonth() - months);
    } else {
      sDate.setMonth(sDate.getMonth() + months);
      eDate.setMonth(eDate.getMonth() + months);
    }

    // Set eDate to the last day of its month
    eDate = new Date(eDate.getFullYear(), eDate.getMonth() + 1, 0);

    setStartDate(getLocalYMD(sDate));
    setEndDate(getLocalYMD(eDate));
  };

  const formatDateHeader = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split('-').map(Number);
    // Create local date object to avoid UTC shift
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formattedRange = useMemo(() => {
    if (!startDate || !endDate) return "";
    
    if (rangeType === "1m") {
      const [y, m] = startDate.split('-').map(Number);
      const date = new Date(y, m - 1, 1);
      return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    }
    if (rangeType === "3m" || rangeType === "6m") {
      const [sy, sm] = startDate.split('-').map(Number);
      const [ey, em] = endDate.split('-').map(Number);
      const sDate = new Date(sy, sm - 1, 1);
      const eDate = new Date(ey, em - 1, 1);
      const sMonth = sDate.toLocaleDateString(undefined, { month: 'short' });
      const eMonth = eDate.toLocaleDateString(undefined, { month: 'short' });
      return `${sMonth} – ${eMonth} ${sy}`;
    }
    if (rangeType === "1y") {
      const [y] = startDate.split('-').map(Number);
      return String(y);
    }

    return `${formatDateHeader(startDate)} — ${formatDateHeader(endDate)}`;
  }, [startDate, endDate, rangeType]);

  const aggregationLevel = useMemo(() => {
    if (!data || data.daily_activity.length < 2) return "daily";
    const [y1, m1, d1] = data.daily_activity[0].date.split('-').map(Number);
    const [y2, m2, d2] = data.daily_activity[1].date.split('-').map(Number);
    const date1 = new Date(y1, m1 - 1, d1).getTime();
    const date2 = new Date(y2, m2 - 1, d2).getTime();
    const diffDays = Math.round((date2 - date1) / (1000 * 3600 * 24));
    
    if (diffDays >= 360) return "yearly";
    if (diffDays >= 28) return "monthly";
    return "daily";
  }, [data]);

  const COLORS = ['#5E7153', '#768A6A', '#92A289', '#AEC0A8', '#CADCC7'];

  if (!data && loading) return <div style={{ textAlign: 'center', padding: '10rem 0' }}>Analyzing your library...</div>;

  return (
    <div className="fade-in-up">
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>Insights</span></h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>Your reading journey, quantified.</p>
      </header>

      {data && (
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 className="section-label">Library Overview</h2>
          <div className="stats-grid">
            {/* Row 1 */}
            <div className="stats-card">
              <span className="stats-label">Total Books</span>
              <div className="stats-value">{data.summary.total_books}</div>
              <div style={{ position: 'absolute', right: '1rem', bottom: '0.5rem', opacity: 0.1 }}>
                <Book size={40} />
              </div>
            </div>

            <div className="stats-card">
              <span className="stats-label">Tsundoku</span>
              <div className="stats-value">{data.summary.tsundoku_count || 0}</div>
              <div style={{ position: 'absolute', right: '1rem', bottom: '0.5rem', opacity: 0.1 }}>
                <Inbox size={40} />
              </div>
            </div>

            <div className="stats-card">
              <span className="stats-label">Books Finished</span>
              <div className="stats-value">{data.summary.finished_books}</div>
              <div style={{ position: 'absolute', right: '1rem', bottom: '0.5rem', opacity: 0.1 }}>
                <Star size={40} />
              </div>
            </div>

            <div className="stats-card">
              <span className="stats-label">Average Rating</span>
              <div className="stats-value">
                {data.summary.average_rating || "—"}
                {data.summary.average_rating > 0 && <span className="stats-unit">/ 10</span>}
              </div>
              <div style={{ position: 'absolute', right: '1rem', bottom: '0.5rem', opacity: 0.1 }}>
                <TrendingUp size={40} />
              </div>
            </div>

            {/* Row 2 */}
            <div className="stats-card">
              <span className="stats-label">Total Pages</span>
              <div className="stats-value">
                {data.summary.total_pages_all_time?.toLocaleString() || "0"}
                <span className="stats-unit">pgs</span>
              </div>
              <div style={{ position: 'absolute', right: '1rem', bottom: '0.5rem', opacity: 0.1 }}>
                <BookOpen size={40} />
              </div>
            </div>

            <div className="stats-card">
              <span className="stats-label">Time Devoted</span>
              <div className="stats-value">
                {(data.summary.total_minutes_all_time || 0) > 1440 ? (
                  <>
                    {(data.summary.total_minutes_all_time / 1440).toFixed(1)}
                    <span className="stats-unit">days</span>
                  </>
                ) : (
                  <>
                    {Math.round((data.summary.total_minutes_all_time || 0) / 60)}
                    <span className="stats-unit">hrs</span>
                  </>
                )}
              </div>
              <div style={{ position: 'absolute', right: '1rem', bottom: '0.5rem', opacity: 0.1 }}>
                <Clock size={40} />
              </div>
            </div>

            <div className="stats-card">
              <span className="stats-label">Avg Pgs / Log</span>
              <div className="stats-value">
                {(data.summary.total_sessions_all_time || 0) > 0 
                  ? Math.round(data.summary.total_pages_all_time / data.summary.total_sessions_all_time) 
                  : 0
                }
              </div>
              <div style={{ position: 'absolute', right: '1rem', bottom: '0.5rem', opacity: 0.1 }}>
                <Zap size={40} />
              </div>
            </div>

            <div className="stats-card">
              <span className="stats-label">Avg Mins / Log</span>
              <div className="stats-value">
                {(data.summary.total_sessions_all_time || 0) > 0 
                  ? Math.round(data.summary.total_minutes_all_time / data.summary.total_sessions_all_time) 
                  : 0
                }
              </div>
              <div style={{ position: 'absolute', right: '1rem', bottom: '0.5rem', opacity: 0.1 }}>
                <Timer size={40} />
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="thin-divider" style={{ margin: '3rem 0' }} />

      <h2 className="section-label">Period Performance</h2>
      
      {/* Date Controls */}
      <div className="date-control-bar">
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            className="date-nav-btn" 
            onClick={() => shiftRange("prev")} 
            disabled={rangeType === "all" || rangeType === "custom"}
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="range-selector">
            {(["1m", "3m", "6m", "1y", "all", "custom"] as RangeType[]).map((type) => (
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
            disabled={(() => {
              if (rangeType === "all" || rangeType === "custom") return true;
              if (!endDate) return true;
              const [ey, em] = endDate.split('-').map(Number);
              const now = new Date();
              return ey > now.getFullYear() || (ey === now.getFullYear() && em >= now.getMonth() + 1);
            })()}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="current-range-display">
          {rangeType === "custom" ? (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                style={{ background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
              />
              <span style={{ margin: '0 0.5rem' }}>—</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                style={{ background: 'var(--background)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
              />
            </div>
          ) : (
            rangeType === "all" ? "All Time" : formattedRange
          )}
        </div>
      </div>

      {data && (
        <>
          {/* Summary Cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
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
              <span className="stats-label">Velocity</span>
              <div className="stats-value">
                {Math.round(data.summary.total_pages_period / (data.daily_activity.length || 1))} 
                <span className="stats-unit">pgs/day</span>
              </div>
              <div style={{ position: 'absolute', right: '1rem', bottom: '0.5rem', opacity: 0.1 }}>
                <Calendar size={40} />
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
            
            <div style={{ width: '100%', height: 300, minHeight: 300 }}>
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
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--muted)' }}
                    tickFormatter={(val) => {
                      const [y, m, d] = String(val).split('-').map(Number);
                      const date = new Date(y, m - 1, d);
                      if (aggregationLevel === "yearly") {
                        return date.toLocaleDateString(undefined, { year: 'numeric' });
                      }
                      if (aggregationLevel === "monthly") {
                        return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                      }
                      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    }}
                    minTickGap={aggregationLevel === "daily" ? 30 : 10}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length && label) {
                        return (
                          <div className="custom-tooltip">
                            <p className="tooltip-date">
                              {(() => {
                                const [y, m, d] = String(label).split('-').map(Number);
                                const date = new Date(y, m - 1, d);
                                if (aggregationLevel === "yearly") {
                                  return date.toLocaleDateString(undefined, { year: 'numeric' });
                                }
                                if (aggregationLevel === "monthly") {
                                  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                                }
                                return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
                              })()}
                            </p>
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
              
              <div style={{ width: '100%', height: 200, minHeight: 200 }}>
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
              
              <div style={{ width: '100%', height: 200, minHeight: 200 }}>
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
                  <div key={book.id} className="progress-card" onClick={() => handleBookClick(book.id)} style={{ cursor: 'pointer' }}>
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

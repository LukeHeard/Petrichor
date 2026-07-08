"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TrendingUp, Clock, BookOpen, Flame } from "lucide-react";

interface CurrentWorkProgress {
  id: number;
  title: string;
  thumbnail_url?: string;
  page_count: number;
  current_page: number;
  progress_percentage: number;
}

interface ReadingSession {
  id: number;
  date: string;
  start_page: number;
  end_page: number;
  minutes_read: number;
  work_id: number;
  work_title: string;
  work_thumbnail_url?: string;
}

function HomeContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [currentlyReading, setCurrentlyReading] = useState<CurrentWorkProgress[]>([]);
  const [recentActivity, setRecentActivity] = useState<ReadingSession[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const handleBookClick = (id: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("book_id", id.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch stats independently
        try {
          const statsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stats`);
          if (statsRes.ok) {
            const statsData = await statsRes.json();
            console.log("Stats data received:", statsData);
            setCurrentlyReading(statsData.currently_reading || []);
            setCurrentStreak(statsData.summary?.current_streak_days || 0);
          } else {
            console.error("Stats fetch failed with status:", statsRes.status);
          }
        } catch (err) {
          console.error("Error fetching stats:", err);
        }

        // Fetch sessions independently
        try {
          const sessionsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sessions`);
          if (sessionsRes.ok) {
            const sessionsData = await sessionsRes.json();
            // Filter for last 7 days
            const now = new Date();
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7);
            
            const filtered = sessionsData
              .filter((s: ReadingSession) => new Date(s.date) >= sevenDaysAgo)
              .sort((a: ReadingSession, b: ReadingSession) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            setRecentActivity(filtered);
          } else {
            console.error("Sessions fetch failed with status:", sessionsRes.status);
          }
        } catch (err) {
          console.error("Error fetching sessions:", err);
        }
      } catch (err) {
        console.error("Unexpected error in fetchData:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    
    // Normalize to midnight for day comparison
    const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  return (
    <div className="fade-in-up">
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>Home</span></h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>"Maybe home is nothing but two planks of wood laid across a fire." — C.S. Lewis</p>
        </div>
        {!loading && currentStreak > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
            <Flame size={18} />
            {currentStreak} day{currentStreak === 1 ? "" : "s"} streak
          </div>
        )}
      </header>

      <section>
        <h2 className="section-label">Currently Reading</h2>
        <div className="thin-divider" style={{ marginTop: 0 }} />

        {loading ? (
          <div style={{ padding: '2rem 0' }}>
            <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Gathering your books...</p>
          </div>
        ) : currentlyReading.length > 0 ? (
          <div className="home-reading-list">
            {currentlyReading.map(book => (
              <div key={book.id} className="home-reading-card" onClick={() => handleBookClick(book.id)} style={{ cursor: 'pointer' }}>
                {book.thumbnail_url ? (
                  <img src={book.thumbnail_url.startsWith('/uploads') ? `${process.env.NEXT_PUBLIC_API_URL}${book.thumbnail_url}` : book.thumbnail_url} alt={book.title} className="home-reading-thumb" />
                ) : (
                  <div className="home-reading-thumb" style={{ background: 'var(--muted-background)', border: '1px solid var(--border)' }} />
                )}
                <div className="home-reading-info">
                  <div className="home-reading-title">{book.title}</div>
                  <div className="home-reading-progress-text">
                    {book.current_page} of {book.page_count} pages • {book.progress_percentage}% completed
                  </div>
                  <div className="home-progress-bar-container">
                    <div className="home-progress-bar-fill" style={{ width: `${book.progress_percentage}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '2rem 0' }}>
            <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Quiet in the library. Nothing being read.</p>
          </div>
        )}
      </section>

      <section style={{ marginTop: '5rem' }}>
        <h2 className="section-label">Recent Activity</h2>
        <div className="thin-divider" style={{ marginTop: 0 }} />
        
        {loading ? (
             <div style={{ padding: '2rem 0' }}>
               <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Reviewing logs...</p>
             </div>
        ) : recentActivity.length > 0 ? (
          <div className="activity-feed">
            {recentActivity.map(session => (
              <div key={session.id} className="activity-item" onClick={() => handleBookClick(session.work_id)} style={{ cursor: 'pointer' }}>
                {session.work_thumbnail_url ? (
                   <img src={session.work_thumbnail_url.startsWith('/uploads') ? `${process.env.NEXT_PUBLIC_API_URL}${session.work_thumbnail_url}` : session.work_thumbnail_url} alt="" className="activity-thumb" />
                ) : (
                   <div className="activity-thumb" style={{ background: 'var(--border)' }} />
                )}
                <div className="activity-content">
                  <div className="activity-text">
                    Read <b style={{ color: 'var(--accent)' }}>{session.end_page - session.start_page} pages</b> in <span className="activity-work-links">{session.work_title}</span>
                  </div>
                  <div className="activity-meta">
                    {formatDate(session.date)} • {session.minutes_read} minutes
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '2rem 0' }}>
            <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No activity in the last 7 days.</p>
          </div>
        )}
      </section>

    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

"use client";

import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";

interface CurrentWorkProgress {
  id: number;
  title: string;
  thumbnail_url?: string;
  page_count: number;
  current_page: number;
  progress_percentage: number;
}

export default function Home() {
  const [currentlyReading, setCurrentlyReading] = useState<CurrentWorkProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCurrentlyReading = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stats`);
        if (res.ok) {
          const data = await res.json();
          setCurrentlyReading(data.currently_reading || []);
        }
      } catch (err) {
        console.error("Failed to fetch currently reading", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentlyReading();
  }, []);

  return (
    <div className="fade-in-up">
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>Home</span></h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>"Maybe home is nothing but two planks of wood laid across a fire." — C.S. Lewis</p>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column' }}>
        <h2 className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          Currently Reading
          {currentlyReading.length > 0 && <TrendingUp size={16} style={{ color: 'var(--accent)', opacity: 0.8 }} />}
        </h2>
        <div className="thin-divider" style={{ marginTop: 0 }} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Loading your progress...</p>
          </div>
        ) : currentlyReading.length > 0 ? (
          <div className="progress-list" style={{ marginTop: '1.5rem' }}>
            {currentlyReading.map(book => (
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
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>You aren't reading anything right now.</p>
          </div>
        )}
      </section>

      <section style={{ marginTop: '3rem' }}>
        <h2 className="section-label">Recent Activity</h2>
        <div className="thin-divider" style={{ marginTop: 0 }} />
        <div style={{ padding: '1rem 0' }}>
          <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No recent activity to show.</p>
        </div>
      </section>
      
    </div>
  );
}

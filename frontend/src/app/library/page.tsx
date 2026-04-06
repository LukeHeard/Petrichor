"use client";

import { useEffect, useState, useCallback } from "react";

interface Work {
  id: number;
  title: string;
  openlibrary_id?: string;
}

export default function Library() {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works`);
      if (response.ok) {
        const data = await response.json();
        setWorks(data);
      }
    } catch (err) {
      console.error("Failed to fetch works", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorks();

    const handleWorkAdded = () => {
      fetchWorks();
    };

    window.addEventListener("petrichor:workAdded", handleWorkAdded);
    return () => window.removeEventListener("petrichor:workAdded", handleWorkAdded);
  }, [fetchWorks]);

  return (
    <div>
      <header style={{ marginBottom: '3rem' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>Library</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>All Books</p>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="thin-divider" style={{ marginTop: 0 }} />

        {loading ? (
          <p style={{ textAlign: 'center', margin: '3rem 0', color: 'var(--muted)', fontStyle: 'italic' }}>Loading library...</p>
        ) : works.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Your library is currently empty.</p>
          </div>
        ) : (
          <div>
            {works.map((work) => (
              <div key={work.id} className="book-row">
                <div>
                  <h3 className="font-serif">{work.title}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                    Entry #{work.id} {work.openlibrary_id && `· OL: ${work.openlibrary_id}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

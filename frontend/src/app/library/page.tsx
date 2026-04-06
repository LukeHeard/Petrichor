"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import BookCard from "@/components/BookCard";

interface Work {
  id: number;
  title: string;
  openlibrary_id?: string;
  author?: string; // We'll need to fetch authors too for a better experience
}

function LibraryContent() {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works`);
      if (response.ok) {
        const data = await response.json();
        // For now, let's just use the data as is. 
        // In a real app, we'd fetch author names linked to these works.
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
        <h1 style={{ marginBottom: '0.25rem' }}>Petrichor <span style={{ opacity: 0.5, fontWeight: 400 }}>Library</span></h1>
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
          <div className="library-grid">
            {works.map((work) => (
              <BookCard 
                key={work.id}
                id={work.id}
                title={work.title}
                openlibrary_id={work.openlibrary_id}
                author={work.author}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function Library() {
  return (
    <Suspense fallback={null}>
      <LibraryContent />
    </Suspense>
  );
}

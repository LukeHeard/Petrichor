"use client";

import { useEffect, useState, useCallback } from "react";
import AddWorkModal from "../components/AddWorkModal";

interface Work {
  id: number;
  title: string;
  openlibrary_id?: string;
}

export default function Home() {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);

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
  }, [fetchWorks]);

  return (
    <div>
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Petrichor</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>Book Journal & Library</p>
        </div>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
          <h2 className="section-label" style={{ marginBottom: 0 }}>Existing Books</h2>
          <button className="btn-ghost" onClick={() => setIsModalOpen(true)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            + Add Book
          </button>
        </div>

        <div className="thin-divider" style={{ marginTop: 0 }} />

        {loading ? (
          <p style={{ textAlign: 'center', margin: '3rem 0', color: 'var(--muted)', fontStyle: 'italic' }}>Loading library...</p>
        ) : works.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p style={{ color: 'var(--muted)', marginBottom: '2rem', fontStyle: 'italic' }}>Your library is currently empty.</p>
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
              Add your first book
            </button>
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
                <div style={{ color: 'var(--muted)', alignSelf: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick stats / Highlights */}
      <section style={{ marginTop: '4rem' }}>
        <h2 className="section-label">Reading Now</h2>
        <div className="thin-divider" />
        <div style={{ padding: '1rem 0' }}>
          <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No active reading sessions.</p>
        </div>
      </section>
      
      <AddWorkModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onWorkAdded={fetchWorks} 
      />
    </div>
  );
}

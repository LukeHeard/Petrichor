"use client";

import { useEffect, useState, useCallback } from "react";
import AddWorkModal from "../components/AddWorkModal";

interface Work {
  id: number;
  title: string;
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
    <div style={{ padding: '1rem 0' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', color: 'var(--accent)', marginBottom: '0.5rem' }}>Petrichor</h1>
        <p style={{ color: 'var(--muted)', fontSize: '1.1rem' }}>Personal Library & Reading Tracking</p>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem' }}>Existing Books</h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ 
            background: 'var(--accent)', 
            color: 'var(--accent-foreground)', 
            border: 'none', 
            padding: '0.5rem 1rem', 
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer'
           }}>
            + Add Book
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', margin: '2rem 0', color: 'var(--muted)' }}>Loading your library...</p>
        ) : works.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>No books found. Start by adding one!</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              style={{ 
              background: 'transparent', 
              color: 'var(--accent)', 
              border: '2px solid var(--accent)', 
              padding: '0.5rem 1.5rem', 
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer'
            }}>
              Create First Book
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {works.map((work) => (
              <div key={work.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem' }}>{work.title}</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>WEMI Hierarchy: Work #{work.id}</p>
                </div>
                <div style={{ color: 'var(--accent)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick stats / Highlights */}
      <section style={{ marginTop: '3rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Reading Now</h2>
        <div className="card" style={{ background: 'var(--muted-background)', border: 'none' }}>
          <p style={{ color: 'var(--muted)', textAlign: 'center' }}>No active reading sessions.</p>
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

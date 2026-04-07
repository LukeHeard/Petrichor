"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface FullWork {
  id: number;
  title: string;
  openlibrary_id?: string;
  first_publish_year?: number;
}

export default function GlobalBookModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const bookId = searchParams.get("book_id");
  
  const [book, setBook] = useState<FullWork | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (bookId) {
      setLoading(true);
      setIsDeleting(false);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${bookId}`)
        .then(res => res.json())
        .then(data => setBook(data))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setBook(null);
    }
  }, [bookId]);

  if (!bookId) return null;

  const closeModal = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("book_id");
    const query = newParams.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'color-mix(in srgb, var(--background) 90%, transparent)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 3000, padding: '1rem'
    }}>
      <div style={{ 
        width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--background)',
        border: '1px solid var(--border)',
        padding: '2rem',
        borderRadius: '8px',
        position: 'relative'
      }}>
        <button onClick={closeModal} style={{ position: 'absolute', top: '1rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.5rem', lineHeight: 1 }}>&times;</button>
        
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontStyle: 'italic', margin: '3rem 0' }}>Loading details...</p>
        ) : book ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Removed cover section per user request */}
            
            <h2 className="font-serif" style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '0.25rem' }}>{book.title}</h2>
            {book.first_publish_year && (
              <p style={{ fontSize: '0.9rem', color: 'var(--muted)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                First published {book.first_publish_year}
              </p>
            )}
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '2rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
               ID: {book.id} {book.openlibrary_id && `| OLID: ${book.openlibrary_id}`}
            </p>

            <div className="thin-divider" />

            <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center' }}>Additional tracking details going here soon (Wishlist, ratings, format, etc).</p>
              
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                {!isDeleting ? (
                  <button 
                    onClick={() => setIsDeleting(true)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      color: 'var(--muted)',
                      padding: '0.5rem 1.25rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease',
                      fontFamily: 'var(--font-sans)',
                      letterSpacing: '0.02em'
                    }}
                    onMouseEnter={(e) => { 
                      e.currentTarget.style.color = '#ff4444'; 
                      e.currentTarget.style.borderColor = 'color-mix(in srgb, #ff4444 30%, transparent)';
                      e.currentTarget.style.backgroundColor = 'color-mix(in srgb, #ff4444 5%, transparent)';
                    }}
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.color = 'var(--muted)'; 
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Remove from Library
                  </button>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: '1rem',
                    padding: '1.5rem',
                    backgroundColor: 'color-mix(in srgb, #ff4444 5%, transparent)',
                    borderRadius: '8px',
                    border: '1px solid color-mix(in srgb, #ff4444 20%, transparent)',
                    width: '100%',
                    animation: 'fadeInUp 0.3s ease'
                  }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--foreground)' }}>Remove this work from library?</p>
                    <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                      <button 
                        onClick={() => setIsDeleting(false)}
                        className="btn-ghost"
                        style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${book.id}`, { method: 'DELETE' });
                            if (res.ok) {
                              window.dispatchEvent(new Event("petrichor:workAdded")); 
                              closeModal();
                              setIsDeleting(false);
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        style={{ 
                          flex: 1, 
                          padding: '0.5rem', 
                          fontSize: '0.85rem',
                          backgroundColor: '#b91c1c',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        Yes, Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
          </div>
        ) : (
           <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Could not load book.</p>
        )}
      </div>
    </div>
  );
}

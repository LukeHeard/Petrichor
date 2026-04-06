"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

interface FullWork {
  id: number;
  title: string;
  openlibrary_id?: string;
}

export default function GlobalBookModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const bookId = searchParams.get("book_id");
  
  const [book, setBook] = useState<FullWork | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bookId) {
      setLoading(true);
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
            {book.openlibrary_id ? (
              <div style={{ position: 'relative', width: '180px', height: '270px', marginBottom: '2rem', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <Image 
                  src={`https://covers.openlibrary.org/b/olid/${book.openlibrary_id}-L.jpg`} 
                  alt={book.title}
                  fill
                  style={{ objectFit: 'cover' }}
                />
              </div>
            ) : (
                <div style={{ width: '180px', height: '270px', marginBottom: '2rem', borderRadius: '4px', backgroundColor: 'var(--muted-background)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center' }}>
                    <span className="font-serif" style={{ color: 'var(--muted)', fontSize: '1.2rem' }}>No Cover</span>
                </div>
            )}
            
            <h2 className="font-serif" style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '0.25rem' }}>{book.title}</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '2rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
               ID: {book.id} {book.openlibrary_id && `| OLID: ${book.openlibrary_id}`}
            </p>

            <div className="thin-divider" />

            <div style={{ alignSelf: 'stretch' }}>
              <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center' }}>Additional tracking details going here soon (Wishlist, ratings, format, etc).</p>
            </div>
            
          </div>
        ) : (
           <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Could not load book.</p>
        )}
      </div>
    </div>
  );
}

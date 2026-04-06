"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

interface FullWork {
  id: number;
  title: string;
  openlibrary_id?: string;
  cover_id?: string;
  author?: string;
}

export default function GlobalBookModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const bookId = searchParams.get("book_id");
  
  const [book, setBook] = useState<FullWork | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [availableCovers, setAvailableCovers] = useState<string[]>([]);
  const [loadingCovers, setLoadingCovers] = useState(false);

  useEffect(() => {
    if (bookId) {
      setLoading(true);
      setShowCoverPicker(false);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${bookId}`)
        .then(res => res.json())
        .then(data => setBook(data))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setBook(null);
    }
  }, [bookId]);

  const handleOpenCoverPicker = async () => {
    if (!bookId) return;
    setShowCoverPicker(true);
    setLoadingCovers(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${bookId}/editions`);
      if (!res.ok) throw new Error("Failed to fetch editions");
      const data = await res.json();
      setAvailableCovers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCovers(false);
    }
  };

  const selectNewCover = async (newCoverId: string) => {
    if (!bookId) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_id: newCoverId })
      });
      if (!res.ok) throw new Error("Failed to update cover");
      const updatedBook = await res.json();
      setBook(updatedBook);
      setShowCoverPicker(false);
      
      // Trigger a global refresh so the library grid updates
      window.dispatchEvent(new Event("petrichor:workAdded"));
    } catch (err) {
      console.error(err);
    }
  };

  if (!bookId) return null;

  const closeModal = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete("book_id");
    const query = newParams.toString();
    router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  };

  const getCoverUrl = (cid: string) => {
    if (!cid) return null;
    if (/^\d+$/.test(cid)) {
      return `https://covers.openlibrary.org/b/id/${cid}-L.jpg`;
    }
    return `https://covers.openlibrary.org/b/olid/${cid}-L.jpg`;
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
        width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--background)',
        border: '1px solid var(--border)',
        padding: '2.5rem',
        borderRadius: '12px',
        position: 'relative'
      }}>
        <button onClick={closeModal} style={{ position: 'absolute', top: '1.25rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.5rem', lineHeight: 1 }}>&times;</button>
        
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontStyle: 'italic', margin: '3rem 0' }}>Loading details...</p>
        ) : book ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {!showCoverPicker ? (
              <>
                <div 
                  onClick={handleOpenCoverPicker}
                  style={{ 
                    position: 'relative', width: '200px', height: '300px', marginBottom: '2rem', 
                    borderRadius: '4px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    cursor: 'pointer', group: 'true'
                  } as any}
                >
                  {book.cover_id ? (
                    <Image 
                      src={getCoverUrl(book.cover_id)!} 
                      alt={book.title}
                      fill
                      style={{ objectFit: 'cover' }}
                      priority
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--muted-background)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '1rem' }}>
                      <span className="font-serif" style={{ color: 'var(--muted)' }}>No Cover Found</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', opacity: 0.8 }}>Click to Change Cover</div>
                </div>

                <h2 className="font-serif" style={{ fontSize: '1.75rem', textAlign: 'center', marginBottom: '0.5rem' }}>{book.title}</h2>
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '2.5rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
                   {book.author || "Unknown Author"}
                </p>

                <div className="thin-divider" style={{ marginBottom: '2rem' }} />

                <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <button className="btn-ghost" style={{ width: '100%', padding: '1rem' }}>Add to Wishlist</button>
                  <button className="btn-ghost" style={{ width: '100%', padding: '1rem' }}>Log Reading Session</button>
                </div>
              </>
            ) : (
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                  <button onClick={() => setShowCoverPicker(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8rem', marginRight: '1rem' }}>&larr; Back</button>
                  <h3 className="font-serif" style={{ margin: 0 }}>Select Cover</h3>
                </div>

                {loadingCovers ? (
                  <p style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--muted)', fontStyle: 'italic' }}>Fetching all available covers...</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    {availableCovers.map((cid, i) => (
                      <div 
                        key={i} 
                        onClick={() => selectNewCover(cid)}
                        style={{ 
                          position: 'relative', width: '100%', aspectRatio: '2/3', 
                          borderRadius: '4px', overflow: 'hidden', cursor: 'pointer',
                          border: book.cover_id === cid ? '2px solid var(--accent)' : '1px solid var(--border)'
                        }}
                      >
                        <Image 
                          src={getCoverUrl(cid)!} 
                          alt="Edition Cover"
                          fill
                          sizes="100px"
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                    ))}
                    {availableCovers.length === 0 && (
                      <p style={{ gridColumn: 'span 3', textAlign: 'center', color: 'var(--muted)', padding: '2rem 0' }}>No other covers found.</p>
                    )}
                  </div>
                )}
              </div>
            )}
            
          </div>
        ) : (
           <p style={{ textAlign: 'center', color: 'var(--muted)' }}>Could not load book details.</p>
        )}
      </div>
    </div>
  );
}

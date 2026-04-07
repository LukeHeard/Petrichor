"use client";

import { useState, useEffect } from "react";
import BookDetailsContent from "./BookDetailsContent";

interface AddWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkAdded: () => void;
}

interface SearchResult {
  title: string;
  author: string;
  first_publish_year?: number;
  openlibrary_id?: string;
  description?: string;
  page_count?: number;
  rating_average?: number;
  rating_count?: number;
}

export default function AddWorkModal({ isOpen, onClose, onWorkAdded }: AddWorkModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [existingOlids, setExistingOlids] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [previewWork, setPreviewWork] = useState<any | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Fetch current library to check for duplicates
  const fetchLibraryIds = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works`);
      if (res.ok) {
        const data = await res.json();
        const ids = new Set(data.map((w: any) => w.openlibrary_id).filter(Boolean));
        setExistingOlids(ids as Set<string>);
      }
    } catch (err) {
      console.error("Failed to fetch existing library IDs", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLibraryIds();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setHasSearched(false);
    setIsSearching(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data);
      setHasSearched(true);
    } catch (err: any) {
      setError("Failed to search OpenLibrary.");
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handlePreview = async (result: SearchResult) => {
    setPreviewWork({ ...result, description: "" });
    setIsPreviewLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/enrich/${encodeURIComponent(result.openlibrary_id || "")}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewWork({ ...result, description: data.description });
      }
    } catch (err) {
      console.error("Failed to enrich work", err);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const selectResult = async (result: SearchResult) => {
    setIsSearching(true); // Borrowing to show loading state
    setError("");

    try {
      // 1. Create the Author
      let authorId = null;
      if (result.author) {
         const authorRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/authors`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ name: result.author })
         });
         if (!authorRes.ok) throw new Error("Failed to create author");
         const authorData = await authorRes.json();
         authorId = authorData.id;
      }

      // 2. Create the Work
      const workRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: result.title, 
          openlibrary_id: result.openlibrary_id || null,
          first_publish_year: result.first_publish_year || 0,
          description: result.description || "",
          page_count: result.page_count || 0,
          rating_average: result.rating_average || 0,
          rating_count: result.rating_count || 0
        })
      });
      if (!workRes.ok) throw new Error("Failed to add book");
      const workData = await workRes.json();

      // 3. Link Author to Work
      if (authorId) {
          const linkRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${workData.id}/authors/${authorId}`, {
              method: 'POST'
          });
          if (!linkRes.ok) throw new Error("Failed to link author to book");
      }

      // Success
      setSearchQuery("");
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setPreviewWork(null);
      onWorkAdded();
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setIsSearching(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.8rem',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--foreground)',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'color-mix(in srgb, var(--background) 90%, transparent)',
      backdropFilter: 'blur(5px)',
      WebkitBackdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: '1rem'
    }}>
      <div style={{ 
        width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--background)',
        border: '1px solid var(--border)',
        padding: '2rem 1.5rem',
        borderRadius: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {previewWork && (
              <button 
                onClick={() => setPreviewWork(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: '0.5rem 0' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
            )}
            <h2 className="font-serif" style={{ fontSize: '1.5rem', marginTop: 0, marginBottom: 0 }}>
              {previewWork ? "Book Preview" : "Find Book"}
            </h2>
          </div>
          <button onClick={() => {
            setSearchQuery("");
            setSearchResults([]);
            setError("");
            setPreviewWork(null);
            onClose();
          }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.5rem', lineHeight: 1 }}>&times;</button>
        </div>

        {error && <div style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.9rem', fontStyle: 'italic' }}>{error}</div>}

        <div style={{ position: 'relative', overflow: 'hidden', minHeight: '200px' }}>
          {!previewWork ? (
            <div className="fade-in-up">
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <input 
                  type="text" 
                  placeholder="Title, author, or ISBN..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  style={inputStyle}
                />
                <button type="submit" className="btn-primary" style={{ opacity: isSearching ? 0.7 : 1 }} disabled={isSearching}>
                  {isSearching ? "..." : "Search"}
                </button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {searchResults.map((res, i) => (
                  <div key={i} className="book-row" style={{ padding: '0.75rem 0.75rem', cursor: 'pointer' }} onClick={() => handlePreview(res)}>
                    <div style={{ pointerEvents: 'none' }}>
                      <h3 className="font-serif" style={{ fontSize: '1.1rem', margin: 0 }}>{res.title}</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>
                        {res.author} {res.first_publish_year ? `(${res.first_publish_year})` : ''}
                      </p>
                    </div>
                    {res.openlibrary_id && existingOlids.has(res.openlibrary_id) ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic', padding: '0.3rem 0.75rem', border: '1px solid transparent' }}>
                        In Library
                      </span>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); selectResult(res); }} 
                        className="btn-ghost" 
                        style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }} 
                        disabled={isSearching}
                      >
                        Add
                      </button>
                    )}
                  </div>
                ))}
                {searchResults.length === 0 && !isSearching && hasSearched && (
                  <p style={{ textAlign: 'center', color: 'var(--muted)', marginTop: '2rem', fontStyle: 'italic' }}>No results found.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="fade-in-up">
              <BookDetailsContent 
                book={previewWork} 
                isLoading={isPreviewLoading} 
                actions={
                  <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                    {previewWork.openlibrary_id && existingOlids.has(previewWork.openlibrary_id) ? (
                      <p style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Already in Library</p>
                    ) : (
                      <button 
                        onClick={() => selectResult(previewWork)} 
                        className="btn-primary"
                        style={{ width: '100%', padding: '0.8rem' }}
                        disabled={isSearching}
                      >
                        {isSearching ? "Adding..." : "Add to Library"}
                      </button>
                    )}
                  </div>
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

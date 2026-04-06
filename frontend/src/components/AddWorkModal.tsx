"use client";

import { useState } from "react";

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
}

export default function AddWorkModal({ isOpen, onClose, onWorkAdded }: AddWorkModalProps) {
  const [step, setStep] = useState<"search" | "form">("search");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [openlibraryId, setOpenlibraryId] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data);
    } catch (err: any) {
      setError("Failed to search OpenLibrary.");
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectResult = (result: SearchResult) => {
    setTitle(result.title);
    setAuthor(result.author);
    setOpenlibraryId(result.openlibrary_id || "");
    setStep("form");
    setError("");
  };

  const resetAndClose = () => {
    setStep("search");
    setSearchQuery("");
    setSearchResults([]);
    setTitle("");
    setAuthor("");
    setOpenlibraryId("");
    setError("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Create the Author
      let authorId = null;
      if (author.trim()) {
         const authorRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/authors`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ name: author })
         });
         if (!authorRes.ok) throw new Error("Failed to create author");
         const authorData = await authorRes.json();
         authorId = authorData.id;
      }

      // 2. Create the Work
      const workRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, openlibrary_id: openlibraryId || null })
      });
      if (!workRes.ok) throw new Error("Failed to create book");
      const workData = await workRes.json();

      // 3. Link Author to Work
      if (authorId) {
          const linkRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${workData.id}/authors/${authorId}`, {
              method: 'POST'
          });
          if (!linkRes.ok) throw new Error("Failed to link author to book");
      }

      // Success
      onWorkAdded();
      resetAndClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
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
        padding: '2rem',
        borderRadius: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'flex-start' }}>
          <h2 className="font-serif" style={{ fontSize: '1.5rem', marginTop: 0 }}>
            {step === "search" ? "Find Book" : "Confirm Details"}
          </h2>
          <button onClick={resetAndClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.5rem', lineHeight: 1 }}>&times;</button>
        </div>

        {error && <div style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.9rem', fontStyle: 'italic' }}>{error}</div>}

        {step === "search" ? (
          <div>
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
                <div key={i} className="book-row" style={{ padding: '0.75rem 0' }}>
                  <div>
                    <h3 className="font-serif" style={{ fontSize: '1.1rem', margin: 0 }}>{res.title}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>
                      {res.author} {res.first_publish_year ? `(${res.first_publish_year})` : ''}
                    </p>
                  </div>
                  <button onClick={() => selectResult(res)} className="btn-ghost" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}>
                    Select
                  </button>
                </div>
              ))}
              {searchResults.length === 0 && !isSearching && searchQuery && (
                <p style={{ textAlign: 'center', color: 'var(--muted)', marginTop: '2rem', fontStyle: 'italic' }}>No results found.</p>
              )}
            </div>

            <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
              <button onClick={() => setStep("form")} style={{ background: 'none', border: 'none', color: 'var(--muted)', textDecoration: 'underline', textUnderlineOffset: '4px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.85rem' }}>
                Or enter details manually
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Author (Optional)</label>
              <input type="text" value={author} onChange={e => setAuthor(e.target.value)} style={inputStyle} />
            </div>
            {openlibraryId && (
              <div>
                 <p style={{ fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic' }}>Linked: OL ID {openlibraryId}</p>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
              <button type="button" onClick={() => setStep("search")} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', textDecoration: 'none', fontSize: '0.85rem' }}>
                &larr; Back
              </button>
              <button type="submit" className="btn-primary" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Saving...' : 'Save Book'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

interface AddWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkAdded: () => void;
}

export default function AddWorkModal({ isOpen, onClose, onWorkAdded }: AddWorkModalProps) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

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
        body: JSON.stringify({ title })
      });
      if (!workRes.ok) throw new Error("Failed to create work");
      const workData = await workRes.json();

      // 3. Link Author to Work (if author was provided)
      if (authorId) {
          const linkRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${workData.id}/authors/${authorId}`, {
              method: 'POST'
          });
          if (!linkRes.ok) throw new Error("Failed to link author to work");
      }

      // Success
      setTitle("");
      setAuthor("");
      onWorkAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '1rem'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginTop: 0 }}>Add New Book</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.5rem', lineHeight: 1 }}>&times;</button>
        </div>

        {error && <div style={{ color: 'red', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--card-border)',
                background: 'var(--background)',
                color: 'var(--foreground)'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Author (Optional)</label>
            <input 
              type="text" 
              value={author} 
              onChange={e => setAuthor(e.target.value)} 
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--card-border)',
                background: 'var(--background)',
                color: 'var(--foreground)'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
            <button 
              type="button" 
              onClick={onClose}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--card-border)',
                background: 'transparent',
                color: 'var(--foreground)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--accent-foreground)',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Adding...' : 'Add Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

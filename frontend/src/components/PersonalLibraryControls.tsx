"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface PersonalLibraryControlsProps {
  workId: number;
  initialStatus: string;
  initialRating: number;
}

export default function PersonalLibraryControls({ workId, initialStatus, initialRating }: PersonalLibraryControlsProps) {
  const [status, setStatus] = useState(initialStatus || "Owned");
  const [rating, setRating] = useState(initialRating || 0);
  const [isSaving, setIsSaving] = useState(false);

  const statuses = ["Owned", "Reading", "Finished"];

  const ratingRef = useRef(rating);
  ratingRef.current = rating;

  const saveChanges = useCallback(async (updates: { status?: string; personal_rating?: number }) => {
    setIsSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${workId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("petrichor:workUpdated", { detail: { id: workId, ...updates } }));
      }
    } catch (err) {
      console.error("Failed to update work", err);
    } finally {
      setIsSaving(false);
    }
  }, [workId]);

  // Handle status change immediately
  const handleStatusChange = (newStatus: string) => {
    if (newStatus === status) return;
    setStatus(newStatus);
    saveChanges({ status: newStatus });
  };

  // Debounced slider update + Save on unmount
  useEffect(() => {
    const currentRating = rating;
    if (currentRating === initialRating) return;

    const timer = setTimeout(() => {
      saveChanges({ personal_rating: currentRating });
    }, 1000); 

    return () => {
      clearTimeout(timer);
      // If we unmount and the value in ref is different from initial, save it immediately
      if (ratingRef.current !== initialRating) {
        const updates = { personal_rating: ratingRef.current };
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${workId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
          keepalive: true // Ensure request completes even if page/component is gone
        });
      }
    };
  }, [rating, initialRating, saveChanges, workId]);

  return (
    <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem 0' }}>
      {/* Status Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p className="section-label" style={{ marginBottom: '0.25rem' }}>Reading Status</p>
        <div style={{ 
          display: 'flex', 
          background: 'color-mix(in srgb, var(--border) 40%, transparent)', 
          padding: '0.25rem', 
          borderRadius: '8px',
          gap: '0.25rem'
        }}>
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              style={{
                flex: 1,
                padding: '0.75rem 0',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: status === s ? 600 : 500,
                background: status === s ? 'var(--background)' : 'transparent',
                color: status === s ? 'var(--accent)' : 'var(--muted)',
                boxShadow: status === s ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                transition: 'background 0.2s ease, color 0.1s ease, box-shadow 0.2s ease',
                fontFamily: 'var(--font-sans)',
                letterSpacing: '0.01em'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Rating Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <p className="section-label" style={{ marginBottom: 0 }}>Personal Rating</p>
          <span style={{ 
            fontSize: '1.75rem', 
            fontWeight: 500, 
            color: 'var(--accent)', 
            fontFamily: 'var(--font-serif)',
            display: 'flex',
            alignItems: 'baseline',
            gap: '0.2rem'
          }}>
            {rating > 0 ? rating.toFixed(1) : "—"} 
            <span style={{ fontSize: '0.9rem', opacity: 0.4, fontWeight: 400, fontFamily: 'var(--font-sans)' }}>/ 10</span>
          </span>
        </div>
        
        <div style={{ padding: '0.5rem 0' }}>
          <input 
            type="range" 
            min="0" 
            max="10" 
            step="0.1" 
            value={rating} 
            onChange={(e) => setRating(parseFloat(e.target.value))}
            onMouseUp={() => saveChanges({ personal_rating: rating })}
            onKeyUp={() => saveChanges({ personal_rating: rating })}
            style={{
              width: '100%',
              accentColor: 'var(--accent)',
              cursor: 'pointer',
              height: '6px',
              borderRadius: '3px',
              WebkitAppearance: 'none',
              background: 'var(--border)',
              outline: 'none'
            }}
          />
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginTop: '0.75rem', 
            opacity: 0.5, 
            fontSize: '0.7rem', 
            fontWeight: 600,
            letterSpacing: '0.05em',
            color: 'var(--muted)'
          }}>
            <span>0.0</span>
            <span>5.0</span>
            <span>10.0</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1rem', minHeight: '1rem' }}>
        {isSaving && (
          <p className="fade-in-up" style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'center', fontStyle: 'italic', margin: 0, opacity: 0.7 }}>
            Synchronizing with library...
          </p>
        )}
      </div>
    </div>
  );
}

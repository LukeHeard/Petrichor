"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface PersonalLibraryControlsProps {
  workId: number;
  initialStatus: string;
  initialRating: number;
  initialReview?: string;
  initialNotes?: string;
}

export default function PersonalLibraryControls({ workId, initialStatus, initialRating, initialReview = "", initialNotes = "" }: PersonalLibraryControlsProps) {
  const [status, setStatus] = useState(initialStatus || "Owned");
  const [rating, setRating] = useState(initialRating || 0);
  const [review, setReview] = useState(initialReview);
  const [notes, setNotes] = useState(initialNotes);
  const [isEditingRating, setIsEditingRating] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const statuses = ["Owned", "Reading", "Finished", "DNF"];

  const ratingRef = useRef(rating);
  ratingRef.current = rating;
  const reviewRef = useRef(review);
  reviewRef.current = review;
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const [inputWidth, setInputWidth] = useState(0);
  const measureRef = useRef<HTMLSpanElement>(null);
  const reviewRefUI = useRef<HTMLTextAreaElement>(null);
  const notesRefUI = useRef<HTMLTextAreaElement>(null);

  const saveChanges = useCallback(async (updates: { status?: string; personal_rating?: number; review?: string; personal_notes?: string }) => {
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

  // Auto-resize textareas
  useEffect(() => {
    if (reviewRefUI.current) {
      reviewRefUI.current.style.height = 'auto';
      reviewRefUI.current.style.height = `${reviewRefUI.current.scrollHeight}px`;
    }
  }, [review]);

  useEffect(() => {
    if (notesRefUI.current) {
      notesRefUI.current.style.height = 'auto';
      notesRefUI.current.style.height = `${notesRefUI.current.scrollHeight}px`;
    }
  }, [notes]);

  // Measure text width for dynamic input/underline
  useEffect(() => {
    if (measureRef.current) {
      setInputWidth(measureRef.current.offsetWidth);
    }
  }, [editValue, isEditingRating, rating]);

  // Debounced slider update + Save on unmount
  useEffect(() => {
    const currentRating = rating;
    if (currentRating === initialRating) return;

    const timer = setTimeout(() => {
      saveChanges({ personal_rating: currentRating });
    }, 1000); 

    return () => {
      clearTimeout(timer);
      if (ratingRef.current !== initialRating) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${workId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personal_rating: ratingRef.current }),
          keepalive: true
        });
      }
    };
  }, [rating, initialRating, saveChanges, workId]);

  // Debounced Review update
  useEffect(() => {
    if (review === initialReview) return;
    const timer = setTimeout(() => {
      saveChanges({ review });
    }, 1500);
    return () => {
      clearTimeout(timer);
      if (reviewRef.current !== initialReview) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${workId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ review: reviewRef.current }),
          keepalive: true
        });
      }
    };
  }, [review, initialReview, saveChanges, workId]);

  // Debounced Notes update
  useEffect(() => {
    if (notes === initialNotes) return;
    const timer = setTimeout(() => {
      saveChanges({ personal_notes: notes });
    }, 1500);
    return () => {
      clearTimeout(timer);
      if (notesRef.current !== initialNotes) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/works/${workId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personal_notes: notesRef.current }),
          keepalive: true
        });
      }
    };
  }, [notes, initialNotes, saveChanges, workId]);

  return (
    <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem 0' }}>
      {/* Hidden measurement span */}
      <span ref={measureRef} style={{
        position: 'absolute',
        visibility: 'hidden',
        whiteSpace: 'pre',
        fontSize: '1.75rem',
        fontWeight: 500,
        fontFamily: 'var(--font-serif)',
        pointerEvents: 'none'
      }}>
        {isEditingRating ? (editValue || " ") : (rating > 0 ? rating.toFixed(1) : "—")}
      </span>

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
          <div 
            onClick={() => {
              if (!isEditingRating) {
                setIsEditingRating(true);
                setEditValue(rating > 0 ? rating.toFixed(1) : "");
              }
            }}
            style={{ 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.2rem',
              position: 'relative',
              paddingBottom: '2px'
            }}
          >
            {isEditingRating ? (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline' }}>
                <input 
                  autoFocus
                  type="text"
                  value={editValue}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*\.?\d?$/.test(val) || val === "") {
                      setEditValue(val);
                    }
                  }}
                  onBlur={() => {
                    setIsEditingRating(false);
                    const num = parseFloat(editValue);
                    if (!isNaN(num)) {
                      const finalNum = Math.min(10, Math.max(0, num));
                      setRating(finalNum);
                      saveChanges({ personal_rating: finalNum });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                      setIsEditingRating(false);
                    }
                  }}
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 500,
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-serif)',
                    background: 'none',
                    border: 'none',
                    width: `${Math.max(inputWidth, 20)}px`,
                    outline: 'none',
                    padding: 0,
                    margin: 0,
                    textAlign: 'right',
                    transition: 'width 0.1s ease-out'
                  }}
                />
                {/* Animated Underline */}
                <div style={{
                  position: 'absolute',
                  bottom: '-2px',
                  left: '0',
                  right: '0',
                  height: '2px',
                  background: 'var(--accent)',
                  borderRadius: '1px',
                  animation: 'fadeInHorizontal 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                }} />
                
                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes fadeInHorizontal {
                    from { opacity: 0; transform: scaleX(0); }
                    to { opacity: 1; transform: scaleX(1); }
                  }
                `}} />
              </div>
            ) : (
              <span style={{ 
                fontSize: '1.75rem', 
                fontWeight: 500, 
                color: 'var(--accent)', 
                fontFamily: 'var(--font-serif)',
                transition: 'opacity 0.3s ease',
                display: 'inline-block',
                minWidth: `${Math.max(inputWidth, 20)}px`,
                textAlign: 'right'
              }}>
                {rating > 0 ? rating.toFixed(1) : "—"} 
              </span>
            )}
            <span style={{ fontSize: '0.9rem', opacity: 0.4, fontWeight: 400, fontFamily: 'var(--font-sans)', transition: 'opacity 0.3s ease' }}>/ 10</span>
          </div>
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

      {/* Review Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p className="section-label">Your Review</p>
        <textarea 
          ref={reviewRefUI}
          value={review}
          onChange={e => setReview(e.target.value)}
          placeholder="Your review..."
          rows={1}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            borderRadius: 0,
            padding: 0,
            color: 'var(--foreground)',
            fontSize: '1.1rem',
            outline: 'none',
            resize: 'none',
            fontFamily: 'var(--font-serif)',
            lineHeight: '1.4',
            transition: 'border-color 0.2s ease',
            overflow: 'hidden',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* Notes Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <p className="section-label">Personal Notes</p>
        <textarea 
          ref={notesRefUI}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Your notes..."
          rows={1}
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            borderRadius: 0,
            padding: 0,
            color: 'var(--foreground)',
            fontSize: '1rem',
            outline: 'none',
            resize: 'none',
            fontFamily: 'var(--font-serif)',
            lineHeight: '1.4',
            transition: 'border-color 0.2s ease',
            overflow: 'hidden',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
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

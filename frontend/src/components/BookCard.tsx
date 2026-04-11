"use client";

import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface BookCardProps {
  id: number;
  title: string;
  goodreads_id?: string;
  thumbnail_url?: string;
  author?: string;
  status?: string;
  page_count?: number;
  current_page?: number;
}

export default function BookCard({ id, title, thumbnail_url, author, status, page_count = 0, current_page = 0 }: BookCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("book_id", id.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="book-card" onClick={handleClick}>
      <div className="book-card-cover">
        {thumbnail_url ? (
          <Image
            src={thumbnail_url}
            alt={title}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <div className="book-card-fallback">
            <span className="font-serif">{title}</span>
          </div>
        )}
        
        {/* Circular Progress Overlay */}
        {status === "Reading" && page_count > 0 && (
          <div style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            width: '32px',
            height: '32px',
            background: 'color-mix(in srgb, var(--background) 80%, transparent)',
            backdropFilter: 'blur(8px)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 10
          }}>
            <svg height="32" width="32" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
              <circle
                stroke="var(--border)"
                fill="transparent"
                strokeWidth="2"
                r="13"
                cx="16"
                cy="16"
                style={{ opacity: 0.2 }}
              />
              <circle
                stroke="var(--accent)"
                fill="transparent"
                strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 13}`}
                style={{ 
                  strokeDashoffset: (2 * Math.PI * 13) - (Math.min(100, (current_page / page_count) * 100) / 100) * (2 * Math.PI * 13),
                  transition: 'stroke-dashoffset 0.6s ease',
                  strokeLinecap: 'round'
                }}
                r="13"
                cx="16"
                cy="16"
              />
            </svg>
            <span style={{ 
              fontSize: '0.55rem', 
              fontWeight: 800,
              color: 'var(--accent)',
              fontFamily: 'var(--font-sans)',
              zIndex: 11
            }}>
              {Math.round((current_page / page_count) * 100)}%
            </span>
          </div>
        )}

        <div className="book-card-hover">
          <div className="book-card-hover-content">
            <p className="font-serif" style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>{title}</p>
            {author && <p style={{ fontSize: '0.75rem', opacity: 0.8 }}>{author}</p>}
            <p style={{ fontSize: '0.65rem', marginTop: '0.5rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>View Details</p>
          </div>
        </div>
      </div>
      <div className="book-card-info">
        <h3 className="font-serif" style={{ fontSize: '0.9rem', margin: '0.5rem 0 0.1rem 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h3>
        {author && <p style={{ fontSize: '0.75rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{author}</p>}
      </div>
    </div>
  );
}

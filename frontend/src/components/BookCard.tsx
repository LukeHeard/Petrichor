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
  index: number;
}

export default function BookCard({ id, title, thumbnail_url, author, status, page_count = 0, current_page = 0, index }: BookCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("book_id", id.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div 
      className="book-card fade-in-up" 
      onClick={handleClick}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="book-card-cover">
        {thumbnail_url ? (
          <Image
            src={thumbnail_url}
            alt={title}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            style={{ objectFit: 'cover' }}
            priority={index < 8}
          />
        ) : (
          <div className="book-card-fallback">
            <span className="font-serif">{title}</span>
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
      <div className="book-card-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="font-serif" style={{ fontSize: '0.9rem', margin: '0.5rem 0 0.1rem 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h3>
          {author && <p style={{ fontSize: '0.75rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{author}</p>}
        </div>
        
        {status === "Reading" && page_count > 0 && (
          <div style={{ position: 'relative', width: '34px', height: '34px', marginTop: '0.6rem', marginLeft: '0.5rem', flexShrink: 0 }}>
            <svg height="34" width="34" style={{ transform: 'rotate(-90deg)' }}>
              <circle
                stroke="var(--border)"
                fill="transparent"
                strokeWidth="2"
                r="15"
                cx="17"
                cy="17"
                style={{ opacity: 0.2 }}
              />
              <circle
                stroke="var(--accent)"
                fill="transparent"
                strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 15}`}
                style={{ 
                  strokeDashoffset: (2 * Math.PI * 15) - (Math.min(100, (current_page / page_count) * 100) / 100) * (2 * Math.PI * 15),
                  transition: 'stroke-dashoffset 0.6s ease',
                  strokeLinecap: 'round'
                }}
                r="15"
                cx="17"
                cy="17"
              />
            </svg>
            <span style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)', 
              fontSize: '0.55rem', 
              fontWeight: 800,
              color: 'var(--accent)',
              fontFamily: 'var(--font-sans)'
            }}>
              {Math.round((current_page / page_count) * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

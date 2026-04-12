"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface LibraryItemProps {
  id: number;
  title: string;
  author?: string;
  first_publish_year?: number;
  personal_rating?: number;
  status?: string;
  page_count?: number;
  current_page?: number;
  index: number;
}

export default function LibraryItem({ id, title, author, first_publish_year, personal_rating, status, page_count = 0, current_page = 0, index }: LibraryItemProps) {
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
      className="book-row fade-in-up" 
      onClick={handleClick}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1, minWidth: 0 }}>
        <h3 className="font-serif" style={{ fontSize: '1.05rem', margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{title}</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0, fontWeight: 500 }}>
          {author || "Unknown Author"}
          {first_publish_year ? ` (${first_publish_year})` : ""}
        </p>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {status === "Reading" && page_count > 0 && (
          <div style={{ position: 'relative', width: '40px', height: '40px' }}>
            <svg height="40" width="40" style={{ transform: 'rotate(-90deg)' }}>
              <circle
                stroke="var(--border)"
                fill="transparent"
                strokeWidth="2"
                r="17"
                cx="20"
                cy="20"
                style={{ opacity: 0.2 }}
              />
              <circle
                stroke="var(--accent)"
                fill="transparent"
                strokeWidth="2"
                strokeDasharray={`${2 * Math.PI * 17}`}
                style={{ 
                  strokeDashoffset: (2 * Math.PI * 17) - (Math.min(100, (current_page / page_count) * 100) / 100) * (2 * Math.PI * 17),
                  transition: 'stroke-dashoffset 0.6s ease',
                  strokeLinecap: 'round'
                }}
                r="17"
                cx="20"
                cy="20"
              />
            </svg>
            <span style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)', 
              fontSize: '0.65rem', 
              fontWeight: 800,
              color: 'var(--accent)',
              fontFamily: 'var(--font-sans)'
            }}>
              {Math.round((current_page / page_count) * 100)}%
            </span>
          </div>
        )}

        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem', minWidth: '70px' }}>
          {status && (
            <span style={{ 
              fontSize: '0.6rem', 
              fontWeight: 700, 
              letterSpacing: '0.1em', 
              textTransform: 'uppercase', 
              color: 'var(--muted)',
              opacity: 0.8
            }}>
              {status}
            </span>
          )}
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.15rem' }}>
            <span className="font-serif" style={{ 
              fontSize: '1.05rem', 
              fontWeight: 600, 
              color: personal_rating && personal_rating > 0 ? 'var(--accent)' : 'var(--muted)',
              opacity: personal_rating && personal_rating > 0 ? 1 : 0.4
            }}>
              {personal_rating && personal_rating > 0 ? personal_rating.toFixed(1) : "—"}
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--muted)', opacity: 0.3, fontWeight: 500 }}>/10</span>
          </div>
        </div>
      </div>
    </div>
  );
}

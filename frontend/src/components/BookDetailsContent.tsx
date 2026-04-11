"use client";

interface BookDetailsContentProps {
  book: {
    title: string;
    author?: string;
    first_publish_year?: number;
    description?: string;
    page_count?: number;
    rating_average?: number;
    rating_count?: number;
    goodreads_id?: string;
    thumbnail_url?: string;
    id?: number;
    tags?: string[];
  };
  actions?: React.ReactNode;
}

export default function BookDetailsContent({ book, actions }: BookDetailsContentProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeInUp 0.3s ease' }}>
      {book.thumbnail_url && (
        <div style={{ 
          width: '120px', 
          height: '180px', 
          position: 'relative', 
          marginBottom: '1.5rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <img 
            src={book.thumbnail_url} 
            alt={book.title} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        </div>
      )}
      <h2 className="font-serif" style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '0.25rem' }}>{book.title}</h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.5rem', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
        {book.author}
      </p>
      {book.first_publish_year && book.first_publish_year > 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', fontStyle: 'italic', marginBottom: '1.5rem' }}>
          First published {book.first_publish_year}
        </p>
      )}

      {book.tags && book.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
          {book.tags.map(tag => (
            <span key={tag} style={{
              fontSize: '0.7rem',
              padding: '0.2rem 0.6rem',
              backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
              color: 'var(--accent)',
              borderRadius: '100px',
              fontWeight: 600,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)'
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', justifyContent: 'center' }}>
        {book.page_count && book.page_count > 0 && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Pages</p>
            <p style={{ fontSize: '1rem', fontWeight: 500 }}>{book.page_count}</p>
          </div>
        )}
        {book.rating_average && book.rating_average > 0 && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Goodreads Rating</p>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.2rem' }}>
              <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>{book.rating_average.toFixed(2)}</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 400 }}>({(book.rating_count || 0).toLocaleString()})</span>
            </div>
          </div>
        )}
      </div>

      <div className="thin-divider" style={{ margin: '0 0 1.5rem 0' }} />

      <div style={{ alignSelf: 'stretch', paddingRight: '0.5rem' }}>
        {book.description ? (
          <p className="font-serif" style={{
            fontSize: '0.95rem',
            lineHeight: '1.6',
            color: 'var(--foreground)',
            opacity: 0.9,
            whiteSpace: 'pre-wrap',
            textAlign: 'left'
          }}>
            {book.description}
          </p>
        ) : (
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center' }}>No description available.</p>
        )}
      </div>

      {(book.id || book.goodreads_id) && (
        <>
          <div className="thin-divider" style={{ margin: '1.5rem 0 0.5rem 0' }} />
          <p style={{ color: 'var(--muted)', fontSize: '0.65rem', marginBottom: '1.5rem', letterSpacing: '0.02em', textTransform: 'uppercase', display: 'flex', gap: '0.75rem', opacity: 0.5 }}>
            {book.id && <span>Internal ID: {book.id}</span>}
            {book.goodreads_id && (
              <span>Goodreads ID: {book.goodreads_id}</span>
            )}
          </p>
        </>
      )}

      {actions && (
        <div style={{ alignSelf: 'stretch', marginTop: '1rem' }}>
          {actions}
        </div>
      )}
    </div>
  );
}

"use client";

interface BookDetailsContentProps {
  book: {
    title: string;
    author?: string;
    first_publish_year?: number;
    description?: string;
    page_count?: number;
    rating_average?: number;
    openlibrary_id?: string;
    id?: number;
  };
  isLoading?: boolean;
  actions?: React.ReactNode;
}

export default function BookDetailsContent({ book, isLoading, actions }: BookDetailsContentProps) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 0' }}>
        <p style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Loading details...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2 className="font-serif" style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '0.25rem' }}>{book.title}</h2>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.5rem', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
         {book.author}
      </p>
      {book.first_publish_year && book.first_publish_year > 0 && (
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', fontStyle: 'italic', marginBottom: '1.5rem' }}>
          First published {book.first_publish_year}
        </p>
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
            <p style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Rating</p>
            <p style={{ fontSize: '1rem', fontWeight: 500 }}>{book.rating_average.toFixed(1)}/5</p>
          </div>
        )}
      </div>

      <div className="thin-divider" style={{ margin: '0 0 1.5rem 0' }} />

      <div style={{ alignSelf: 'stretch', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
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

      {book.id || book.openlibrary_id ? (
        <>
          <div className="thin-divider" style={{ margin: '1.5rem 0 0.5rem 0' }} />
          <p style={{ color: 'var(--muted)', fontSize: '0.65rem', marginBottom: '1.5rem', letterSpacing: '0.02em', textTransform: 'uppercase', display: 'flex', gap: '0.75rem', opacity: 0.5 }}>
             {book.id && <span>Internal ID: {book.id}</span>}
             {book.openlibrary_id && (
               <span>OLID: {book.openlibrary_id.replace('/works/', '')}</span>
             )}
          </p>
        </>
      ) : null}

      {actions && (
        <div style={{ alignSelf: 'stretch', marginTop: '1rem' }}>
          {actions}
        </div>
      )}
    </div>
  );
}

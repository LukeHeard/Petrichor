"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AddWorkModal from "./AddWorkModal";

export default function NavigationWithModal() {
  const pathname = usePathname();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Helper function to dispatch event when work is added
  const handleWorkAdded = () => {
    window.dispatchEvent(new Event("petrichor:workAdded"));
    setIsModalOpen(false);
  };

  return (
    <>
      <nav className="bottom-nav">
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem' }}>
          
          <Link href="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`} onClick={() => setIsMoreMenuOpen(false)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Home</span>
          </Link>
          
          <div className="nav-separator" />
          
          <Link href="/library" className={`nav-item ${pathname === '/library' ? 'active' : ''}`} onClick={() => setIsMoreMenuOpen(false)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>
            <span>Library</span>
          </Link>

          {/* Center Plus Button with organic parenthesis curves */}
          <div className="nav-plus-wrapper">
            <svg style={{ color: 'var(--border)' }} xmlns="http://www.w3.org/2000/svg" width="12" height="32" viewBox="0 0 12 32">
              <path d="M 10 2 C 2 8, 2 24, 10 30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            
            <button className="nav-plus-btn" onClick={() => { setIsModalOpen(true); setIsMoreMenuOpen(false); }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </button>
            
            <svg style={{ color: 'var(--border)' }} xmlns="http://www.w3.org/2000/svg" width="12" height="32" viewBox="0 0 12 32">
              <path d="M 2 2 C 10 8, 10 24, 2 30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          
          <Link href="/tracking" className={`nav-item ${pathname === '/tracking' ? 'active' : ''}`} onClick={() => setIsMoreMenuOpen(false)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            <span>Tracking</span>
          </Link>
          
          <div className="nav-separator" />
          
          <button 
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className={`nav-item ${isMoreMenuOpen ? 'active' : ''}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            <span>More</span>
          </button>

        </div>
      </nav>

      {/* More Flyout Menu */}
      {isMoreMenuOpen && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }} 
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <div className="more-menu-container">
            <Link href="/more" className="more-menu-item" onClick={() => setIsMoreMenuOpen(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              Stats & Insights
            </Link>
            <div className="more-menu-divider" />
            <div className="more-menu-item" style={{ opacity: 0.5, cursor: 'default' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              Settings
            </div>
          </div>
        </>
      )}

      {/* Global Add Book Modal */}
      <AddWorkModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onWorkAdded={handleWorkAdded} 
      />
    </>
  );
}

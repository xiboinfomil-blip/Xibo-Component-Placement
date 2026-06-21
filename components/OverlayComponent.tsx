import { useEffect, useState, useRef, useMemo } from 'react';

interface OverlayComponentProps {
  apiUrl: string;
  position: { x: number; y: number; rotation: number };
  size: { width: number; height: number };
  isVisible: boolean;
  onReady: () => void;
}

// Simple in-memory cache map outside the component to persist across renders/unmounts if needed
// Or use a ref inside if you only want it to last while this component instance exists.
// For a robust solution across different instances of this component, a global map or context is better.
const htmlCache = new Map<string, string>();

export default function OverlayComponent({ 
  apiUrl, 
  position, 
  size, 
  isVisible,
  onReady 
}: OverlayComponentProps) {
  const [htmlContent, setHtmlContent] = useState<string | null>(htmlCache.get(apiUrl) || null);
  const [isLoading, setIsLoading] = useState(!htmlCache.has(apiUrl));
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasCalledReady = useRef(false);

  // Memoize the style so it doesn't cause unnecessary re-renders of children if not needed
  // However, since position/size change often, we keep it inline but ensure iframe isn't remounted.
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${size.width}px`,
    height: `${size.height}px`,
    transform: `rotate(${position.rotation}deg)`,
    pointerEvents: isVisible ? 'auto' : 'none',
    opacity: isVisible ? 1 : 0,
    transition: 'opacity 0.3s ease-in-out',
    zIndex: 9999,
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };

  useEffect(() => {
    // If we already have it in cache and state, skip fetching
    if (htmlContent) {
      if (!hasCalledReady.current) {
        hasCalledReady.current = true;
        onReady();
      }
      return;
    }

    let isCancelled = false;

    async function fetchComponent() {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        let html = await response.text();
        
        if (isCancelled) return;

        const baseUrl = new URL(apiUrl).origin + '/';
        
        const centeringStyles = `
          <style>
            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
              overflow: hidden;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            body > * {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
            }
            * {
              box-sizing: border-box;
            }
          </style>
        `;
        
        if (html.includes('<head>')) {
          html = html.replace(
            '<head>', 
            `<head><base href="${baseUrl}">${centeringStyles}`
          );
        } else if (html.includes('<html>')) {
          html = html.replace('<html>', `<html><head>${centeringStyles}</head>`);
        } else {
          html = `<html><head>${centeringStyles}<base href="${baseUrl}"></head><body>${html}</body></html>`;
        }

        // Update cache
        htmlCache.set(apiUrl, html);
        setHtmlContent(html);
        
        if (!hasCalledReady.current) {
          hasCalledReady.current = true;
          onReady();
        }
      } catch (err: any) {
        if (isCancelled) return;
        setError(err.message);
        
        if (!hasCalledReady.current) {
          hasCalledReady.current = true;
          onReady();
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchComponent();

    return () => {
      isCancelled = true;
    };
  }, [apiUrl, htmlContent, onReady]);

  const handleIframeLoad = () => {
    if (iframeRef.current) {
      iframeRef.current.style.width = '100%';
      iframeRef.current.style.height = '100%';
    }
  };

  if (isLoading) {
    return (
      <div style={style}>
        <div className="text-white text-xs bg-black p-2">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={style}>
        <div className="text-white text-xs p-2 bg-red-900">Error: {error}</div>
      </div>
    );
  }

  return (
    <div style={style}>
      {isVisible && htmlContent && (
        <iframe
          key={apiUrl} // ✅ KEY CHANGE: Only remount if URL changes
          ref={iframeRef}
          srcDoc={htmlContent}
          className="w-full h-full border-0 block"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
          title="Overlay Component"
          onLoad={handleIframeLoad}
          style={{ border: 'none', outline: 'none' }}
          scrolling="no"
        />
      )}
      {!isVisible && htmlContent && (
        <div className="w-full h-full flex items-center justify-center bg-blue-500/30">
          <span className="text-white text-xs">Hidden (time range)</span>
        </div>
      )}
    </div>
  );
}
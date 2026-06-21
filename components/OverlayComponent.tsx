// components/OverlayComponent.tsx
import { useEffect, useState, useRef } from 'react';

interface OverlayComponentProps {
  apiUrl: string;
  position: { x: number; y: number; rotation: number };
  size: { width: number; height: number };
  isVisible: boolean;
  onReady: () => void;
}

export default function OverlayComponent({ 
  apiUrl, 
  position, 
  size, 
  isVisible,
  onReady 
}: OverlayComponentProps) {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasCalledReady = useRef(false);
  const fetchedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (fetchedUrl.current === apiUrl) return;

    async function fetchComponent() {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        let html = await response.text();
        
        const baseUrl = new URL(apiUrl).origin + '/';
        
        // ✅ FIX: Inject CSS to center content vertically and horizontally
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
        
        // Check if <head> exists
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

        setHtmlContent(html);
        fetchedUrl.current = apiUrl;
        
        if (!hasCalledReady.current) {
          hasCalledReady.current = true;
          onReady();
        }
      } catch (err: any) {
        setError(err.message);
        fetchedUrl.current = apiUrl;
        
        if (!hasCalledReady.current) {
          hasCalledReady.current = true;
          onReady();
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchComponent();
  }, [apiUrl, onReady]);

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
    display: 'flex', // ✅ Enable flexbox on container
    justifyContent: 'center', // ✅ Center horizontally
    alignItems: 'center', // ✅ Center vertically
  };

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
import React, { useEffect, useRef } from 'react';

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasCalledReady = useRef(false);

  // Trigger ready status immediately on mount to prevent Xibo layout blocks
  useEffect(() => {
    if (!hasCalledReady.current) {
      hasCalledReady.current = true;
      if (typeof onReady === 'function') {
        onReady();
      }
    }
  }, [onReady]);

  // Fail-safe calculation: If isVisible is false, we throw it off-screen 
  // instead of using display:none or opacity:0. This forces Windows WebView 
  // to keep rendering active without hiding the DOM block.
  const calculatedLeft = isVisible ? position.x : -9999;
  const calculatedTop = isVisible ? position.y : -9999;

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${calculatedLeft}px`,
    top: `${calculatedTop}px`,
    width: `${size.width}px`,
    height: `${size.height}px`,
    transform: `rotate(${position.rotation}deg)`,
    transformOrigin: 'center center',
    zIndex: 999,
    overflow: 'hidden',
    background: 'transparent',
  };

  return (
    <div style={containerStyle}>
      <iframe
        ref={iframeRef}
        src={apiUrl} 
        title="Signage Overlay Element"
        scrolling="no"
        style={{ 
          width: '100%', 
          height: '100%', 
          border: '0px none transparent', 
          outline: 'none', 
          display: 'block',
          background: 'transparent'
        }}
      />
    </div>
  );
}
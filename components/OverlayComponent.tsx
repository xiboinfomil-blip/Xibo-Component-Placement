import React, { useEffect, useRef, useState } from 'react';

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
  const [isEngineReady, setIsEngineReady] = useState(false);

  // 1. Prevent Windows WebView2 context isolation paint drops
  useEffect(() => {
    if (!hasCalledReady.current) {
      hasCalledReady.current = true;
      
      // Delays signaling the parent CMS wrapper until the component 
      // is safely mounted and processed by the Windows rendering thread.
      const timer = setTimeout(() => {
        setIsEngineReady(true);
        if (typeof onReady === 'function') {
          onReady();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [onReady]);

  // 2. Strict styling configured specifically for Xibo Windows Display Engines
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${size.width}px`,
    height: `${size.height}px`,
    transform: `rotate(${position.rotation}deg)`,
    transformOrigin: 'center center',
    zIndex: 999,
    overflow: 'hidden',
    // Uses structural block/none toggles instead of opacity to fix 
    // the persistent "invisible layer" bug found on Windows Player hardware.
    display: isVisible && isEngineReady ? 'block' : 'none',
    pointerEvents: isVisible ? 'auto' : 'none',
    backgroundColor: 'transparent',
  };

  // 3. Fail-safe forced dimensions on load event
  const handleIframeLoad = () => {
    if (iframeRef.current) {
      iframeRef.current.style.width = '100%';
      iframeRef.current.style.height = '100%';
    }
  };

  return (
    <div style={containerStyle}>
      <iframe
        ref={iframeRef}
        src={apiUrl} 
        title="Signage Overlay Element"
        onLoad={handleIframeLoad}
        scrolling="no"
        // Uses explicit inline styles instead of pure utility classes 
        // to bypass rendering engines that strip out framework css classes inside Xibo.
        style={{ 
          width: '100%', 
          height: '100%', 
          border: 'none', 
          outline: 'none', 
          display: 'block',
          background: 'transparent'
        }}
        // The sandbox attribute is explicitly omitted to ensure the 
        // local Xibo container layer allows modern Javascript features execution.
      />
    </div>
  );
}
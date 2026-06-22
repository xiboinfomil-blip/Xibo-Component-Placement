import { useEffect, useRef } from 'react';

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

  // Instantly dispatch tracking hook back to parent component tree
  useEffect(() => {
    if (!hasCalledReady.current) {
      hasCalledReady.current = true;
      onReady();
    }
  }, [onReady]);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${size.width}px`,
    height: `${size.height}px`,
    transform: `rotate(${position.rotation}deg)`,
    transformOrigin: 'center center',
    // Strict visibility matrix configuration avoiding DOM remount overhead
    pointerEvents: isVisible ? 'auto' : 'none',
    opacity: isVisible ? 1 : 0,
    willChange: 'opacity',
    transition: 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 999,
    overflow: 'hidden',
  };

  const handleIframeLoad = () => {
    if (iframeRef.current) {
      iframeRef.current.style.width = '100%';
      iframeRef.current.style.height = '100%';
    }
  };

  return (
    <div style={style}>
      <iframe
        ref={iframeRef}
        src={apiUrl} 
        className="w-full h-full border-0 block bg-transparent"
        sandbox="allow-scripts allow-same-origin allow-forms"
        title="Signage Overlay Element"
        onLoad={handleIframeLoad}
        style={{ border: 'none', outline: 'none' }}
        scrolling="no"
        allowTransparency={true}
      />
    </div>
  );
}
// components/OverlayRenderer.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import OverlayComponent from './OverlayComponent';

interface Overlay {
  id: string;
  apiUrl: string;
  position: { x: number; y: number; rotation: number };
  size: { width: number; height: number };
  startTime: number;
  endTime: number;
}

interface OverlayRendererProps {
  overlays?: Overlay[];
  referenceDimensions?: { width: number; height: number };
  currentTime: number;
  onAllComponentsReady: () => void;
}

export default function OverlayRenderer({ 
  overlays, 
  referenceDimensions, 
  currentTime,
  onAllComponentsReady
}: OverlayRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleOverlays, setVisibleOverlays] = useState<Set<string>>(new Set());
  const [readyComponents, setReadyComponents] = useState<Set<string>>(new Set());
  const hasNotifiedReady = useRef(false);

  // Update visible overlays based on current time
  useEffect(() => {
    if (!overlays) return;

    const newVisibleOverlays = new Set<string>();
    
    overlays.forEach(overlay => {
      const isVisible = currentTime >= overlay.startTime && currentTime <= overlay.endTime;
      if (isVisible) {
        newVisibleOverlays.add(overlay.id);
      }
    });

    setVisibleOverlays(newVisibleOverlays);
  }, [currentTime, overlays]);

  // Check if all components are ready
  useEffect(() => {
    if (!overlays || overlays.length === 0) {
      if (!hasNotifiedReady.current) {
        hasNotifiedReady.current = true;
        onAllComponentsReady();
      }
      return;
    }

    if (readyComponents.size >= overlays.length && !hasNotifiedReady.current) {
      hasNotifiedReady.current = true;
      onAllComponentsReady();
    }
  }, [readyComponents, overlays, onAllComponentsReady]);

  // ✅ FIX: Stabilize handleComponentReady so it doesn't change on every render
  const handleComponentReady = useCallback((overlayId: string) => {
    setReadyComponents(prev => {
      if (prev.has(overlayId)) return prev; // Avoid state update if already ready
      const newSet = new Set(prev);
      newSet.add(overlayId);
      return newSet;
    });
  }, []);

  // Cleanup iframes on unmount
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        const iframes = containerRef.current.querySelectorAll('iframe');
        iframes.forEach(iframe => { iframe.srcdoc = ''; });
      }
    };
  }, []);

  if (!overlays || !referenceDimensions) {
    return null;
  }

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 100 }}>
      {overlays.map((overlay) => {
        const isVisible = visibleOverlays.has(overlay.id);

        return (
          <OverlayComponent
            key={overlay.id}
            apiUrl={overlay.apiUrl}
            position={overlay.position}
            size={overlay.size}
            isVisible={isVisible}
            onReady={() => handleComponentReady(overlay.id)}
          />
        );
      })}
    </div>
  );
}
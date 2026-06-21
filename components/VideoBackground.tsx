import { useEffect, useRef, useState, useCallback } from 'react';
import OverlayRenderer from './OverlayRenderer';

export interface VideoState {
  currentTime: number;
  duration: number;
  paused: boolean;
  videoWidth: number;
  videoHeight: number;
  readyState: number;
}

interface Overlay {
  id: string;
  apiUrl: string;
  position: { x: number; y: number; rotation: number };
  size: { width: number; height: number };
  startTime: number;
  endTime: number;
}

interface VideoBackgroundProps {
  videoUrl?: string;
  updatedAt?: any;
  overlays?: Overlay[];
  referenceDimensions?: { width: number; height: number };
  onVideoStateChange?: (state: VideoState) => void;
}

export default function VideoBackground({ 
  videoUrl, 
  overlays, 
  referenceDimensions,
  onVideoStateChange 
}: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoState, setVideoState] = useState<VideoState>({
    currentTime: 0,
    duration: 0,
    paused: true,
    videoWidth: 0,
    videoHeight: 0,
    readyState: 0
  });
  const [isAllOverlaysReady, setIsAllOverlaysReady] = useState(false);

  // ✅ FIX 1: Stabilize the callback ref so it never triggers useEffect re-runs
  const onVideoStateChangeRef = useRef(onVideoStateChange);
  useEffect(() => {
    onVideoStateChangeRef.current = onVideoStateChange;
  }, [onVideoStateChange]);

  // ✅ FIX 2: Single stable useEffect for all video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateStateFromVideo = () => {
      const newState: VideoState = {
        currentTime: video.currentTime,
        duration: video.duration || 0,
        paused: video.paused,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState
      };
      
      setVideoState(newState);
      onVideoStateChangeRef.current?.(newState);
    };

    const handleLoadedMetadata = () => updateStateFromVideo();
    const handleTimeUpdate = () => updateStateFromVideo();
    const handlePlay = () => updateStateFromVideo();
    const handlePause = () => updateStateFromVideo();
    const handleEnded = () => updateStateFromVideo();
    const handleError = (e: Event) => console.error('[VideoBackground] Video error:', e);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    updateStateFromVideo();

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, []); // ✅ Empty dependency array - listeners are attached exactly ONCE

  const handleAllComponentsReady = useCallback(() => {
    setIsAllOverlaysReady(true);
  }, []);

  // ✅ FIX 3: Memoize scale factor so it doesn't recalculate on every timeupdate
  const scaleFactor = (() => {
    if (!referenceDimensions || !videoState.videoWidth || !videoState.videoHeight) return 1;
    const scaleX = videoState.videoWidth / referenceDimensions.width;
    const scaleY = videoState.videoHeight / referenceDimensions.height;
    return Math.min(scaleX, scaleY);
  })();

  // ✅ FIX 4: Memoize scaled overlays so OverlayRenderer doesn't re-render unnecessarily
  const scaledOverlays = useRef<Overlay[]>([]);
  const prevScaleFactor = useRef(scaleFactor);
  
  if (overlays && (prevScaleFactor.current !== scaleFactor || scaledOverlays.current.length !== overlays.length)) {
    prevScaleFactor.current = scaleFactor;
    scaledOverlays.current = overlays.map(overlay => ({
      ...overlay,
      position: {
        x: overlay.position.x * scaleFactor,
        y: overlay.position.y * scaleFactor,
        rotation: overlay.position.rotation
      },
      size: {
        width: overlay.size.width * scaleFactor,
        height: overlay.size.height * scaleFactor
      }
    }));
  }

  return (
    // Changed to w-screen h-screen to ensure it matches viewport exactly
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          // object-fill stretches to fit exactly w-screen h-screen
          className="absolute inset-0 w-full h-full object-fill"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      )}

      {scaledOverlays.current.length > 0 && referenceDimensions && (
        <OverlayRenderer
          overlays={scaledOverlays.current}
          referenceDimensions={referenceDimensions}
          currentTime={videoState.currentTime}
          onAllComponentsReady={handleAllComponentsReady}
        />
      )}

      <div className="fixed top-4 right-4 bg-black/70 text-white p-3 rounded text-xs font-mono z-50">
        <div>Video: {videoUrl ? 'Loaded' : 'Not loaded'}</div>
        <div>Overlays: {overlays?.length || 0}</div>
        <div>Ready: {isAllOverlaysReady ? 'Yes' : 'No'}</div>
        <div>Time: {videoState.currentTime.toFixed(2)}s</div>
        <div>Scale: {scaleFactor.toFixed(2)}</div>
      </div>
    </div>
  );
}
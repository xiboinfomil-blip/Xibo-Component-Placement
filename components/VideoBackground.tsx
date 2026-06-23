import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import OverlayRenderer from './OverlayRenderer';
import './VideoBackground.css';

declare global {
  interface Window {
    EmbedInit?: () => void;
  }
}

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
  overlays?: Overlay[];
  referenceDimensions?: { width: number; height: number };
  onVideoStateChange?: (state: VideoState) => void;
}

export default function VideoBackground({ 
  videoUrl, 
  overlays = [], // Fallback default to avoid undefined crashes
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

  // 1. Hook into Xibo's lifecycle window event
  useEffect(() => {
    window.EmbedInit = () => {
      console.log('[Xibo Widget] Layout Engine Handshake initialized.');
    };

    return () => {
      delete window.EmbedInit;
    };
  }, []);

  // 2. Heavy-duty Autoplay enforcement for Xibo Player Web Views
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    video.load();

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('[Xibo Widget] Video autoplay tracking started successfully.');
        })
        .catch((error) => {
          console.warn('[Xibo Widget] Autoplay blocked, forcing fallback muted playback:', error);
          video.muted = true;
          video.play().catch(err => console.error('[Xibo Widget] Critical playback blockage:', err));
        });
    }
  }, [videoUrl]);

  // Keep callback reference updated without triggering observer re-runs
  const onVideoStateChangeRef = useRef(onVideoStateChange);
  useEffect(() => {
    onVideoStateChangeRef.current = onVideoStateChange;
  }, [onVideoStateChange]);

  // 3. Single stable observer for video element telemetry
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

    // Throttled timeupdate helper to reduce React state-update thrashing
    let rafId: number;
    const handleTimeUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateStateFromVideo);
    };

    video.addEventListener('loadedmetadata', updateStateFromVideo);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', updateStateFromVideo);
    video.addEventListener('pause', updateStateFromVideo);
    video.addEventListener('ended', updateStateFromVideo);
    
    const handleError = (e: Event) => console.error('[VideoBackground] Xibo video engine playback error:', e);
    video.addEventListener('error', handleError);

    if (video.readyState >= 1) updateStateFromVideo();

    return () => {
      cancelAnimationFrame(rafId);
      video.removeEventListener('loadedmetadata', updateStateFromVideo);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', updateStateFromVideo);
      video.removeEventListener('pause', updateStateFromVideo);
      video.removeEventListener('ended', updateStateFromVideo);
      video.removeEventListener('error', handleError);
    };
  }, [videoUrl]);

  const handleAllComponentsReady = useCallback(() => {
    setIsAllOverlaysReady(true);
  }, []);

  // 4. Clean, declarative scaling math with useMemo
  const scaleFactor = useMemo(() => {
    if (!referenceDimensions || !videoState.videoWidth || !videoState.videoHeight) return 1;
    const scaleX = videoState.videoWidth / referenceDimensions.width;
    const scaleY = videoState.videoHeight / referenceDimensions.height;
    return Math.min(scaleX, scaleY);
  }, [referenceDimensions, videoState.videoWidth, videoState.videoHeight]);

  // Re-calculate overlays instantly and safely on dependancy adjustments
  const scaledOverlays = useMemo(() => {
    if (!overlays) return [];
    return overlays.map(overlay => ({
      ...overlay,
      position: {
        ...overlay.position,
        x: overlay.position.x * scaleFactor,
        y: overlay.position.y * scaleFactor,
      },
      size: {
        width: overlay.size.width * scaleFactor,
        height: overlay.size.height * scaleFactor
      }
    }));
  }, [overlays, scaleFactor]);

  return (
    <div className="video-container w-full h-full relative overflow-hidden bg-black">
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          className="video-element w-full h-full object-cover"
          muted
          loop
          playsInline
          controls={false}
          preload="auto"
        />
      )}

      {scaledOverlays.length > 0 && referenceDimensions && (
        <div className="overlay-container-layer absolute inset-0 pointer-events-none">
          <OverlayRenderer
            overlays={scaledOverlays}
            referenceDimensions={referenceDimensions}
            currentTime={videoState.currentTime}
            onAllComponentsReady={handleAllComponentsReady}
          />
        </div>
      )}
    </div>
  );
}
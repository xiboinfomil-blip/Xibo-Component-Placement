import { useEffect, useRef, useState, useCallback } from 'react';
import OverlayRenderer from './OverlayRenderer';
import './VideoBackground.css';

// Declare Xibo global hooks so TypeScript doesn't throw errors
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

  // 1. Hook into Xibo's lifecycle window event
  useEffect(() => {
    window.EmbedInit = () => {
      console.log('[Xibo Widget] Layout Engine Handshake initialized.');
      // If your video needs to wait for Xibo layout metrics, handle it here
    };

    return () => {
      delete window.EmbedInit;
    };
  }, []);

  // 2. Heavy-duty Autoplay enforcement for Xibo Player Web Views
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    // Force reloading the video asset source directly
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

  // Stabilize callback reference
  const onVideoStateChangeRef = useRef(onVideoStateChange);
  useEffect(() => {
    onVideoStateChangeRef.current = onVideoStateChange;
  }, [onVideoStateChange]);

  // Single stable observer for video element telemetry
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
    const handleError = (e: Event) => console.error('[VideoBackground] Xibo video engine playback error:', e);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    if (video.readyState >= 1) updateStateFromVideo();

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [videoUrl]);

  const handleAllComponentsReady = useCallback(() => {
    setIsAllOverlaysReady(true);
  }, []);

  // Compute dynamic scaling based on viewport differences
  const scaleFactor = (() => {
    if (!referenceDimensions || !videoState.videoWidth || !videoState.videoHeight) return 1;
    const scaleX = videoState.videoWidth / referenceDimensions.width;
    const scaleY = videoState.videoHeight / referenceDimensions.height;
    return Math.min(scaleX, scaleY);
  })();

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

      {scaledOverlays.current.length > 0 && referenceDimensions && (
        <div className="overlay-container-layer absolute inset-0 pointer-events-none">
          <OverlayRenderer
            overlays={scaledOverlays.current}
            referenceDimensions={referenceDimensions}
            currentTime={videoState.currentTime}
            onAllComponentsReady={handleAllComponentsReady}
          />
        </div>
      )}
    </div>
  );
}
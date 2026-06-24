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
  overlays = [], 
  referenceDimensions,
  onVideoStateChange 
}: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Store the current object URL to revoke it later for memory management
  const objectUrlRef = useRef<string | null>(null);
  
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

  // 2. Heavy-duty Autoplay enforcement & Caching Strategy
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    // Clean up previous source if exists to free memory
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    // Force load the new source
    // Note: In Xibo, ensure your server sends proper Cache-Control headers 
    // e.g., Cache-Control: public, max-age=31536000
    video.src = videoUrl;
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

    // Cleanup function to prevent memory leaks in long-running Xibo players
    return () => {
      if (video) {
        video.pause();
        video.src = '';
        video.load(); // Reset the decoder
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
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
    const video = videoRef.current;
    if (!video || !referenceDimensions) return { scale: 1, offsetX: 0, offsetY: 0 };
    
    // Use the ACTUAL rendered dimensions, not intrinsic
    const renderedWidth = video.clientWidth;
    const renderedHeight = video.clientHeight;
    
    if (!renderedWidth || !renderedHeight) return { scale: 1, offsetX: 0, offsetY: 0 };
    
    // Since you use object-cover, calculate the cover scale
    const videoAspect = video.videoWidth / video.videoHeight;
    const containerAspect = renderedWidth / renderedHeight;
    
    let visibleVideoWidth, visibleVideoHeight;
    if (containerAspect > videoAspect) {
      // Container is wider - video is letterboxed vertically
      visibleVideoWidth = renderedWidth;
      visibleVideoHeight = renderedWidth / videoAspect;
    } else {
      // Container is taller - video is pillarboxed horizontally
      visibleVideoHeight = renderedHeight;
      visibleVideoWidth = renderedHeight * videoAspect;
    }
    
    const scaleX = visibleVideoWidth / referenceDimensions.width;
    const scaleY = visibleVideoHeight / referenceDimensions.height;
    
    // Center offset for object-cover cropping
    return { 
      scale: Math.max(scaleX, scaleY), 
      offsetX: (renderedWidth - visibleVideoWidth) / 2, 
      offsetY: (renderedHeight - visibleVideoHeight) / 2 
    };
  }, [referenceDimensions, videoState.videoWidth, videoState.videoHeight]);

  // Re-calculate overlays instantly and safely on dependancy adjustments
  const scaledOverlays = useMemo(() => {
    if (!overlays || typeof scaleFactor !== 'object') return [];
    return overlays.map(overlay => ({
      ...overlay,
      position: {
        ...overlay.position,
        x: overlay.position.x * scaleFactor.scale + scaleFactor.offsetX,
        y: overlay.position.y * scaleFactor.scale + scaleFactor.offsetY,
      },
      size: {
        width: overlay.size.width * scaleFactor.scale,
        height: overlay.size.height * scaleFactor.scale
      }
    }));
  }, [overlays, scaleFactor]);

  return (
    <div className="video-container w-full h-full relative overflow-hidden bg-black">
      {videoUrl && (
        <video
          ref={videoRef}
          className="video-element w-full h-full object-cover"
          muted
          loop
          playsInline
          controls={false}
          preload="auto" // Critical for caching
          // Disable picture-in-picture to save resources in Kiosk mode
          disablePictureInPicture
          // Disable remote playback to save resources
          disableRemotePlayback
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
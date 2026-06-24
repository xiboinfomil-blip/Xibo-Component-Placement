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
    console.log('[Xibo Widget] Component Mounted. Registering EmbedInit.');
    window.EmbedInit = () => {
      console.log('[Xibo Widget] Layout Engine Handshake received.');
    };

    return () => {
      console.log('[Xibo Widget] Component Unmounting. Cleaning up EmbedInit.');
      delete window.EmbedInit;
    };
  }, []);

  // 2. Heavy-duty Autoplay enforcement & Caching Strategy
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) {
      console.warn('[Video Cache] No video URL provided or ref missing.');
      return;
    }

    console.log(`[Video Cache] Loading new source: ${videoUrl}`);

    // Clean up previous source if exists to free memory
    if (objectUrlRef.current) {
      console.log('[Video Cache] Revoking previous object URL to free memory.');
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    // Force load the new source
    video.src = videoUrl;
    
    // Log ready state changes for debugging caching behavior
    const handleReadyStateChange = () => {
      console.log(`[Video Cache] ReadyState changed: ${video.readyState} (0=Nothing, 1=Metadata, 2=Current, 3=Future, 4=Enough)`);
    };
    video.addEventListener('readystatechange', handleReadyStateChange);

    video.load();

    const attemptPlay = async () => {
      try {
        console.log('[Video Playback] Attempting autoplay...');
        await video.play();
        console.log('[Video Playback] Autoplay successful.');
      } catch (error) {
        console.warn('[Video Playback] Autoplay blocked or failed:', error);
        console.log('[Video Playback] Retrying with muted=true...');
        video.muted = true;
        try {
          await video.play();
          console.log('[Video Playback] Muted autoplay successful.');
        } catch (muteError) {
          console.error('[Video Playback] Critical playback failure even when muted:', muteError);
        }
      }
    };

    attemptPlay();

    // Cleanup function to prevent memory leaks in long-running Xibo players
    return () => {
      console.log('[Video Cache] Cleaning up video element resources.');
      video.removeEventListener('readystatechange', handleReadyStateChange);
      
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

    console.log('[Video Telemetry] Setting up event listeners.');

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

    video.addEventListener('loadedmetadata', () => {
      console.log('[Video Telemetry] Metadata loaded.', { width: video.videoWidth, height: video.videoHeight, duration: video.duration });
      updateStateFromVideo();
    });
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    
    video.addEventListener('play', () => {
      console.log('[Video Telemetry] Event: Play');
      updateStateFromVideo();
    });
    
    video.addEventListener('pause', () => {
      console.log('[Video Telemetry] Event: Pause');
      updateStateFromVideo();
    });
    
    video.addEventListener('ended', () => {
      console.log('[Video Telemetry] Event: Ended');
      updateStateFromVideo();
    });
    
    const handleError = (e: Event) => {
      // @ts-ignore - Error event has specific properties
      const error = e.target?.error;
      console.error('[Video Telemetry] Playback Error Code:', error?.code, 'Message:', error?.message);
    };
    video.addEventListener('error', handleError);

    if (video.readyState >= 1) {
      console.log('[Video Telemetry] Initial state capture (already loaded).');
      updateStateFromVideo();
    }

    return () => {
      console.log('[Video Telemetry] Removing event listeners.');
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
    console.log('[Overlay Renderer] All components reported ready.');
    setIsAllOverlaysReady(true);
  }, []);

  // 4. Clean, declarative scaling math with useMemo
  const scaleFactor = useMemo(() => {
    const video = videoRef.current;
    if (!video || !referenceDimensions) {
      console.log('[Scaling] Missing video ref or reference dimensions.');
      return { scale: 1, offsetX: 0, offsetY: 0 };
    }
    
    const renderedWidth = video.clientWidth;
    const renderedHeight = video.clientHeight;
    
    if (!renderedWidth || !renderedHeight) return { scale: 1, offsetX: 0, offsetY: 0 };
    
    const videoAspect = video.videoWidth / video.videoHeight;
    const containerAspect = renderedWidth / renderedHeight;
    
    let visibleVideoWidth, visibleVideoHeight;
    if (containerAspect > videoAspect) {
      visibleVideoWidth = renderedWidth;
      visibleVideoHeight = renderedWidth / videoAspect;
    } else {
      visibleVideoHeight = renderedHeight;
      visibleVideoWidth = renderedHeight * videoAspect;
    }
    
    const scaleX = visibleVideoWidth / referenceDimensions.width;
    const scaleY = visibleVideoHeight / referenceDimensions.height;
    
    const result = { 
      scale: Math.max(scaleX, scaleY), 
      offsetX: (renderedWidth - visibleVideoWidth) / 2, 
      offsetY: (renderedHeight - visibleVideoHeight) / 2 
    };

    // Only log significant changes to avoid console spam during resize
    // console.log('[Scaling] Calculated scale factor:', result.scale.toFixed(3));
    return result;
  }, [referenceDimensions, videoState.videoWidth, videoState.videoHeight]);

  // Re-calculate overlays instantly and safely on dependancy adjustments
  const scaledOverlays = useMemo(() => {
    if (!overlays || typeof scaleFactor !== 'object') return [];
    
    // console.log(`[Overlay Calc] Scaling ${overlays.length} overlays.`);
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
          preload="auto"
          disablePictureInPicture
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
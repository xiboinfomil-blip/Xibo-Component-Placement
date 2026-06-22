import { useEffect, useRef, useState, useCallback } from 'react';
import OverlayRenderer from './OverlayRenderer';
import { useCachedVideo } from '../hooks/useCachedVideo';
import './VideoBackground.css';

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
  updatedAt,
  overlays, 
  referenceDimensions,
  onVideoStateChange 
}: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Handle video caching
  const { 
    data: videoBlob, 
    isLoading: isVideoLoading, 
    error: videoError 
  } = useCachedVideo(videoUrl, updatedAt);
  
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  
  useEffect(() => {
    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      setObjectUrl(url);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [videoBlob]);

  const [videoState, setVideoState] = useState<VideoState>({
    currentTime: 0,
    duration: 0,
    paused: true,
    videoWidth: 0,
    videoHeight: 0,
    readyState: 0
  });
  
  const [isAllOverlaysReady, setIsAllOverlaysReady] = useState(false);

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
    const handleError = (e: Event) => console.error('[VideoBackground] Video playback error:', e);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    // Initial check
    if (video.readyState >= 1) updateStateFromVideo();

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [objectUrl, videoUrl]); // Re-attach when hardware endpoints shift

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

  const videoSource = objectUrl || videoUrl;

  return (
    <div className="video-container w-full h-full relative overflow-hidden bg-black">
      {videoError && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black text-red-500">
          <div className="text-center font-semibold">Failed to load video layer.</div>
        </div>
      )}

      {videoSource && (
        <video
          ref={videoRef}
          src={videoSource}
          className="video-element w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
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
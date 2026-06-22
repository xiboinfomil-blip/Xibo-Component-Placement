import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom'; // 1. Import routing hooks
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import VideoBackground, { VideoState } from '../components/VideoBackground';
import LoadingSpinner from '../components/LoadingSpinner';

const queryClient = new QueryClient();

export default function App() {
  // 2. Extract ID from route params (e.g., if your route is defined as /video/:id)
  const { id } = useParams<{ id: string }>();
  
  // 3. Extract ID from the URL path segments (e.g., if your route is just /:id)
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);
  
  // 4. Dynamic VIDEO_DOC_ID
  // Prioritizes route param -> then last path segment -> then fallback to original ID
  const VIDEO_DOC_ID = id || pathSegments[pathSegments.length - 1];

  const [videoData, setVideoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoState, setVideoState] = useState<VideoState | null>(null);
  const videoControlsRef = useRef<any>(null);

  useEffect(() => {
    // Reset state when VIDEO_DOC_ID changes (useful if navigating between videos)
    setLoading(true);
    setError(null);

    async function fetchVideoData() {
      try {
        const docRef = doc(db, 'videos', VIDEO_DOC_ID);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setVideoData(docSnap.data());
        } else {
          setError('Video document not found');
        }
      } catch (err: any) {
        console.error('Error fetching video data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (VIDEO_DOC_ID) {
      fetchVideoData();
    } else {
      setLoading(false);
      setError('No video ID provided in the URL.');
    }
  }, [VIDEO_DOC_ID]); // 5. Added VIDEO_DOC_ID to dependency array so it refetches on URL change

  const handleVideoStateChange = useCallback((state: VideoState) => {
    setVideoState(state);
  }, []);

  // Access video controls after mount
  useEffect(() => {
    // You can access video controls here if needed
    // For example: videoControlsRef.current?.play();
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#050505] text-white overflow-hidden">
        <div className="text-center">
          <p className="text-red-400/80 text-xs font-medium tracking-[0.3em] uppercase mb-3">
            Erreur de chargement
          </p>
          <p className="text-zinc-500 text-sm max-w-xs mx-auto leading-relaxed">
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <VideoBackground 
        videoUrl={videoData?.url}
        updatedAt={videoData?.updatedAt}
        overlays={videoData?.overlays}
        referenceDimensions={videoData?.referenceDimensions}
        onVideoStateChange={handleVideoStateChange}
      />
    </QueryClientProvider>
  );
}
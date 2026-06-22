import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import VideoBackground, { VideoState } from '../components/VideoBackground';
import LoadingSpinner from '../components/LoadingSpinner';

// Create the query client outside the component
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevents aggressive refetching in Xibo
      retry: 2,                    // Retries fetching if the signage network blips
    },
  },
});

function VideoPlayerApp() {
  // 1. Extract ID via traditional route params (e.g., /video/:id)
  const { id } = useParams<{ id: string }>();
  
  // 2. Extract ID from path segments (e.g., /:id)
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);
  
  // 3. Extract ID from URL search parameters (e.g., ?id=YOUR_ID)
  // This is the most bulletproof method for Xibo Player local environments!
  const searchParams = new URLSearchParams(location.search);
  const queryId = searchParams.get('id');

  // Priority: Query Param (?id=) -> Route Param (:id) -> Last Path Segment
  const VIDEO_DOC_ID = queryId || id || pathSegments[pathSegments.length - 1];

  const [videoState, setVideoState] = useState<VideoState | null>(null);
  const videoControlsRef = useRef<any>(null);

  // 4. Use TanStack React Query for Firebase fetching
  const { data: videoData, isLoading, error } = useQuery({
    queryKey: ['videoData', VIDEO_DOC_ID],
    queryFn: async () => {
      if (!VIDEO_DOC_ID) {
        throw new Error('No video ID provided in the URL.');
      }

      const docRef = doc(db, 'videos', VIDEO_DOC_ID);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Video document not found in Firestore.');
      }
      
      return docSnap.data();
    },
    enabled: !!VIDEO_DOC_ID, // Only run the query if we actually found an ID
  });

  const handleVideoStateChange = useCallback((state: VideoState) => {
    setVideoState(state);
  }, []);

  // Handle Loading State
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Handle Error State (No ID or Firebase failure)
  if (error || !VIDEO_DOC_ID) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#050505] text-white overflow-hidden">
        <div className="text-center">
          <p className="text-red-400/80 text-xs font-medium tracking-[0.3em] uppercase mb-3">
            Erreur de chargement
          </p>
          <p className="text-zinc-500 text-sm max-w-xs mx-auto leading-relaxed">
            {error instanceof Error ? error.message : 'Une erreur inconnue est survenue.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <VideoBackground 
      videoUrl={videoData?.url}
      updatedAt={videoData?.updatedAt}
      overlays={videoData?.overlays}
      referenceDimensions={videoData?.referenceDimensions}
      onVideoStateChange={handleVideoStateChange}
    />
  );
}

// Shell wrapper to ensure QueryClientProvider is higher in the tree than the useQuery hook
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <VideoPlayerApp />
    </QueryClientProvider>
  );
}
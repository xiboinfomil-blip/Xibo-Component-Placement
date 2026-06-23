import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useCallback, useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import VideoBackground, { VideoState } from '../components/VideoBackground';
import LoadingSpinner from '../components/LoadingSpinner';

// 1. Enhanced Query Client for 24/7 Signage (Safe for JSON configuration documents)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevents aggressive refetching in Xibo
      retry: 5,                    // Increased retries for spotty signage networks
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000), // Exponential backoff up to 30s
      refetchInterval: 1000 * 60 * 5, // AUTO-REFRESH: Pulls new Firestore data every 5 minutes automatically
      staleTime: 1000 * 60 * 2,    // Conserves Firestore reads
    },
  },
});

function VideoPlayerApp() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  // 2. Bulletproof ID Extraction for Xibo's Embedded Browser Environment
  const getParamId = () => {
    // Check standard query string (?id=...)
    const standardParams = new URLSearchParams(window.location.search);
    if (standardParams.get('id')) return standardParams.get('id');

    // Check hash-based query string if Xibo or HashRouter forces a hash path (e.g., /#/video?id=...)
    const hashSplit = window.location.hash.split('?');
    if (hashSplit[1]) {
      const hashParams = new URLSearchParams(hashSplit[1]);
      if (hashParams.get('id')) return hashParams.get('id');
    }

    // Fallback to React Router path parsing
    if (id) return id;
    const pathSegments = location.pathname.split('/').filter(Boolean);
    return pathSegments[pathSegments.length - 1] || null;
  };

  const VIDEO_DOC_ID = getParamId();
  const [, setVideoState] = useState<VideoState | null>(null);

  const { data: videoData, isLoading, error } = useQuery({
    queryKey: ['videoData', VIDEO_DOC_ID],
    queryFn: async () => {
      if (!VIDEO_DOC_ID) {
        throw new Error('Aucun identifiant (ID) trouvé dans l’URL.');
      }

      const docRef = doc(db, 'videos', VIDEO_DOC_ID);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Document vidéo introuvable dans Firestore.');
      }
      
      return docSnap.data();
    },
    enabled: !!VIDEO_DOC_ID,
  });

  // 3. Self-Healing Mechanism: Auto-reload the page on persistent errors
  useEffect(() => {
    if (error) {
      const reloadTimer = setTimeout(() => {
        window.location.reload();
      }, 30000); // Attempt a hard reload after 30 seconds of failure state

      return () => clearTimeout(reloadTimer);
    }
  }, [error]);

  const handleVideoStateChange = useCallback((state: VideoState) => {
    setVideoState(state);
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error || !VIDEO_DOC_ID) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#050505] text-white overflow-hidden">
        <div className="text-center p-6">
          <p className="text-red-400/80 text-xs font-medium tracking-[0.3em] uppercase mb-3">
            Erreur de chargement
          </p>
          <p className="text-zinc-500 text-sm max-w-xs mx-auto leading-relaxed">
            {error instanceof Error ? error.message : 'Une erreur inconnue est survenue.'}
          </p>
          <p className="text-zinc-600 text-xs mt-4 animate-pulse">
            Tentative de reconnexion automatique...
          </p>
        </div>
      </div>
    );
  }

  return (
    <VideoBackground 
      videoUrl={videoData?.videoUrl || videoData?.url}
      overlays={videoData?.overlays}
      referenceDimensions={videoData?.referenceDimensions}
      onVideoStateChange={handleVideoStateChange}
    />
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <VideoPlayerApp />
    </QueryClientProvider>
  );
}
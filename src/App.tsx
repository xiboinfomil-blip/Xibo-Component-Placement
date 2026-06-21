// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import VideoBackground, { VideoState } from '../components/VideoBackground';
import LoadingSpinner from '../components/LoadingSpinner'; // 1. Import the new component

const queryClient = new QueryClient();

// Your video document ID from Firebase
const VIDEO_DOC_ID = 'pq2Qlsa6ML89EYofgTdp';

export default function App() {
  const [videoData, setVideoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoState, setVideoState] = useState<VideoState | null>(null);
  const videoControlsRef = useRef<any>(null);

  useEffect(() => {
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

    fetchVideoData();
  }, []);

  const handleVideoStateChange = useCallback((state: VideoState) => {
    setVideoState(state);
  }, []);

  // Access video controls after mount
  useEffect(() => {
    // You can access video controls here if needed
    // For example: videoControlsRef.current?.play();
  }, []);

  // 2. Use the premium spinner here
  if (loading) {
    return <LoadingSpinner />;
  }

  // 3. (Bonus) Updated error state to match the premium dark aesthetic
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
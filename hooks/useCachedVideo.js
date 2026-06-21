import { useQuery } from '@tanstack/react-query';
import { getCachedVideo, cacheVideo } from '../lib/cacheUtils';

export function useCachedVideo(videoUrl, firebaseUpdatedAt) {
  return useQuery({
    queryKey: ['video', videoUrl],
    queryFn: async () => {
      if (!videoUrl) {
        throw new Error('No video URL provided');
      }

      // Try cache first
      const cachedBlob = await getCachedVideo(videoUrl, firebaseUpdatedAt);
      
      if (cachedBlob) {
        return cachedBlob;
      }
      
      // Fetch from network
      console.log('🔄 Fetching video from network');
      const response = await fetch(videoUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Cache it
      await cacheVideo(videoUrl, blob, firebaseUpdatedAt);
      
      return blob;
    },
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    enabled: !!videoUrl,
  });
}
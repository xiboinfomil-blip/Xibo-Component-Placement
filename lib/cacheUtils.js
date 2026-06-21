const CACHE_NAME = 'video-cache-v1';

export async function getCachedVideo(videoUrl, firebaseUpdatedAt) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(videoUrl);
    
    if (cachedResponse) {
      const cachedMeta = await cache.match(`${videoUrl}.meta`);
      
      if (cachedMeta) {
        const meta = await cachedMeta.json();
        
        if (meta.updatedAt === firebaseUpdatedAt) {
          console.log('✅ Serving from Cache API');
          return await cachedResponse.blob();
        }
      }
    }
  } catch (error) {
    console.error('Cache read error:', error);
  }
  
  return null;
}

export async function cacheVideo(videoUrl, blob, firebaseUpdatedAt) {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    const response = new Response(blob, {
      headers: {
        'Content-Type': 'video/mp4',
      },
    });
    await cache.put(videoUrl, response);
    
    const metaResponse = new Response(
      JSON.stringify({ updatedAt: firebaseUpdatedAt }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    await cache.put(`${videoUrl}.meta`, metaResponse);
    
    console.log('💾 Video cached successfully');
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

export async function clearOldCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    for (const request of keys) {
      if (request.url.endsWith('.meta')) {
        const videoUrl = request.url.replace('.meta', '');
        const hasVideo = await cache.match(videoUrl);
        
        if (!hasVideo) {
          await cache.delete(request);
          console.log('🗑️ Cleaned up orphaned meta');
        }
      }
    }
  } catch (error) {
    console.error('Cache cleanup error:', error);
  }
}

export async function getCacheInfo() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    
    let totalSize = 0;
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
    
    return {
      count: keys.length,
      sizeMB: (totalSize / (1024 * 1024)).toFixed(2),
    };
  } catch (error) {
    console.error('Cache info error:', error);
    return { count: 0, sizeMB: '0' };
  }
}
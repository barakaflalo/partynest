// PartyNest Service Worker - Network First
/* Cloudflare Pages redirects *.html -> pretty URL (308); a cached "redirected" copy is refused for page loads. Hand navigations a clean copy. */
function cleanNav(r){ if(!r||!r.redirected) return r; return r.blob().then(function(b){return new Response(b,{status:r.status,statusText:r.statusText,headers:r.headers});}); }
var _respondWith=FetchEvent.prototype.respondWith;
FetchEvent.prototype.respondWith=function(p){ var nav=this.request.mode==='navigate'; return _respondWith.call(this, nav?Promise.resolve(p).then(cleanNav):p); };
const CACHE_NAME = 'partynest-v2';
const OFFLINE_URL = './';

// Install: cache the main page
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll([OFFLINE_URL]);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k.indexOf('partynest-')===0 && k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network first, fallback to cache
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  // Skip Firebase requests - always network
  if (e.request.url.includes('firebase') || 
      e.request.url.includes('googleapis') ||
      e.request.url.includes('gstatic')) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(function(response) {
        // Cache successful responses
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      })
      .catch(function() {
        // Network failed - use cache
        return caches.match(e.request).then(function(cached) {
          return cached || caches.match(OFFLINE_URL);
        });
      })
  );
});

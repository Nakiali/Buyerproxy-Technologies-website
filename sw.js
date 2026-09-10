/* ═══════════════════════════════════════════════════
   BuyerProxy Service Worker — PWA / Offline Support
   v1.0
═══════════════════════════════════════════════════ */

var CACHE      = "buyerproxy-v1";
var FONT_CACHE = "buyerproxy-fonts-v1";

/* Core app shell — pre-cached on install */
var PRECACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

/* ── INSTALL: cache the app shell ── */
self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      return cache.addAll(PRECACHE);
    }).then(function(){
      return self.skipWaiting();
    }).catch(function(err){
      console.warn("SW install failed:", err);
      return self.skipWaiting();
    })
  );
});

/* ── ACTIVATE: remove old caches ── */
self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k!==CACHE && k!==FONT_CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

/* ── FETCH: smart caching strategy ── */
self.addEventListener("fetch", function(e){
  var url = e.request.url;

  /* Only handle GET */
  if(e.request.method !== "GET") return;

  /* Skip non-http, chrome-extension, Cloudflare CDN */
  if(!url.startsWith("http")) return;
  if(url.includes("cdn-cgi") || url.includes("cloudflare-static")) return;

  /* Skip Firebase API calls — always go to network */
  if(url.includes("firestore.googleapis.com") ||
     url.includes("firebase.googleapis.com")  ||
     url.includes("gstatic.com/firebasejs")) {
    /* Firebase SDK: cache-first so it loads offline too */
    if(url.includes("gstatic.com/firebasejs")){
      e.respondWith(
        caches.open(FONT_CACHE).then(function(cache){
          return cache.match(e.request).then(function(cached){
            if(cached) return cached;
            return fetch(e.request).then(function(res){
              if(res && res.status===200) cache.put(e.request, res.clone());
              return res;
            });
          });
        })
      );
    }
    /* Firestore data calls: always network, never cache */
    return;
  }

  /* Google Fonts: cache-first */
  if(url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com")){
    e.respondWith(
      caches.open(FONT_CACHE).then(function(cache){
        return cache.match(e.request).then(function(cached){
          if(cached) return cached;
          return fetch(e.request).then(function(res){
            if(res && res.status===200) cache.put(e.request, res.clone());
            return res;
          }).catch(function(){ return new Response("",{status:408}); });
        });
      })
    );
    return;
  }

  /* Same-origin app files: cache-first + background update */
  if(url.startsWith(self.location.origin)){
    e.respondWith(
      caches.match(e.request).then(function(cached){
        var networkFetch = fetch(e.request).then(function(res){
          if(res && res.status===200){
            caches.open(CACHE).then(function(cache){
              cache.put(e.request, res.clone());
            });
          }
          return res;
        }).catch(function(){});

        /* Return cached version immediately; update in background */
        return cached || networkFetch || caches.match("/index.html");
      })
    );
    return;
  }

  /* Everything else: network with cache fallback */
  e.respondWith(
    fetch(e.request).catch(function(){
      return caches.match(e.request);
    })
  );
});

/* ── Message handler (force update) ── */
self.addEventListener("message", function(e){
  if(e.data && e.data.type==="SKIP_WAITING") self.skipWaiting();
});

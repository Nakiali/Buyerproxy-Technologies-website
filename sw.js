/*
  BuyerProxy Service Worker — safer PWA caching
  v2.0

  Security rule: never cache Firebase/Firestore data responses.
  Navigation is NETWORK-FIRST so a new deployment is not hidden behind
  an old cached index.html.
*/

var APP_CACHE  = "buyerproxy-app-v2";
var STATIC_CACHE = "buyerproxy-static-v2";
var FONT_CACHE = "buyerproxy-fonts-v2";

var PRECACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(APP_CACHE).then(function(cache){
      return cache.addAll(PRECACHE);
    }).then(function(){
      return self.skipWaiting();
    }).catch(function(err){
      console.warn("SW install failed:", err);
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){
        return [APP_CACHE, STATIC_CACHE, FONT_CACHE].indexOf(k) === -1;
      }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function isFirebaseData(url){
  return url.includes("firestore.googleapis.com") ||
         url.includes("firebase.googleapis.com") ||
         url.includes("securetoken.googleapis.com") ||
         url.includes("identitytoolkit.googleapis.com") ||
         url.includes("firebaseinstallations.googleapis.com") ||
         url.includes("firebaseio.com");
}

function isFirebaseSDK(url){
  return url.includes("www.gstatic.com/firebasejs/");
}

function isFont(url){
  return url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com");
}

self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  var url=e.request.url;
  if(!url.startsWith("http")) return;
  if(url.includes("cdn-cgi") || url.includes("cloudflare-static")) return;

  // Never cache Firebase data/auth traffic.
  if(isFirebaseData(url)) return;

  // Firebase SDK and Google Fonts are static assets.
  if(isFirebaseSDK(url) || isFont(url)){
    e.respondWith(
      caches.open(FONT_CACHE).then(function(cache){
        return cache.match(e.request).then(function(cached){
          var network=fetch(e.request).then(function(res){
            if(res && res.status===200) cache.put(e.request,res.clone());
            return res;
          });
          return cached || network;
        });
      })
    );
    return;
  }

  if(url.startsWith(self.location.origin)){
    var requestPath=new URL(url).pathname;

    // Network-first for navigation/app shell. Fall back to cached shell offline.
    if(e.request.mode === "navigate" || requestPath === "/" || requestPath === "/index.html"){
      e.respondWith(
        fetch(e.request).then(function(res){
          if(res && res.ok){
            caches.open(APP_CACHE).then(function(cache){ cache.put(e.request,res.clone()); });
          }
          return res;
        }).catch(function(){
          return caches.match(e.request).then(function(cached){
            return cached || caches.match("/index.html");
          });
        })
      );
      return;
    }

    // Static same-origin assets: stale-while-revalidate.
    e.respondWith(
      caches.match(e.request).then(function(cached){
        var network=fetch(e.request).then(function(res){
          if(res && res.ok){
            caches.open(STATIC_CACHE).then(function(cache){ cache.put(e.request,res.clone()); });
          }
          return res;
        }).catch(function(){ return cached; });
        return cached || network;
      })
    );
    return;
  }

  // External non-Firebase GET: network first, cache fallback if previously cached.
  e.respondWith(fetch(e.request).catch(function(){ return caches.match(e.request); }));
});

self.addEventListener("message", function(e){
  if(e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

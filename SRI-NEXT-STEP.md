# SRI — final step still required

The current `index.html` loads the pinned Firebase 10.12.0 compat SDK from `www.gstatic.com`.

Do not invent an `integrity="sha384-..."` value. Generate each SHA-384 hash from the exact deployed bytes, then add it to the corresponding script tag together with `crossorigin="anonymous"`.

Required files:
- firebase-app-compat.js
- firebase-firestore-compat.js
- firebase-auth-compat.js

This is intentionally left as a separate step so a wrong hash cannot break the live BuyerProxy application.

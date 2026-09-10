# BuyerProxy — Secure GitHub → Netlify Deployment

This package aligns the BuyerProxy frontend with the hardened Firestore rules.

## Files
- `index.html` — updated application frontend; existing visual design retained.
- `firestore.rules` — scoped Admin/Agent/Client access.
- `netlify.toml` — security headers + CSP Report-Only + cache policy.
- `sw.js` — safer PWA caching; Firestore/Auth data is never cached.
- `manifest.json` — PWA metadata.
- `firebase.json` — Firebase CLI rules deployment configuration.

## Important before production
1. Keep your Firebase project `buyerproxy-v3` and make sure Authentication/Firestore are enabled.
2. Deploy `firestore.rules` to the same Firebase project.
3. Confirm the first/admin user already has `role: "admin"` in `bp_data/collections/users/{uid}`.
4. The frontend now resolves username login through `bp_data/collections/usernames/{username}` rather than querying the entire users collection.
5. Admin agent creation uses a secondary Firebase Auth app so the admin session is not replaced by the new agent account.
6. Agent/client Firestore reads are now role-scoped; the frontend no longer performs a full users/orders/disputes download for every signed-in user.
7. CSP is intentionally **Report-Only** at this stage because the existing UI still uses inline scripts, inline event handlers, and inline styles. Do not change it to enforced CSP until the inline-JS migration is completed and tested.
8. SRI hashes were not inserted blindly. They must be generated from the exact Firebase SDK bytes used in deployment before claiming the SRI Observatory check is fixed.

## Firebase CLI
From this folder:

```bash
firebase login
firebase use buyerproxy-v3
firebase deploy --only firestore:rules
```

If `firebase use buyerproxy-v3` says the project is not configured locally, run:

```bash
firebase use --add
```

and select `buyerproxy-v3`.

## Netlify / GitHub
Push all files in this folder to the GitHub repository connected to Netlify. Netlify should use:
- Publish directory: `.`
- Build command: none

The `netlify.toml` in the repository supplies the headers and SPA redirect.

## Required smoke tests after deployment
### Public
- Landing page loads.
- Public order submission creates a `New` order.
- Public order success modal works.

### Client
- Register a new client.
- Log out.
- Log in by email.
- Log in by username.
- Client sees only their own orders.
- Client cannot open another client's order by direct document ID.
- Client rating saves only 1–5 stars.

### Admin
- Admin login works.
- Admin sees all orders/users/disputes.
- Admin can assign an agent.
- Assignment writes both `agent_id` and `agent_uid`.
- Admin can update M-Pesa reference/status.
- Admin can create a manual order.
- Admin can create an agent without being logged out or converted into the agent account.
- Admin can resolve disputes.

### Agent
- Agent login works.
- Agent sees only orders assigned to that agent.
- Agent can update only allowed workflow status/note fields.
- Agent cannot reassign an order.
- Agent can raise a dispute only for an order assigned to them.
- Agent profile update works.

### Security
- Open browser DevTools → Application → Storage and confirm sensitive caches are UID-scoped.
- Test client A against client B data.
- Test agent A against agent B data.
- Rescan the deployed site with MDN HTTP Observatory.

## Do not do this
Never replace these rules with:

```text
allow read, write: if request.auth != null;
```

and never put Firebase Admin SDK service-account private keys in `index.html` or GitHub.

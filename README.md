# Rotina de Alto Desempenho

Static site on GitHub Pages with Firebase as backend.

## Private access mode (single account)
This project is now locked with Firebase Authentication and only one owner email is allowed.

Owner email configured in code:
- `igor.ramosr@hotmail.com`

Important limitation:
- GitHub Pages serves static files publicly.
- The login gate blocks UI usage and backend writes, but does not make static source files secret.

## Stack
- Frontend: static HTML/CSS/JS
- Hosting: GitHub Pages
- Backend: Firebase Functions + Firestore
- Auth: Firebase Authentication (Email/Password)

## Local structure
- `index.html`: static website
- `functions/index.js`: HTTP backend API
- `firestore.rules`: Firestore security rules
- `.github/workflows/deploy-pages.yml`: Pages deploy pipeline

## Backend API
Base URL (after deploy):
- `https://southamerica-east1-vidapessoal-ebf84.cloudfunctions.net/api`

Routes:
- `GET /health`
- `POST /lead`

Auth requirement:
- `GET /health` is public.
- Other routes require Firebase ID token in `Authorization: Bearer <token>`.
- Token email must match owner email (`igor.ramosr@hotmail.com`).

Example body for `POST /lead`:
```json
{
  "name": "Igor",
  "email": "igor@example.com",
  "note": "Quero entrar na lista"
}
```

## Deploy backend
From repo root:
```bash
firebase use --add
cd functions
npm install
cd ..
set OWNER_EMAIL=igor.ramosr@hotmail.com
firebase deploy --only functions,firestore
```

On Linux/macOS replace `set` with:
```bash
export OWNER_EMAIL=igor.ramosr@hotmail.com
```

## Configure Firebase Auth (required)
1. Open Firebase Console > Authentication > Sign-in method.
2. Enable `Email/Password` provider.
3. Create a user with email `igor.ramosr@hotmail.com`.
4. Open Firebase Console > Project settings > Your apps > Web app config.
5. Copy `apiKey`, `authDomain`, `projectId` and `appId` into `index.html` (`firebaseConfig` object).

## Deploy frontend
Push to `main` branch. GitHub Action deploys the site automatically.

For private repositories, make sure your GitHub plan allows Pages for private repos.

## Client helper
After login, frontend exposes:
- `window.getOwnerIdToken()`

You can use it for authenticated API calls:
```js
const token = await window.getOwnerIdToken();

const apiBaseUrl = "https://southamerica-east1-vidapessoal-ebf84.cloudfunctions.net/api";

await fetch(`${apiBaseUrl}/lead`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  },
  body: JSON.stringify({
    name: "Igor",
    email: "igor@example.com",
    note: "teste",
  }),
});
```

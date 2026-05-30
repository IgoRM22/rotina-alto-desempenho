# Rotina de Alto Desempenho

Static site on GitHub Pages with Firebase as backend.

## Access control (authorized e-mails)
This project uses Google login via Firebase Authentication.

Access rule:
- App data is shared from owner path: /users/xTs3D5SePzed6eWo72e56oqFoBd2.
- A user can enter only if their authenticated e-mail is in Firestore document:
  - /system/accessControl
  - field: allowedEmails (array of strings)
- If e-mail is not authorized, login is blocked and user is signed out.

Recommended setup:
1. In Firestore, create document /system/accessControl.
2. Add field allowedEmails with a list of authorized e-mails.
3. Keep e-mails in lowercase for consistency.

Example:
```json
{
  "allowedEmails": [
    "admin@email.com",
    "pessoa.autorizada@email.com"
  ]
}
```

Important limitation:
- GitHub Pages serves static files publicly.
- The login gate blocks UI usage and backend writes, but does not make static source files secret.

## Stack
- Frontend: static HTML/CSS/JS
- Hosting: GitHub Pages
- Backend: Firebase Functions + Firestore
- Auth: Firebase Authentication (Google)

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
- If `OWNER_EMAIL` env var is defined on deploy, token email must match it.

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
firebase deploy --only functions,firestore
```

Optional hard-lock by email (Windows):
```bash
set OWNER_EMAIL=seu-email@gmail.com
firebase deploy --only functions,firestore
```

Linux/macOS:
```bash
export OWNER_EMAIL=seu-email@gmail.com
firebase deploy --only functions,firestore
```

## Configure Firebase Auth (required)
1. Open Firebase Console > Authentication > Sign-in method.
2. Enable `Google` provider.
3. Open Authentication > Settings > Authorized domains.
4. Add `igorm22.github.io`.
5. Open Firebase Console > Project settings > Your apps > Web app config.
6. Copy `apiKey`, `authDomain`, `projectId` and `appId` into `index.html` (`firebaseConfig` object).

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

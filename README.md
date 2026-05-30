# Rotina de Alto Desempenho

Static site on GitHub Pages with Firebase as backend.

## Stack
- Frontend: static HTML/CSS/JS
- Hosting: GitHub Pages
- Backend: Firebase Functions + Firestore

## Local structure
- `index.html`: static website
- `functions/index.js`: HTTP backend API
- `firestore.rules`: Firestore security rules
- `.github/workflows/deploy-pages.yml`: Pages deploy pipeline

## Backend API
Base URL (after deploy):
- `https://southamerica-east1-meuprofissadev-487520.cloudfunctions.net/api`

Routes:
- `GET /health`
- `POST /lead`

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
cd functions
npm install
cd ..
firebase deploy --only functions,firestore
```

## Deploy frontend
Push to `main` branch. GitHub Action deploys the site automatically.

For private repositories, make sure your GitHub plan allows Pages for private repos.

## Recommended next step
After first function deploy, copy the final function URL from the CLI output and use it in frontend JS.

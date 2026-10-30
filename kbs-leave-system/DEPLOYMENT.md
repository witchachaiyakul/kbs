# Deployment

## Architecture

- GitHub Pages serves the static files in `frontend/`.
- VS Code Live Server serves the same files locally.
- Firebase Function `gasApi` is the browser-facing API proxy. It keeps the GAS URL and shared secret server-side and allows only the named API methods.
- Google Apps Script remains responsible for LINE ID-token verification, leave rules, Sheets access, Google Docs/PDF generation, and LINE messaging.
- GitHub Actions runs the proxy tests and JavaScript syntax checks before publishing GitHub Pages. It does not call production Sheets or LINE.

## Configure GAS

In the Apps Script project, add Script Property `API_SHARED_SECRET` with a newly generated, high-entropy value. Keep the existing LINE token properties there. Deploy the web app to execute as the deploying account and allow anonymous access; the API dispatcher rejects requests without the shared secret, and user-facing API methods still verify LINE ID tokens.

Deploy the updated `backend/Code.js` to the existing Apps Script deployment. The LINE webhook continues to use the same `/exec` URL.

## Configure Firebase Functions

Select the Firebase project, then set the two Functions secrets. Use the Apps Script web app `/exec` URL for `GAS_API_URL` and the exact same value as the GAS `API_SHARED_SECRET` for `GAS_API_SECRET`.

```sh
cd functions
npm ci
npm test
cd ..
firebase login
firebase use --add
firebase functions:secrets:set GAS_API_URL
firebase functions:secrets:set GAS_API_SECRET
firebase deploy --only functions:gasApi
```

Set the deployed function URL in `frontend/js/config.js` by replacing `YOUR_FIREBASE_PROJECT_ID`. The URL is public configuration, not a secret. Never put `GAS_API_SECRET`, LINE tokens, or service credentials in frontend files or GitHub.

## Test With Live Server

Install the Firebase CLI and start the Functions emulator from the repository root:

```sh
firebase emulators:start --only functions --project demo-kbs-leave
```

The frontend automatically uses `http://127.0.0.1:5001/demo-kbs-leave/us-central1/gasApi` on localhost. Create `functions/.secret.local` with `GAS_API_URL` and `GAS_API_SECRET` to let the emulator reach GAS. This file is ignored by Git. For meaningful end-to-end testing, point it at a separate test Apps Script deployment and test spreadsheet; submitting a form writes records and creates real Drive documents.

Open `frontend/index.html` with Live Server. LINE login is completed on the registered LIFF relay page and returns to localhost. Local login requires that the LIFF endpoint already points to the deployed `liff-relay.html` and that the browser can open the localhost Live Server origin.

## Publish GitHub Pages

In the GitHub repository, choose **Settings → Pages → Build and deployment → GitHub Actions**. Push to `main` or run the `Test and deploy frontend` workflow manually. It publishes only `frontend/` after tests pass.

Set the LINE LIFF endpoint URL to the deployed `liff-relay.html`, for example `https://OWNER.github.io/REPOSITORY/liff-relay.html`. The actual owner and repository path must match the GitHub Pages URL.

## Verification Scope

GitHub Actions tests the proxy contract and checks JavaScript syntax. A live test of Sheets, LINE, Drive, and Google Docs requires configured Firebase/GAS credentials and should use a separate test spreadsheet and document templates.
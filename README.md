# Shortly — URL Shortener

A full-stack URL shortener built with React, Vite, Node.js, Express, and MongoDB.
It creates short links, supports custom short codes and expiration, and includes
accounts, QR downloads, and a click analytics dashboard.

## Requirements

- Node.js 20.19+ or 22.12+
- MongoDB running locally, or a MongoDB Atlas connection string

## Run locally

1. From the project root, install dependencies:

   ```powershell
   npm install
   ```

2. Create the server environment file:

   ```powershell
   Copy-Item server\.env.example server\.env
   ```

   Update `MONGODB_URI` in `server\.env` if your MongoDB server is not using the
   local default (`mongodb://127.0.0.1:27017/url_shortener`). For MongoDB Atlas,
   use the database user's credentials and replace `JWT_SECRET` with a private,
   randomly generated secret of at least 32 characters.

3. Start the API and frontend:

   ```powershell
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173). The Express API runs at
   [http://localhost:5000](http://localhost:5000).

The API waits for MongoDB to connect before listening. If MongoDB is unavailable
or `MONGODB_URI` is missing, the server reports the startup error and exits.

## Production

Build the React frontend:

```powershell
npm run build
```

Start the API with `npm start`. Configure `MONGODB_URI`, `PORT`, and
`CLIENT_ORIGIN` in the server environment for your deployment. Optionally set
`PUBLIC_BASE_URL` to the public host that serves short-link redirects; otherwise
links use the API request host. Serve the built files from `client\dist` using a
static host.

## API

- `POST /api/urls` — accepts JSON `{ "url": "https://example.com" }` and
  optionally `customCode` and an ISO `expiresAt`. Returns the original URL,
  short code, and short URL. A bearer token associates links with its account;
  without a token, link creation remains available anonymously.
- `POST /api/auth/register` and `POST /api/auth/login` — create an account or
  return a seven-day JWT.
- `GET /api/auth/me` — return the signed-in account.
- `GET /api/urls/mine` — list the signed-in account's links and click counts.
- `GET /api/urls/analytics` — return totals, the most-clicked links, and a
  30-day daily click series for the signed-in account.
- `DELETE /api/urls/:shortCode` — delete one of the signed-in account's links
  and its click history.
- `GET /:shortCode` — redirects to the stored destination, or returns 404 if
  the short code does not exist. Expired links return HTTP 410 instead.
- `GET /api/health` — returns API and MongoDB connection status.

Click totals count each redirect. Unique visitors are estimated with a
long-lived, per-link browser cookie; the app does not store visitor IP
addresses. QR codes are generated in the browser and can be downloaded as PNG.
Accounts use bcrypt password hashes and bearer JWTs; use HTTPS and protect the
JWT secret in production.

The former Flask source files have been removed. The existing `urls.db` file is
left untouched as a backup; the new application stores links in MongoDB and
does not read from SQLite.

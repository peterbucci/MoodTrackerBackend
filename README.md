# 🧠 MoodTracker Backend

Backend service for the **MoodTracker** mobile app.
Handles Fitbit OAuth, Fitbit subscriptions, feature computation, and request/label storage.
Built with **Node.js**, **Express**, and **SQLite**.

---

## Features

- Fitbit OAuth 2.0 (authorization + token refresh)
- Fitbit subscription webhook ingestion
- Computes Tier 1–4 + acute features from Fitbit data
- Merges mobile-provided client features with Fitbit features
- Request queue + automatic fulfillment
- Stores:
  - tokens
  - features
  - labels
  - sync logs
- REST API consumed by the Expo client app

---

## Tech Stack

- Node.js
- Express
- SQLite (via better-sqlite3)
- Fitbit Web API
- PM2 for production process management

---

## Environment Variables

Create a `.env` file in the backend root:

```
PORT=3000

# Public backend URL (used for Fitbit redirects + webhooks)
BASE_URL=https://<your-domain>

# CORS origin (can be "*" for mobile-only apps)
ORIGIN=*

# Fitbit OAuth
FITBIT_CLIENT_ID=xxxx
FITBIT_CLIENT_SECRET=xxxx
FITBIT_REDIRECT_URI=https://<your-domain>/oauth/callback

# Fitbit Subscription
FITBIT_SUBSCRIBER_ID=mysubscriber-1
FITBIT_VERIFICATION_CODE=xxxx

# Request + Feature settings
FETCH_DEBOUNCE_MS=600000
API_SECRET=xxxx

# Location clusters (JSON array)
LOCATION_CLUSTERS=[ {...}, {...} ]
```

---

## Running Locally

```
npm install
npm run dev
```

Backend will start at:

```
http://localhost:3000
```

---

## Testing OAuth Locally (with ngrok)

```
ngrok http 3000
```

Then update `.env`:

```
BASE_URL=https://<your-ngrok-url>
FITBIT_REDIRECT_URI=https://<your-ngrok-url>/oauth/callback
```

And update your Fitbit Developer Console accordingly.

---

## Deployment (AWS Lightsail)

1. Create a Lightsail instance (Node.js or Ubuntu)
2. Assign a static IP
3. Clone your repo and install dependencies:
   ```
   git clone <repo>
   npm install
   ```
4. Add `.env` file on server
5. Start the app with PM2:
   ```
   pm2 start src/index.js --name mood-backend
   pm2 save
   pm2 startup
   ```
6. Point DNS record (Route 53) to your Lightsail static IP
7. Enable HTTPS:
   - Lightsail Load Balancer (easy), or
   - Nginx + Certbot (free, manual)

---

## API Overview (Simplified)

### `POST /requests`

Queue a new build request (from mobile client).

### `GET /requests/pending`

Return number of pending requests.

### `GET /features/:id`

Return a feature record + associated label.

### `POST /fitbit/webhook`

Fitbit pushes activity/sleep updates here.

### `GET /oauth/start`

Begin OAuth login with Fitbit.

### `GET /oauth/callback`

Handles Fitbit OAuth redirect.

---

## About This Backend

This backend powers the **MoodTracker** emotion-logging app.

It prepares these feature vectors for eventual machine learning use.

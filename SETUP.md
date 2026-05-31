# 🛠️ SwaggerPilot — Complete Setup Guide

Follow this guide exactly. Every manual step is listed.

---

## Prerequisites

Install these before starting:

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 18 or 20 (LTS) | https://nodejs.org |
| npm | comes with Node | — |
| Git | any | https://git-scm.com |

To check you have them:
```bash
node --version    # should print v18.x or v20.x
npm --version     # should print 9.x or 10.x
```

---

## Step 1 — Get the Code

If you cloned/downloaded from GitHub:
```bash
cd swagger-pilot
```

If you have the zip file:
```bash
unzip swagger-pilot.zip
cd swagger-pilot
```

---

## Step 2 — Setup Backend

```bash
cd backend
```

### 2a. Install dependencies
```bash
npm install
```
This installs NestJS, Socket.io, swagger-parser, axios, and all other packages.
Takes 1-2 minutes on first run.

### 2b. Create environment file
```bash
cp .env.example .env
```

Open `.env` in any text editor. You will see:
```
PORT=4000
GEMINI_API_KEY=
```

- `PORT=4000` — leave this as is
- `GEMINI_API_KEY` — optional. If you want AI-generated bonus tests, add your key here.
  - Get a free key at: https://aistudio.google.com/app/apikey
  - If you leave it blank, SwaggerPilot still works perfectly with rule-based tests only

### 2c. Start backend
```bash
npm run start:dev
```

You should see:
```
🚀 SwaggerPilot backend running on http://localhost:4000
```

Leave this terminal open.

---

## Step 3 — Setup Frontend

Open a **new terminal** (keep backend terminal open).

```bash
cd frontend
```

### 3a. Install dependencies
```bash
npm install
```

### 3b. Create environment file
```bash
cp .env.example .env
```

Open `.env`. You will see:
```
VITE_BACKEND_URL=http://localhost:4000
```

Leave this as is (it points to your backend).

### 3c. Start frontend
```bash
npm run dev
```

You should see:
```
  VITE v5.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

---

## Step 4 — Open SwaggerPilot

Open your browser and go to:
```
http://localhost:5173
```

You should see the SwaggerPilot UI with a URL input field.

---

## Step 5 — Run Your First Test

### Testing a public API (no auth needed):
1. Paste this URL: `https://petstore.swagger.io/v2/swagger.json`
2. Leave auth as "None"
3. Click **Run Tests**
4. Watch results stream in live ✅

### Testing YOUR local API:

**Important**: Your API must be running before SwaggerPilot can test it.

1. Start your API first:
   ```bash
   # Example for NestJS
   cd your-project
   npm run start:dev
   # Your API running on localhost:3000
   ```

2. In SwaggerPilot, paste your swagger URL:
   ```
   http://localhost:3000/api-json
   ```
   
3. If your API needs auth, select the auth type and fill in your token

4. Click **Run Tests**

---

## 🐳 Alternative: Run with Docker

If you prefer Docker (optional):

### Prerequisites
- Docker Desktop installed: https://www.docker.com/products/docker-desktop

### Run
```bash
# From the swagger-pilot root folder
docker-compose up --build
```

Open http://localhost:5173

### Important for Docker + Local API:
When your API runs on `localhost:3000` and SwaggerPilot runs in Docker,
use `host.docker.internal` instead of `localhost`:

```
# Instead of:
http://localhost:3000/api-json

# Use:
http://host.docker.internal:3000/api-json
```

This works automatically on **Windows** and **Mac**.

On **Linux**, run this once:
```bash
sudo sh -c 'echo "172.17.0.1 host.docker.internal" >> /etc/hosts'
```

---

## 🔑 Getting a Gemini API Key (Optional)

SwaggerPilot works without Gemini. But for AI bonus tests:

1. Go to https://aistudio.google.com/app/apikey
2. Sign in with Google
3. Click "Create API Key"
4. Copy the key
5. Open `backend/.env` and set:
   ```
   GEMINI_API_KEY=your_key_here
   ```
6. Restart backend: `Ctrl+C` then `npm run start:dev`

---

## 🔧 Configuration Options

### Backend (`backend/.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4000 | Backend server port |
| GEMINI_API_KEY | (empty) | Optional Gemini API key |

### Frontend (`frontend/.env`)
| Variable | Default | Description |
|----------|---------|-------------|
| VITE_BACKEND_URL | http://localhost:4000 | Backend URL |

---

## ❓ Troubleshooting

### "Connection refused" when testing local API
- Make sure your API is actually running
- Try pinging it: `curl http://localhost:3000/health`
- If using Docker for SwaggerPilot, use `host.docker.internal:3000` not `localhost:3000`

### "Failed to parse Swagger" error
- Make sure the URL returns valid JSON/YAML
- Test it in browser: open the URL directly
- Some APIs need auth to access the swagger URL itself

### Frontend can't connect to backend
- Make sure backend is running: check Terminal 1 shows the startup message
- Check `frontend/.env` has correct `VITE_BACKEND_URL`
- Try http://localhost:4000 in browser — should not show "connection refused"

### `npm install` fails
- Make sure Node.js version is 18 or 20
- Try: `npm cache clean --force` then `npm install` again

### Port already in use
```bash
# Change backend port in backend/.env:
PORT=4001

# Change frontend .env:
VITE_BACKEND_URL=http://localhost:4001
```

---

## 📂 Two Terminals Summary

| Terminal | Command | What it does |
|----------|---------|-------------|
| Terminal 1 | `cd backend && npm run start:dev` | Runs backend on :4000 |
| Terminal 2 | `cd frontend && npm run dev` | Runs frontend on :5173 |

Both must be running at the same time.

---

## 🎯 Quick Test Checklist

- [ ] Node.js 18 or 20 installed
- [ ] `cd backend && npm install` done
- [ ] `backend/.env` created from `.env.example`
- [ ] Backend running (Terminal 1 shows port 4000)
- [ ] `cd frontend && npm install` done  
- [ ] `frontend/.env` created from `.env.example`
- [ ] Frontend running (Terminal 2 shows port 5173)
- [ ] Browser open at http://localhost:5173
- [ ] Tested with Petstore URL first ✅

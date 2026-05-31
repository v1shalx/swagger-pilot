# ✈️ SwaggerPilot

**AI-Powered Automatic API Test Runner from any Swagger/OpenAPI URL**

Zero code. Zero setup. Paste your Swagger URL → Get 100+ tests in seconds.

---

## 🎯 What Is SwaggerPilot?

SwaggerPilot reads any Swagger/OpenAPI spec and automatically:
- Generates 100+ test cases using a **rule-based engine** (auth, boundary, type, format, path param tests)
- Adds **AI-powered edge cases** via Gemini (SQL injection, XSS, Unicode, duplicates)
- Runs all tests against your real API
- Streams results **live** as each test runs
- Produces a full **pass/fail report** with charts and download

**Works with any framework**: NestJS, Spring Boot, FastAPI, Django, Laravel, .NET, Express.js — anything that outputs a Swagger/OpenAPI spec.

---

## 🚀 Quick Start (2 minutes)

### Option A — Without Docker (Recommended for local testing)

```bash
# Terminal 1 — Start backend
cd backend
npm install
cp .env.example .env
npm run start:dev

# Terminal 2 — Start frontend
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173 → Paste your Swagger URL → Click Run Tests ✅

### Option B — With Docker

```bash
docker-compose up --build
```

Open http://localhost:5173

---

## 🌍 Supported Swagger URL Examples

| Framework | Swagger URL |
|-----------|------------|
| NestJS | `http://localhost:3000/api-json` |
| Spring Boot | `http://localhost:8080/v3/api-docs` |
| FastAPI | `http://localhost:8000/openapi.json` |
| Django REST | `http://localhost:8000/api/schema/` |
| .NET Core | `http://localhost:5000/swagger/v1/swagger.json` |
| Express | `http://localhost:3000/api-docs.json` |

**Testing local APIs?** Run SwaggerPilot locally (not the hosted version). See SETUP.md.

---

## 🧪 What Tests Are Generated?

### Layer 1 — Rule Engine (Always runs, no AI needed)

| Category | Tests Generated |
|----------|----------------|
| Auth | No token → 401, Invalid token → 401, Valid token → success |
| Required Fields | Missing each required field → 400 |
| Type Validation | Wrong type for each field (string for int, etc.) → 400 |
| Boundary | Below minimum, above maximum, too short, too long → 400 |
| Format | Invalid email, date, UUID, URI formats → 400 |
| Path Params | Non-existent ID → 404, String for numeric ID → 400, Negative/Zero → 400 |
| Query Params | Missing required query params → 400 |
| Happy Path | Valid request with all correct data → 200/201 |

### Layer 2 — Gemini AI (Bonus, requires API key)

- SQL injection in string fields
- XSS attempts
- Unicode / emoji in names
- Extremely large payloads
- Duplicate entry detection
- Null values for non-nullable fields

---

## 🔐 Auth Types Supported

| Type | How to use |
|------|-----------|
| None | No auth needed |
| Bearer Token | Paste your JWT token |
| API Key | Header or query param |
| Basic Auth | username:password |
| Auto Login | Provide login URL + credentials → token extracted automatically |

---

## ⚠️ Known Limitations & Corner Cases Handled

| Situation | How SwaggerPilot Handles It |
|-----------|---------------------------|
| Circular `$ref` in spec | Detected and ignored safely |
| `oneOf` / `anyOf` / `allOf` | Merged/resolved before test generation |
| `multipart/form-data` endpoints | Marked as SKIPPED with reason |
| Localhost URL from hosted version | Warning banner shown in UI |
| Rate limiting (429) | Configurable delay between tests |
| Token expiry mid-run | Detected and flagged in report |
| Gemini returns bad JSON | Caught, logged, run continues with rule tests |
| Connection refused | Friendly error message shown |
| OpenAPI 2.0 and 3.0 | Both fully supported |

---

## 📊 Example Output

```
SwaggerPilot Results — Petstore API
════════════════════════════════════════
Total Tests:   127
✅ Passed:      98  (77%)
❌ Failed:      24  (19%)
⚠️ Errors:       5  (4%)
⏱ Duration:  12.4s

By Endpoint:
  POST /user          8/10 passed
  GET  /user/{id}    12/12 passed ✅
  PUT  /user/{id}     6/10 passed

Failed Tests:
  ❌ POST /user — age below minimum (sent: 17, expected: 400, got: 201)
  ❌ PUT /user/{id} — invalid token (expected: 401, got: 200)
```

---

## 🏗️ Tech Stack

- **Backend**: NestJS (TypeScript), Socket.io, Axios, swagger-parser
- **Frontend**: React, TypeScript, Vite, TailwindCSS, Recharts, Socket.io-client
- **AI**: Google Gemini 1.5 Flash (optional)
- **DevOps**: Docker, Docker Compose, GitHub Actions

---

## 📁 Project Structure

```
swagger-pilot/
├── backend/
│   └── src/
│       ├── swagger-parser/     # Fetches + parses any OpenAPI 2.0/3.0 spec
│       ├── test-generator/     # Rule engine + Gemini AI test generation
│       ├── test-runner/        # Executes tests, handles all auth types
│       ├── reporter/           # Formats final report
│       └── gateway/            # WebSocket gateway (orchestrates everything)
├── frontend/
│   └── src/
│       ├── pages/              # Home (form) + Report (results)
│       ├── components/         # TestCard, LiveFeed
│       └── hooks/              # useSocket (all real-time logic)
├── docker-compose.yml
├── README.md
└── SETUP.md                    # Step-by-step manual setup guide
```

---

## 🌐 Public APIs to Test Against

| API | Swagger URL |
|-----|------------|
| Petstore v2 | `https://petstore.swagger.io/v2/swagger.json` |
| Petstore v3 | `https://petstore3.swagger.io/api/v3/openapi.json` |

---

## 📝 License

MIT — Free to use, modify, and distribute.

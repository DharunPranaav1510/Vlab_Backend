# VirtualLab Backend

Production-ready Node.js + TypeScript + Express + Prisma backend for the VirtualLab frontend.

## 1) Setup

1. Copy env template:
   - `cp .env.example .env`
2. Set PostgreSQL `DATABASE_URL` in `.env`
3. Install deps:
   - `npm install`
4. Generate Prisma client:
   - `npm run prisma:generate`
5. Run migrations:
   - `npm run prisma:migrate`
6. Start dev server:
   - `npm run dev`

Backend runs on `http://localhost:5000` by default to match existing frontend `API_BASE`.

## 2) Frontend Compatibility Endpoints (exact behavior)

### `GET /rented_serial`
- Returns exact shape:
```json
{ "data": "line1\nline2\n..." }
```
- Fallback on errors:
```json
{ "data": "" }
```

### `POST /upload_project` (multipart/form-data)
Fields:
- `project_name` (string)
- `controls` (repeatable)
- `sensors` (string)
- `code_file` (file)

Response exact shape:
```json
{ "project": "Project Name" }
```

### `POST /trigger_control`
Body:
```json
{ "control": "reset", "state": "high" }
```
Response exact shape:
```json
{ "status": "success", "command": "reset", "response": "ok" }
```

### `GET /video_feed`
- Returns MJPEG multipart stream for `<img src="">`.

## 3) Production API Modules

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me`
- `GET /users/me`
- `GET/POST /hardware`
- `GET/POST /bookings`
- `GET/POST /projects`
- `POST /uploads`
- `GET/POST /logs`
- `GET /vm/status`

Connector APIs (protected by `x-connector-key`):
- `GET /connector/tasks`
- `POST /connector/task-complete`
- `POST /connector/status-update`
- `POST /connector/rdp-link`

## 4) Booking Rules Enforced

- no past booking
- max 3-day advance window
- max 3 consecutive slots
- overlap prevention
- transactional create path

## 5) Project Structure

```text
src/
├── modules/
├── controllers/
├── services/
├── repositories/
├── middleware/
├── integrations/
├── config/
└── server.ts
```

## 6) Notes

- Frontend localStorage auth flow remains untouched.
- Real backend auth is available for secure API usage.
- Compatibility routes remain at root and return exact frontend-expected shapes.

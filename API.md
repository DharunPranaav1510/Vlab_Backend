# API Documentation

Base URL: `http://localhost:5000`

## Compatibility Layer (frontend-critical)

### GET `/rented_serial`
- Response (always JSON):
```json
{ "data": "line1\nline2\n..." }
```
- On internal failure:
```json
{ "data": "" }
```

### POST `/upload_project`
- Content-Type: `multipart/form-data`
- Fields:
  - `project_name: string`
  - `controls: string` (repeatable)
  - `sensors: string`
  - `code_file: file`
- Response:
```json
{ "project": "Project Name" }
```

### POST `/trigger_control`
- Body:
```json
{ "control": "reset", "state": "high" }
```
- Response:
```json
{ "status": "success", "command": "reset", "response": "ok" }
```

### GET `/video_feed`
- MJPEG multipart response compatible with `<img src="...">`.

## Auth

### POST `/auth/register`
```json
{ "email": "user@example.com", "password": "password123", "name": "User" }
```

### POST `/auth/login`
```json
{ "email": "user@example.com", "password": "password123" }
```

### GET `/auth/me`
- Reads bearer token or cookie.

### POST `/auth/forgot-password`
```json
{ "email": "user@example.com" }
```

### POST `/auth/reset-password`
```json
{ "token": "reset-token", "password": "newpassword123" }
```

## Bookings

### GET `/bookings`
- Auth required

### POST `/bookings`
- Auth required
```json
{
  "title": "ESP32 IoT Corner (My Booking)",
  "labName": "ESP32 IoT Corner",
  "start": "2026-03-24T10:00:00.000Z",
  "end": "2026-03-24T12:00:00.000Z",
  "duration": 2
}
```

## Connector
All connector endpoints require `x-connector-key`.

### GET `/connector/tasks?connectorId=lab-connector-1`
### POST `/connector/task-complete`
```json
{ "taskId": "task-id", "success": true, "result": { "details": "ok" } }
```

### POST `/connector/status-update`
```json
{
  "vmId": "vm-01",
  "state": "ALLOCATED",
  "hardwareId": "hardware-id",
  "bookingId": "booking-id",
  "metadata": { "ip": "10.0.0.5" }
}
```

### POST `/connector/rdp-link`
```json
{
  "bookingId": "booking-id",
  "rdpLink": "https://meshcentral.example/link",
  "vmId": "vm-01"
}
```

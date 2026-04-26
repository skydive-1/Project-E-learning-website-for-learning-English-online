# API Design Reference

Base URL: `https://<host>/api/v1`

All authenticated endpoints require the header:
```
Authorization: Bearer <jwt_token>
```

---

## Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | ❌ | Register a new student account |
| POST | `/auth/login` | ❌ | Login and receive JWT |
| POST | `/auth/refresh` | ❌ | Refresh access token |
| POST | `/auth/logout` | ✅ | Invalidate refresh token |

### POST `/auth/register`
**Request body**
```json
{
  "fullName": "Nguyen Van A",
  "email": "student@example.com",
  "password": "StrongP@ss1"
}
```
**Response `201`**
```json
{ "message": "Registration successful" }
```

### POST `/auth/login`
**Request body**
```json
{ "email": "student@example.com", "password": "StrongP@ss1" }
```
**Response `200`**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "abc...",
  "expiresIn": 3600
}
```

---

## Courses

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/courses` | ❌ | List published courses (paginated) |
| GET | `/courses/{id}` | ❌ | Get course detail |
| POST | `/courses` | ✅ Instructor | Create course |
| PUT | `/courses/{id}` | ✅ Instructor | Update course |
| DELETE | `/courses/{id}` | ✅ Admin | Delete course |
| POST | `/courses/{id}/enroll` | ✅ Student | Enroll in course |

### GET `/courses`
**Query params:** `page`, `pageSize`, `level`, `search`

**Response `200`**
```json
{
  "data": [
    {
      "id": 1,
      "title": "English for Beginners",
      "thumbnailUrl": "https://...",
      "level": "Beginner",
      "lessonCount": 12,
      "enrollmentCount": 340
    }
  ],
  "totalCount": 50,
  "page": 1,
  "pageSize": 10
}
```

---

## Lessons

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/courses/{courseId}/lessons` | ✅ | List lessons for a course |
| GET | `/lessons/{id}` | ✅ | Get lesson detail + video URL |
| POST | `/courses/{courseId}/lessons` | ✅ Instructor | Create lesson |
| PUT | `/lessons/{id}` | ✅ Instructor | Update lesson |
| DELETE | `/lessons/{id}` | ✅ Instructor | Delete lesson |
| POST | `/lessons/{id}/progress` | ✅ Student | Update watch progress |

---

## Quizzes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/lessons/{lessonId}/quiz` | ✅ | Get quiz for a lesson |
| POST | `/lessons/{lessonId}/quiz` | ✅ Instructor | Create quiz |
| POST | `/quizzes/{id}/attempt` | ✅ Student | Submit quiz attempt |
| GET | `/quizzes/{id}/attempts` | ✅ Student | Get own attempt history |

### POST `/quizzes/{id}/attempt`
**Request body**
```json
{
  "answers": [
    { "questionId": 1, "selectedOptionId": 3 },
    { "questionId": 2, "openEndedText": "The answer is …" }
  ]
}
```
**Response `201`**
```json
{
  "attemptId": 42,
  "score": 85,
  "passed": true,
  "feedback": [
    { "questionId": 2, "aiFeedback": "Good answer! Consider also mentioning …", "awardedPoints": 8 }
  ]
}
```

---

## Progress

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users/me/progress` | ✅ Student | Overall progress across enrollments |
| GET | `/users/me/progress/{courseId}` | ✅ Student | Progress for a specific course |

---

## AI

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/ai/feedback` | ✅ | Get AI writing feedback for free-text input |
| POST | `/ai/chat` | ✅ | Chat with AI English assistant |

### POST `/ai/feedback`
**Request body**
```json
{ "text": "I goed to the store yesterday." }
```
**Response `200`**
```json
{
  "corrected": "I went to the store yesterday.",
  "explanation": "Use the simple past form 'went' instead of 'goed'."
}
```

---

## Common HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request — validation error |
| 401 | Unauthorized — missing or invalid token |
| 403 | Forbidden — insufficient permissions |
| 404 | Not Found |
| 422 | Unprocessable Entity |
| 500 | Internal Server Error |

---

*Keep this document updated when adding or changing endpoints.*

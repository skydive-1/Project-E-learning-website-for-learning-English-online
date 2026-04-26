# Entity Relationship Diagram

This document describes the database schema for the English E-Learning Platform.

---

## Core Entities

### User
| Column | Type | Notes |
|---|---|---|
| Id | UUID / int | Primary key |
| FullName | varchar(100) | |
| Email | varchar(255) | Unique |
| PasswordHash | varchar | Bcrypt hash |
| Role | enum | `Student`, `Instructor`, `Admin` |
| CreatedAt | timestamp | |
| UpdatedAt | timestamp | |

---

### Course
| Column | Type | Notes |
|---|---|---|
| Id | int | Primary key |
| Title | varchar(200) | |
| Description | text | |
| ThumbnailUrl | varchar | |
| InstructorId | int | FK → User |
| Level | enum | `Beginner`, `Intermediate`, `Advanced` |
| IsPublished | bool | |
| CreatedAt | timestamp | |

---

### Lesson
| Column | Type | Notes |
|---|---|---|
| Id | int | Primary key |
| CourseId | int | FK → Course |
| Title | varchar(200) | |
| VideoUrl | varchar | CDN URL |
| Duration | int | Seconds |
| OrderIndex | int | Display order |
| IsPublished | bool | |

---

### Enrollment
| Column | Type | Notes |
|---|---|---|
| Id | int | Primary key |
| UserId | int | FK → User |
| CourseId | int | FK → Course |
| EnrolledAt | timestamp | |
| CompletedAt | timestamp | Nullable |

---

### LessonProgress
| Column | Type | Notes |
|---|---|---|
| Id | int | Primary key |
| UserId | int | FK → User |
| LessonId | int | FK → Lesson |
| WatchedSeconds | int | |
| IsCompleted | bool | |
| LastWatchedAt | timestamp | |

---

### Quiz
| Column | Type | Notes |
|---|---|---|
| Id | int | Primary key |
| LessonId | int | FK → Lesson |
| Title | varchar(200) | |
| PassScore | int | 0-100 |

---

### Question
| Column | Type | Notes |
|---|---|---|
| Id | int | Primary key |
| QuizId | int | FK → Quiz |
| Content | text | |
| Type | enum | `MultipleChoice`, `OpenEnded` |
| Points | int | |
| OrderIndex | int | |

---

### AnswerOption
| Column | Type | Notes |
|---|---|---|
| Id | int | Primary key |
| QuestionId | int | FK → Question |
| Content | text | |
| IsCorrect | bool | |

---

### QuizAttempt
| Column | Type | Notes |
|---|---|---|
| Id | int | Primary key |
| UserId | int | FK → User |
| QuizId | int | FK → Quiz |
| Score | int | |
| SubmittedAt | timestamp | |

---

### UserAnswer
| Column | Type | Notes |
|---|---|---|
| Id | int | Primary key |
| AttemptId | int | FK → QuizAttempt |
| QuestionId | int | FK → Question |
| SelectedOptionId | int | FK → AnswerOption (nullable for open-ended) |
| OpenEndedText | text | Nullable |
| AiScore | int | Nullable (AI grading) |
| AiFeedback | text | Nullable |

---

## Relationships (summary)

```
User         1 ── n  Enrollment     n ── 1  Course
Course       1 ── n  Lesson
Lesson       1 ── 1  Quiz
Quiz         1 ── n  Question
Question     1 ── n  AnswerOption
User         1 ── n  QuizAttempt    n ── 1  Quiz
QuizAttempt  1 ── n  UserAnswer
User         1 ── n  LessonProgress n ── 1  Lesson
```

---

*Update this diagram as the schema evolves.*

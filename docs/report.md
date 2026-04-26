# Project Report

## English E-Learning Platform

**Course:** Graduation Project  
**Academic Year:** 2024 – 2025  
**Team members:** *(List names here)*

---

## 1. Problem Statement

Many Vietnamese learners struggle to access affordable, structured, and interactive English courses. Existing platforms are either too expensive or lack personalised feedback. This project aims to build a full-featured web application that delivers structured English lessons with video content, adaptive quizzes, and AI-powered feedback — all accessible through a modern browser.

---

## 2. Objectives

1. Provide a course-based learning path with ordered, video-based lessons.
2. Automatically grade quizzes and use AI to score open-ended writing tasks.
3. Track individual learner progress and display it on a personal dashboard.
4. Deliver an accessible, mobile-friendly user interface.

---

## 3. System Architecture

```
┌────────────────────┐        HTTPS / REST        ┌──────────────────────────┐
│  Next.js Frontend  │ ◄──────────────────────────► │  ASP.NET Core Web API   │
│  (Vercel / Nginx)  │                              │  (Docker / Azure App)   │
└────────────────────┘                              └──────────┬───────────────┘
                                                               │ EF Core
                                                    ┌──────────▼───────────────┐
                                                    │       PostgreSQL          │
                                                    └──────────────────────────┘
                                                               │ HTTP
                                                    ┌──────────▼───────────────┐
                                                    │       OpenAI API          │
                                                    └──────────────────────────┘
```

---

## 4. Key Features Implemented

- [ ] User authentication (JWT — register / login / refresh)
- [ ] Course management (CRUD, publishing)
- [ ] Lesson management with video streaming
- [ ] Quiz engine — multiple-choice auto-grading
- [ ] Open-ended quiz grading via OpenAI
- [ ] Learner progress dashboard
- [ ] AI writing feedback endpoint
- [ ] Responsive UI (desktop + mobile)

---

## 5. Database Schema

See [`erd.md`](./erd.md) for the full Entity Relationship Diagram.

---

## 6. API Reference

See [`api-design.md`](./api-design.md) for the full API endpoint reference.

---

## 7. Development Workflow

See the [Git Workflow section in README.md](../README.md#git-workflow).

---

## 8. Deployment Plan

| Component | Platform |
|---|---|
| Frontend | Vercel (free tier) |
| Backend API | Azure App Service / Railway |
| Database | Supabase (PostgreSQL) / Railway |
| CI/CD | GitHub Actions |

---

## 9. Testing Strategy

| Layer | Approach |
|---|---|
| Backend unit tests | xUnit + Moq |
| API integration tests | xUnit + WebApplicationFactory |
| Frontend component tests | Jest + React Testing Library |
| E2E tests | Playwright |

---

## 10. References

- Next.js documentation: https://nextjs.org/docs
- ASP.NET Core documentation: https://learn.microsoft.com/aspnet/core
- OpenAI API: https://platform.openai.com/docs
- Entity Framework Core: https://learn.microsoft.com/ef/core

---

*Last updated: 2025*

# 🌐 English E-Learning Platform

> A modern web application for learning English online — featuring structured courses, video lessons, AI-powered assistance, and adaptive quizzes.  
> *Graduation project — developed by a 3-member student team.*

---

## 📋 Table of Contents

- [Project Introduction](#project-introduction)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Frontend Setup](#frontend-setup)
  - [Backend Setup](#backend-setup)
- [Environment Variables](#environment-variables)
- [Git Workflow](#git-workflow)
- [Contributing](#contributing)

---

## 📖 Project Introduction

This platform provides a comprehensive English learning experience through structured courses, interactive video lessons, and AI-assisted tools. Learners can enroll in courses, watch lessons, take quizzes that are graded automatically, and receive AI-powered feedback — all while the system tracks their progress in real time.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📚 Course & Lesson System | Organize content into courses with multiple ordered lessons |
| 🎥 Video Learning | Stream lesson videos with progress tracking per video |
| 📝 Quiz & Auto-Grading | Multiple-choice and open-ended quizzes with instant automated grading |
| 🤖 AI Support | AI-powered writing feedback, vocabulary suggestions, and chat assistant |
| 📊 Progress Tracking | Dashboard showing course completion, quiz scores, and learning streaks |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js (React), TypeScript, Tailwind CSS |
| **Backend** | ASP.NET Core 8 Web API, C# |
| **Database** | PostgreSQL (via Entity Framework Core) |
| **Auth** | JWT Bearer tokens |
| **AI Integration** | OpenAI API |
| **Storage** | Cloud storage for video assets |

---

## 📁 Folder Structure

```
/
├── frontend/                  # Next.js application
│   ├── public/                # Static assets
│   ├── app/                   # Next.js App Router pages & layouts
│   ├── components/            # Reusable UI components
│   │   ├── common/            # Buttons, inputs, modals …
│   │   ├── layout/            # Header, Footer, Sidebar
│   │   ├── course/            # Course card, lesson list …
│   │   └── quiz/              # Quiz form, result display …
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # API clients, utilities
│   ├── store/                 # Global state (Zustand / Redux)
│   ├── types/                 # TypeScript type definitions
│   ├── .env.example
│   └── package.json
│
├── backend/                   # ASP.NET Core Web API
│   ├── src/
│   │   ├── ELearning.API/         # Entry point — controllers, middleware
│   │   ├── ELearning.Application/ # Use cases, DTOs, interfaces
│   │   ├── ELearning.Domain/      # Entities, value objects, domain events
│   │   └── ELearning.Infrastructure/ # EF Core, repositories, external services
│   ├── tests/
│   │   └── ELearning.Tests/
│   ├── .env.example
│   └── ELearning.slnx
│
├── docs/                      # Project documentation
│   ├── erd.md                 # Entity Relationship Diagram
│   ├── api-design.md          # API endpoint reference
│   └── report.md              # Project report / presentation notes
│
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Minimum Version |
|---|---|
| Node.js | 20 LTS |
| npm | 10 |
| .NET SDK | 8.0 |
| PostgreSQL | 15 |

---

### Frontend Setup

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start the development server
npm run dev
```

The app will be available at **http://localhost:3000**.

---

### Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Copy environment variables
cp .env.example .env

# Restore NuGet packages
dotnet restore

# Apply database migrations
dotnet ef database update --project src/ELearning.Infrastructure --startup-project src/ELearning.API

# Start the API server
dotnet run --project src/ELearning.API
```

The API will be available at **http://localhost:5000** (Swagger UI at `/swagger`).

---

## 🔑 Environment Variables

### `frontend/.env.example`

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_APP_NAME=ELearn
```

### `backend/.env.example`

```env
ConnectionStrings__DefaultConnection=Host=localhost;Port=5432;Database=elearning;Username=postgres;Password=yourpassword
Jwt__SecretKey=your_jwt_secret_key_here
Jwt__Issuer=ELearnAPI
Jwt__Audience=ELearnClient
OpenAI__ApiKey=your_openai_api_key_here
ASPNETCORE_ENVIRONMENT=Development
```

> **Never commit real `.env` files.** Only `.env.example` files are tracked in git.

---

## 🌿 Git Workflow

```
main          ← production-ready code only
  └── develop ← integration branch for completed features
        ├── feature/auth
        ├── feature/course
        ├── feature/lesson
        ├── feature/quiz
        ├── feature/ai-support
        └── feature/progress-tracking
```

### Branch naming

| Prefix | Purpose |
|---|---|
| `feature/` | New feature development |
| `fix/` | Bug fixes |
| `hotfix/` | Critical production fixes |
| `chore/` | Tooling, config, dependency updates |
| `docs/` | Documentation changes |

### Pull Request workflow

1. Branch off from `develop`: `git checkout -b feature/<name> develop`
2. Commit small, focused changes with clear messages
3. Open a PR targeting `develop`
4. At least **one** team member reviews and approves
5. Squash-merge into `develop` after approval
6. Merge `develop` → `main` only for releases

---

## 🤝 Contributing

1. Fork the repository and create your branch from `develop`
2. Follow the existing code style (ESLint / EditorConfig)
3. Write or update tests for any logic changes
4. Ensure all checks pass before opening a PR
5. Fill in the PR template fully

---

*© 2025 — Graduation Project. All rights reserved.*

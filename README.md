# DevCollab — Real-Time Collaborative Code Review Platform

A production-ready platform where developers join a shared room via a 6-character code, view code in a Monaco editor, leave line-level annotations that appear on all screens instantly via WebSocket, and **import pull requests directly from GitHub**.

---

## Features

- **Real-time annotations** — click any line, add a comment, everyone sees it instantly
- **GitHub PR import** — connect GitHub, browse repos, import any PR (open/closed/merged)
- **Closed PR discussions** — rejected PRs can be discussed line-by-line in DevCollab
- **Role-based access** — Owner, Reviewer, Viewer
- **Threaded replies** — reply to any annotation, resolve/reopen threads
- **Live presence** — see who is in the room right now
- **Export** — download review as Markdown

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Spring Boot 3.2, Spring Security, JWT |
| Real-time | Spring WebSocket, STOMP, SockJS |
| GitHub | GitHub REST API v3 + OAuth Apps (free) |
| Database | PostgreSQL |
| Cache | Redis (Pub/Sub relay) |
| Frontend | React 18, Vite, Monaco Editor |
| Deploy | Render (backend) + Vercel (frontend) |

---

## Quick Start — Local Development

### Prerequisites
- Docker + Docker Compose
- Node.js 18+

### 1. Set up GitHub OAuth App (free, 2 minutes)

1. Go to https://github.com/settings/developers
2. Click **New OAuth App**
3. Fill in:
   - Application name: `DevCollab Local`
   - Homepage URL: `http://localhost:5173`
   - Authorization callback URL: `http://localhost:8080/api/v1/github/callback`
4. Click Register. Copy the **Client ID** and generate a **Client Secret**

### 2. Set GitHub credentials

Create a `.env` file in the project root:
```
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
```

Or export them:
```bash
export GITHUB_CLIENT_ID=your_client_id_here
export GITHUB_CLIENT_SECRET=your_client_secret_here
```

### 3. Start everything

```bash
# Start backend + PostgreSQL + Redis
docker compose up --build

# In a new terminal — start frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Environment Variables

### Backend

| Variable | Description | Default |
|----------|-------------|---------|
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL | `jdbc:postgresql://localhost:5432/devcollab` |
| `SPRING_DATASOURCE_USERNAME` | DB username | `devcollab` |
| `SPRING_DATASOURCE_PASSWORD` | DB password | `devcollab123` |
| `SPRING_REDIS_HOST` | Redis host | `localhost` |
| `SPRING_REDIS_PORT` | Redis port | `6379` |
| `SPRING_REDIS_PASSWORD` | Redis password | `redis123` |
| `SPRING_REDIS_SSL` | TLS for Redis Cloud | `false` |
| `JWT_SECRET` | Min 32 chars | see compose |
| `JWT_EXPIRATION` | Token lifetime ms | `86400000` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins | `http://localhost:5173` |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID | **required** |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret | **required** |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend REST base URL |
| `VITE_WS_URL` | Backend WebSocket URL |

---

## Production Deployment

### 1. Neon PostgreSQL (free)
1. Create project at https://neon.tech → select `ap-south-1`
2. Copy connection string → set as `SPRING_DATASOURCE_URL` in Render

### 2. Redis Cloud (free)
1. Create database at https://redis.com/try-free → `ap-south-1`
2. Set `SPRING_REDIS_HOST`, `SPRING_REDIS_PORT=6380`, `SPRING_REDIS_PASSWORD`, `SPRING_REDIS_SSL=true`

### 3. GitHub OAuth App for Production
1. Create a **second** OAuth App at https://github.com/settings/developers
2. Homepage URL: `https://your-app.vercel.app`
3. Callback URL: `https://your-backend.onrender.com/api/v1/github/callback`
4. Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in Render dashboard

### 4. Render (backend)
1. New Web Service → connect GitHub → Runtime: **Docker**
2. Set all environment variables from the table above
3. Health check path: `/actuator/health`

### 5. Vercel (frontend)
1. New Project → import frontend folder → Framework: Vite
2. Set environment variables:
   - `VITE_API_URL=https://your-backend.onrender.com/api/v1`
   - `VITE_WS_URL=https://your-backend.onrender.com/ws`

---

## API Reference

### Auth
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | `/api/v1/auth/register` | No |
| POST | `/api/v1/auth/login` | No |
| GET  | `/api/v1/auth/me` | JWT |

### Rooms
| Method | Endpoint | Notes |
|--------|----------|-------|
| POST | `/api/v1/rooms` | Create room |
| GET  | `/api/v1/rooms` | My rooms |
| GET  | `/api/v1/rooms/{id}` | Room details |
| POST | `/api/v1/rooms/join` | Join by code |
| PUT  | `/api/v1/rooms/{id}/code` | Update code |
| DELETE | `/api/v1/rooms/{id}` | Archive room |
| GET  | `/api/v1/rooms/{id}/members` | List members |

### Annotations
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/api/v1/rooms/{id}/annotations` | Load on entry |
| PATCH | `/api/v1/annotations/{id}/status` | Resolve/reopen |
| DELETE | `/api/v1/annotations/{id}` | Delete |
| GET | `/api/v1/annotations/{id}/replies` | Get replies |

### GitHub
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET  | `/api/v1/github/auth-url` | Get OAuth redirect URL |
| GET  | `/api/v1/github/callback?code=` | OAuth callback |
| GET  | `/api/v1/github/status` | Is GitHub connected? |
| DELETE | `/api/v1/github/disconnect` | Disconnect GitHub |
| GET  | `/api/v1/github/repos` | List user repos |
| GET  | `/api/v1/github/repos/{owner}/{repo}/pulls` | List PRs |
| GET  | `/api/v1/github/repos/{owner}/{repo}/pulls/{n}/files` | PR files |
| POST | `/api/v1/github/import-pr` | Import PR → new room |

### WebSocket (STOMP)
| Direction | Destination | Description |
|-----------|-------------|-------------|
| SUBSCRIBE | `/topic/room/{id}/annotations` | Live annotations |
| SUBSCRIBE | `/topic/room/{id}/status` | Resolve/reopen events |
| SUBSCRIBE | `/topic/room/{id}/replies` | Live replies |
| SUBSCRIBE | `/topic/room/{id}/presence` | Who is online |
| SEND | `/app/room/{id}/annotate` | Add annotation |
| SEND | `/app/room/{id}/reply` | Add reply |
| SEND | `/app/room/{id}/heartbeat` | Presence ping |

---

## Project Structure

```
devcollab/
├── backend/
│   ├── src/main/java/com/devcollab/
│   │   ├── config/          WebSocketConfig, SecurityConfig
│   │   ├── controller/      Auth, Room, Annotation, GitHub, GlobalExceptionHandler
│   │   ├── dto/             AuthDTOs, RoomDTOs, AnnotationDTOs, GitHubDTOs
│   │   ├── entity/          User, ReviewRoom, RoomMember, Annotation, AnnotationReply
│   │   ├── repository/      5 JPA repositories
│   │   ├── security/        JwtUtil, JwtAuthFilter
│   │   └── service/         Auth, Room, Annotation, GitHub, UserDetailsServiceImpl
│   ├── Dockerfile
│   └── pom.xml
├── frontend/
│   ├── src/
│   │   ├── api/             axiosInstance.js
│   │   ├── hooks/           useWebSocket.js, useGitHub.js
│   │   ├── pages/           Login, Register, Dashboard, Room
│   │   ├── components/      AnnotationPanel, AnnotationThread, PresenceBar, GitHubImportModal
│   │   └── styles/          global.css
│   ├── .env.development
│   └── package.json
└── docker-compose.yml
```

---

## How GitHub Import Works

1. User clicks **Connect GitHub** → redirected to GitHub OAuth
2. GitHub redirects back to `/api/v1/github/callback?code=...`
3. Backend exchanges code for access token, stores on user record
4. User clicks **Import PR** → 3-step modal:
   - Step 1: Pick a repository
   - Step 2: Pick a PR (shows Open / Closed / Merged badges)
   - Step 3: Pick which changed file to open (or auto-select first)
5. Backend fetches file content from GitHub API, creates a new room
6. User lands in the review room with code pre-loaded and a GitHub banner showing PR status

**For closed/rejected PRs:** The PR import works identically regardless of PR status. Select any closed or merged PR → code loads → invite your team → annotate line by line.

---

Built by Pranit Lavangare · Java/Spring Boot Backend Developer

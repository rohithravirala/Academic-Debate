# Academic Debate Platform

Full-stack academic debate platform with a modern dashboard and real-time argument flow.

- **Frontend:** React + Vite + Axios + React Router
- **Backend:** Node.js + Express + JWT + Socket.IO
- **Database:** MongoDB Atlas via Mongoose

## Project Structure

- `frontend/` → UI, routing, API client, socket client
- `backend/` → REST APIs, auth, Mongoose models, socket server

## Backend Setup

Create/update `backend/.env`:

```bash
PORT=5001
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>/academic_debate?retryWrites=true&w=majority
JWT_SECRET=your_strong_secret
CLIENT_URLS=http://localhost:5173,https://your-frontend.vercel.app
CLIENT_URL=http://localhost:5173
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password_or_app_password
SMTP_FROM=Academic Debate <no-reply@academicdebate.local>
```

Run backend:

```bash
cd backend
npm install
npm run dev
```

## Frontend Setup

Create/update `frontend/.env.development`:

```bash
VITE_API_URL=http://localhost:5001
```

Run frontend:

```bash
cd frontend
npm install
npm run dev
```

## Core Schemas

### User
- `name` (required)
- `email` (required, unique)
- `password` (hashed)
- `role` (`student | moderator`)
- `points` (default `0`)
- `createdAt`

### Debate
- `title` (required)
- `topic`
- `description`
- `category` (`Technology | Science | Politics | Education | Environment`)
- `status` (`live | upcoming`)
- `scheduledTime`
- `watchersCount`
- `proVotes`, `conVotes`
- `createdBy` (User ref)
- `participants.proUser` (User ref)
- `participants.conUser` (User ref)
- `participantLabels.proLabel`, `participantLabels.conLabel`

### Argument
- `debateId` (Debate ref)
- `userId` (User ref)
- `side` (`pro | con`)
- `type` (`argument | rebuttal | question`)
- `content`
- `createdAt`

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:token`

### Debates (JWT Protected)
- `GET /api/debates`
- `GET /api/debates/home-feed` (recent + trending)
- `GET /api/debates/latest`
- `POST /api/debates`
- `GET /api/debates/:id`
- `POST /api/debates/:id/join` (`{ role: "pro" | "con" }` or `{ side: "pro" | "con" }`)
- `POST /api/debates/:id/watch`
- `POST /api/debates/:id/vote`

## Real-Time Debate Rules

- Debate start/end times are stored and returned as UTC ISO timestamps.
- Frontend must send create times as UTC (e.g. `new Date(localValue).toISOString()`).
- Each debate has one `pro` and one `con` slot; only one user can occupy each slot.
- A user can join only one side in the same debate.
- Only the joined `pro` user can post in Pro arguments; only the joined `con` user can post in Con arguments.
- Any authenticated user can post in live audience chat.

### Messages (JWT Protected)
- `GET /api/messages/:debateId`
- `POST /api/messages`

### Users (JWT Protected)
- `GET /api/users/leaderboard` (top 5 by points)
- `GET /api/users/profile`
- `PUT /api/users/profile`

## Socket Events

### Client → Server
- `joinDebate` → `{ debateId }`
- `sendMessage` / `sendArgument` → `{ debateId, side, type, content }`

### Server → Client
- `newArgument`
- `errorMessage`

## Validation Checklist

The implementation has been smoke-tested for:

- Register user
- Login user
- Create debate
- Join debate side (`pro`/`con`)
- Vote in debate poll (`pro`/`con`)
- Register watcher count
- Fetch debates
- Fetch home dashboard feed
- Fetch leaderboard
- Frontend production build

## Frontend Routes

- `/login` → Login
- `/signup` → Sign up with role selector
- `/forgot-password` → Request reset link
- `/reset-password/:token` → Set new password
- `/home` → Dashboard with recent/trending sections
- `/debate-rooms` → Full debate listing with filters/search/category
- `/debates/:debateId` → Real-time room (Pro/Con chat, participants, timer, voting)
- `/leaderboard` → Top debaters
- `/profile` → Profile view/edit

## Password Reset Flow

1. User submits email on `/forgot-password`.
2. Backend creates secure reset token + 1-hour expiry in `users` collection.
3. Backend sends reset URL to user email (`/reset-password/:token`).
4. User submits new password and confirmation.
5. Backend verifies token, hashes password, and clears reset token fields.

If SMTP is not configured, backend logs the reset link to terminal for local development.

## Deployment Ready

### Frontend (Vercel)
- Env var: `VITE_API_URL=https://your-backend.onrender.com`
- Build: `npm run build`
- Output: `frontend/dist`

### Backend (Render)
- Start command: `npm start`
- Uses dynamic port: `process.env.PORT || 5001`
- Ensure `MONGO_URI`, `JWT_SECRET`, `CLIENT_URLS` are set

# HizmatTop

HizmatTop is a local MVP for finding services, comparing prices, viewing businesses on a map and booking appointments.

## Requirements

- Node.js 18+
- npm

No MongoDB, MongoDB Atlas or external database server is required. The backend uses SQLite and stores data in `backend/data/hizmat-top.sqlite`.

## First Setup

Install backend dependencies:

```bash
cd backend
npm install
```

Create backend environment file:

```bash
copy .env.example .env
```

Set a long random value for `JWT_SECRET` in `backend/.env`.

Optional AI assistant via Groq:

```text
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.1-8b-instant
```

If `GROQ_API_KEY` is empty, the AI chat still works in local fallback mode and recommends businesses from the SQLite database without calling Groq.

Create and seed the local SQLite database:

```bash
npm run db:setup
```

Install frontend dependencies:

```bash
cd ../frontend
npm install
```

Create frontend environment file:

```bash
copy .env.example .env
```

## Run The Project

Fast start from the project root:

```bash
python start.py
```

This starts both backend and frontend. Use `Ctrl+C` in that terminal to stop them.

Optional reset + demo seed:

```bash
python start.py --seed
```

Start backend:

```bash
cd backend
npm run dev
```

Backend API runs at:

```text
http://localhost:5000/api
```

Start frontend in another terminal:

```bash
cd frontend
npm start
```

Frontend runs at:

```text
http://localhost:3000
```

## Test Accounts

These accounts are created by `npm run db:setup` or `python start.py --seed`.

| Role | Name | Email | Password | Where to go |
| --- | --- | --- | --- | --- |
| Admin | Admin | `admin@hizmat.top` | `admin123` | `/admin` |
| Business owner | Alisher Karimov | `owner@hizmat.top` | `owner123` | `/dashboard` |
| Business owner | Diana Kim | `owner2@hizmat.top` | `owner123` | `/dashboard` |
| User | Dilshod Testov | `user@hizmat.top` | `user123` | `/profile` |
| User | Nodira Usmonova | `user2@hizmat.top` | `user123` | `/profile` |

Business owner accounts can create businesses, add services, manage bookings and upload normal room videos for `Virtual ko'rish`.

Admin account can approve, reject, block and manage platform data from the admin panel.

## Useful Commands

Reset and seed SQLite:

```bash
cd backend
npm run db:setup
```

Build frontend:

```bash
cd frontend
npm run build
```

Run the mock 3D/VR processing pipeline manually:

```bash
python processing-service/vr_pipeline.py --tour-id demo --video-path backend/uploads/vr-videos/demo.mp4 --output-dir processing-service/output
```

The real COLMAP + Gaussian Splatting/Nerfstudio processing is intentionally separated into `processing-service` so it can later be connected without putting long GPU work inside normal Node.js requests.

## Current MVP Scope

- Local SQLite storage
- Seed data for demo
- User, owner and admin roles
- Search and filters
- Map and geolocation
- Favorites
- Booking with backend-based available slots
- Business chat between users and business owners
- AI assistant endpoint prepared for Groq API
- Virtual ko'rish MVP: normal phone video upload, preview generation, active/inactive control and VR-like immersive fullscreen viewer
- Owner dashboard basics
- Admin moderation basics
- Virtual tour table prepared for future panorama, 360 video, COLMAP or Gaussian Splatting processing
- Notifications table prepared for in-app notifications

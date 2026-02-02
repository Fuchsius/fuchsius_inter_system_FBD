# Fuchsius System

A comprehensive HR and employee management system built with modern web technologies.

## Features

- **User Management** - Create and manage employee profiles
- **Attendance Tracking** - Monitor and manage attendance records
- **Project Management** - Organize projects and team assignments
- **Task Management** - Create, assign, and track tasks
- **Events Management** - Schedule and manage company events
- **Department Management** - Organize employees by departments
- **Positions & Roles** - Manage job positions and roles
- **Notifications** - Real-time notifications for users
- **Activity Tracking** - Log and track user activities
- **Referrals** - Employee referral system
- **Multi-Platform** - Web and Electron desktop application

## Tech Stack

### Backend
- **Node.js** with Express.js
- **Prisma ORM** for database management
- **JWT** for authentication
- **Socket.io** for real-time features

### Frontend
- **React** with Vite
- **Tailwind CSS** for styling
- **ESLint** for code quality

### Desktop
- **Electron** for cross-platform desktop application

## Project Structure

```
├── backend/          # Node.js Express API server
├── frontend/         # React web application
├── electron/         # Electron desktop application
└── README.md        # This file
```

## Getting Started

### Prerequisites
- Node.js (v14+)
- npm or yarn
- Database (configured in backend)

### Backend Setup

```bash
cd backend
npm install
npx prisma migrate dev
npm start
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Electron Setup

```bash
cd electron
npm install
npm start
```

## Environment Variables

Each module has a `.env` file for configuration:
- `backend/.env` - API and database configuration
- `frontend/.env` - API endpoint configuration
- `electron/.env` - Electron-specific settings

## API Routes

The backend provides RESTful APIs for:
- `/api/users` - User management
- `/api/auth` - Authentication
- `/api/attendance` - Attendance records
- `/api/projects` - Project management
- `/api/tasks` - Task management
- `/api/events` - Event management
- `/api/departments` - Department management
- `/api/positions` - Position management
- `/api/activities` - Activity logs
- `/api/referrals` - Referral system
- `/api/notifications` - Notifications

## Development

### Running All Services
1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm run dev`
3. Start electron: `cd electron && npm start`

### Database
- Database schema: `backend/prisma/schema.prisma`
- Run migrations: `npx prisma migrate dev`
- Seed database: `node prisma/seed.js`

## License

[Add your license information here]

## Contact

For questions or support, please contact [your contact information]

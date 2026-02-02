# Fuchsius System

A comprehensive HR and employee management system built with modern web technologies. Available as a web application and cross-platform desktop application.

---

## 📥 Downloads

Download the latest version of Fuchsius for your platform:

### Desktop Applications (v1.0.0)

| Platform | Download |
|----------|----------|
| **Linux** | [Fuchsius-1.0.0.AppImage](Fuchsius%20app%20download%20website/download-files/Fuchsius-1.0.0.AppImage) |
| **macOS** | [Fuchsius-1.0.0.dmg](Fuchsius%20app%20download%20website/download-files/Fuchsius-1.0.0.dmg) |

**Web Version:** Available at `http://localhost:3000` when running locally

---

## ✨ Features

- **User Management** - Create and manage employee profiles
- **Attendance Tracking** - Monitor and manage attendance records
- **Project Management** - Organize projects and team assignments
- **Task Management** - Create, assign, and track tasks
- **Events Management** - Schedule and manage company events
- **Department Management** - Organize employees by departments
- **Positions & Roles** - Manage job positions and roles
- **Real-time Notifications** - Instant updates via WebSocket
- **Activity Tracking** - Comprehensive activity logs
- **Employee Referrals** - Referral management system
- **Multi-Platform Support** - Web, Linux, and macOS applications

---

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express.js
- **Prisma ORM** for database management
- **JWT** for secure authentication
- **Socket.io** for real-time features

### Frontend
- **React 18+** with Vite
- **Tailwind CSS** for responsive styling
- **ESLint** for code quality

### Desktop Application
- **Electron** for cross-platform desktop support

---

## 📁 Project Structure

```
Fuchsius System/
├── backend/                          # Express.js API server
│   ├── controllers/                  # Request handlers
│   ├── routers/                      # API routes
│   ├── services/                     # Business logic
│   ├── auth/                         # Authentication utilities
│   ├── middleware/                   # Express middleware
│   ├── prisma/                       # Database schema & migrations
│   └── uploads/                      # File uploads directory
├── frontend/                         # React web application
│   ├── src/
│   │   ├── components/              # React components
│   │   ├── pages/                   # Page components
│   │   ├── api/                     # API client functions
│   │   └── services/                # Frontend services
│   └── index.html                   # Entry HTML
├── electron/                         # Electron desktop app
│   ├── main.js                      # Electron main process
│   ├── preload.js                   # Preload script
│   └── src/                         # Renderer process
├── Fuchsius app download website/   # Download page
└── README.md                        # This file
```

---

## 🚀 Installation & Setup

### Prerequisites
- **Node.js** v14 or higher
- **npm** or **yarn** package manager
- Database credentials (PostgreSQL, MySQL, or SQLite)

### Backend Setup

```bash
cd backend
npm install
npx prisma migrate dev
npm start
```

The API server will start at `http://localhost:5000` (or configured port)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The web app will be available at `http://localhost:5173`

### Desktop Application Setup

```bash
cd electron
npm install
npm start
```

### Environment Configuration

Create `.env` files in each directory:

**backend/.env**
```
DATABASE_URL="your_database_url"
JWT_SECRET="your_jwt_secret"
PORT=5000
```

**frontend/.env**
```
VITE_API_URL="http://localhost:5000/api"
```

---

## 📡 API Endpoints

| Category | Endpoint |
|----------|----------|
| **Authentication** | `/api/auth` |
| **Users** | `/api/users` |
| **Attendance** | `/api/attendance` |
| **Projects** | `/api/projects` |
| **Tasks** | `/api/tasks` |
| **Events** | `/api/events` |
| **Departments** | `/api/departments` |
| **Positions** | `/api/positions` |
| **Activities** | `/api/activities` |
| **Referrals** | `/api/referrals` |
| **Notifications** | `/api/notifications` |

---

## 💻 Development

### Running All Services Locally

```bash
# Terminal 1: Backend
cd backend && npm start

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Desktop (optional)
cd electron && npm start
```

### Database Management

```bash
# Run migrations
npx prisma migrate dev

# Seed initial data
node backend/prisma/seed.js

# View database UI
npx prisma studio
```

### Code Quality

```bash
# Frontend linting
cd frontend && npm run lint
```

---

## 📝 License

[Add your license information here]

---

## 📧 Contact & Support

For questions, bug reports, or feature requests, please contact [your contact information]

---

## 🤝 Contributing

We welcome contributions! Please feel free to submit pull requests or open issues for suggestions.

# Nexus Workspace Manager - Server

A Node.js and Express backend for the Nexus Workspace Manager application. It provides authentication, workspace management, projects, tasks, comments, notifications, activity tracking and search APIs.

## Live API

- API: `https://nexus-workspace-server.vercel.app`
- Health check: `https://nexus-workspace-server.vercel.app/api/health`

## Features

- User registration and login
- JWT authentication
- Password hashing with bcrypt
- Role-based permissions
- Workspace management
- Project management
- Task management
- Comments
- Activity tracking
- Notifications
- Search functionality
- File uploads
- MongoDB database integration
- REST API
- Real-time updates with Socket.IO
- CORS configuration
- Vercel deployment support

## Technologies Used

- Node.js
- Express.js
- MongoDB
- Mongoose
- JSON Web Token
- bcryptjs
- Multer
- CORS
- dotenv
- UUID

## API Modules

| Module | Endpoint |
| --- | --- |
| Authentication | `/api/auth` |
| Users | `/api/users` |
| Workspaces | `/api/workspaces` |
| Projects | `/api/projects` |
| Tasks | `/api/tasks` |
| Comments | `/api/comments` |
| Activity | `/api/activity` |
| Notifications | `/api/notifications` |
| Search | `/api/search` |

## Project Structure

```text
src/
├── config/
├── middleware/
├── models/
├── routes/
├── utils/
├── app.js
├── index.js
└── seed.js
```

## Installation

```bash
git clone https://github.com/Abdullah111000/Nexus-Workspace-server
cd Nexus-Workspace-server
npm install
```

## Environment Variables

Create a `.env` file in the server root:

```env
PORT=5000
MONGODB_URI=YOUR_MONGODB_CONNECTION_STRING
JWT_SECRET=YOUR_PRIVATE_JWT_SECRET
CLIENT_ORIGIN=http://localhost:5173
```

For production, set `CLIENT_ORIGIN` to the deployed frontend URL:

```env
CLIENT_ORIGIN=https://nexus-workspace-abdullah.vercel.app
```

Never commit `.env` files, database credentials or JWT secrets to GitHub.

## Run Locally

```bash
npm run dev
```

The API runs at `http://localhost:5000`.

## Start Production Server

```bash
npm start
```

## Seed Demo Data

```bash
npm run seed
```

## Demo Accounts

All demo accounts use the password `password123`.

| Email | Role |
| --- | --- |
| `owner@demo.com` | Owner |
| `admin@demo.com` | Admin |
| `member@demo.com` | Member |
| `viewer@demo.com` | Viewer |

## Shortcuts

- `⌘/Ctrl + K` command palette
- `⌘/Ctrl + Enter` new task (on a project)
- `1` / `2` / `3` board / list / calendar

## Deployment

The backend is deployed on Vercel. Configure `MONGODB_URI`, `JWT_SECRET` and `CLIENT_ORIGIN` in the Vercel project environment variables.

## Related Repository

Frontend repository: `https://github.com/Abdullah111000/Nexus-Workspace-client`

## Author

Created by `Abdullah Iftikhar`.

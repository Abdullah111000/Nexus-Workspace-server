import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDb } from './config/db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import workspaceRoutes from './routes/workspaces.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import commentRoutes from './routes/comments.js';
import activityRoutes from './routes/activity.js';
import notificationRoutes from './routes/notifications.js';
import searchRoutes from './routes/search.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const originList = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: originList.length === 1 ? originList[0] : originList,
    credentials: true,
  })
);
app.use(express.json({ limit: '12mb' }));

const uploadStatic = process.env.VERCEL
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadStatic));

app.use(async (_req, _res, next) => {
  try {
    await connectDb(process.env.MONGODB_URI);
    next();
  } catch (err) {
    next(err);
  }
});

app.use((req, _res, next) => {
  req.io = req.app.get('io') || null;
  next();
});

const api = express.Router();
api.get('/health', (_req, res) => res.json({ ok: true, vercel: Boolean(process.env.VERCEL) }));
api.use('/auth', authRoutes);
api.use('/users', userRoutes);
api.use('/workspaces', workspaceRoutes);
api.use('/projects', projectRoutes);
api.use('/tasks', taskRoutes);
api.use('/comments', commentRoutes);
api.use('/activity', activityRoutes);
api.use('/notifications', notificationRoutes);
api.use('/search', searchRoutes);

// Keep /api/* for the client. Also mount at / in case Vercel strips the prefix.
app.use('/api', api);
app.use(api);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

export default app;

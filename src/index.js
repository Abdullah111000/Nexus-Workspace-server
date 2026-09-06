import http from 'http';
import app from './app.js';
import { connectDb } from './config/db.js';
import { attachSockets } from './sockets/index.js';

const origin = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim();

if (!process.env.VERCEL) {
  const server = http.createServer(app);
  const io = attachSockets(server, origin);
  app.set('io', io);

  const port = Number(process.env.PORT || 5000);
  await connectDb(process.env.MONGODB_URI);
  server.listen(port, () => console.log(`API listening on http://localhost:${port}`));
}

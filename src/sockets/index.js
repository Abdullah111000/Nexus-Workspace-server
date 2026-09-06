import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export function attachSockets(httpServer, origin) {
  const io = new Server(httpServer, {
    cors: { origin, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('auth'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id);
      if (!user) return next(new Error('auth'));
      socket.userId = user._id.toString();
      next();
    } catch {
      next(new Error('auth'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    socket.on('join:workspace', (wsId) => {
      if (wsId) socket.join(`ws:${wsId}`);
    });
    socket.on('leave:workspace', (wsId) => {
      if (wsId) socket.leave(`ws:${wsId}`);
    });
  });

  return io;
}

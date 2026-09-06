import { Activity } from '../models/Activity.js';
import { Notification } from '../models/Notification.js';

export async function logActivity(io, data) {
  const entry = await Activity.create(data);
  const populated = await entry.populate('actor', 'name email avatar');
  io?.to(`ws:${data.workspace}`).emit('activity:new', populated);
  return populated;
}

export async function notify(io, { user, type, title, body, task, project, workspace }) {
  const n = await Notification.create({ user, type, title, body, task, project, workspace });
  io?.to(`user:${user}`).emit('notification:new', n);
  return n;
}

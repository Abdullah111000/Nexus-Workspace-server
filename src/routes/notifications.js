import { Router } from 'express';
import { Notification } from '../models/Notification.js';
import { Task } from '../models/Task.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

router.get('/', async (req, res) => {
  const items = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(80);
  const unread = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ items, unread });
});

router.post('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
  res.json({ ok: true });
});

router.patch('/:id', async (req, res) => {
  const n = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!n) return res.status(404).json({ message: 'Not found' });
  n.read = req.body.read !== false;
  await n.save();
  res.json(n);
});

router.post('/due-check', async (req, res) => {
  if (!req.user.notificationPrefs?.dueSoon) return res.json({ created: 0 });
  const soon = new Date();
  soon.setDate(soon.getDate() + 2);
  const tasks = await Task.find({
    assignee: req.user._id,
    completed: false,
    dueDate: { $gte: new Date(), $lte: soon },
  }).limit(20);
  let created = 0;
  for (const t of tasks) {
    const exists = await Notification.findOne({
      user: req.user._id,
      type: 'dueSoon',
      task: t._id,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    if (!exists) {
      await Notification.create({
        user: req.user._id,
        type: 'dueSoon',
        title: 'Due date approaching',
        body: `“${t.title}” is due soon`,
        task: t._id,
        project: t.project,
        workspace: t.workspace,
      });
      created += 1;
    }
  }
  res.json({ created });
});

export default router;

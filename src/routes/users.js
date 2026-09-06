import { Router } from 'express';
import { User } from '../models/User.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/me', auth, async (req, res) => {
  res.json(req.user.toSafe());
});

router.patch('/me', auth, async (req, res) => {
  const { name, avatar, theme, defaultView, notificationPrefs } = req.body;
  if (name !== undefined) req.user.name = name;
  if (avatar !== undefined) req.user.avatar = avatar;
  if (theme !== undefined) req.user.theme = theme;
  if (defaultView !== undefined) req.user.defaultView = defaultView;
  if (notificationPrefs !== undefined) {
    req.user.notificationPrefs = { ...req.user.notificationPrefs.toObject?.() || req.user.notificationPrefs, ...notificationPrefs };
  }
  await req.user.save();
  res.json(req.user.toSafe());
});

router.get('/directory', auth, async (_req, res) => {
  const users = await User.find().select('name email avatar').sort({ name: 1 });
  res.json(
    users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      avatar: u.avatar,
    }))
  );
});

export default router;

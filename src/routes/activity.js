import { Router } from 'express';
import { Activity } from '../models/Activity.js';
import { auth } from '../middleware/auth.js';
import { loadWorkspace } from '../middleware/permissions.js';

const router = Router();
router.use(auth);

router.get('/workspace/:workspaceId', loadWorkspace, async (req, res) => {
  const q = { workspace: req.workspace._id };
  if (req.query.project) q.project = req.query.project;
  if (req.query.task) q.task = req.query.task;
  if (req.query.actor) q.actor = req.query.actor;
  if (req.query.action) q.action = req.query.action;
  const items = await Activity.find(q).populate('actor', 'name email avatar').sort({ createdAt: -1 }).limit(200);
  res.json(items);
});

export default router;

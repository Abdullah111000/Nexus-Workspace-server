import { Router } from 'express';
import { Task } from '../models/Task.js';
import { Project } from '../models/Project.js';
import { Workspace } from '../models/Workspace.js';
import { FilterPreset } from '../models/FilterPreset.js';
import { auth } from '../middleware/auth.js';
import { loadWorkspace, requireRole } from '../middleware/permissions.js';

const router = Router();
router.use(auth);

router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ tasks: [], projects: [], workspaces: [] });
  const workspaces = await Workspace.find({
    'members.user': req.user._id,
    name: { $regex: q, $options: 'i' },
  }).limit(8);
  const wsIds = (await Workspace.find({ 'members.user': req.user._id }).select('_id')).map((w) => w._id);
  const projects = await Project.find({
    workspace: { $in: wsIds },
    name: { $regex: q, $options: 'i' },
  }).limit(10);
  const tasks = await Task.find({
    workspace: { $in: wsIds },
    title: { $regex: q, $options: 'i' },
  })
    .populate('project', 'name')
    .limit(20);
  res.json({ tasks, projects, workspaces });
});

router.get('/presets/:workspaceId', loadWorkspace, async (req, res) => {
  const presets = await FilterPreset.find({
    workspace: req.workspace._id,
    user: req.user._id,
    ...(req.query.project ? { project: req.query.project } : {}),
  });
  res.json(presets);
});

router.post('/presets/:workspaceId', loadWorkspace, requireRole('member'), async (req, res) => {
  const preset = await FilterPreset.create({
    user: req.user._id,
    workspace: req.workspace._id,
    project: req.body.project || null,
    name: req.body.name || 'Saved filter',
    filters: req.body.filters || {},
  });
  res.status(201).json(preset);
});

router.delete('/presets/:id', async (req, res) => {
  await FilterPreset.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ ok: true });
});

export default router;

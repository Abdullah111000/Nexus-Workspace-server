import { Router } from 'express';
import { Workspace } from '../models/Workspace.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { Comment } from '../models/Comment.js';
import { Activity } from '../models/Activity.js';
import { Notification } from '../models/Notification.js';
import { FilterPreset } from '../models/FilterPreset.js';
import { User } from '../models/User.js';
import { auth } from '../middleware/auth.js';
import { loadWorkspace, requireRole } from '../middleware/permissions.js';
import { logActivity } from '../utils/activity.js';

const router = Router();
router.use(auth);

router.get('/', async (req, res) => {
  const list = await Workspace.find({ 'members.user': req.user._id }).populate('members.user', 'name email avatar');
  res.json(list);
});

router.post('/', async (req, res) => {
  const { name, icon, color, defaultView } = req.body;
  const ws = await Workspace.create({
    name: name || 'Untitled workspace',
    icon: icon || '⬡',
    color: color || '#6366f1',
    defaultView: defaultView || 'board',
    members: [{ user: req.user._id, role: 'owner' }],
  });
  const populated = await ws.populate('members.user', 'name email avatar');
  res.status(201).json(populated);
});

router.get('/:workspaceId', loadWorkspace, async (req, res) => {
  const populated = await req.workspace.populate('members.user', 'name email avatar');
  res.json({ ...populated.toObject(), myRole: req.memberRole });
});

router.patch('/:workspaceId', loadWorkspace, requireRole('admin'), async (req, res) => {
  const { name, icon, color, defaultView } = req.body;
  if (name !== undefined) req.workspace.name = name;
  if (icon !== undefined) req.workspace.icon = icon;
  if (color !== undefined) req.workspace.color = color;
  if (defaultView !== undefined) req.workspace.defaultView = defaultView;
  await req.workspace.save();
  const populated = await req.workspace.populate('members.user', 'name email avatar');
  await logActivity(req.io, {
    workspace: req.workspace._id,
    actor: req.user._id,
    action: 'workspace.updated',
    meta: { name: req.workspace.name },
  });
  res.json(populated);
});

router.delete('/:workspaceId', loadWorkspace, requireRole('owner'), async (req, res) => {
  const id = req.workspace._id;
  await Promise.all([
    Task.deleteMany({ workspace: id }),
    Comment.deleteMany({ workspace: id }),
    Activity.deleteMany({ workspace: id }),
    Notification.deleteMany({ workspace: id }),
    FilterPreset.deleteMany({ workspace: id }),
    Project.deleteMany({ workspace: id }),
    Workspace.deleteOne({ _id: id }),
  ]);
  res.json({ ok: true });
});

router.post('/:workspaceId/invite', loadWorkspace, requireRole('admin'), async (req, res) => {
  const { email, role } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  if (!user) return res.status(404).json({ message: 'No user with that email. They must sign up first.' });
  const existing = req.workspace.members.find((m) => m.user.toString() === user._id.toString());
  if (existing) {
    existing.role = role && role !== 'owner' ? role : existing.role;
  } else {
    req.workspace.members.push({ user: user._id, role: role && role !== 'owner' ? role : 'member' });
  }
  await req.workspace.save();
  const populated = await req.workspace.populate('members.user', 'name email avatar');
  await logActivity(req.io, {
    workspace: req.workspace._id,
    actor: req.user._id,
    action: 'member.invited',
    meta: { email: user.email, role: role || 'member' },
  });
  res.json(populated);
});

router.patch('/:workspaceId/members/:userId', loadWorkspace, requireRole('admin'), async (req, res) => {
  const member = req.workspace.members.find((m) => m.user.toString() === req.params.userId);
  if (!member) return res.status(404).json({ message: 'Member not found' });
  if (member.role === 'owner') return res.status(400).json({ message: 'Cannot change owner role' });
  if (req.body.role === 'owner') return res.status(400).json({ message: 'Cannot assign owner this way' });
  member.role = req.body.role;
  await req.workspace.save();
  const populated = await req.workspace.populate('members.user', 'name email avatar');
  res.json(populated);
});

router.delete('/:workspaceId/members/:userId', loadWorkspace, requireRole('admin'), async (req, res) => {
  const member = req.workspace.members.find((m) => m.user.toString() === req.params.userId);
  if (!member) return res.status(404).json({ message: 'Member not found' });
  if (member.role === 'owner') return res.status(400).json({ message: 'Cannot remove owner' });
  req.workspace.members = req.workspace.members.filter((m) => m.user.toString() !== req.params.userId);
  await req.workspace.save();
  const populated = await req.workspace.populate('members.user', 'name email avatar');
  res.json(populated);
});

router.get('/:workspaceId/export', loadWorkspace, async (req, res) => {
  const projects = await Project.find({ workspace: req.workspace._id });
  const tasks = await Task.find({ workspace: req.workspace._id });
  const comments = await Comment.find({ workspace: req.workspace._id });
  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace: req.workspace,
    projects,
    tasks,
    comments,
  });
});

router.post('/:workspaceId/import', loadWorkspace, requireRole('admin'), async (req, res) => {
  const payload = req.body;
  if (!payload || payload.version !== 1 || !payload.workspace) {
    return res.status(400).json({ message: 'Invalid workspace export JSON' });
  }
  if (payload.workspace.name) req.workspace.name = payload.workspace.name;
  if (payload.workspace.icon) req.workspace.icon = payload.workspace.icon;
  if (payload.workspace.color) req.workspace.color = payload.workspace.color;
  await req.workspace.save();
  res.json({ ok: true, message: 'Workspace metadata imported. Full clone of nested IDs is skipped to avoid collisions — use seed for a fresh demo.' });
});

router.post('/:workspaceId/reset', loadWorkspace, requireRole('owner'), async (req, res) => {
  const id = req.workspace._id;
  await Promise.all([
    Task.deleteMany({ workspace: id }),
    Comment.deleteMany({ workspace: id }),
    Activity.deleteMany({ workspace: id }),
    Notification.deleteMany({ workspace: id }),
    FilterPreset.deleteMany({ workspace: id }),
    Project.deleteMany({ workspace: id }),
  ]);
  res.json({ ok: true });
});

export default router;

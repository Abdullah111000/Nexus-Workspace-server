import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { Comment } from '../models/Comment.js';
import { Activity } from '../models/Activity.js';
import { auth } from '../middleware/auth.js';
import { loadWorkspace, requireRole } from '../middleware/permissions.js';
import { logActivity } from '../utils/activity.js';

const router = Router();
router.use(auth);

const DEFAULT_COLUMNS = [
  { id: 'todo', name: 'To do', order: 0 },
  { id: 'in_progress', name: 'In progress', order: 1 },
  { id: 'review', name: 'Review', order: 2 },
  { id: 'done', name: 'Done', order: 3 },
];

export const TEMPLATES = {
  blank: { name: 'Blank', tasks: [] },
  sprint: {
    name: 'Sprint board',
    tasks: [
      { title: 'Sprint planning', status: 'todo', priority: 'high', labels: ['planning'] },
      { title: 'Implement user stories', status: 'todo', priority: 'medium', labels: ['dev'] },
      { title: 'QA pass', status: 'todo', priority: 'medium', labels: ['qa'] },
      { title: 'Demo & retro', status: 'todo', priority: 'low', labels: ['meeting'] },
    ],
  },
  bugfix: {
    name: 'Bug triage',
    tasks: [
      { title: 'Reproduce issue', status: 'todo', priority: 'high', labels: ['bug'] },
      { title: 'Write failing test', status: 'todo', priority: 'medium', labels: ['qa'] },
      { title: 'Fix & ship', status: 'todo', priority: 'high', labels: ['dev'] },
    ],
  },
  content: {
    name: 'Content calendar',
    tasks: [
      { title: 'Brief', status: 'todo', priority: 'medium', labels: ['content'] },
      { title: 'Draft', status: 'todo', priority: 'medium', labels: ['content'] },
      { title: 'Review', status: 'review', priority: 'low', labels: ['content'] },
      { title: 'Publish', status: 'todo', priority: 'high', labels: ['content'] },
    ],
  },
};

router.get('/templates', (_req, res) => {
  res.json(
    Object.entries(TEMPLATES).map(([id, t]) => ({
      id,
      name: t.name,
      taskCount: t.tasks.length,
    }))
  );
});

router.get('/workspace/:workspaceId', loadWorkspace, async (req, res) => {
  const archived = req.query.archived === 'true';
  const projects = await Project.find({ workspace: req.workspace._id, archived }).populate('members', 'name email avatar');
  res.json(projects);
});

router.post('/workspace/:workspaceId', loadWorkspace, requireRole('member'), async (req, res) => {
  const { name, description, color, icon, members, template } = req.body;
  const project = await Project.create({
    workspace: req.workspace._id,
    name: name || 'New project',
    description: description || '',
    color: color || '#8b5cf6',
    icon: icon || '◈',
    members: members?.length ? members : req.workspace.members.map((m) => m.user),
    columns: DEFAULT_COLUMNS,
    lastView: req.workspace.defaultView,
  });
  const tpl = TEMPLATES[template];
  if (tpl?.tasks?.length) {
    await Task.insertMany(
      tpl.tasks.map((t, i) => ({
        ...t,
        workspace: req.workspace._id,
        project: project._id,
        createdBy: req.user._id,
        order: i,
      }))
    );
  }
  await logActivity(req.io, {
    workspace: req.workspace._id,
    project: project._id,
    actor: req.user._id,
    action: 'project.created',
    meta: { name: project.name },
  });
  const populated = await project.populate('members', 'name email avatar');
  res.status(201).json(populated);
});

router.get('/:projectId', auth, async (req, res) => {
  const project = await Project.findById(req.params.projectId).populate('members', 'name email avatar');
  if (!project) return res.status(404).json({ message: 'Project not found' });
  req.params.workspaceId = project.workspace.toString();
  await loadWorkspace(req, res, async () => {
    res.json(project);
  });
});

router.patch('/:projectId', auth, async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  req.params.workspaceId = project.workspace.toString();
  await loadWorkspace(req, res, async () => {
    requireRole('member')(req, res, async () => {
      const fields = ['name', 'description', 'color', 'icon', 'archived', 'members', 'columns', 'lastView'];
      for (const f of fields) {
        if (req.body[f] !== undefined) project[f] = req.body[f];
      }
      await project.save();
      await logActivity(req.io, {
        workspace: project.workspace,
        project: project._id,
        actor: req.user._id,
        action: 'project.updated',
        meta: { name: project.name },
      });
      const populated = await project.populate('members', 'name email avatar');
      res.json(populated);
    });
  });
});

router.delete('/:projectId', auth, async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  req.params.workspaceId = project.workspace.toString();
  await loadWorkspace(req, res, async () => {
    requireRole('admin')(req, res, async () => {
      await Task.deleteMany({ project: project._id });
      await Comment.deleteMany({ workspace: project.workspace });
      await Activity.deleteMany({ project: project._id });
      await project.deleteOne();
      res.json({ ok: true });
    });
  });
});

router.post('/:projectId/columns', auth, async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  req.params.workspaceId = project.workspace.toString();
  await loadWorkspace(req, res, async () => {
    requireRole('member')(req, res, async () => {
      project.columns.push({
        id: uuid(),
        name: req.body.name || 'New column',
        order: project.columns.length,
      });
      await project.save();
      res.json(project);
    });
  });
});

export default router;

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Task } from '../models/Task.js';
import { Comment } from '../models/Comment.js';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { auth } from '../middleware/auth.js';
import { loadWorkspace, requireRole } from '../middleware/permissions.js';
import { logActivity, notify } from '../utils/activity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 8 * 1024 * 1024 },
});

const router = Router();
router.use(auth);

function taskQuery(req) {
  const q = { project: req.params.projectId, parent: null };
  const { assignee, label, priority, status, dueFrom, dueTo, q: search, completed } = req.query;
  if (assignee) q.assignee = assignee;
  if (label) q.labels = label;
  if (priority) q.priority = priority;
  if (status) q.status = status;
  if (completed === 'true') q.completed = true;
  if (completed === 'false') q.completed = false;
  if (dueFrom || dueTo) {
    q.dueDate = {};
    if (dueFrom) q.dueDate.$gte = new Date(dueFrom);
    if (dueTo) q.dueDate.$lte = new Date(dueTo);
  }
  if (search) q.title = { $regex: search, $options: 'i' };
  return q;
}

function sortSpec(sort) {
  switch (sort) {
    case 'due':
      return { dueDate: 1 };
    case 'priority':
      return { priority: -1, createdAt: -1 };
    case 'alpha':
      return { title: 1 };
    case 'created':
      return { createdAt: -1 };
    default:
      return { order: 1, createdAt: 1 };
  }
}

router.get('/project/:projectId', async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  req.params.workspaceId = project.workspace.toString();
  await loadWorkspace(req, res, async () => {
    const includeSub = req.query.subtasks === 'true';
    const filter = taskQuery(req);
    if (includeSub) delete filter.parent;
    const tasks = await Task.find(filter)
      .populate('assignee', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .sort(sortSpec(req.query.sort));
    const parents = includeSub ? tasks.filter((t) => !t.parent) : tasks;
    const allSubs = await Task.find({ project: project._id, parent: { $ne: null } })
      .populate('assignee', 'name email avatar')
      .sort({ order: 1 });
    res.json({ tasks: parents, subtasks: allSubs });
  });
});

router.post('/project/:projectId', async (req, res) => {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  req.params.workspaceId = project.workspace.toString();
  await loadWorkspace(req, res, async () => {
    requireRole('member')(req, res, async () => {
      const count = await Task.countDocuments({ project: project._id, parent: req.body.parent || null });
      const task = await Task.create({
        workspace: project.workspace,
        project: project._id,
        parent: req.body.parent || null,
        title: req.body.title || 'Untitled task',
        description: req.body.description || '',
        status: req.body.status || project.columns[0]?.id || 'todo',
        priority: req.body.priority || 'medium',
        dueDate: req.body.dueDate || null,
        assignee: req.body.assignee || null,
        labels: req.body.labels || [],
        order: req.body.order ?? count,
        createdBy: req.user._id,
      });
      const populated = await task.populate('assignee createdBy', 'name email avatar');
      await logActivity(req.io, {
        workspace: project.workspace,
        project: project._id,
        task: task._id,
        actor: req.user._id,
        action: 'task.created',
        meta: { title: task.title },
      });
      if (task.assignee && task.assignee.toString() !== req.user._id.toString()) {
        const assigneeUser = await User.findById(task.assignee);
        if (assigneeUser?.notificationPrefs?.assigned) {
          await notify(req.io, {
            user: task.assignee,
            type: 'assigned',
            title: 'Assigned to a task',
            body: `${req.user.name} assigned you “${task.title}”`,
            task: task._id,
            project: project._id,
            workspace: project.workspace,
          });
        }
      }
      req.io?.to(`ws:${project.workspace}`).emit('task:updated', populated);
      res.status(201).json(populated);
    });
  });
});

router.get('/:taskId', async (req, res) => {
  const task = await Task.findById(req.params.taskId)
    .populate('assignee createdBy', 'name email avatar')
    .populate('project', 'name columns color icon');
  if (!task) return res.status(404).json({ message: 'Task not found' });
  req.params.workspaceId = task.workspace.toString();
  await loadWorkspace(req, res, async () => {
    const subtasks = await Task.find({ parent: task._id }).populate('assignee', 'name email avatar').sort({ order: 1 });
    res.json({ task, subtasks, myRole: req.memberRole });
  });
});

router.patch('/:taskId', async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ message: 'Task not found' });
  req.params.workspaceId = task.workspace.toString();
  await loadWorkspace(req, res, async () => {
    requireRole('member')(req, res, async () => {
      const before = task.toObject();
      const fields = ['title', 'description', 'status', 'priority', 'dueDate', 'assignee', 'labels', 'completed', 'order', 'parent'];
      for (const f of fields) {
        if (req.body[f] !== undefined) task[f] = req.body[f];
      }
      await task.save();
      const populated = await task.populate('assignee createdBy', 'name email avatar');
      let action = 'task.edited';
      if (before.status !== task.status) action = 'task.status_changed';
      if (!before.completed && task.completed) action = 'task.completed';
      await logActivity(req.io, {
        workspace: task.workspace,
        project: task.project,
        task: task._id,
        actor: req.user._id,
        action,
        meta: { title: task.title, from: before.status, to: task.status },
      });
      if (req.body.assignee && String(req.body.assignee) !== String(before.assignee || '')) {
        await notify(req.io, {
          user: req.body.assignee,
          type: 'assigned',
          title: 'Assigned to a task',
          body: `${req.user.name} assigned you “${task.title}”`,
          task: task._id,
          project: task.project,
          workspace: task.workspace,
        });
      }
      req.io?.to(`ws:${task.workspace}`).emit('task:updated', populated);
      res.json(populated);
    });
  });
});

router.delete('/:taskId', async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ message: 'Task not found' });
  req.params.workspaceId = task.workspace.toString();
  await loadWorkspace(req, res, async () => {
    requireRole('member')(req, res, async () => {
      await Task.deleteMany({ $or: [{ _id: task._id }, { parent: task._id }] });
      await Comment.deleteMany({ task: task._id });
      await logActivity(req.io, {
        workspace: task.workspace,
        project: task.project,
        actor: req.user._id,
        action: 'task.deleted',
        meta: { title: task.title },
      });
      req.io?.to(`ws:${task.workspace}`).emit('task:deleted', { id: task._id });
      res.json({ ok: true, snapshot: task });
    });
  });
});

router.post('/:taskId/duplicate', async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ message: 'Task not found' });
  req.params.workspaceId = task.workspace.toString();
  await loadWorkspace(req, res, async () => {
    requireRole('member')(req, res, async () => {
      const copy = await Task.create({
        workspace: task.workspace,
        project: task.project,
        parent: task.parent,
        title: `${task.title} (copy)`,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        assignee: task.assignee,
        labels: task.labels,
        completed: false,
        order: task.order + 1,
        createdBy: req.user._id,
      });
      const subs = await Task.find({ parent: task._id });
      if (subs.length) {
        await Task.insertMany(
          subs.map((s, i) => ({
            workspace: s.workspace,
            project: s.project,
            parent: copy._id,
            title: s.title,
            description: s.description,
            status: s.status,
            priority: s.priority,
            completed: false,
            order: i,
            createdBy: req.user._id,
          }))
        );
      }
      const populated = await copy.populate('assignee createdBy', 'name email avatar');
      res.status(201).json(populated);
    });
  });
});

router.post('/:taskId/convert', async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ message: 'Task not found' });
  req.params.workspaceId = task.workspace.toString();
  await loadWorkspace(req, res, async () => {
    requireRole('member')(req, res, async () => {
      if (req.body.to === 'task') task.parent = null;
      else if (req.body.parent) task.parent = req.body.parent;
      await task.save();
      const populated = await task.populate('assignee createdBy', 'name email avatar');
      res.json(populated);
    });
  });
});

router.post('/bulk', async (req, res) => {
  const { ids, patch, workspaceId } = req.body;
  req.params.workspaceId = workspaceId;
  await loadWorkspace(req, res, async () => {
    requireRole('member')(req, res, async () => {
      const allowed = {};
      for (const f of ['status', 'assignee', 'priority', 'completed']) {
        if (patch?.[f] !== undefined) allowed[f] = patch[f];
      }
      if (patch?.delete) {
        await Task.deleteMany({ _id: { $in: ids }, workspace: req.workspace._id });
        return res.json({ ok: true, deleted: ids.length });
      }
      await Task.updateMany({ _id: { $in: ids }, workspace: req.workspace._id }, { $set: allowed });
      const tasks = await Task.find({ _id: { $in: ids } }).populate('assignee createdBy', 'name email avatar');
      res.json(tasks);
    });
  });
});

router.post('/:taskId/attachments', upload.single('file'), async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ message: 'Task not found' });
  req.params.workspaceId = task.workspace.toString();
  await loadWorkspace(req, res, async () => {
    requireRole('member')(req, res, async () => {
      if (!req.file) return res.status(400).json({ message: 'No file' });
      const att = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`,
      };
      task.attachments.push(att);
      await task.save();
      res.json(task);
    });
  });
});

export default router;

import { Router } from 'express';
import { Comment } from '../models/Comment.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { auth } from '../middleware/auth.js';
import { loadWorkspace, requireRole } from '../middleware/permissions.js';
import { logActivity, notify } from '../utils/activity.js';

const router = Router();
router.use(auth);

router.get('/task/:taskId', async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ message: 'Task not found' });
  req.params.workspaceId = task.workspace.toString();
  await loadWorkspace(req, res, async () => {
    const comments = await Comment.find({ task: task._id }).populate('author mentions', 'name email avatar').sort({ createdAt: 1 });
    res.json(comments);
  });
});

router.post('/task/:taskId', async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) return res.status(404).json({ message: 'Task not found' });
  req.params.workspaceId = task.workspace.toString();
  await loadWorkspace(req, res, async () => {
    requireRole('member')(req, res, async () => {
      const mentionIds = req.body.mentions || [];
      const comment = await Comment.create({
        task: task._id,
        workspace: task.workspace,
        author: req.user._id,
        body: req.body.body || '',
        mentions: mentionIds,
      });
      const populated = await comment.populate('author mentions', 'name email avatar');
      await logActivity(req.io, {
        workspace: task.workspace,
        project: task.project,
        task: task._id,
        actor: req.user._id,
        action: 'task.commented',
        meta: { title: task.title },
      });
      for (const mid of mentionIds) {
        const u = await User.findById(mid);
        if (u?.notificationPrefs?.mentioned) {
          await notify(req.io, {
            user: mid,
            type: 'mentioned',
            title: 'You were mentioned',
            body: `${req.user.name} mentioned you on “${task.title}”`,
            task: task._id,
            project: task.project,
            workspace: task.workspace,
          });
        }
      }
      req.io?.to(`ws:${task.workspace}`).emit('comment:created', populated);
      res.status(201).json(populated);
    });
  });
});

router.patch('/:commentId', async (req, res) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });
  if (comment.author.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'You can only edit your own comments' });
  }
  comment.body = req.body.body;
  await comment.save();
  const populated = await comment.populate('author mentions', 'name email avatar');
  res.json(populated);
});

router.delete('/:commentId', async (req, res) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });
  if (comment.author.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'You can only delete your own comments' });
  }
  await comment.deleteOne();
  res.json({ ok: true });
});

export default router;

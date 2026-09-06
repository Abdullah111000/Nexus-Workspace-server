import { Workspace } from '../models/Workspace.js';

const rank = { viewer: 1, member: 2, admin: 3, owner: 4 };

export async function loadWorkspace(req, res, next) {
  const id = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;
  if (!id) return res.status(400).json({ message: 'Workspace id required' });
  const workspace = await Workspace.findById(id);
  if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
  const member = workspace.members.find((m) => m.user.toString() === req.user._id.toString());
  if (!member) return res.status(403).json({ message: 'Access denied' });
  req.workspace = workspace;
  req.memberRole = member.role;
  next();
}

export function requireRole(min) {
  return (req, res, next) => {
    if ((rank[req.memberRole] || 0) < rank[min]) {
      return res.status(403).json({ message: 'Access denied', code: 'FORBIDDEN' });
    }
    next();
  };
}

export function canEdit(role) {
  return (rank[role] || 0) >= rank.member;
}

export function canAdmin(role) {
  return (rank[role] || 0) >= rank.admin;
}

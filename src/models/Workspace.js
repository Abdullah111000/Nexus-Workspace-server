import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'admin', 'member', 'viewer'], default: 'member' },
  },
  { _id: false }
);

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: '⬡' },
    color: { type: String, default: '#6366f1' },
    defaultView: { type: String, enum: ['board', 'list', 'calendar'], default: 'board' },
    members: [memberSchema],
  },
  { timestamps: true }
);

export const Workspace = mongoose.model('Workspace', workspaceSchema);

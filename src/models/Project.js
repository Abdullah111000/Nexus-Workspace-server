import mongoose from 'mongoose';

const columnSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    color: { type: String, default: '#8b5cf6' },
    icon: { type: String, default: '◈' },
    archived: { type: Boolean, default: false },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    columns: { type: [columnSchema], default: [] },
    lastView: { type: String, enum: ['board', 'list', 'calendar'], default: 'board' },
  },
  { timestamps: true }
);

export const Project = mongoose.model('Project', projectSchema);

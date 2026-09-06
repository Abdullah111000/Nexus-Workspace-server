import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['assigned', 'mentioned', 'dueSoon', 'comment'], required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    read: { type: Boolean, default: false },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
  },
  { timestamps: true }
);

export const Notification = mongoose.model('Notification', notificationSchema);

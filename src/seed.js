import 'dotenv/config';
import { connectDb } from './config/db.js';
import { User } from './models/User.js';
import { Workspace } from './models/Workspace.js';
import { Project } from './models/Project.js';
import { Task } from './models/Task.js';
import { Comment } from './models/Comment.js';
import { Activity } from './models/Activity.js';
import { Notification } from './models/Notification.js';
import { FilterPreset } from './models/FilterPreset.js';

await connectDb(process.env.MONGODB_URI);

const models = [User, Workspace, Project, Task, Comment, Activity, Notification, FilterPreset];
for (const model of models) {
  try {
    await model.collection.dropIndexes();
  } catch (e) {
    // ignore if collection doesn't exist
  }
}

await Promise.all(models.map((m) => m.deleteMany({})));



const [owner, admin, member, viewer] = await User.create([
  { name: 'Abdullah Iftikhar', email: 'owner@demo.com', password: 'password123', theme: 'dark' },
  { name: 'Talha Iftikhar', email: 'admin@demo.com', password: 'password123', theme: 'dark' },
  { name: 'Asad Jutt', email: 'member@demo.com', password: 'password123', theme: 'light' },
  { name: 'Awais Shah', email: 'viewer@demo.com', password: 'password123', theme: 'dark' },
]);

const ws = await Workspace.create({
  name: 'Nexus Labs',
  icon: '✦',
  color: '#6366f1',
  defaultView: 'board',
  members: [
    { user: owner._id, role: 'owner' },
    { user: admin._id, role: 'admin' },
    { user: member._id, role: 'member' },
    { user: viewer._id, role: 'viewer' },
  ],
});

const cols = [
  { id: 'todo', name: 'To do', order: 0 },
  { id: 'in_progress', name: 'In progress', order: 1 },
  { id: 'review', name: 'Review', order: 2 },
  { id: 'done', name: 'Done', order: 3 },
];

const product = await Project.create({
  workspace: ws._id,
  name: 'Product launch',
  description: 'Q3 launch workstream — website, onboarding, and GTM.',
  color: '#8b5cf6',
  icon: '◈',
  members: [owner._id, admin._id, member._id, viewer._id],
  columns: cols,
  lastView: 'board',
});

const ops = await Project.create({
  workspace: ws._id,
  name: 'Ops & hiring',
  description: 'Internal operations and recruiting pipeline.',
  color: '#06b6d4',
  icon: '◎',
  members: [owner._id, admin._id],
  columns: cols,
  lastView: 'list',
});

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const nextWeek = new Date();
nextWeek.setDate(nextWeek.getDate() + 7);

const t1 = await Task.create({
  workspace: ws._id,
  project: product._id,
  title: 'Finalize pricing page copy',
  description: 'Align with marketing on value props and FAQ.',
  status: 'in_progress',
  priority: 'high',
  dueDate: tomorrow,
  assignee: member._id,
  labels: ['content', 'web'],
  createdBy: owner._id,
  order: 0,
});

const t2 = await Task.create({
  workspace: ws._id,
  project: product._id,
  title: 'Onboarding checklist UI',
  description: 'Empty states, progress, and skip logic.',
  status: 'todo',
  priority: 'urgent',
  dueDate: nextWeek,
  assignee: admin._id,
  labels: ['dev', 'ux'],
  createdBy: owner._id,
  order: 1,
});

const t3 = await Task.create({
  workspace: ws._id,
  project: product._id,
  title: 'Beta user interviews',
  description: 'Five calls with design partners.',
  status: 'review',
  priority: 'medium',
  dueDate: nextWeek,
  assignee: owner._id,
  labels: ['research'],
  createdBy: admin._id,
  order: 0,
});

await Task.create({
  workspace: ws._id,
  project: product._id,
  title: 'Ship changelog',
  description: 'Public notes for v1.',
  status: 'done',
  priority: 'low',
  completed: true,
  assignee: member._id,
  labels: ['content'],
  createdBy: member._id,
  order: 0,
});

await Task.create([
  { workspace: ws._id, project: product._id, parent: t2._id, title: 'Wireframe steps', status: 'done', completed: true, createdBy: admin._id, order: 0 },
  { workspace: ws._id, project: product._id, parent: t2._id, title: 'Implement stepper', status: 'todo', createdBy: admin._id, order: 1 },
  { workspace: ws._id, project: product._id, parent: t1._id, title: 'Legal review of claims', status: 'todo', createdBy: owner._id, order: 0 },
]);

await Task.create({
  workspace: ws._id,
  project: ops._id,
  title: 'Senior frontend role JD',
  description: 'Publish on LinkedIn and the careers page.',
  status: 'todo',
  priority: 'high',
  assignee: admin._id,
  labels: ['hiring'],
  createdBy: owner._id,
});

await Comment.create({
  task: t1._id,
  workspace: ws._id,
  author: owner._id,
  body: 'Let’s keep the hero under 12 words. @Asad Jutt can you own the FAQ?',
  mentions: [member._id],
});

await Comment.create({
  task: t1._id,
  workspace: ws._id,
  author: member._id,
  body: 'On it — draft in Figma comments by EOD.',
  mentions: [],
});

await Activity.create([
  { workspace: ws._id, project: product._id, task: t1._id, actor: owner._id, action: 'task.created', meta: { title: t1.title } },
  { workspace: ws._id, project: product._id, task: t1._id, actor: member._id, action: 'task.commented', meta: { title: t1.title } },
  { workspace: ws._id, project: product._id, task: t3._id, actor: admin._id, action: 'task.status_changed', meta: { title: t3.title, from: 'todo', to: 'review' } },
]);

await Notification.create({
  user: member._id,
  type: 'mentioned',
  title: 'You were mentioned',
  body: 'Abdullah Iftikhar mentioned you on “Finalize pricing page copy”',
  task: t1._id,
  project: product._id,
  workspace: ws._id,
});

await Notification.create({
  user: admin._id,
  type: 'assigned',
  title: 'Assigned to a task',
  body: 'You were assigned “Onboarding checklist UI”',
  task: t2._id,
  project: product._id,
  workspace: ws._id,
});

await FilterPreset.create({
  user: owner._id,
  workspace: ws._id,
  project: product._id,
  name: 'My high priority',
  filters: { assignee: owner._id.toString(), priority: 'high' },
});

console.log('Seeded demo users:');
console.log('  owner@demo.com / password123  (owner)');
console.log('  admin@demo.com / password123  (admin)');
console.log('  member@demo.com / password123 (member)');
console.log('  viewer@demo.com / password123 (viewer)');
process.exit(0);

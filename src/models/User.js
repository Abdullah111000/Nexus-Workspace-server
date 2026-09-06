import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const notificationPrefsSchema = new mongoose.Schema(
  {
    assigned: { type: Boolean, default: true },
    mentioned: { type: Boolean, default: true },
    dueSoon: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    avatar: { type: String, default: '' },
    theme: { type: String, enum: ['light', 'dark'], default: 'dark' },
    defaultView: { type: String, enum: ['board', 'list', 'calendar'], default: 'board' },
    notificationPrefs: { type: notificationPrefsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hash(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function compare(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafe = function toSafe() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    avatar: this.avatar,
    theme: this.theme,
    defaultView: this.defaultView,
    notificationPrefs: this.notificationPrefs,
  };
};

export const User = mongoose.model('User', userSchema);

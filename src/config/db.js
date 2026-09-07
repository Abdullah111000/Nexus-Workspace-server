import mongoose from 'mongoose';

let connectionPromise;

export const connectDb = async (uri) => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  const mongoUri =
    uri ||
    process.env.MONGODB_URI ||
    `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.6kvz2fb.mongodb.net`;

  connectionPromise = mongoose
    .connect(mongoUri)
    .then(async (conn) => {
    console.log(`Database connected successfully: ${conn.connection.host}`);
    const workspaceIndexes = await conn.connection.db.collection('workspaces').indexes();
    if (workspaceIndexes.some((index) => index.name === 'id_1')) {
      await conn.connection.db.collection('workspaces').dropIndex('id_1');
      console.log('Removed obsolete workspaces.id index');
    }
    return conn;
    })
    .catch((error) => {
      connectionPromise = undefined;
    console.error('Database connection failed:', error.message);
      throw error;
    });

  return connectionPromise;
};

export const connectDB = connectDb;

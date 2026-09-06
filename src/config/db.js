import mongoose from 'mongoose';

export const connectDb = async (uri) => {
  const mongoUri =
    uri ||
    process.env.MONGODB_URI ||
    `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@cluster0.6kvz2fb.mongodb.net`;

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`Database connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    throw error;
  }
};

export const connectDB = connectDb;
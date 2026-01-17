import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: string;
  bookstoRead?: mongoose.Types.ObjectId[];
  booksReading?: mongoose.Types.ObjectId[];
  favorites?: mongoose.Types.ObjectId[];
}

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' }, // 'user' or 'admin'
  bookstoRead: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
  booksReading: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
});

export const User = mongoose.model<IUser>('User', UserSchema);
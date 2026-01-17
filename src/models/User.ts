import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserBook {
  book: Types.ObjectId;       // reference to the Book
  status: 'toRead' | 'reading' | 'read';
  rating?: number;            // optional per-user rating
}

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  books: IUserBook[];         // user's books with status & rating
  favorites: Types.ObjectId[]; // array of favorite books
}

const UserBookSchema: Schema<IUserBook> = new Schema({
  book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  status: { type: String, enum: ['toRead', 'reading', 'read'], required: true },
  rating: { type: Number, min: 1, max: 5 }
});

const UserSchema: Schema<IUser> = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  books: { type: [UserBookSchema], default: [] },
  favorites: [{ type: Schema.Types.ObjectId, ref: 'Book', default: [] }],
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);

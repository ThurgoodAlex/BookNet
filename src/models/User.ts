import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserBook {
  book: Types.ObjectId;  
  status: 'toRead' | 'reading' | 'read';
  rating?: number;    
}

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  books: IUserBook[];
  favorites: Types.ObjectId[];
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

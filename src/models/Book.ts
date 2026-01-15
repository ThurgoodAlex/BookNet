import mongoose, { Schema, Document } from 'mongoose';

export interface IBook extends Document {
  title: string;
  type: string;
  description: string;
  completed: boolean;
  rating: number;
}

const bookSchema: Schema = new Schema({
  title: { type: String, required: true },
  type: { type: String, required: true },
  description: { type: String },
  completed: { type: Boolean, default: false },
  rating: { type: Number, default: 0 },
});

export default mongoose.model<IBook>('Book', bookSchema);
import mongoose, { Schema, Document } from 'mongoose';

export interface IBook extends Document {
  title: string;
  type: string;
  description?: string;
  completed: boolean; // global completion optional
}

const BookSchema: Schema = new Schema({
  title: { type: String, required: true },
  type: { type: String, required: true },
  description: { type: String },
  completed: { type: Boolean, default: false }, // global flag (optional)
});

export default mongoose.model<IBook>('Book', BookSchema);

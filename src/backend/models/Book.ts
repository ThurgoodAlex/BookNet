import { Schema, model, Document } from 'mongoose';

export interface IBook extends Document {
  // Google Books reference
  googleBooksId: string;
  isbn?: string;
  
  // Cached data for performance (from Google Books)
  title: string;
  author: string;
  coverImage: string;
  genres: string[];
  publishedYear?: number;
  pageCount?: number;
  
  // Our custom data (not in Google Books)
  averageRating: number;      // OUR users' average rating
  totalRatings: number;       // Number of ratings from OUR users
  relatedBooks: Schema.Types.ObjectId[];  // Computed relationships
  
  // Cache management
  lastFetched: Date;
}

const bookSchema = new Schema<IBook>({
  googleBooksId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  isbn: { 
    type: String, 
    index: true 
  },
  
  // Cached data
  title: { type: String, required: true },
  author: { type: String, required: true },
  coverImage: String,
  genres: [String],
  publishedYear: Number,
  pageCount: Number,
  
  // Our custom data
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  totalRatings: { type: Number, default: 0, min: 0 },
  relatedBooks: [{ type: Schema.Types.ObjectId, ref: 'Book' }],
  
  // 3D visualization
  
  // Cache management
  lastFetched: { type: Date, default: Date.now }
}, { 
  timestamps: true 
});

// Indexes for performance
bookSchema.index({ genres: 1, averageRating: -1 });
bookSchema.index({ author: 1 });
bookSchema.index({ averageRating: -1, totalRatings: -1 });

export default model<IBook>('Book', bookSchema);
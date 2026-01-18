import mongoose, { Schema, model, Document } from 'mongoose';

export interface IUserBook {
  book: mongoose.Types.ObjectId;
  status: 'toRead' | 'reading' | 'read';
  rating?: number;
  completed?: boolean;
  
  // Tracking dates
  dateAdded: Date;
  dateStarted?: Date;
  dateCompleted?: Date;
  
  // Reading analytics
  readingProgress?: number; // 0-100
  notes?: string;
  timeSpentReading?: number; // minutes
}

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: string;
  
  // User's book collection
  books: IUserBook[];
  favorites: Schema.Types.ObjectId[];
  
  // Analytics for recommendations (computed periodically)
  preferredGenres?: Map<string, number>; // genre -> weight
  preferredAuthors?: Map<string, number>; // author -> weight
  averageRating?: number;
  totalBooksRead?: number;
  
  // 3D shelf customization
  shelfLayout?: '3d-grid' | '3d-spiral' | '3d-wall' | '3d-circular';
  shelfTheme?: string;
}

const userBookSchema = new Schema<IUserBook>({
  book: { 
    type: Schema.Types.ObjectId, 
    ref: 'Book', 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['toRead', 'reading', 'read'], 
    required: true,
    default: 'toRead'
  },
  rating: { 
    type: Number, 
    min: 1, 
    max: 5 
  },
  completed: { 
    type: Boolean, 
    default: false 
  },
  dateAdded: { 
    type: Date, 
    default: Date.now 
  },
  dateStarted: Date,
  dateCompleted: Date,
  readingProgress: { 
    type: Number, 
    min: 0, 
    max: 100,
    default: 0
  },
  notes: String,
  timeSpentReading: { 
    type: Number, 
    default: 0 
  }
}, { _id: false });

const userSchema = new Schema<IUser>({
  username: { 
    type: String, 
    required: true, 
    unique: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    default: 'user' 
  },
  
  books: [userBookSchema],
  favorites: [{ type: Schema.Types.ObjectId, ref: 'Book' }],
  
  // Analytics
  preferredGenres: {
    type: Map,
    of: Number
  },
  preferredAuthors: {
    type: Map,
    of: Number
  },
  averageRating: Number,
  totalBooksRead: Number,
  
  // 3D customization
  shelfLayout: {
    type: String,
    enum: ['3d-grid', '3d-spiral', '3d-wall', '3d-circular'],
    default: '3d-grid'
  },
  shelfTheme: String
}, { 
  timestamps: true 
});

// Index for faster queries
userSchema.index({ 'books.book': 1 });
userSchema.index({ 'books.status': 1 });

export const User = model<IUser>('User', userSchema);
export default User;
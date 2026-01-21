import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import Book from '../models/Book';
import { generateToken } from '../utils/jwt';

// Counter for unique IDs
let idCounter = 0;
function uniqueId() {
  return `${Date.now()}_${++idCounter}_${Math.random().toString(36).slice(2, 8)}`;
}

export interface TestUser {
  _id: string;
  username: string;
  email: string;
  password: string;
  role: string;
  token: string;
}

export async function createTestUser(overrides: Partial<{
  username: string;
  email: string;
  password: string;
  role: string;
}> = {}): Promise<TestUser> {
  const hashedPassword = await bcrypt.hash(overrides.password || 'password123', 10);
  const uid = uniqueId();

  const user = new User({
    username: overrides.username || `testuser_${uid}`,
    email: overrides.email || `test_${uid}@example.com`,
    password: hashedPassword,
    role: overrides.role || 'user'
  });

  await user.save();

  const token = generateToken({ id: user._id.toString(), role: user.role });

  return {
    _id: user._id.toString(),
    username: user.username,
    email: user.email,
    password: overrides.password || 'password123',
    role: user.role,
    token
  };
}

export async function createTestBook(overrides: Partial<{
  googleBooksId: string;
  title: string;
  author: string;
  coverImage: string;
  genres: string[];
  averageRating: number;
  totalRatings: number;
}> = {}) {
  const uid = uniqueId();

  const book = new Book({
    googleBooksId: overrides.googleBooksId || `google_${uid}`,
    title: overrides.title || 'Test Book',
    author: overrides.author || 'Test Author',
    coverImage: overrides.coverImage || 'https://example.com/cover.jpg',
    genres: overrides.genres || ['Fiction'],
    averageRating: overrides.averageRating ?? 0,
    totalRatings: overrides.totalRatings ?? 0,
    lastFetched: new Date()
  });

  await book.save();
  return book;
}

export async function addBookToUserLibrary(
  userId: string,
  bookId: string,
  status: 'toRead' | 'reading' | 'read' = 'toRead',
  rating?: number
) {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  user.books.push({
    book: bookId as any,
    status,
    rating,
    dateAdded: new Date()
  } as any);

  await user.save();
  return user;
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

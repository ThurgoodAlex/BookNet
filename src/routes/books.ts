import { Router } from 'express';
import mongoose from 'mongoose';
import Book, { IBook } from '../models/Book';
import { User, IUserBook } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper to validate ObjectId
const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

// POST / → create a new book (admin only)
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const { title, type, description } = req.body;
    const book: IBook = new Book({ title, type, description, completed: false });
    const savedBook = await book.save();
    res.status(201).json(savedBook);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// GET / → get all books
router.get('/', async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /:id → get a single book
router.get('/:id', async (req, res) => {
  const bookId = req.params.id as string;
  if (!isValidObjectId(bookId)) return res.status(400).json({ message: 'Invalid book ID' });

  try {
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json(book);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /:id → update book (admin only)
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id as string;
  if (!isValidObjectId(bookId)) return res.status(400).json({ message: 'Invalid book ID' });
  if (req.user!.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

  try {
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    const { title, type, description, completed } = req.body;
    if (title !== undefined) book.title = title;
    if (type !== undefined) book.type = type;
    if (description !== undefined) book.description = description;
    if (completed !== undefined) book.completed = completed;

    const updatedBook = await book.save();
    res.json(updatedBook);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});


// DELETE /:id → delete book (admin only)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id as string;
  if (!isValidObjectId(bookId)) return res.status(400).json({ message: 'Invalid book ID' });

  if (req.user!.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

  try {
    const book = await Book.findByIdAndDelete(bookId);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.status(200).json({ message: 'Book deleted' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /:id/add-to-list → add book to user's list
router.patch('/:id/add-to-list', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id as string;
  const status = req.body.status as 'toRead' | 'reading' | 'read';
  const userId = req.user!.id;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  if (user.books.some(b => b.book.toString() === bookId)) {
    return res.status(400).json({ message: 'Book already in your list' });
  }

  user.books.push({
    book: new mongoose.Types.ObjectId(bookId),
    status
  } as IUserBook);

  await user.save();
  res.json({ message: `Book added to ${status} list` });
});

// PATCH /:id/rating → set per-user rating
router.patch('/:id/rating', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id as string;
  const rating = Number(req.body.rating);
  const userId = req.user!.id;

  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating must be 1-5' });
  if (!isValidObjectId(bookId)) return res.status(400).json({ message: 'Invalid book ID' });

  const result = await User.updateOne(
    { _id: userId, 'books.book': bookId },
    { $set: { 'books.$.rating': rating } }
  );

  if (result.matchedCount === 0) return res.status(404).json({ message: 'Book not found in your list' });

  res.json({ message: 'Rating updated' });
});

// PATCH /:id/completed → mark book as read
router.patch('/:id/completed', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id as string;
  const userId = req.user!.id;
  const rating = req.body.rating ? Number(req.body.rating) : undefined;

  if (!isValidObjectId(bookId)) return res.status(400).json({ message: 'Invalid book ID' });

  const update: any = { 'books.$.status': 'read' };
  if (rating) update['books.$.rating'] = rating;

  const result = await User.updateOne(
    { _id: userId, 'books.book': bookId },
    { $set: update }
  );

  if (result.matchedCount === 0) return res.status(404).json({ message: 'Book not found in your list' });

  res.json({ message: 'Book marked as read' });
});

// PATCH /:id/remove → remove book from user's list
router.patch('/:id/remove', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id as string;
  const userId = req.user!.id;

  if (!isValidObjectId(bookId)) return res.status(400).json({ message: 'Invalid book ID' });

  const result = await User.updateOne(
    { _id: userId },
    { $pull: { books: { book: bookId } } }
  );

  if (result.modifiedCount === 0) return res.status(404).json({ message: 'Book not found in your list' });

  res.json({ message: 'Book removed from your list' });
});

// PATCH /:id/favorite → add to favorites
router.patch('/:id/favorite', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id as string;
  const userId = req.user!.id;

  if (!isValidObjectId(bookId)) return res.status(400).json({ message: 'Invalid book ID' });

  const result = await User.updateOne(
    { _id: userId },
    { $addToSet: { favorites: bookId } }
  );

  if (result.matchedCount === 0) return res.status(404).json({ message: 'User not found' });
  if (result.modifiedCount === 0) return res.status(400).json({ message: 'Book already in favorites' });

  res.json({ message: 'Book added to favorites' });
});

// PATCH /:id/unfavorite → remove from favorites
router.patch('/:id/unfavorite', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id as string;
  const userId = req.user!.id;

  if (!isValidObjectId(bookId)) return res.status(400).json({ message: 'Invalid book ID' });

  const result = await User.updateOne(
    { _id: userId },
    { $pull: { favorites: bookId } }
  );

  if (result.matchedCount === 0) return res.status(404).json({ message: 'User not found' });
  if (result.modifiedCount === 0) return res.status(400).json({ message: 'Book not in favorites' });

  res.json({ message: 'Book removed from favorites' });
});

export default router;

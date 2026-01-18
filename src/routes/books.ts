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
    // if (req.user!.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

    const { title, type, description } = req.body;
    const book: IBook = new Book({ title, type, description, completed: false });
    const savedBook = await book.save();
    res.status(201).json(savedBook);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// GET / → get books books based on status if provided, else all books
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const books = await Book.find({}, 'title description'); // only select title & description
    if (books.length === 0) return res.status(404).json({ message: 'No books found' });

    res.json(books);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /books/user?status=toRead|reading|read
router.get('/user', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    const validStatuses = ['toRead', 'reading', 'read'];

    if (statusFilter && !validStatuses.includes(statusFilter)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Populate books.book as IBook
    const user = await User.findById(req.user!.id)
      .populate<{ book: IBook }>('books.book', 'title type description completed');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Filter by status if provided
    const filteredBooks = statusFilter
      ? user.books.filter(b => b.status === statusFilter)
      : user.books;

    // Map to include global book info + user-specific fields
    const result = filteredBooks.map(b => {
      const book = b.book as unknown as IBook;

      return {
        _id: book._id,
        title: book.title,
        type: book.type,
        description: book.description,
        status: b.status,
        completed: b.completed ?? false,
        rating: b.rating ?? undefined
      };
    });

    if (result.length === 0) return res.status(404).json({ message: 'No books found' });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});




// GET /:id → get a single book
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
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

  // if (req.user!.role !== 'admin') return res.status(403).json({ message: 'Admin only' });

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
  let status = req.body.status;
  if (!status || !['toRead', 'reading', 'read'].includes(status)) {
    status = 'toRead';
  }
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
  const bookId = req.params.id;
  const userId = req.user!.id;
  const rating = req.body.rating ? Number(req.body.rating) : undefined;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const bookEntry = user.books.find(b => b.book.toString() === bookId);
  if (!bookEntry) return res.status(404).json({ message: 'Book not in your list' });

  bookEntry.status = 'read';
  bookEntry.completed = true;
  if (rating !== undefined) bookEntry.rating = rating;

  user.markModified('books');
  await user.save();

  res.json({ message: 'Book marked as read', book: bookEntry });
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
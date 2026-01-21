import { Router } from 'express';
import mongoose from 'mongoose';
import Book, { IBook } from '../models/Book';
import { User, IUserBook } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { searchBooks, getBookById } from '../services/googleBooks';
import { updateUserPreferences } from '../services/recommendation';

const router = Router();

// Helper to validate ObjectId
const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

// Helper to check if cache needs refresh (30 days)
const needsCacheRefresh = (lastFetched: Date) => {
  return Date.now() - lastFetched.getTime() > 30 * 24 * 60 * 60 * 1000;
};

// GET /books/search?q=query → Search Google Books API
router.get('/search', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ message: 'Search query required' });
    }

    const results = await searchBooks(query);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /books/import → Import book from Google Books and add to user's library
router.post('/import', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { googleBooksId, status = 'toRead' } = req.body;
    const userId = req.user!.id;

    if (!googleBooksId) {
      return res.status(400).json({ message: 'Google Books ID required' });
    }

    // Check if book already exists in our system
    let book = await Book.findOne({ googleBooksId });

    if (!book) {
      // Fetch from Google Books API
      const googleData = await getBookById(googleBooksId);
      if (!googleData) {
        return res.status(404).json({ message: 'Book not found on Google Books' });
      }

      // Create book with minimal cached data
      book = new Book({
        googleBooksId,
        isbn: googleData.isbn,
        title: googleData.title,
        author: googleData.authors[0],
        coverImage: googleData.thumbnail,
        genres: googleData.categories,
        publishedYear: googleData.publishedDate 
          ? new Date(googleData.publishedDate).getFullYear() 
          : undefined,
        pageCount: googleData.pageCount,
        
        // Our custom data
        averageRating: 0,
        totalRatings: 0,
        relatedBooks: [],
        lastFetched: new Date()
      });
      await book.save();
    }

    // Add to user's library
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.books.some(b => b.book.toString() === book._id.toString())) {
      return res.status(400).json({ message: 'Book already in your library' });
    }

    user.books.push({
      book: book._id,
      status,
      dateAdded: new Date()
    } as IUserBook);

    await user.save();

    res.status(201).json({
      message: 'Book imported successfully',
      book: {
        _id: book._id,
        title: book.title,
        author: book.author,
        coverImage: book.coverImage,
        status
      }
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /books/user?status=toRead|reading|read → Get user's books with cached data
router.get('/user', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    const validStatuses = ['toRead', 'reading', 'read'];

    if (statusFilter && !validStatuses.includes(statusFilter)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Get user with populated books (cached data only)
    const user = await User.findById(req.user!.id)
      .populate<{ books: Array<IUserBook & { book: IBook }> }>(
        'books.book',
        'title author coverImage genres averageRating position3D'
      );

    if (!user) return res.status(404).json({ message: 'User not found' });

    // Filter by status if provided
    const filteredBooks = statusFilter
      ? user.books.filter(b => b.status === statusFilter)
      : user.books;

    // Map to include cached book info + user-specific fields
    const result = filteredBooks.map(b => {
      const book = b.book as IBook;
      return {
        _id: book._id,
        title: book.title,
        author: book.author,
        coverImage: book.coverImage,
        genres: book.genres,
        averageRating: book.averageRating, // Our rating
        status: b.status,
        rating: b.rating,
        dateAdded: b.dateAdded,
      };
    });

    if (result.length === 0) {
      return res.status(404).json({ message: 'No books found' });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /books/:id → Get book with cached data (fast)
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id as string;
  if (!isValidObjectId(bookId)) {
    return res.status(400).json({ message: 'Invalid book ID' });
  }

  try {
    const book = await Book.findById(bookId)
      .select('title author coverImage genres averageRating totalRatings relatedBooks');
    
    if (!book) return res.status(404).json({ message: 'Book not found' });
    
    res.json(book);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /books/:id/details → Get full book details from Google Books
router.get('/:id/details', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id as string;
  if (!isValidObjectId(bookId)) {
    return res.status(400).json({ message: 'Invalid book ID' });
  }

  try {
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: 'Book not found' });

    // Fetch fresh data from Google Books
    const googleData = await getBookById(book.googleBooksId);
    if (!googleData) {
      return res.status(404).json({ message: 'Book details not available' });
    }

    // Update cache if stale
    if (needsCacheRefresh(book.lastFetched)) {
      book.title = googleData.title;
      book.author = googleData.authors[0];
      book.coverImage = googleData.thumbnail;
      book.genres = googleData.categories;
      book.pageCount = googleData.pageCount;
      book.lastFetched = new Date();
      await book.save();
    }

    // Return full Google Books data + our custom data
    res.json({
      ...googleData,
      _id: book._id,
      averageRating: book.averageRating, // Our rating
      totalRatings: book.totalRatings,
      relatedBooks: book.relatedBooks,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /books/:id/status → Update reading status
router.patch('/:id/status', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id;
  const { status } = req.body;
  const userId = req.user!.id;

  if (!isValidObjectId(bookId as string)) {
    return res.status(400).json({ message: 'Invalid book ID' });
  }

  if (!status || !['toRead', 'reading', 'read'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const bookEntry = user.books.find(b => b.book.toString() === bookId);
    if (!bookEntry) {
      return res.status(404).json({ message: 'Book not in your list' });
    }

    bookEntry.status = status;
    if (status === 'reading' && !bookEntry.dateStarted) {
      bookEntry.dateStarted = new Date();
    }
    if (status === 'read' && !bookEntry.dateCompleted) {
      bookEntry.dateCompleted = new Date();
      bookEntry.completed = true;
    }

    user.markModified('books');
    await user.save();

    res.json({ message: 'Status updated', book: bookEntry });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /books/:id/rating → Set user's rating and update book average
router.patch('/:id/rating', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id as string;
  const rating = Number(req.body.rating);
  const userId = req.user!.id;

  // Validate half-point ratings (1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5)
  const validRatings = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  if (!rating || !validRatings.includes(rating)) {
    return res.status(400).json({ message: 'Rating must be 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, or 5' });
  }
  if (!isValidObjectId(bookId)) {
    return res.status(400).json({ message: 'Invalid book ID' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const bookEntry = user.books.find(b => b.book.toString() === bookId);
    if (!bookEntry) {
      return res.status(404).json({ message: 'Book not in your list' });
    }

    const oldRating = bookEntry.rating;
    bookEntry.rating = rating;
    user.markModified('books');
    await user.save();

    // Update book's average rating
    const book = await Book.findById(bookId);
    if (book) {
      if (oldRating) {
        // Update existing rating
        const sum = book.averageRating * book.totalRatings;
        book.averageRating = (sum - oldRating + rating) / book.totalRatings;
      } else {
        // New rating
        const sum = book.averageRating * book.totalRatings;
        book.totalRatings += 1;
        book.averageRating = (sum + rating) / book.totalRatings;
      }
      await book.save();
    }

    // Update user preferences for recommendations (async, don't wait)
    updateUserPreferences(userId).catch(console.error);

    res.json({
      message: 'Rating updated',
      rating,
      bookAverageRating: book?.averageRating
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /books/:id/favorite → Add to favorites
router.patch('/:id/favorite', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id as string;
  const userId = req.user!.id;

  if (!isValidObjectId(bookId)) {
    return res.status(400).json({ message: 'Invalid book ID' });
  }

  try {
    const result = await User.updateOne(
      { _id: userId },
      { $addToSet: { favorites: bookId } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: 'Book already in favorites' });
    }

    // Update user preferences for recommendations (async, don't wait)
    updateUserPreferences(userId).catch(console.error);

    res.json({ message: 'Book added to favorites' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /books/:id/unfavorite → Remove from favorites
router.patch('/:id/unfavorite', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id as string;
  const userId = req.user!.id;

  if (!isValidObjectId(bookId)) {
    return res.status(400).json({ message: 'Invalid book ID' });
  }

  try {
    const result = await User.updateOne(
      { _id: userId },
      { $pull: { favorites: bookId } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: 'Book not in favorites' });
    }

    res.json({ message: 'Book removed from favorites' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /books/:id → Remove book from user's library
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  const bookId = req.params.id as string;
  const userId = req.user!.id;

  if (!isValidObjectId(bookId)) {
    return res.status(400).json({ message: 'Invalid book ID' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const bookIndex = user.books.findIndex(b => b.book.toString() === bookId);
    if (bookIndex === -1) {
      return res.status(404).json({ message: 'Book not in your library' });
    }

    // Update book's average rating if user had rated it
    const bookEntry = user.books[bookIndex];
    if (bookEntry.rating) {
      const book = await Book.findById(bookId);
      if (book && book.totalRatings > 0) {
        const sum = book.averageRating * book.totalRatings;
        book.totalRatings -= 1;
        book.averageRating = book.totalRatings > 0 
          ? (sum - bookEntry.rating) / book.totalRatings 
          : 0;
        await book.save();
      }
    }

    user.books.splice(bookIndex, 1);
    user.markModified('books');
    await user.save();

    // Update user preferences for recommendations (async, don't wait)
    updateUserPreferences(userId).catch(console.error);

    res.json({ message: 'Book removed from library' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
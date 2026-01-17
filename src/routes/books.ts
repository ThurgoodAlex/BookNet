import { Router, Request, Response } from 'express';
import Book, { IBook } from '../models/Book';
import { User } from '../models/User';

const router = Router();

// POST /books → create a new book
router.post('/', async (req: Request, res: Response) => {
  try {
    const book: IBook = new Book({
      title: req.body.title,
      type: req.body.type,
      description: req.body.description,
      completed: req.body.completed || false,
      rating: req.body.rating || 0,
    });
    const savedBook = await book.save();
    res.status(201).json(savedBook);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// POST /books/favorites → add a book to user's favorites
router.post('/favorites', async (req: Request, res: Response) => {
  const { userId, bookId } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.favorites = user.favorites || [];
    if (user.favorites.includes(bookId)) {
      return res.status(400).json({ message: 'Book already in favorites' });
    }
    user.favorites.push(bookId);
    await user.save();
    res.status(200).json({ message: 'Book added to favorites' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /books/toread → add a book to user's to-read list
router.post('/toread', async (req: Request, res: Response) => {
  const { userId, bookId } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.bookstoRead = user.bookstoRead || [];
    if (user.bookstoRead.includes(bookId)) {
      return res.status(400).json({ message: 'Book already in to-read list' });
    }
    user.bookstoRead.push(bookId);
    await user.save();
    res.status(200).json({ message: 'Book added to to-read list' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// POST /books/reading → add a book to user's reading list
router.post('/reading', async (req: Request, res: Response) => {
  const { userId, bookId } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.booksReading = user.booksReading || [];
    if (user.booksReading.includes(bookId)) {
      return res.status(400).json({ message: 'Book already in reading list' });
    }
    user.booksReading.push(bookId);
    await user.save();
    res.status(200).json({ message: 'Book added to reading list' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /books → get all books
router.get('/', async (req: Request, res: Response) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /books/:id → get a single book
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).send('Book not found');
    res.json(book);
  } catch (err: any) {
    res.status(400).json({ message: 'Invalid book ID' });
  }
});

// PUT /books/:id → update a book
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).send('Book not found');

    // Only update fields if provided
    if (req.body.title !== undefined) book.title = req.body.title;
    if (req.body.description !== undefined) book.description = req.body.description;
    if (req.body.completed !== undefined) book.completed = req.body.completed;
    if (req.body.rating !== undefined) book.rating = req.body.rating;
    if (req.body.type !== undefined) book.type = req.body.type;

    const updatedBook = await book.save();
    res.json(updatedBook);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /books/:id → delete a book
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book) return res.status(404).send('Book not found');
    res.status(204).send();
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /books/:id/rating → update book rating.
router.patch('/books/:id/rating', async (req: Request, res: Response) => {
  const { bookId } = req.params;
    const { rating, userId } = req.body;

    const result = await User.updateOne(
      { _id: userId, "books.book": bookId },
      { $set: { "books.$.rating": rating } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Book not found in user's list"
    });
    }

    res.json({ message: "Rating updated" });
  }
);

// PATCH /books/:id/completed → update book completion status.
router.patch('/books/:id/completed', async (req: Request, res: Response) => {
    const { bookId } = req.params;
    const { completed, userId } = req.body;
    const result = await User.updateOne(
      { _id: userId, "books.book": bookId },
      { $set: { "books.$.completed": completed } }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Book not found in user's list"
    });
    }
    res.json({ message: "Completion status updated" });
  }
);

export default router;

import { Router, Request, Response } from 'express';
import Book, { IBook } from '../models/Book';

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

export default router;

import express from 'express';
import authRouter from '../routes/auth';
import booksRouter from '../routes/books';
import recommendationRouter from '../routes/recommendation';

export function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  app.use('/books', booksRouter);
  app.use('/recommendations', recommendationRouter);
  return app;
}

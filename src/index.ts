import express, { Request, Response, NextFunction } from 'express';
import bookRoutes from './backend/routes/books';
import authRoutes from './backend/routes/auth';


const app = express();
const port = process.env.PORT || 3000;
const mongoose = require('mongoose');


mongoose.connect('mongodb://localhost:27017/BookNet')
  .then(() => console.log('MongoDB connected'))
  .catch((err: any) => console.error('MongoDB connection error:', err));

app.use(express.json());
app.use('/books', bookRoutes);
app.use('/auth', authRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('Welcome to BookNet API');
});

// Add this error handling middleware
app.use(
  (err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ message: err.message || 'Something went wrong' });
  }
);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
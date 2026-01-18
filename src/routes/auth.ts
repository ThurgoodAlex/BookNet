const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
import { Router, Request, Response } from 'express';
import User from '../models/User';
const { body, validationResult } = require('express-validator');
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { generateToken } from '../utils/jwt';

const router = Router();

router.post(
  '/register',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    try {
      const existingUser = await User.findOne({ normalizedEmail });
      if (existingUser) return res.status(409).json({ message: 'Email already exists' });

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = new User({
        username,
        email: normalizedEmail,
        password: hashedPassword,
      });

      await user.save();

      res.status(201).json({ message: 'User registered successfully' });
    } catch (err: unknown) {
      if (err instanceof Error) {
        res.status(500).json({ message: err.message });
      } else {
        res.status(500).json({ message: 'Unknown error occurred' });
      }
    }
  }
);


router.post(
  '/login',
  [
    body('email').isEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    try {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) return res.status(400).json({ message: 'Invalid credentials' });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

      const token = generateToken({ id: user._id, role: user.role });

      res.status(200).json({ token, message: 'Logged in successfully' });
    } catch (err: unknown) {
      if (err instanceof Error) {
        res.status(500).json({ message: 'Error logging in', error: err.message });
      } else {
        res.status(500).json({ message: 'Error logging in', error: String(err) });
      }
    }
  }
);


router.post('/logout', authMiddleware, (req: AuthRequest, res: Response) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
});

// -------- EXAMPLE PROTECTED ROUTE --------
router.get('/profile', authMiddleware, async (req: AuthRequest, res) => {
  const user = await User.findById(req.user?.id).select('username email');

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({
    userId: user._id,
    username: user.username,
    email: user.email,
    role: req.user?.role,
  });
});

export default router;
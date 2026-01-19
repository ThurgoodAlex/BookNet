import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
const { body, validationResult } = require('express-validator');
import { User } from '../models/User'; // Changed from IUser import
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { generateToken } from '../utils/jwt';

const router = Router();

// POST /auth/register → Register new user
router.post(
  '/register',
  [
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be 3-30 characters'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Enter a valid email')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    try {
      // Check if user already exists (email or username)
      const existingUser = await User.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        if (existingUser.email === email) {
          return res.status(409).json({ message: 'Email already exists' });
        }
        return res.status(409).json({ message: 'Username already taken' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user
      const user = new User({
        username,
        email,
        password: hashedPassword,
        role: 'user'
      });

      await user.save();

      // Generate token immediately (auto-login after registration)
      const token = generateToken({ id: user._id.toString(), role: user.role });

      res.status(201).json({
        message: 'User registered successfully',
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email
        }
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Registration error:', err);
        res.status(500).json({ message: 'Error registering user', error: err.message });
      } else {
        res.status(500).json({ message: 'Unknown error occurred' });
      }
    }
  }
);

// POST /auth/login → Login user
router.post(
  '/login',
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Enter a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = generateToken({ 
        id: user._id.toString(), 
        role: user.role 
      });

      res.status(200).json({
        message: 'Logged in successfully',
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Error logging in', error: err.message });
      } else {
        res.status(500).json({ message: 'Error logging in', error: String(err) });
      }
    }
  }
);

// POST /auth/logout → Logout user (client-side token removal mainly)
router.post('/logout', authMiddleware, (req: AuthRequest, res: Response) => {
  // If using cookies (uncomment if needed)
  // res.clearCookie('token');
  
  res.status(200).json({ message: 'Logged out successfully' });
});

// GET /auth/profile → Get current user profile
router.get('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id)
      .select('-password') // Exclude password
      .populate('books.book', 'title author coverImage'); // Populate book info

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      booksCount: user.books.length,
      favoritesCount: user.favorites.length,
      totalBooksRead: user.books.filter(b => b.status === 'read').length,
      averageRating: user.averageRating,
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Profile error:', err);
      res.status(500).json({ message: 'Error fetching profile', error: err.message });
    } else {
      res.status(500).json({ message: 'Error fetching profile' });
    }
  }
});

// PUT /auth/profile → Update user profile
router.put(
  '/profile',
  authMiddleware,
  [
    body('username')
      .optional()
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be 3-30 characters'),
    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Enter a valid email')
      .normalizeEmail(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, shelfLayout, shelfTheme } = req.body;
    const userId = req.user!.id;

    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if username/email is already taken by another user
      if (username && username !== user.username) {
        const existing = await User.findOne({ username });
        if (existing) {
          return res.status(409).json({ message: 'Username already taken' });
        }
        user.username = username;
      }

      if (email && email !== user.email) {
        const existing = await User.findOne({ email });
        if (existing) {
          return res.status(409).json({ message: 'Email already exists' });
        }
        user.email = email;
      }

      await user.save();

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        }
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Update profile error:', err);
        res.status(500).json({ message: 'Error updating profile', error: err.message });
      } else {
        res.status(500).json({ message: 'Error updating profile' });
      }
    }
  }
);

// PUT /auth/password → Change password
router.put(
  '/password',
  authMiddleware,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters'),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      // Hash and save new password
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      res.json({ message: 'Password updated successfully' });
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Change password error:', err);
        res.status(500).json({ message: 'Error changing password', error: err.message });
      } else {
        res.status(500).json({ message: 'Error changing password' });
      }
    }
  }
);

// GET /auth/verify → Verify token is valid
router.get('/verify', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({
    valid: true,
    user: {
      id: req.user!.id,
      role: req.user!.role
    }
  });
});

export default router;
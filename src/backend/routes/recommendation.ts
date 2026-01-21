import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getRecommendations, updateUserPreferences } from '../services/recommendation';

const router = Router();

// GET /recommendations → Get personalized recommendations
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const result = await getRecommendations(userId, limit);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'User not found') {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
});

// GET /recommendations/genres → Get recommendations, optionally filtered by genre
router.get('/genres', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const genre = req.query.genre as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const result = await getRecommendations(userId, limit, genre);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'User not found') {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
});

// POST /recommendations/refresh → Force recalculate user preferences
router.post('/refresh', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    await updateUserPreferences(userId);
    res.json({ message: 'Preferences updated successfully' });
  } catch (err: any) {
    if (err.message === 'User not found') {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
});

export default router;

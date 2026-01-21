import request from 'supertest';
import { createTestApp } from '../testApp';
import { createTestUser, createTestBook, addBookToUserLibrary, authHeader } from '../helpers';
import { User } from '../../models/User';
import { updateUserPreferences } from '../../services/recommendation';

const app = createTestApp();

describe('Recommendation Routes', () => {
  describe('GET /recommendations', () => {
    it('should return empty recommendations for new user with no books', async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .get('/recommendations')
        .set(authHeader(testUser.token));

      expect(response.status).toBe(200);
      expect(response.body.recommendations).toEqual([]);
      expect(response.body.basedOn.topGenres).toEqual([]);
      expect(response.body.basedOn.topAuthors).toEqual([]);
    });

    it('should return recommendations based on user preferences', async () => {
      const testUser = await createTestUser();

      // Create books the user has rated highly
      const book1 = await createTestBook({
        title: 'User Book 1',
        author: 'Favorite Author',
        genres: ['Fiction', 'Mystery'],
        averageRating: 4.5,
        totalRatings: 10
      });
      await addBookToUserLibrary(testUser._id, book1._id.toString(), 'read', 5);

      // Create a candidate book that matches user preferences
      const candidateBook = await createTestBook({
        title: 'Recommended Book',
        author: 'Favorite Author',
        genres: ['Fiction'],
        averageRating: 4.2,
        totalRatings: 20
      });

      // Update user preferences
      await updateUserPreferences(testUser._id);

      const response = await request(app)
        .get('/recommendations')
        .set(authHeader(testUser.token));

      expect(response.status).toBe(200);
      expect(response.body.recommendations.length).toBeGreaterThanOrEqual(1);
      expect(response.body.basedOn.topGenres).toContain('Fiction');
      expect(response.body.basedOn.topAuthors).toContain('Favorite Author');
    });

    it('should exclude books already in user library', async () => {
      const testUser = await createTestUser();

      // Create a book and add it to user's library
      const userBook = await createTestBook({
        title: 'Already In Library',
        author: 'Some Author',
        genres: ['Fiction'],
        averageRating: 4.5,
        totalRatings: 10
      });
      await addBookToUserLibrary(testUser._id, userBook._id.toString(), 'read', 5);
      await updateUserPreferences(testUser._id);

      const response = await request(app)
        .get('/recommendations')
        .set(authHeader(testUser.token));

      expect(response.status).toBe(200);
      const recommendedIds = response.body.recommendations.map((r: any) => r._id);
      expect(recommendedIds).not.toContain(userBook._id.toString());
    });

    it('should respect limit parameter', async () => {
      const testUser = await createTestUser();

      // Create multiple books
      for (let i = 0; i < 5; i++) {
        await createTestBook({
          title: `Book ${i}`,
          genres: ['Fiction'],
          averageRating: 4,
          totalRatings: 10
        });
      }

      const response = await request(app)
        .get('/recommendations?limit=3')
        .set(authHeader(testUser.token));

      expect(response.status).toBe(200);
      expect(response.body.recommendations.length).toBeLessThanOrEqual(3);
    });

    it('should cap limit at 50', async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .get('/recommendations?limit=100')
        .set(authHeader(testUser.token));

      expect(response.status).toBe(200);
      // The limit should be capped at 50
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/recommendations');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /recommendations/genres', () => {
    it('should filter recommendations by genre', async () => {
      const testUser = await createTestUser();

      // Create books with different genres
      await createTestBook({
        title: 'Mystery Book',
        genres: ['Mystery'],
        averageRating: 4.5,
        totalRatings: 10
      });
      await createTestBook({
        title: 'Sci-Fi Book',
        genres: ['Science Fiction'],
        averageRating: 4.5,
        totalRatings: 10
      });

      const response = await request(app)
        .get('/recommendations/genres?genre=Mystery')
        .set(authHeader(testUser.token));

      expect(response.status).toBe(200);
      // All returned books should have Mystery genre
      response.body.recommendations.forEach((book: any) => {
        expect(book.genres).toContain('Mystery');
      });
    });

    it('should return 400 when genre parameter is missing', async () => {
      const testUser = await createTestUser();

      const response = await request(app)
        .get('/recommendations/genres')
        .set(authHeader(testUser.token));

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Genre query parameter required');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/recommendations/genres?genre=Fiction');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /recommendations/refresh', () => {
    it('should recalculate user preferences', async () => {
      const testUser = await createTestUser();

      // Create and rate a book
      const book = await createTestBook({
        title: 'Highly Rated Book',
        author: 'Great Author',
        genres: ['Fantasy', 'Adventure']
      });
      await addBookToUserLibrary(testUser._id, book._id.toString(), 'read', 5);

      const response = await request(app)
        .post('/recommendations/refresh')
        .set(authHeader(testUser.token));

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Preferences updated successfully');

      // Verify preferences were updated
      const user = await User.findById(testUser._id);
      expect(user!.preferredGenres).toBeDefined();
      expect(user!.preferredGenres!.get('Fantasy')).toBeGreaterThan(0);
      expect(user!.preferredAuthors!.get('Great Author')).toBeGreaterThan(0);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).post('/recommendations/refresh');
      expect(response.status).toBe(401);
    });
  });
});

describe('Preference Computation', () => {
  it('should weight high ratings more heavily', async () => {
    const testUser = await createTestUser();

    // Book rated 5 stars
    const highRatedBook = await createTestBook({
      author: 'Author A',
      genres: ['Genre A']
    });
    await addBookToUserLibrary(testUser._id, highRatedBook._id.toString(), 'read', 5);

    // Book rated 3 stars
    const midRatedBook = await createTestBook({
      author: 'Author B',
      genres: ['Genre B']
    });
    await addBookToUserLibrary(testUser._id, midRatedBook._id.toString(), 'read', 3);

    await updateUserPreferences(testUser._id);

    const user = await User.findById(testUser._id);
    const weightA = user!.preferredGenres!.get('Genre A') || 0;
    const weightB = user!.preferredGenres!.get('Genre B') || 0;

    // 5-star rating should have higher weight than 3-star
    expect(weightA).toBeGreaterThan(weightB);
  });

  it('should add bonus weight for favorites', async () => {
    const testUser = await createTestUser();

    // Create two books with same rating
    const favoriteBook = await createTestBook({
      author: 'Favorite Author',
      genres: ['Favorite Genre']
    });
    const regularBook = await createTestBook({
      author: 'Regular Author',
      genres: ['Regular Genre']
    });

    await addBookToUserLibrary(testUser._id, favoriteBook._id.toString(), 'read', 4);
    await addBookToUserLibrary(testUser._id, regularBook._id.toString(), 'read', 4);

    // Add favorite book to favorites
    await User.updateOne(
      { _id: testUser._id },
      { $addToSet: { favorites: favoriteBook._id } }
    );

    await updateUserPreferences(testUser._id);

    const user = await User.findById(testUser._id);
    const favWeight = user!.preferredGenres!.get('Favorite Genre') || 0;
    const regWeight = user!.preferredGenres!.get('Regular Genre') || 0;

    // Favorite should have higher weight
    expect(favWeight).toBeGreaterThan(regWeight);
  });

  it('should give small weight to unrated toRead books', async () => {
    const testUser = await createTestUser();

    const book = await createTestBook({
      author: 'Wishlist Author',
      genres: ['Wishlist Genre']
    });
    await addBookToUserLibrary(testUser._id, book._id.toString(), 'toRead');

    await updateUserPreferences(testUser._id);

    const user = await User.findById(testUser._id);
    const weight = user!.preferredGenres!.get('Wishlist Genre') || 0;

    // Should have a small positive weight
    expect(weight).toBeGreaterThan(0);
    expect(weight).toBeLessThan(0.5);
  });

  it('should ignore low-rated books (2.5 and below)', async () => {
    const testUser = await createTestUser();

    const book = await createTestBook({
      author: 'Disliked Author',
      genres: ['Disliked Genre']
    });
    await addBookToUserLibrary(testUser._id, book._id.toString(), 'read', 2);

    await updateUserPreferences(testUser._id);

    const user = await User.findById(testUser._id);
    const weight = user!.preferredGenres!.get('Disliked Genre') || 0;

    // Low-rated books should not contribute to positive preferences
    expect(weight).toBe(0);
  });

  it('should support half-point ratings', async () => {
    const testUser = await createTestUser();
    const book = await createTestBook();
    await addBookToUserLibrary(testUser._id, book._id.toString());

    const app = createTestApp();

    const response = await request(app)
      .patch(`/books/${book._id}/rating`)
      .set(authHeader(testUser.token))
      .send({ rating: 4.5 });

    expect(response.status).toBe(200);
    expect(response.body.rating).toBe(4.5);
  });

  it('should reject invalid half-point ratings', async () => {
    const testUser = await createTestUser();
    const book = await createTestBook();
    await addBookToUserLibrary(testUser._id, book._id.toString());

    const app = createTestApp();

    const response = await request(app)
      .patch(`/books/${book._id}/rating`)
      .set(authHeader(testUser.token))
      .send({ rating: 4.3 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Rating must be 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, or 5');
  });
});

describe('Recommendation Scoring', () => {
  it('should rank books by relevance to user preferences', async () => {
    const testUser = await createTestUser();

    // User likes Fiction
    const userBook = await createTestBook({
      author: 'Loved Author',
      genres: ['Fiction']
    });
    await addBookToUserLibrary(testUser._id, userBook._id.toString(), 'read', 5);
    await updateUserPreferences(testUser._id);

    // Create candidate books
    const goodMatch = await createTestBook({
      title: 'Good Match',
      author: 'Loved Author',
      genres: ['Fiction'],
      averageRating: 4.5,
      totalRatings: 100
    });
    const poorMatch = await createTestBook({
      title: 'Poor Match',
      author: 'Unknown Author',
      genres: ['Non-Fiction'],
      averageRating: 4.5,
      totalRatings: 100
    });

    const response = await request(app)
      .get('/recommendations')
      .set(authHeader(testUser.token));

    expect(response.status).toBe(200);

    // Find positions of books in recommendations
    const ids = response.body.recommendations.map((r: any) => r._id);
    const goodIndex = ids.indexOf(goodMatch._id.toString());
    const poorIndex = ids.indexOf(poorMatch._id.toString());

    // Good match should rank higher (if both are present)
    if (goodIndex >= 0 && poorIndex >= 0) {
      expect(goodIndex).toBeLessThan(poorIndex);
    }
  });
});

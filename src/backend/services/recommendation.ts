import { User, IUser, IUserBook } from '../models/User';
import Book, { IBook } from '../models/Book';

/**
 * Calculate weight from rating for preference computation
 * Rating 5: 1.0, Rating 4.5: 0.9, Rating 4: 0.8, etc.
 * Ratings 2.5 and below: 0 (not used for positive recommendations)
 */
function ratingToWeight(rating: number | undefined): number {
  if (!rating || rating <= 2.5) return 0;
  return Math.max(0, (rating - 2) / 3);
}

/**
 * Update user's preferred genres and authors based on their book ratings and favorites
 */
export async function updateUserPreferences(userId: string): Promise<void> {
  const user = await User.findById(userId)
    .populate<{ books: Array<IUserBook & { book: IBook }> }>('books.book');

  if (!user) {
    throw new Error('User not found');
  }

  const genreScores = new Map<string, number>();
  const authorScores = new Map<string, number>();

  for (const userBook of user.books) {
    const book = userBook.book as IBook;
    if (!book) continue;

    // Calculate base weight from rating
    let weight = ratingToWeight(userBook.rating);

    // Add bonus weight for favorites
    const isFavorite = user.favorites.some(
      fav => fav.toString() === book._id.toString()
    );
    if (isFavorite) {
      weight += 0.5;
    }

    // If no rating but book is in library, give small weight for toRead status
    if (weight === 0 && userBook.status === 'toRead') {
      weight = 0.1;
    }

    if (weight <= 0) continue;

    // Update genre scores
    if (book.genres) {
      for (const genre of book.genres) {
        const current = genreScores.get(genre) || 0;
        genreScores.set(genre, current + weight);
      }
    }

    // Update author scores
    if (book.author) {
      const current = authorScores.get(book.author) || 0;
      authorScores.set(book.author, current + weight);
    }
  }

  // Update user document
  user.preferredGenres = genreScores;
  user.preferredAuthors = authorScores;

  // Update analytics
  const ratedBooks = user.books.filter(b => b.rating);
  if (ratedBooks.length > 0) {
    const sum = ratedBooks.reduce((acc, b) => acc + (b.rating || 0), 0);
    user.averageRating = sum / ratedBooks.length;
  }
  user.totalBooksRead = user.books.filter(b => b.status === 'read').length;

  await user.save();
}

export interface RecommendedBook {
  _id: string;
  title: string;
  author: string;
  genres: string[];
  coverImage: string;
  averageRating: number;
  score: number;
}

export interface RecommendationResult {
  recommendations: RecommendedBook[];
  basedOn: {
    topGenres: string[];
    topAuthors: string[];
  };
}

/**
 * Calculate recommendation score for a book based on user preferences
 */
function calculateScore(
  book: IBook,
  preferredGenres: Map<string, number>,
  preferredAuthors: Map<string, number>
): number {
  // Genre match score
  let genreScore = 0;
  if (book.genres) {
    for (const genre of book.genres) {
      genreScore += preferredGenres.get(genre) || 0;
    }
  }

  // Author match score (weighted higher)
  const authorScore = (preferredAuthors.get(book.author) || 0) * 2;

  // Popularity bonus
  const popularityBonus = book.averageRating * 0.1 * Math.log(book.totalRatings + 1);

  return genreScore + authorScore + popularityBonus;
}

/**
 * Convert MongoDB object to Map (handles both Map and plain object)
 */
function toMap(data: Map<string, number> | Record<string, number> | undefined): Map<string, number> {
  if (!data) return new Map();
  if (data instanceof Map) return data;
  return new Map(Object.entries(data));
}

/**
 * Get top N items from a Map sorted by value
 */
function getTopFromMap(map: Map<string, number>, limit: number): string[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

/**
 * Build MongoDB query for candidate books
 */
function buildCandidateQuery(
  topGenres: string[],
  topAuthors: string[],
  genreFilter?: string
): Record<string, unknown> {
  // Genre filter takes full precedence - just fetch that genre
  // (scoring will still use preferences for ranking)
  if (genreFilter) {
    return { genres: genreFilter };
  }

  // No filter: find books matching user's preferred genres or authors
  const orConditions: Record<string, unknown>[] = [];

  if (topGenres.length > 0) {
    orConditions.push({ genres: { $in: topGenres } });
  }
  if (topAuthors.length > 0) {
    orConditions.push({ author: { $in: topAuthors } });
  }

  if (orConditions.length === 0) {
    return {}; // No preferences - fetch popular books
  }

  if (orConditions.length === 1) {
    return orConditions[0];
  }

  return { $or: orConditions };
}

/**
 * Get personalized book recommendations for a user
 */
export async function getRecommendations(
  userId: string,
  limit: number = 10,
  genreFilter?: string
): Promise<RecommendationResult> {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Get user's existing book IDs to exclude from recommendations
  const userBookIds = new Set(user.books.map(b => b.book.toString()));

  // Convert from MongoDB storage format
  const preferredGenres = toMap(user.preferredGenres);
  const preferredAuthors = toMap(user.preferredAuthors);

  const topGenres = getTopFromMap(preferredGenres, 5);
  const topAuthors = getTopFromMap(preferredAuthors, 5);

  const hasPreferences = topGenres.length > 0 || topAuthors.length > 0;

  // Build query
  const query = buildCandidateQuery(topGenres, topAuthors, genreFilter);

  // Fetch candidate books
  const candidateBooks = await Book.find(query)
    .sort({ averageRating: -1, totalRatings: -1 })
    .limit(limit * 5) // Fetch more to filter and score
    .lean();

  // Filter out books already in user's library and score remaining
  const scoredBooks: Array<{ book: IBook; score: number }> = [];

  for (const book of candidateBooks) {
    if (userBookIds.has(book._id.toString())) {
      continue; // Skip books already in user's library
    }

    const score = hasPreferences
      ? calculateScore(book as IBook, preferredGenres, preferredAuthors)
      : book.averageRating * Math.log(book.totalRatings + 1); // Popularity-only for new users

    scoredBooks.push({ book: book as IBook, score });
  }

  // Sort by score and take top N
  scoredBooks.sort((a, b) => b.score - a.score);
  const topBooks = scoredBooks.slice(0, limit);

  const recommendations: RecommendedBook[] = topBooks.map(({ book, score }) => ({
    _id: book._id.toString(),
    title: book.title,
    author: book.author,
    genres: book.genres || [],
    coverImage: book.coverImage,
    averageRating: book.averageRating,
    score: Math.round(score * 100) / 100
  }));

  return {
    recommendations,
    basedOn: {
      topGenres,
      topAuthors
    }
  };
}
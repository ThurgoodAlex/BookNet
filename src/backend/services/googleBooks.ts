import axios from 'axios';

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';
const API_KEY = process.env.GOOGLE_BOOKS_API_KEY;

export interface GoogleBookResult {
  id: string;
  title: string;
  authors: string[];
  description: string;
  categories: string[];
  thumbnail: string;
  pageCount: number;
  publishedDate: string;
  isbn: string;
  averageRating?: number;
  ratingsCount?: number;
  language?: string;
  publisher?: string;
}

/**
 * Search for books using Google Books API
 * @param query Search query string
 * @param maxResults Maximum number of results (default 20)
 * @returns Array of book results
 */
export async function searchBooks(
  query: string, 
  maxResults: number = 20
): Promise<GoogleBookResult[]> {
  try {
    const response = await axios.get(GOOGLE_BOOKS_API, {
      params: {
        q: query,
        maxResults,
        key: API_KEY,
        printType: 'books',
        langRestrict: 'en' // Optional: restrict to English books
      },
      timeout: 5000 // 5 second timeout
    });

    if (!response.data.items) {
      return [];
    }

    return response.data.items.map((item: any) => ({
      id: item.id,
      title: item.volumeInfo.title || 'Unknown Title',
      authors: item.volumeInfo.authors || ['Unknown Author'],
      description: item.volumeInfo.description || '',
      categories: item.volumeInfo.categories || [],
      thumbnail: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
      pageCount: item.volumeInfo.pageCount || 0,
      publishedDate: item.volumeInfo.publishedDate || '',
      isbn: getISBN(item.volumeInfo.industryIdentifiers),
      averageRating: item.volumeInfo.averageRating,
      ratingsCount: item.volumeInfo.ratingsCount,
      language: item.volumeInfo.language,
      publisher: item.volumeInfo.publisher
    }));
  } catch (error: any) {
    console.error('Google Books API search error:', error.message);
    
    // Return empty array on error rather than throwing
    // This prevents API issues from breaking the app
    return [];
  }
}

/**
 * Get detailed book information by Google Books ID
 * @param googleBooksId The Google Books volume ID
 * @returns Book details or null if not found
 */
export async function getBookById(
  googleBooksId: string
): Promise<GoogleBookResult | null> {
  try {
    const response = await axios.get(`${GOOGLE_BOOKS_API}/${googleBooksId}`, {
      params: { key: API_KEY },
      timeout: 5000
    });

    const item = response.data;
    
    return {
      id: item.id,
      title: item.volumeInfo.title || 'Unknown Title',
      authors: item.volumeInfo.authors || ['Unknown Author'],
      description: item.volumeInfo.description || '',
      categories: item.volumeInfo.categories || [],
      thumbnail: item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
      pageCount: item.volumeInfo.pageCount || 0,
      publishedDate: item.volumeInfo.publishedDate || '',
      isbn: getISBN(item.volumeInfo.industryIdentifiers),
      averageRating: item.volumeInfo.averageRating,
      ratingsCount: item.volumeInfo.ratingsCount,
      language: item.volumeInfo.language,
      publisher: item.volumeInfo.publisher
    };
  } catch (error: any) {
    console.error(`Google Books API error for ID ${googleBooksId}:`, error.message);
    return null;
  }
}

/**
 * Search books by author
 * @param author Author name
 * @param maxResults Maximum results
 */
export async function searchByAuthor(
  author: string,
  maxResults: number = 10
): Promise<GoogleBookResult[]> {
  return searchBooks(`inauthor:${author}`, maxResults);
}

/**
 * Search books by ISBN
 * @param isbn ISBN-10 or ISBN-13
 */
export async function searchByISBN(isbn: string): Promise<GoogleBookResult | null> {
  const results = await searchBooks(`isbn:${isbn}`, 1);
  return results.length > 0 ? results[0] : null;
}

/**
 * Search books by subject/genre
 * @param subject Subject or genre
 * @param maxResults Maximum results
 */
export async function searchBySubject(
  subject: string,
  maxResults: number = 20
): Promise<GoogleBookResult[]> {
  return searchBooks(`subject:${subject}`, maxResults);
}

/**
 * Helper to extract ISBN from industry identifiers
 * Prefers ISBN-13 over ISBN-10
 */
function getISBN(identifiers: any[]): string {
  if (!identifiers || identifiers.length === 0) return '';
  
  // Prefer ISBN_13
  const isbn13 = identifiers.find(id => id.type === 'ISBN_13');
  if (isbn13) return isbn13.identifier;
  
  // Fall back to ISBN_10
  const isbn10 = identifiers.find(id => id.type === 'ISBN_10');
  if (isbn10) return isbn10.identifier;
  
  // Return first available
  return identifiers[0]?.identifier || '';
}

/**
 * Get higher resolution cover image if available
 * @param thumbnail Standard thumbnail URL from Google Books
 */
export function getHighResCover(thumbnail: string): string {
  // Google Books thumbnails can be upgraded by changing zoom parameter
  return thumbnail.replace('&zoom=1', '&zoom=2').replace('http:', 'https:');
}
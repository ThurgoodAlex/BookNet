# BookNet

A full-stack book library management API built with Node.js, TypeScript, and MongoDB. Features JWT authentication, Google Books API integration, and comprehensive test coverage.

**[API Documentation](#api-reference)**

---

## Why I Built This

I wanted to demonstrate my ability to architect and build a production-ready backend from scratch. This project showcases:

- **API Design** — RESTful endpoints with proper HTTP semantics and status codes
- **Authentication** — Secure JWT-based auth flow with password hashing
- **Database Modeling** — Efficient MongoDB schemas with embedded documents and indexing strategies
- **External API Integration** — Google Books API with intelligent caching to reduce costs
- **Testing** — TDD approach with isolated tests using in-memory MongoDB
- **TypeScript** — Strict mode with proper typing throughout

---

## Tech Stack

| Category | Technology | Why I Chose It |
|----------|------------|----------------|
| **Runtime** | Node.js 18+ | Industry standard, excellent async performance |
| **Language** | TypeScript 5.9 | Type safety catches bugs at compile time, better IDE support |
| **Framework** | Express 5 | Minimal, flexible, widely understood |
| **Database** | MongoDB + Mongoose 9 | Flexible schema for evolving book data, great for embedded documents |
| **Auth** | JWT + bcryptjs | Stateless authentication scales horizontally |
| **Validation** | express-validator | Declarative validation with clear error messages |
| **Testing** | Jest + Supertest | Fast, parallel tests with great DX |

---

## Architecture Decisions

### Embedded Documents vs. References

I chose to embed `UserBook` documents directly in the User schema rather than creating a separate collection:

```typescript
// User has embedded books array
books: [{
  book: ObjectId,      // Reference to cached book data
  status: 'reading',   // User-specific
  rating: 4,           // User-specific
  dateAdded: Date
}]
```

**Rationale:** A user's book collection is always accessed with the user. Embedding eliminates joins for the most common query pattern (fetching a user's library), improving read performance.

### Caching Strategy

Books fetched from Google Books API are cached in MongoDB:

```typescript
// Book model includes cache management
lastFetched: Date  // Refresh if > 30 days old
```

**Rationale:** Google Books API has rate limits. Caching book metadata locally reduces API calls by ~90% for popular books while keeping data reasonably fresh.

### Authentication Flow

```
Register/Login → JWT issued → Client stores token → Token sent in headers → Middleware validates
```

**Rationale:** Stateless JWT authentication allows horizontal scaling without session store synchronization. Tokens include user ID and role for authorization decisions.

---

## Key Features

### User Authentication
- Registration with duplicate email/username detection
- Login with bcrypt password verification
- Profile management and password changes
- Token verification endpoint for client-side auth checks

### Book Management
- Search millions of books via Google Books API
- Import books to personal library with reading status
- Track progress: `toRead` → `reading` → `read`
- Rate books (1-5 stars) and mark favorites
- Reading analytics: progress percentage, time spent, notes

### Data Validation
Every endpoint validates input and returns structured errors:

```json
{
  "errors": [{
    "field": "email",
    "message": "Enter a valid email"
  }]
}
```

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Create account, returns JWT |
| `POST` | `/auth/login` | Authenticate, returns JWT |
| `POST` | `/auth/logout` | Logout (requires auth) |
| `GET` | `/auth/profile` | Get user profile |
| `PUT` | `/auth/profile` | Update username/email |
| `PUT` | `/auth/password` | Change password |
| `GET` | `/auth/verify` | Validate token |

### Books

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/books/search?q=query` | Search Google Books |
| `POST` | `/books/import` | Add book to library |
| `GET` | `/books/user` | Get user's books |
| `GET` | `/books/user?status=reading` | Filter by status |
| `GET` | `/books/:id` | Get cached book info |
| `GET` | `/books/:id/details` | Fetch fresh data from Google |
| `PATCH` | `/books/:id/status` | Update reading status |
| `PATCH` | `/books/:id/rating` | Rate book (1-5) |
| `PATCH` | `/books/:id/favorite` | Add to favorites |
| `DELETE` | `/books/:id` | Remove from library |

### Example Request

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alex","email":"alex@example.com","password":"secure123"}'
```

```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "alex",
    "email": "alex@example.com"
  }
}
```

---

## Database Schema

### User
```typescript
{
  username: string,          // Unique, 3-30 chars
  email: string,             // Unique, normalized
  password: string,          // bcrypt hashed
  role: 'user' | 'admin',
  books: UserBook[],         // Embedded
  favorites: ObjectId[],
  // Analytics for future recommendations
  preferredGenres: Map<string, number>,
  preferredAuthors: Map<string, number>
}
```

### Book (Cache)
```typescript
{
  googleBooksId: string,     // Indexed, unique
  title: string,
  author: string,
  coverImage: string,
  genres: string[],
  averageRating: number,     // Our users' ratings
  totalRatings: number,
  lastFetched: Date          // Cache invalidation
}
```

### Indexes
```typescript
// Optimized for common queries
userSchema.index({ 'books.book': 1 });
userSchema.index({ 'books.status': 1 });
bookSchema.index({ genres: 1, averageRating: -1 });
bookSchema.index({ author: 1 });
```

---

## Testing

I follow TDD practices with isolated tests using `mongodb-memory-server`:

```bash
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage
```

### Test Structure
```
__tests__/
├── routes/
│   ├── auth.test.ts    # 20+ auth endpoint tests
│   └── books.test.ts   # 30+ book endpoint tests
├── helpers.ts          # Test factories
├── setup.ts            # DB lifecycle management
└── testApp.ts          # Isolated Express instance
```

### Test Helpers
```typescript
// Factory functions for clean tests
const user = await createTestUser({ email: 'test@example.com' });
const book = await createTestBook({ title: 'Clean Code' });
await addBookToUserLibrary(user._id, book._id, 'reading');

// Auth helper
const response = await request(app)
  .get('/books/user')
  .set(authHeader(user.token));  // { Authorization: 'Bearer ...' }
```

---

## Running Locally

```bash
# Clone and install
git clone https://github.com/ThurgoodAlex/BookNet.git
cd BookNet/src/backend
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start development server
npm run dev

# Run tests
npm test
```

### Environment Variables
```env
PORT=3000
JWT_SECRET=your-secret-key
GOOGLE_BOOKS_API_KEY=optional-for-higher-rate-limits
MONGODB_URI=mongodb://localhost:27017/BookNet
```

---

## Project Structure

```
src/backend/
├── __tests__/           # Jest test suites
├── middleware/
│   └── auth.ts          # JWT verification middleware
├── models/
│   ├── User.ts          # User + embedded UserBook schema
│   └── Book.ts          # Cached book data schema
├── routes/
│   ├── auth.ts          # Authentication endpoints
│   └── books.ts         # Book management endpoints
├── services/
│   └── googleBooks.ts   # External API wrapper
├── utils/
│   └── jwt.ts           # Token generation/verification
└── index.ts             # Express app setup
```

---

## What I Learned

- **Schema design trade-offs** — When to embed vs. reference in MongoDB
- **API rate limit management** — Caching strategies for external APIs
- **Test isolation** — Using in-memory databases for fast, reliable tests
- **TypeScript in Node** — Strict typing with Express request/response handling
- **Security basics** — Proper password hashing, JWT best practices, input validation

---

## Future Improvements

- [ ] Recommendation engine based on reading history
- [ ] Frontend with React and 3D bookshelf visualization (Three.js)
- [ ] Social features: reviews, followers, book clubs
- [ ] Goodreads import via CSV
- [ ] Rate limiting and request throttling
- [ ] CI/CD pipeline with GitHub Actions

---

## Contact

**Alex Thurgood**  
GitHub: [@ThurgoodAlex](https://github.com/ThurgoodAlex)

---

*Built as a portfolio project to demonstrate full-stack development skills.*

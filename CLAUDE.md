# BookNet

A personal book library management application with Google Books API integration.

## Tech Stack

- **Backend:** Node.js, Express 5, TypeScript, MongoDB/Mongoose 9
- **Auth:** JWT (jsonwebtoken), bcryptjs
- **Validation:** express-validator
- **Testing:** Jest, Supertest, mongodb-memory-server

## Project Structure

```
src/
├── backend/
│   ├── __tests__/          # Jest tests with MongoDB memory server
│   ├── middleware/auth.ts  # JWT authentication middleware
│   ├── models/
│   │   ├── User.ts         # User schema with embedded books array
│   │   └── Book.ts         # Book schema (Google Books cache)
│   ├── routes/
│   │   ├── auth.ts         # /auth/* endpoints
│   │   ├── books.ts        # /books/* endpoints
│   │   └── recommendation.ts # Placeholder
│   ├── services/
│   │   └── googleBooks.ts  # Google Books API wrapper
│   ├── utils/jwt.ts        # Token generation/verification
│   └── index.ts            # Express app entry point
└── frontend/               # Not yet implemented
```

## Commands

```bash
# From src/backend/
npm run dev          # Start dev server with hot reload
npm test             # Run Jest tests
npm run test:watch   # Watch mode
npm run test:coverage
npm run build        # Compile TypeScript
```

## API Routes

### Auth (`/auth`)
- `POST /register` - Create user (username, email, password)
- `POST /login` - Get JWT token
- `POST /logout` - Logout (requires auth)
- `GET /profile` - Get user profile (requires auth)
- `PUT /profile` - Update profile (requires auth)
- `PUT /password` - Change password (requires auth)
- `GET /verify` - Verify token validity (requires auth)

### Books (`/books`)
- `GET /search?q=query` - Search Google Books
- `POST /import` - Import book by googleBooksId
- `GET /user?status=toRead|reading|read` - Get user's books
- `GET /:id` - Get cached book info
- `GET /:id/details` - Get full details from Google Books
- `PATCH /:id/status` - Update reading status
- `PATCH /:id/rating` - Set 1-5 rating
- `PATCH /:id/favorite` - Add to favorites
- `PATCH /:id/unfavorite` - Remove from favorites
- `DELETE /:id` - Remove from library

## Environment Variables

- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - JWT signing secret
- `GOOGLE_BOOKS_API_KEY` - Optional, for higher rate limits
- MongoDB connects to `mongodb://localhost:27017/BookNet`

## Code Conventions

- TypeScript strict mode
- Interfaces prefixed with `I` (IUser, IBook, IUserBook)
- Auth middleware attaches `req.user` with `{ id, role }`
- Express-validator for input validation
- Status codes: 201 (created), 400 (bad request), 401 (unauthorized), 404 (not found), 409 (conflict)
- All routes use async/await with try-catch

## Development Workflow
- Follow test-driven development (TDD) when implementing new features:
  - Write tests before implementation whenever feasible
  - For new functions/methods, create basic unit tests first
  - For bug fixes, write a failing test that reproduces the issue before fixing it
  - When you find a bug, show me where the bug is
  - Skip TDD for rapid prototyping or exploratory work unless specified otherwise
- Keep me informed during development:
  - Explain your plan before implementing significant changes
  - Break down complex tasks into steps and get approval before proceeding
  - Ask for my input on design decisions and architecture choices
  - Summarize what you've done after completing each major step
- Code Review Process:
  - After completing a feature or significant change, perform a self-review checking for:
    - Code adheres to project conventions (TypeScript strict mode, naming, etc.)
    - Proper error handling and validation
    - Test coverage for new functionality
    - Security considerations (auth, input validation)
    - Performance implications (database queries, API calls)
  - Highlight any concerns or areas that need attention
  - Suggest improvements or refactoring opportunities

## Database Models

**User:** username, email, password (hashed), role, books[], favorites[], analytics fields

**Book:** googleBooksId, title, author, coverImage, genres[], averageRating, totalRatings, lastFetched (30-day cache)

**UserBook (embedded):** book (ref), status, rating, dateAdded, dateStarted, dateCompleted, readingProgress

## Testing

Tests use mongodb-memory-server for isolation. Test helpers in `__tests__/helpers.ts`:
- `createTestUser()` - Returns user with JWT token
- `createTestBook()` - Creates book in DB
- `addBookToUserLibrary()` - Links book to user
- `authHeader(token)` - Returns `{ Authorization: 'Bearer ...' }`

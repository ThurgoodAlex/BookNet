# BookNet

## Tagline 
    Interactive personal bookshelf with data-driven book recommendations

## Focus
    Showcase advanced frontend and full-stack skills through 3D visualization and relationship graphs

## Tech Stack

### Backend
- **Runtime:** Node.js, Express 5, TypeScript
- **Database:** MongoDB/Mongoose 9
- **Auth:** JWT (jsonwebtoken), bcryptjs
- **Validation:** express-validator
- **Testing:** Jest, Supertest, mongodb-memory-server

### Frontend
- **Framework:** React 19, TypeScript
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS 4
- **Linting:** ESLint 9 with TypeScript support

## Project Structure

```
src/
├── backend/
│   ├── __tests__/              # Jest tests with MongoDB memory server
│   ├── middleware/
│   │   ├── auth.ts             # JWT authentication middleware
│   │   └── validate.ts         # ObjectId validation middleware
│   ├── models/
│   │   ├── User.ts             # User schema with embedded books array
│   │   └── Book.ts             # Book schema (Google Books cache)
│   ├── routes/
│   │   ├── auth.ts             # /auth/* endpoints
│   │   ├── books.ts            # /books/* endpoints
│   │   └── recommendation.ts   # /recommendations/* endpoints
│   ├── services/
│   │   ├── googleBooks.ts      # Google Books API wrapper
│   │   └── recommendation.ts   # Recommendation algorithm
│   ├── utils/jwt.ts            # Token generation/verification
│   └── index.ts                # Express app entry point
└── frontend/
    ├── src/
    │   ├── App.tsx             # Main app component
    │   ├── main.tsx            # React entry point
    │   └── index.css           # Global styles with Tailwind
    ├── vite.config.ts          # Vite configuration
    ├── tsconfig.json           # TypeScript configuration
    └── package.json            # Frontend dependencies
```

## Commands

```bash
# From src/backend/
npm run dev          # Start dev server with hot reload
npm test             # Run Jest tests
npm run test:watch   # Watch mode
npm run test:coverage
npm run build        # Compile TypeScript

# From src/frontend/
npm run dev          # Start Vite dev server
npm run build        # TypeScript check + Vite build
npm run lint         # Run ESLint
npm run preview      # Preview production build
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

### Recommendations (`/recommendations`)
- `GET /` - Get personalized recommendations (requires auth)
- `GET /genres?genre=...` - Filter recommendations by genre (requires auth)
- `POST /refresh` - Force recalculate user preferences (requires auth)

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

**User:** username, email, password (hashed), role, books[], favorites[], preferredGenres (Map), preferredAuthors (Map), averageRating, totalBooksRead

**Book:** googleBooksId, title, author, coverImage, genres[], averageRating, totalRatings, lastFetched (30-day cache)

**UserBook (embedded):** book (ref), status, rating, dateAdded, dateStarted, dateCompleted, readingProgress

## Recommendation Engine

The recommendation service calculates personalized suggestions based on:
- **Genre preferences** - Weighted by book ratings (0 weight for 2.5 and below, up to 1.0 for 5-star)
- **Author preferences** - 2x weighted compared to genres
- **Favorite bonus** - +0.5 weight added for favorited books
- **Popularity score** - Book rating × log(totalRatings)

User preferences auto-update when rating, favoriting, or removing books. Excludes books already in user's library.

## Testing

Tests use mongodb-memory-server for isolation. Test helpers in `__tests__/helpers.ts`:
- `createTestUser()` - Returns user with JWT token
- `createTestBook()` - Creates book in DB
- `addBookToUserLibrary()` - Links book to user
- `authHeader(token)` - Returns `{ Authorization: 'Bearer ...' }`

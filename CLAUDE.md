# BookNet

Interactive personal bookshelf with data-driven book recommendations.

## Tech Stack

- **Backend:** Node.js, Express 5, TypeScript, MongoDB/Mongoose 9, JWT auth
- **Frontend:** React 19, TypeScript, Vite 7, Tailwind CSS 4
- **Testing:** Jest, Supertest, mongodb-memory-server

## Commands

```bash
# Backend (from src/backend/)
npm run dev           # Dev server with hot reload
npm test              # Run Jest tests
npm run test:watch    # Watch mode

# Frontend (from src/frontend/)
npm run dev           # Vite dev server
npm run build         # TypeScript check + build
npm run lint          # ESLint
```

## Code Conventions

- TypeScript strict mode
- Interfaces prefixed with `I` (IUser, IBook, IUserBook)
- Auth middleware attaches `req.user` with `{ id, role }`
- Express-validator for input validation
- Status codes: 201 created, 400 bad request, 401 unauthorized, 404 not found, 409 conflict
- All routes use async/await with try-catch

## Development Workflow

- **TDD:** Write tests before implementation when feasible. For bug fixes, write a failing test first.
- **Communication:** Explain your plan before significant changes. Break down complex tasks and get approval. Summarize after completing each major step.
- **Self-review:** Check conventions, error handling, test coverage, security, and performance before completing a feature.

## Recommendation Engine

Personalized suggestions based on:
- Genre preferences weighted by ratings (0 for ≤2.5 stars, up to 1.0 for 5 stars)
- Author preferences (2x weight vs genres)
- Favorite bonus (+0.5 weight)
- Popularity = rating × log(totalRatings)

User preferences auto-update on rating/favoriting/removing books. Excludes books already in library.

## Do Not

- Modify `.env` or commit secrets
- Change auth middleware without approval
- Add dependencies without asking
- Edit files in `node_modules`
# Contributing to CrewHub

Thank you for your interest in contributing to CrewHub! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/crewhub.git
   cd crewhub
   ```
3. **Set up the development environment**:
   ```bash
   cp .env.example .env
   make dev
   ```

## 📝 Development Workflow

### Branch Naming

Use descriptive branch names:
- `feature/add-session-filtering` - New features
- `fix/session-disconnect-bug` - Bug fixes
- `docs/update-readme` - Documentation
- `refactor/cleanup-api-calls` - Code refactoring

### Making Changes

1. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature
   ```

2. Make your changes with clear, atomic commits:
   ```bash
   git commit -m "feat: add session filtering by model"
   ```

3. Write or update tests as needed

4. Ensure all tests pass:
   ```bash
   # Backend
   cd backend && pytest
   
   # Frontend
   cd frontend && npm test
   ```

5. Push your branch and create a Pull Request

## 📋 Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add real-time token cost tracking
fix: resolve SSE connection timeout issue
docs: update installation instructions
```

## 🏗️ Project Structure

```
crewhub/
├── backend/              # Python FastAPI backend
│   ├── app/
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   └── config.py     # Configuration
│   ├── tests/            # Backend tests
│   └── requirements.txt
├── frontend/             # React TypeScript frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks
│   │   └── lib/          # Utilities
│   └── package.json
└── docker-compose.yml
```

## 🧪 Testing

### Backend Tests

```bash
cd backend
pip install -r requirements.txt
pytest -v
```

### Frontend Tests

```bash
cd frontend
npm install
npm test
```

## 💅 Code Style

### Backend (Python)

- Use [Black](https://black.readthedocs.io/) for formatting
- Follow PEP 8 style guidelines
- Use type hints

```bash
cd backend
black app/
```

### Frontend (TypeScript)

- Use ESLint and Prettier for formatting
- Follow React best practices
- Use functional components with hooks

```bash
cd frontend
npm run lint
npm run format
```

## 🐛 Reporting Issues

When reporting bugs, please include:

1. **Description** - Clear description of the issue
2. **Steps to Reproduce** - How to trigger the bug
3. **Expected Behavior** - What should happen
4. **Actual Behavior** - What actually happens
5. **Environment** - OS, Docker version, browser, etc.
6. **Screenshots** - If applicable

## 💡 Feature Requests

For feature requests, please:

1. Check existing issues to avoid duplicates
2. Describe the use case and motivation
3. Provide examples if possible

## 📜 Pull Request Guidelines

- Keep PRs focused and reasonably sized
- Update documentation as needed
- Add tests for new functionality
- Ensure CI checks pass
- Request review from maintainers

## 🤝 Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow

## 📧 Questions?

Open an issue with the `question` label or reach out to the maintainers.

---

Thank you for contributing! 🦀

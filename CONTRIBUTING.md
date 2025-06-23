# Contributing to Deliberate Reasoning Engine

Thank you for your interest in contributing to DRE! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/deliberate-reasoning-engine.git`
3. Create a feature branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Submit a pull request

## Development Setup

```bash
npm install
npm run build
npm run dev  # Run in watch mode
```

## Code Style

- We use TypeScript with strict mode enabled
- Follow the existing code style (2 spaces, no semicolons in TS)
- Use meaningful variable names
- Add comments for complex logic

## Testing

Before submitting a PR:

```bash
npm run build
npm test  # Currently runs test scripts
```

## Pull Request Process

1. Ensure your code builds without errors
2. Update the README.md if you've added new features
3. Update CHANGELOG.md with your changes under "Unreleased"
4. Ensure all tests pass
5. Submit a PR with a clear description of changes

## Types of Contributions

We welcome:
- Bug fixes
- New thought types or tools
- Performance improvements
- Documentation improvements
- Test coverage improvements
- Examples and use cases

## Questions?

Feel free to open an issue for discussion or contact the maintainer at jonathan@haas.holdings.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
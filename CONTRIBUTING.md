# Contributing to Blaze CLI

Thank you for your interest in contributing. This guide covers everything you need to get started.

## Prerequisites

- Node.js 18 or later
- Yarn (corepack-managed, see `packageManager` in `package.json`)

## Setup

```bash
git clone https://github.com/blaze-money/cli.git
cd cli
yarn install
yarn build
```

## Development

Start the compiler in watch mode:

```bash
yarn dev
```

Run the CLI locally during development:

```bash
node dist/cli/index.js --help
```

## Testing

Run the full test suite:

```bash
yarn test
```

Run integration tests (requires API credentials):

```bash
yarn test:integration
```

## Linting and Type Checking

```bash
yarn lint
yarn typecheck
```

## Submitting Changes

1. Fork the repository and create a feature branch from `main`.
2. Make your changes with clear, descriptive commits.
3. Ensure all tests pass and linting is clean.
4. Open a pull request against `main` with a summary of what changed and why.

## Code Style

- TypeScript strict mode is enforced.
- Follow the patterns established in the existing codebase.
- Keep functions small and focused.
- Add tests for new functionality.

## Reporting Issues

Use [GitHub Issues](https://github.com/blaze-money/cli/issues) for bugs and feature requests. Please include reproduction steps and environment details when reporting bugs.

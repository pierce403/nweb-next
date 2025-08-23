# nweb Indexer Development Makefile

.PHONY: help setup install dev clean test lint format type-check run stats watch

help: ## Show this help message
	@echo "nweb Indexer Development Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

setup: ## Set up development environment
	python -m venv .venv
	@echo "Virtual environment created. Run 'source .venv/bin/activate' to activate."

install: ## Install dependencies
	pip install -e .
	@echo "Dependencies installed."

dev: ## Install in development mode with dev dependencies
	pip install -e ".[dev]"
	@echo "Development dependencies installed."

clean: ## Clean up build artifacts and cache
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info/
	rm -rf .pytest_cache/
	rm -rf .mypy_cache/
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete
	@echo "Cleaned up build artifacts."

test: ## Run tests
	pytest -v

lint: ## Run linting
	ruff check indexer/

format: ## Format code
	black indexer/
	isort indexer/
	ruff check --fix indexer/

type-check: ## Run type checking
	mypy indexer/

run: ## Run the indexer
	nweb-indexer run

stats: ## Show indexer statistics
	nweb-indexer stats

watch: ## Watch blockchain events
	nweb-indexer watch

db-init: ## Initialize database tables
	@echo "Database tables will be created automatically on first run"

db-reset: ## Reset database (WARNING: destroys data)
	@echo "WARNING: This will delete all data!"
	@echo "Run: dropdb nweb && createdb nweb"
	@echo "Then recreate user: psql -d nweb -c \"create user nweb with password 'nweb'; grant all privileges on database nweb to nweb;\""

logs: ## Show recent logs (if using file logging)
	@echo "Logs are output to console by default. Configure logging to file for persistent logs."

# Development workflow
dev-setup: setup install dev ## Complete development setup
	@echo "Development environment ready!"
	@echo "Next steps:"
	@echo "1. Copy .env.example to .env and configure"
	@echo "2. Run 'make run' to start the indexer"

# CI/CD
ci: lint type-check test ## Run all CI checks

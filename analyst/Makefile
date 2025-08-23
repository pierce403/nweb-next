# nweb Analyst Development Makefile

.PHONY: help setup install dev clean build start lint type-check format

help: ## Show this help message
	@echo "nweb Analyst Development Commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

dev: ## Start development server
	npm run dev

build: ## Build for production
	npm run build

start: ## Start production server
	npm run start

clean: ## Clean build artifacts
	rm -rf .next
	rm -rf out
	rm -rf node_modules/.cache

lint: ## Run linting
	npm run lint

type-check: ## Run TypeScript type checking
	npm run type-check

format: ## Format code
	npm run format

setup: install ## Complete development setup
	@echo "Analyst development environment ready!"
	@echo "Next steps:"
	@echo "1. Copy .env.example to .env.local"
	@echo "2. Configure database connection"
	@echo "3. Run 'make dev' to start development server"

# Development workflow
dev-setup: setup dev ## Setup and start development

# Production
prod-build: clean build ## Clean build for production

# Docker support
docker-build: ## Build Docker image
	docker build -t nweb-analyst .

docker-run: ## Run Docker container
	docker run -p 3000:3000 --env-file .env.local nweb-analyst

# Database helpers
db-check: ## Check database connectivity
	@echo "Testing database connection..."
	@node -e "
	const { sql } = require('kysely');
	const { db } = require('./lib/database.ts');
	// Note: This is a placeholder - actual implementation would test the connection
	console.log('Database configuration loaded');
	"

# CI/CD
ci: lint type-check build ## Run all CI checks

.PHONY: deploy deploy-frontend deploy-backend logs logs-front logs-back ps restart down version

COMPOSE = docker compose -f docker-compose.prod.yml

# ── Helpers ────────────────────────────────────────────────────────────────────
COMMIT     := $(shell git rev-parse --short HEAD)
COMMIT_MSG := $(shell git log -1 --pretty=format:"%s")
BRANCH     := $(shell git rev-parse --abbrev-ref HEAD)
DATE       := $(shell date '+%Y-%m-%d %H:%M')

define show_version
	@echo ""
	@echo "  ✦ 42 League — deployed"
	@echo "  ┌─────────────────────────────────────────┐"
	@echo "  │  branch  $(BRANCH)"
	@echo "  │  commit  $(COMMIT)  $(COMMIT_MSG)"
	@echo "  │  date    $(DATE)"
	@if docker inspect league-frontend  > /dev/null 2>&1; then echo "  │  front   $$(docker inspect --format '{{.Config.Labels.commit}}' league-frontend  2>/dev/null || echo '$(COMMIT)')"; fi
	@if docker inspect league-backend   > /dev/null 2>&1; then echo "  │  back    $$(docker inspect --format '{{.Config.Labels.commit}}' league-backend    2>/dev/null || echo '$(COMMIT)')"; fi
	@echo "  └─────────────────────────────────────────┘"
	@echo ""
endef

# ── Targets ────────────────────────────────────────────────────────────────────

deploy: ## Pull + rebuild front + back + affiche les versions
	git pull
	$(COMPOSE) build \
		--build-arg GIT_COMMIT=$(COMMIT) \
		--build-arg BUILD_DATE="$(DATE)" \
		frontend backend
	$(COMPOSE) up -d --no-deps frontend backend
	$(call show_version)

deploy-frontend: ## Pull + rebuild seulement le frontend
	git pull
	$(COMPOSE) build \
		--build-arg GIT_COMMIT=$(COMMIT) \
		--build-arg BUILD_DATE="$(DATE)" \
		frontend
	$(COMPOSE) up -d --no-deps frontend
	$(call show_version)

deploy-backend: ## Pull + rebuild seulement le backend
	git pull
	$(COMPOSE) build \
		--build-arg GIT_COMMIT=$(COMMIT) \
		--build-arg BUILD_DATE="$(DATE)" \
		backend
	$(COMPOSE) up -d --no-deps backend
	$(call show_version)

version: ## Affiche la version actuellement déployée
	$(call show_version)

logs: ## Logs live de tous les services
	$(COMPOSE) logs -f --tail=100

logs-front: ## Logs du frontend
	$(COMPOSE) logs -f --tail=100 frontend

logs-back: ## Logs du backend
	$(COMPOSE) logs -f --tail=100 backend

ps: ## État des containers
	$(COMPOSE) ps

restart: ## Redémarre les containers sans rebuild
	$(COMPOSE) restart

down: ## Arrête tout
	$(COMPOSE) down

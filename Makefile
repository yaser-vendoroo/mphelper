.DEFAULT_GOAL := help

NODE_MODULES := node_modules
DIST := dist
EXTENSION := $(DIST)/extension
VERSION := $(shell node -p "require('./package.json').version")
PACKAGE_ZIP := $(DIST)/mphelper-extension-v$(VERSION).zip

.PHONY: help install build clean clean-all rebuild setup version paths check package

help: ## Show this help
	@echo "MPHelper – available commands:"
	@echo ""
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: $(NODE_MODULES) ## Install Node dev dependencies

$(NODE_MODULES): package.json package-lock.json
	npm install

build: $(NODE_MODULES) ## Build Chrome extension
	npm run build

clean: ## Remove build output (dist/)
	rm -rf $(DIST)

clean-all: clean ## Remove build output and node_modules
	rm -rf $(NODE_MODULES)

rebuild: clean build ## Clean and rebuild all artifacts

setup: install build ## First-time setup: install deps and build

version: ## Print package version
	@echo $(VERSION)

paths: ## Print install path for the extension
	@echo "Chrome extension: $(CURDIR)/$(EXTENSION)/"

check: build ## Build and verify expected output files exist
	@test -f $(EXTENSION)/manifest.json || (echo "Missing extension manifest" && exit 1)
	@test -f $(EXTENSION)/content.js || (echo "Missing extension content.js" && exit 1)
	@test -f $(EXTENSION)/popup.html || (echo "Missing extension popup.html" && exit 1)
	@test -f $(EXTENSION)/popup.js || (echo "Missing extension popup.js" && exit 1)
	@test -f $(EXTENSION)/page-interceptor.js || (echo "Missing page-interceptor.js" && exit 1)
	@echo "Build OK (v$(VERSION))"

package: check ## Build and zip dist/extension/ for sharing (dist/mphelper-extension-v<ver>.zip)
	@rm -f $(PACKAGE_ZIP)
	@command -v zip >/dev/null 2>&1 || (echo "zip not found. Install with: sudo apt install zip" && exit 1)
	@cd $(EXTENSION) && zip -r -q ../mphelper-extension-v$(VERSION).zip .
	@echo "Packaged $(PACKAGE_ZIP) ($$(du -h $(PACKAGE_ZIP) | cut -f1))"

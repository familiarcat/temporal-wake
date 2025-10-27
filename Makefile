SHELL := /bin/zsh
ROOT := /Users/bradygeorgen/Documents/workspace/temporal

.PHONY: all build open clean

all: build

build:
	@"$(ROOT)/build_md_previews.sh"

open: build
	@open "$(ROOT)/screenplay.html" "$(ROOT)/novel.html" "$(ROOT)/outline.html"

clean:
	@rm -f "$(ROOT)/screenplay.html" "$(ROOT)/novel.html" "$(ROOT)/outline.html" "$(ROOT)/md.css"


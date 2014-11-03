JS_COMPILER = ./node_modules/.bin/uglifyjs

all: physics-perception.min.js

.INTERMEDIATE physics-perception.js: \
	src/features/stability-attr.js \
	src/features/movable-up-attr.js \
	src/features/shape-attr.js \
	src/features/circle-attr.js \
	src/features/square-attr.js \
	src/features/rectangle-attr.js \
	src/features/triangle-attr.js \
	src/features/moves-attr.js \
	src/features/small-attr.js \
	src/features/large-attr.js \
	src/features/left-attr.js \
	src/features/left-most-attr.js \
	src/features/right-attr.js \
	src/features/right-most-attr.js \
	src/features/bottom-attr.js \
	src/features/single-attr.js \
	src/features/top-attr.js \
	src/features/top-most-attr.js \
	src/features/on-ground-attr.js \
	src/features/left-rel.js \
	src/features/right-rel.js \
	src/features/beside-rel.js \
	src/features/below-rel.js \
	src/features/above-rel.js \
	src/features/touch-rel.js \
	src/features/ontop-rel.js \
	src/features/far-rel.js \
	src/features/far-attr.js \
	src/features/close-rel.js \
	src/features/close-attr.js \
	src/features/hits-rel.js \
	src/features/gets-hit-rel.js \
	src/features/collides-rel.js \
	src/features/supports-rel.js \
	src/features/count-attr.js \
	src/features/touch-attr.js \
	src/settings.js \
	src/group-node.js \
	src/object-node.js \
	src/scene-node.js \
	src/selector.js \
	src/solution.js

physics-perception.min.js: physics-perception.js Makefile
	@rm -f $@
	$(JS_COMPILER) -m --preamble '// Copyright Erik Weitnauer 2014.' < $< > $@
	@chmod a-w $@

physics-perception.js: Makefile
	@rm -f $@
	cat $(filter %.js,$^) > $@
	@chmod a-w $@

clean:
	rm -f physics-perception*.js

.PHONY: all clean

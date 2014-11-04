# Physics Perception #

This is a javascript library that allows perceiving of a number of static and
dynamic features like stability, distance, collisions, etc. of objects in a
2D physical scene. There are three types of features: object attributes (e.g., shape), group attributes (e.g., close) and relationships (e.g., close-to or left-of). Many features return gradual membership values, which means something can be a little or a lot left-of something else.

The physical scenes can be loaded from SVGs.

### How to Use ###

The examples load a local svg file which will trigger an access permission violation in most browsers. Instead of opening the examples directly in a browser, start a local server and open them through `localhost`. You could either use the `npm` package `static` or run `python -m SimpleHTTPServer`.

For a description how to create SVG images that can be parsed by the library, please refer to the documentation of [svg2physics](https://github.com/eweitnauer/svg2physics).

### Dependencies ###

* [geom.js](https://github.com/eweitnauer/geom.js)
* [svg2physics](https://github.com/eweitnauer/svg2physics)
* [box2dweb](http://box2dweb.googlecode.com)

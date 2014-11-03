# Physics Perception #

This is a javascript library that allows perceiving of a number of static and
dynamic features like stability, distance, collisions, etc. of objects in a
2D physical scene. There are three types of features: object attributes (e.g., shape), group attributes (e.g., close) and relationships (e.g., close-to or left-of). Many features return gradual membership values, which means something can be a little or a lot left-of something else.

The physical scenes can be loaded from SVGs.

### Dependencies ###

* [geom.js](https://github.com/eweitnauer/geom.js)
* [svg2physics](https://github.com/eweitnauer/svg2physics)
* [box2dweb](http://box2dweb.googlecode.com)
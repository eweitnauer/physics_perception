var scale = 4
  , pixels_per_unit = 50
  , svg, info_div
  , world
  , simulator
  , sn, ps // SceneNode, PhysicsScene
  , interactor
  , attr = 'small'
  , attr_getter = get_attr_getter(attr);

function init() {
	svg = d3.select("body")
    .append("svg")
    .attr("width", 100*scale)
    .attr("height", 100*scale)
    .style("margin", "5px");
  sel_div = d3.select('body')
    .append('div')
    .classed('features', true);
  createFeatureButtons(sel_div.node(), feature_selected);
  d3.select('body')
    .append('div').style('clear', 'both');
  info_div = d3.select('body')
    .append('div')
    .classed('info', true);
  loadSVG('./scene.svg');

  interactor = new SceneInteractor(ps, sn, svg.node(), 100*scale);
  interactor.scaling(scale);
  interactor.onSelection = onSelection;
  interactor.colorize_values(attr_getter);
}

function feature_selected(feature) {
	attr = feature.prototype.key;
	attr_getter = get_attr_getter(attr);
	interactor.colorize_values(attr_getter);
	sel_div.selectAll('.feature')
	  .classed('active', function(d) { return d.key === attr });
}

function getFeatureList() {
	var obj_attrs = d3.values(pbpSettings.obj_attrs).map(function(feature) {
    return { key: feature.prototype.key
           , src: feature
           , enabled: true };
  });
  var grp_attrs = d3.values(pbpSettings.group_attrs).map(function(feature) {
    return { key: feature.prototype.key
           , src: feature
           , enabled: false };
  });
  var rels = d3.values(pbpSettings.obj_rels).map(function(feature) {
    return { key: feature.prototype.key
           , src: feature
           , enabled: false };
  });
  return obj_attrs.concat(grp_attrs).concat(rels);
}

function createFeatureButtons(div_el, click_callback) {
	var features = getFeatureList();

	var divs = d3.select(div_el)
	  .selectAll('.feature')
	  .data(features);

	var enter = divs.enter()
		.append('div')
	    .classed('feature', true)
	    .classed('active', function(d) { return d.key === attr })
	    .classed('disabled', function(d) { return !d.enabled });
	if (click_callback) enter.on('click', function(d) {
		if (d.enabled) click_callback(d.src) });
	enter.append('div')
		.classed('key', true)
	  .text(function(d) { return d.key.split('_').join(' ') });
}

function onSelection(last, all) {
	if (!last) return;
	info_div.html('activity of "'+attr+'": ' + Math.round(attr_getter(last))
		           +"%<br/><br/>Summary "
		           +last.describe());
}

function get_attr_getter(attr) {
	return function(obj) {
		return obj.get(attr).get_activity()*100;
	}
}

function loadSVG(path) {
  var scene = s2p.SVGSceneParser.parseFile(path, pixels_per_unit);
  scene.adjustStrokeWidth(0.5*pixels_per_unit/100);

  // create & populate physics scene
  world = new Box2D.Dynamics.b2World(new Box2D.Common.Math.b2Vec2(0, 10), true);
  var adapter = new s2p.Box2DAdapter();
  scene.friction = 0.3;
  scene.resitution = 0.1;
  adapter.loadScene(world, scene, true, false);

  // create physics scene, oracle and scene node
  ps = new s2p.PhysicsScene(world);
  sn = new SceneNode(scene, new s2p.PhysicsOracle(ps));
  sn.registerObjects();
  sn.oracle.gotoState('start');
  //sn.perceiveAll();
}

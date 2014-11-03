var scale = 4
  , pixels_per_unit = 50
  , svg
  , canvas
  , world
  , simulator;

function init() {
  create_html_elements();
  loadSVG('./scene.svg');
}

function loadSVG(path) {
  var scene = s2p.SVGSceneParser.parseFile(path, pixels_per_unit);
  scene.adjustStrokeWidth(0.5*pixels_per_unit/100);

  // display svg scene
  svg.selectAll("*").remove();
  scene.renderInSvg(document, svg.node(), 0, 0, scale);

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

  // Things we could do with the scene node:
  //sn.perceiveCollisions();
  //sn.oracle.gotoState('start');
  //sn.perceiveCurrent('start');
  //sn.oracle.pscene.reset();

  // display physics scene
  simulator = new s2p.Simulator(ps, canvas.node(), scene.pixels_per_unit*scale, false);
  simulator.play();
}

function create_html_elements() {
  svg = d3.select("body")
    .append("svg")
    .attr("width", 100*scale)
    .attr("height", 100*scale)
    .style("margin", "5px");

  canvas = d3.select("body")
    .append("canvas")
    .attr("width", 100*scale)
    .attr("height", 100*scale)
    .style("margin", "5px");
}

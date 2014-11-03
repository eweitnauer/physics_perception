/// Labels are only 'stable' or 'unstable', but internally there are four values:
/// 'moving', 'unstable', 'slightly unstable' and 'stable'. The mapping of values
/// to labels should depend on the context later, but is fixed for now.
StabilityAttribute = function(obj) {
  this.perceive(obj);
}
StabilityAttribute.prototype.key = 'stability';
StabilityAttribute.prototype.targetType = 'obj';
StabilityAttribute.prototype.arity = 1;
StabilityAttribute.prototype.constant = false;

/// Returns an StabilityAttribute instance, which is the perception of the passed
/// object's stability. Possible values are 'very stable', 'stable', 'unstable'
/// and 'very unstable'.
StabilityAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = this.checkStability(obj.phys_obj, obj.object_node.scene_node.oracle);
}

StabilityAttribute.prototype.get_activity = function() {
  return this.val ? 1 : 0;
}

StabilityAttribute.prototype.get_label = function() {
	if (this.val == 'stable' || this.val == 'slightly unstable') return 'stable';
	if (this.val == 'moving' || this.val == 'unstable') return 'unstable';
}

/// Returns whether the object is 'stable', 'unstable' or 'moving'.
/// An object is 'moving', if its speed is above 0.25. An object is
/// considered 'stable' if, after pushing it with an impulse as big as its mass,
/// after 0.3 seconds of simulation, its position changed less than 0.2, its rotation
/// changed less than 9 degrees and its speed is less than 0.4. If the body is
/// a circle, the rotation must change less than 60 degrees.
/// An object is considered 'slightly unstable' if, after pushing it with an impulse as half as
/// big as its mass, after 0.3 seconds of simulation, it does not exceed 2/3 of the above
/// values.
/// For an static object 'stable' is returned.
StabilityAttribute.prototype.checkStability = function(body, oracle) {
	var max_initial_v = 0.25;
	var max_v = 0.4;
	var max_dx = 0.2;
	var max_drot_circle = 1.047, max_drot = 0.157;
	if (oracle.isStatic(body)) return 'stable';
	var is_stable = function(dir, soft) {
		var rot0 = body.GetAngle();
		var apply_impulse = function() {oracle.applyCentralImpulse(body, dir, soft ? 'small' : 'medium')};
    return oracle.analyzeFuture(0.3, apply_impulse, function() {
    	//console.log('pushing', soft ? 'softly' : '', 'to the', dir);
    	var v = body.m_linearVelocity.Length();
    	var factor = soft ? 2/3 : 1.0;
			//console.log('  speed:',v);
    	if (v >= max_v*factor) return false;
    	var dx = oracle.pscene.getBodyDistance(body);
      //console.log('  dist:',dx);
      if (dx >= max_dx*factor) return false;
      var drot = Point.norm_angle(body.GetAngle() - rot0);
      //console.log('  rot:',drot);
      if ( body.IsCircle() && Math.abs(drot) >= max_drot_circle*factor ||
          !body.IsCircle() && Math.abs(drot) >= max_drot*factor) return false;
      return true;
    });
  }
  // check for 'moving'
  var v = body.m_linearVelocity.Length();
  //console.log('curr. vel.', v);
  if (v > max_initial_v) return 'moving';
  // check for pushing left and right
  if (is_stable('left', false) && is_stable('right', false)) return 'stable';
  if (is_stable('left', true) && is_stable('right', true)) return 'slightly unstable';
  return 'unstable';
}
/// For now, this is a all or nothing decision between "can be moved up" or "can't be moved up".
/// Depends on whether the after applying a upward directed force for 5 seconds the object touches
/// the upper frame.
MovableUpAttribute = function(obj) {
  this.perceive(obj);
}
MovableUpAttribute.prototype.key = 'can_move_up';
MovableUpAttribute.prototype.targetType = 'obj';
MovableUpAttribute.prototype.arity = 1;
MovableUpAttribute.prototype.constant = false;

/// Returns an MovableUpAttribute instance, which is the perception of whether the passed
/// object can be moved up. Possible values are 1 or 0.
MovableUpAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = this.checkMovability('up', obj.phys_obj, obj.object_node.scene_node.oracle);
}

MovableUpAttribute.prototype.get_activity = function() {
  return this.val ? 1 : 0;
}

MovableUpAttribute.prototype.get_label = function() {
	return 'can-move-up';
}

/// Returns true if the object can be moved towards the passed direction, one of
/// 'up', 'left' or 'right'. This is the case if pulling the object with a small force
/// for 4 seconds into the respective direction will result in the object beeing at
/// the respective edge of the frame or having moved substantially far in the direction.
/// For now only works for 'up'.
MovableUpAttribute.prototype.checkMovability = function(dir, body, oracle) {
	if (oracle.isStatic(body)) return false;

  var f = new Box2D.Common.Math.b2Vec2(0, -body.GetMass()*12);
  //if (dir == 'up') f = new b2Vec2(0, -body.GetMass()*12);
  //else if (dir == 'left') f = new b2Vec2(-body.GetMass()*2, 0);
  //else if (dir == 'right') f = new b2Vec2(body.GetMass()*2, 0);
  //else throw "unknown direction '" + dir + "'";

  // apply force to the body (will be cleared on reset after analyzeFuture automatically)
  var pull = function() {
    body.SetSleepingAllowed(false);
    body.ApplyForce(f, body.GetWorldCenter());
  }

  return oracle.analyzeFuture(2.5, pull, function() {
    // check whether object is close to top of frame
    var res = oracle.getTouchedBodiesWithPos(body);
    return res.some(function (e) {
      if (e.body.master_obj.id !== "|") return false;
      for (var i=0; i<e.pts.length; i++) {
        if (e.pts[i].y < 0.1) return true;
      }
    });
  });
}
ShapeAttribute = function(obj) {
  this.perceive(obj);
}
ShapeAttribute.prototype.key = 'shape';
ShapeAttribute.prototype.targetType = 'obj';
ShapeAttribute.prototype.arity = 1;
ShapeAttribute.prototype.constant = true;

/// Returns an ShapeAttribute instance, which is the perception of the passed
/// object's shape. Possible shapes are circle, triangle, rectangle, square and
/// unknown.
ShapeAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = ShapeAttribute.determineShape(obj);
}

ShapeAttribute.prototype.get_activity = function() {
  return this.val == '?' ? 0 : 1;
}

ShapeAttribute.prototype.get_label = function() {
  return this.val;
}

ShapeAttribute.determineShape = function(shape) {
  // determine shape type (circle, triangle, square, rectangle or unknown)
  if (shape instanceof Polygon) {
    if (!shape.closed) return 'unknown';
    shape.order_vertices();
    if (shape.pts.length == 3) return 'triangle';
    if (ShapeAttribute.isRectangle(shape)) {
      // in square, all edges should have the same length
      var edges = shape.get_edge_lengths(true); // sorted by length
      if (edges[0]/edges[3] < 0.7) return 'rectangle';
      else return 'square';
    }
    else return 'unknown';
  } else if (shape instanceof Circle) return 'circle';
  else return 'unknown';
}

/// Returns true, if Polygon has 4 corners, all with angles in [70,110] degree.
ShapeAttribute.isRectangle = function(poly) {
  if (poly.pts.length != 4) return false;
  var a_max = 110 * Math.PI / 180, a_min = 70 * Math.PI / 180;
  for (var i=0; i<poly.pts.length; ++i) {
    if (poly.angle(i) > a_max || poly.angle(i) < a_min) return false;
  }
  return true;
}

CircleAttribute = function(obj) {
  this.perceive(obj);
}
CircleAttribute.prototype.key = 'circle';
CircleAttribute.prototype.targetType = 'obj';
CircleAttribute.prototype.arity = 1;
CircleAttribute.prototype.constant = true;

/// Returns an CircleAttribute instance, which is the perception of the passed
/// object's shape. Possible shapes are circle, triangle, rectangle, square and
/// unknown.
CircleAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = CircleAttribute.circleness(obj);
}

CircleAttribute.prototype.get_activity = function() {
  return this.val;
}

CircleAttribute.prototype.get_label = function() {
  return this.key;
}

CircleAttribute.circleness = function(shape) {
  if (shape instanceof Circle) return 1;
  else return 0;

  // cool feature:
  // check roundness of an object by getting its convex hull and
  // then see how much the difference between the convex hull corner & midpoints
  // and the "radius" of the convex hull
}
SquareAttribute = function(obj) {
  this.perceive(obj);
}
SquareAttribute.prototype.key = 'square';
SquareAttribute.prototype.targetType = 'obj';
SquareAttribute.prototype.arity = 1;
SquareAttribute.prototype.constant = true;

/// Returns an SquareAttribute instance, which is the perception of the passed
/// object's shape. Possible shapes are circle, triangle, rectangle, square and
/// unknown.
SquareAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = SquareAttribute.squareness(obj);
}

SquareAttribute.prototype.get_activity = function() {
  return this.val;
}

SquareAttribute.prototype.get_label = function() {
  return this.key;
}

SquareAttribute.squareness = function(shape) {
  if (shape instanceof Polygon) {
    if (!shape.closed) return 0;
    shape.order_vertices();
    if (SquareAttribute.isRectangle(shape)) {
      // in square, all edges should have the same length
      var edges = shape.get_edge_lengths(true); // sorted by length
      if (edges[0]/edges[3] < 0.7) return 0.3;
      else return 1;
    }
  }
  return 0;
}

/// Returns true, if Polygon has 4 corners, all with angles in [70,110] degree.
SquareAttribute.isRectangle = function(poly) {
  if (poly.pts.length != 4) return false;
  var a_max = 110 * Math.PI / 180, a_min = 70 * Math.PI / 180;
  for (var i=0; i<poly.pts.length; ++i) {
    if (poly.angle(i) > a_max || poly.angle(i) < a_min) return false;
  }
  return true;
}
RectangleAttribute = function(obj) {
  this.perceive(obj);
}
RectangleAttribute.prototype.key = 'rect';
RectangleAttribute.prototype.targetType = 'obj';
RectangleAttribute.prototype.arity = 1;
RectangleAttribute.prototype.constant = true;

/// Returns an RectangleAttribute instance, which is the perception of the passed
/// object's shape. Possible shapes are circle, triangle, rectangle, square and
/// unknown.
RectangleAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = RectangleAttribute.rectness(obj);
}

RectangleAttribute.prototype.get_activity = function() {
  return this.val;
}

RectangleAttribute.prototype.get_label = function() {
  return this.key;
}

RectangleAttribute.rectness = function(shape) {
  if (shape instanceof Polygon) {
    if (!shape.closed) return 0;
    shape.order_vertices();
    if (RectangleAttribute.isRectangle(shape)) {
      // in square, all edges should have the same length
      var edges = shape.get_edge_lengths(true); // sorted by length
      if (edges[0]/edges[3] < 0.7) return 1;
      else return 0.4;
    }
  }
  return 0;
}

/// Returns true, if Polygon has 4 corners, all with angles in [70,110] degree.
RectangleAttribute.isRectangle = function(poly) {
  if (poly.pts.length != 4) return false;
  var a_max = 110 * Math.PI / 180, a_min = 70 * Math.PI / 180;
  for (var i=0; i<poly.pts.length; ++i) {
    if (poly.angle(i) > a_max || poly.angle(i) < a_min) return false;
  }
  return true;
}
TriangleAttribute = function(obj) {
  this.perceive(obj);
}
TriangleAttribute.prototype.key = 'triangle';
TriangleAttribute.prototype.targetType = 'obj';
TriangleAttribute.prototype.arity = 1;
TriangleAttribute.prototype.constant = true;

/// Returns an TriangleAttribute instance, which is the perception of the passed
/// object's shape. Possible shapes are circle, triangle, rectangle, square and
/// unknown.
TriangleAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = TriangleAttribute.triangleness(obj);
}

TriangleAttribute.prototype.get_activity = function() {
  return this.val;
}

TriangleAttribute.prototype.get_label = function() {
  return this.key;
}

TriangleAttribute.triangleness = function(shape) {
  if ((shape instanceof Polygon) && shape.closed && shape.pts.length === 3) return 1;
  return 0;
}
/// Reflects whether an object is moving at the moment or will be moving 0.1 seconds
/// in the future. The activation is 0.5 for a linear velocity of 0.1.
MovesAttribute = function(obj) {
  this.perceive(obj);
}
MovesAttribute.prototype.key = 'moves';
MovesAttribute.prototype.targetType = 'obj';
MovesAttribute.prototype.arity = 1;
MovesAttribute.prototype.constant = true;

// google: "plot from -0.5 to 5, 1/(1+exp(40*(0.1-x)))"
MovesAttribute.membership = function(lin_vel) {
  var a = 40; // steepness of sigmoid function
  var m = 0.1; // linear velocity at which sigmoid is 0.5
  return 1/(1+Math.exp(a*(m-lin_vel)));
}

MovesAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  // vel. right now
  var body = obj.phys_obj;
  this.val = body.m_linearVelocity.Length();
  // vel. in 0.1 seconds
  obj.object_node.scene_node.oracle.analyzeFuture(0.1, null, (function() {
  	this.val_soon = body.m_linearVelocity.Length();
  }).bind(this));
}

MovesAttribute.prototype.get_activity = function() {
  return Math.max(MovesAttribute.membership(this.val), MovesAttribute.membership(this.val_soon));
}

MovesAttribute.prototype.get_label = function() {
  return 'moves';
}
SmallAttribute = function(obj) {
  this.perceive(obj);
}
SmallAttribute.prototype.key = 'small';
SmallAttribute.prototype.targetType = 'obj';
SmallAttribute.prototype.arity = 1;
SmallAttribute.prototype.constant = true;

// google: "plot from -10 to 1000, 1-1/(1+exp(4*(1.8-x/100)))"
SmallAttribute.membership = function(area) {
  var a = 4; // steepness of sigmoid function
  var m = 1.8; // area at which sigmoid is 0.5 (whole scene has area 100)
  var size = 100;
  return 1-1/(1+Math.exp(a*(m-area/size/size*100)));
}

SmallAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = Math.abs(obj.area());
}

SmallAttribute.prototype.get_activity = function() {
  return SmallAttribute.membership(this.val);
}

SmallAttribute.prototype.get_label = function() {
  return 'small';
}
LargeAttribute = function(obj) {
  this.perceive(obj);
}
LargeAttribute.prototype.key = 'large';
LargeAttribute.prototype.targetType = 'obj';
LargeAttribute.prototype.arity = 1;
LargeAttribute.prototype.constant = true;

// google: "plot from -10 to 1000, 1/(1+exp(4*(2-x/100)))"
LargeAttribute.membership = function(area) {
  var a = 4; // steepness of sigmoid function
  var m = 2.0; // area at which sigmoid is 0.5 (whole scene has area 100)
  var size = 100;
  return 1/(1+Math.exp(a*(m-area/size/size*100)));
}

LargeAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = Math.abs(obj.area());
}

LargeAttribute.prototype.get_activity = function() {
  return LargeAttribute.membership(this.val);
}

LargeAttribute.prototype.get_label = function() {
  return 'large';
}
LeftAttribute = function(obj) {
  this.perceive(obj);
}
LeftAttribute.prototype.key = "left_pos";
LeftAttribute.prototype.targetType = 'obj';
LeftAttribute.prototype.arity = 1;
LeftAttribute.prototype.size = 100; // scene size
LeftAttribute.prototype.constant = false;

LeftAttribute.prototype.membership = function(x) {
	return 1-1/(1+Math.exp(20*(0.4-x/this.size)));
}

LeftAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = obj.x;
}

LeftAttribute.prototype.get_activity = function() {
  return this.membership(this.val);
}

LeftAttribute.prototype.get_label = function() {
  return 'left';
}
LeftMostAttribute = function(obj) {
  this.adaptDomain(obj.object_node.scene_node.objs);
  this.perceive(obj);
}
LeftMostAttribute.prototype.key = "left_most";
LeftMostAttribute.prototype.targetType = 'obj';
LeftMostAttribute.prototype.arity = 1;
LeftMostAttribute.prototype.constant = false;

LeftMostAttribute.prototype.adaptDomain = function(objs) {
  var best, best_obj = null;
  for (var i=0; i<objs.length; i++) {
    if (!(objs[i] instanceof ObjectNode)) continue;
    var x = objs[i].obj.phys_obj.GetPosition().x;
    if (!best_obj || best > x) {
      best_obj = objs[i];
      best = x;
    }
  }
	this.leftmost_x = best_obj.obj.x;
}

LeftMostAttribute.prototype.membership = function(x) {
  return CloseRelationship.membership(2.5*Math.abs(this.val-this.leftmost_x));
}

LeftMostAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = obj.x;
}

LeftMostAttribute.prototype.get_activity = function() {
  return this.membership(this.val);
}

LeftMostAttribute.prototype.get_label = function() {
  return 'left-most';
}
RightAttribute = function(obj) {
  this.perceive(obj);
}
RightAttribute.prototype.key = "right_pos";
RightAttribute.prototype.targetType = 'obj';
RightAttribute.prototype.arity = 1;
RightAttribute.prototype.size = 100; // scene size
RightAttribute.prototype.constant = false;

RightAttribute.prototype.membership = function(x) {
	return 1-1/(1+Math.exp(20*(0.4-x/this.size)));
}

RightAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = this.size-obj.x;
}

RightAttribute.prototype.get_activity = function() {
  return this.membership(this.val);
}

RightAttribute.prototype.get_label = function() {
  return 'right';
}
RightMostAttribute = function(obj) {
  this.adaptDomain(obj.object_node.scene_node.objs);
  this.perceive(obj);
}
RightMostAttribute.prototype.key = "right_most";
RightMostAttribute.prototype.targetType = 'obj';
RightMostAttribute.prototype.arity = 1;
RightMostAttribute.prototype.constant = false;

RightMostAttribute.prototype.adaptDomain = function(objs) {
  var best, best_obj = null;
  for (var i=0; i<objs.length; i++) {
    if (!(objs[i] instanceof ObjectNode)) continue;
    var x = objs[i].obj.phys_obj.GetPosition().x;
    if (!best_obj || best < x) {
      best_obj = objs[i];
      best = x;
    }
  }
	this.rightmost_x = best_obj.obj.x;
}

RightMostAttribute.prototype.membership = function(x) {
  return CloseRelationship.membership(2.5*Math.abs(this.val-this.rightmost_x));
}

RightMostAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = obj.x;
}

RightMostAttribute.prototype.get_activity = function() {
  return this.membership(this.val);
}

RightMostAttribute.prototype.get_label = function() {
  return 'right-most';
}
BottomAttribute = function(obj) {
  this.adaptDomain(obj.object_node.scene_node.ground);
  this.perceive(obj);
}
BottomAttribute.prototype.key = "bottom_pos";
BottomAttribute.prototype.targetType = 'obj';
BottomAttribute.prototype.arity = 1;
BottomAttribute.prototype.constant = false;

BottomAttribute.prototype.adaptDomain = function(ground) {
	var bb = ground.bounding_box();
	this.maxy = ground.y+bb.y+bb.height;
}

BottomAttribute.prototype.membership = function(x) {
	return 1-1/(1+Math.exp(20*(0.3-x/this.maxy)));
}

BottomAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = this.maxy-obj.y; // y get smaller towards the top
}

BottomAttribute.prototype.get_activity = function() {
  return this.membership(this.val);
}

BottomAttribute.prototype.get_label = function() {
  return 'bottom';
}
/// Reflects whether an object is moving at the moment or will be moving 0.1 seconds
/// in the future. The activation is 0.5 for a linear velocity of 0.1.
SingleAttribute = function(obj) {
  this.perceive(obj);
}
SingleAttribute.prototype.key = 'single';
SingleAttribute.prototype.targetType = 'obj';
SingleAttribute.prototype.arity = 1;
SingleAttribute.prototype.constant = false;

// Input this at google: plot 1/(1+exp(30*(0.05-x/100))) from -10 to 110
SingleAttribute.membership = function(dist) {
  var a_far = 40; // steepness of sigmoid function
  var m_far = 0.03; // distance at which sigmoid is 0.5 (on scale 0...1)
  var size = 100; // scene width and height
  return 1/(1+Math.exp(a_far*(m_far-dist/size)));
}

SingleAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  var other = obj.object_node.scene_node.oracle.getClosestBodyWithDist(obj.phys_obj);
  if (!other) this.val = 100; // no other objects!
  else this.val = other.dist / obj.phys_scale;
}

SingleAttribute.prototype.get_activity = function() {
  return Math.max(0, SingleAttribute.membership(this.val)
                   - TouchRelationship.membership(this.val));
}

SingleAttribute.prototype.get_label = function() {
  return 'single';
}
TopAttribute = function(obj) {
  this.adaptDomain(obj.object_node.scene_node.ground);
  this.perceive(obj);
}
TopAttribute.prototype.key = "top_pos";
TopAttribute.prototype.targetType = 'obj';
TopAttribute.prototype.arity = 1;
TopAttribute.prototype.constant = false;


TopAttribute.prototype.adaptDomain = function(ground) {
	if (ground) {
		var bb = ground.bounding_box();
		this.maxy = ground.y+bb.y+bb.height;
	} else {
		this.maxy = 100;
	}
}

TopAttribute.prototype.membership = function(x) {
	return 1-1/(1+Math.exp(20*(0.45-x/this.maxy)));
}

TopAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = obj.y; // y get smaller towards the top
}

TopAttribute.prototype.get_activity = function() {
  return this.membership(this.val);
}

TopAttribute.prototype.get_label = function() {
  return 'top';
}
TopMostAttribute = function(obj) {
  this.adaptDomain(obj.object_node.scene_node.objs);
  this.perceive(obj);
}
TopMostAttribute.prototype.key = "top_most";
TopMostAttribute.prototype.targetType = 'obj';
TopMostAttribute.prototype.arity = 1;
TopMostAttribute.prototype.constant = false;

TopMostAttribute.prototype.adaptDomain = function(objs) {
  var best, best_obj = null;
  for (var i=0; i<objs.length; i++) {
    if (!(objs[i] instanceof ObjectNode)) continue;
    var y = objs[i].obj.phys_obj.GetPosition().y;
    if (!best_obj || best > y) {
      best_obj = objs[i];
      best = y;
    }
  }
	this.topmost_y = best_obj.obj.y;
}

TopMostAttribute.prototype.membership = function(x) {
  return CloseRelationship.membership(2.5*Math.abs(this.val-this.topmost_y));
}

TopMostAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  this.val = obj.y; // y gets smaller towards the top
}

TopMostAttribute.prototype.get_activity = function() {
  return this.membership(this.val);
}

TopMostAttribute.prototype.get_label = function() {
  return 'top-most';
}
OnGroundAttribute = function(obj) {
	this.ground = obj.object_node.scene_node.ground;
  this.perceive(obj);
}
OnGroundAttribute.prototype.key = "on_ground";
OnGroundAttribute.prototype.targetType = 'obj';
OnGroundAttribute.prototype.arity = 1;
OnGroundAttribute.prototype.constant = false;

OnGroundAttribute.prototype.perceive = function(obj) {
  this.obj = obj;
  var touch = obj.object_node.getRel('touch', {other: this.ground.object_node});
  this.val = touch.get_activity();
}

OnGroundAttribute.prototype.get_activity = function() {
  return this.val == '?' ? 0 : this.val;
}

OnGroundAttribute.prototype.get_label = function() {
  return 'on-ground';
}
/// Object beeing left to other object on a scale from 1 (very) to 0 (not at all).
LeftRelationship = function(obj, other) {
  this.perceive(obj, other);
}
LeftRelationship.prototype.key = "left_of";
LeftRelationship.prototype.arity = 2;
LeftRelationship.prototype.targetType = 'obj';
LeftRelationship.prototype.symmetry = false;
LeftRelationship.prototype.constant = false;

LeftRelationship.prototype.perceive = function(obj, other) {
  this.obj = obj;
  this.other = other;
  var left = SpatialRelationAnalyzer(100, 100/2/100, 'left').getMembership(obj, other);
  var right = SpatialRelationAnalyzer(100, 100/2/100, 'right').getMembership(obj, other);
  this.val = Math.max(0, left[1]-right[1]);
}

LeftRelationship.prototype.get_activity = function() {
  if (this.val == '?') return 0;
  return this.val;
}

LeftRelationship.prototype.get_label = function() {
  return 'left-of';
}
/// Object beeing right to other object on a scale from 1 (very) to 0 (not at all).
RightRelationship = function(obj, other) {
  this.perceive(obj, other);
}
RightRelationship.prototype.key = "right_of";
RightRelationship.prototype.targetType = 'obj';
RightRelationship.prototype.arity = 2;
RightRelationship.prototype.symmetry = false;
RightRelationship.prototype.constant = false;

RightRelationship.prototype.perceive = function(obj, other) {
  this.obj = obj;
  this.other = other;
  var left = SpatialRelationAnalyzer(100, 100/2/100, 'left').getMembership(obj, other);
  var right = SpatialRelationAnalyzer(100, 100/2/100, 'right').getMembership(obj, other);
  this.val = Math.max(0, right[1]-left[1]);
}


RightRelationship.prototype.get_activity = function() {
  if (this.val == '?') return 0;
  return this.val;
}

RightRelationship.prototype.get_label = function() {
  return 'right-of';
}
/// Object being left or right to another object on a scale from 1 (very) to 0 (not at all).
BesideRelationship = function(obj, other) {
  this.perceive(obj, other);
}
BesideRelationship.prototype.key = "beside";
BesideRelationship.prototype.targetType = 'obj';
BesideRelationship.prototype.arity = 2;
BesideRelationship.prototype.symmetric = true;
BesideRelationship.prototype.constant = false;

BesideRelationship.prototype.perceive = function(obj, other) {
  this.obj = obj;
  this.other = other;
  var l_pos = SpatialRelationAnalyzer(100, 100/2/100, 'left').getMembership(obj, other);
  var r_pos = SpatialRelationAnalyzer(100, 100/2/100, 'right').getMembership(obj, other);
  var left = Math.max(0, l_pos[1]-r_pos[1]);
  var right = Math.max(0, r_pos[1]-l_pos[1]);
  this.val = Math.max(left, right);
}

BesideRelationship.prototype.get_activity = function() {
  return this.val == '?' ? 0 : this.val;
}

BesideRelationship.prototype.get_label = function() {
  return 'beside';
}
/// Object beeing below to other object on a scale from 1 (very) to 0 (not at all).
BelowRelationship = function(obj, other) {
  this.perceive(obj, other);
}
BelowRelationship.prototype.key = "below";
BelowRelationship.prototype.targetType = 'obj';
BelowRelationship.prototype.arity = 2;
BelowRelationship.prototype.symmetry = false;
BelowRelationship.prototype.constant = false;

BelowRelationship.prototype.perceive = function(obj, other) {
  this.obj = obj;
  this.other = other;
  var above = SpatialRelationAnalyzer(100, 100/2/100, 'above').getMembership(obj, other);
  var below = SpatialRelationAnalyzer(100, 100/2/100, 'below').getMembership(obj, other);
  this.val = Math.max(0, below[1]-above[1]);
}


BelowRelationship.prototype.get_activity = function() {
  if (this.val == '?') return 0;
  else return this.val;
}

BelowRelationship.prototype.get_label = function() {
  return 'below';
}
/// Object beeing above to other object on a scale from 1 (very) to 0 (not at all).
AboveRelationship = function(obj, other) {
  this.perceive(obj, other);
}
AboveRelationship.prototype.key = "above";
AboveRelationship.prototype.targetType = 'obj';
AboveRelationship.prototype.arity = 2;
AboveRelationship.prototype.symmetry = false;
AboveRelationship.prototype.constant = false;

AboveRelationship.prototype.perceive = function(obj, other) {
  this.obj = obj;
  this.other = other;
  var above = SpatialRelationAnalyzer(100, 100/2/100, 'above').getMembership(obj, other);
  var below = SpatialRelationAnalyzer(100, 100/2/100, 'below').getMembership(obj, other);
  this.val_max = above[2];
  this.val_min = above[0];
  this.val = Math.max(0, above[1]-below[1]);
}

AboveRelationship.prototype.get_activity = function() {
  if (this.val == '?') return 0;
  else return this.val;
}

AboveRelationship.prototype.get_label = function() {
  return 'above';
}
TouchRelationship = function(obj, other) {
  this.perceive(obj, other);
}
TouchRelationship.prototype.key = "touch";
TouchRelationship.prototype.targetType = 'obj';
TouchRelationship.prototype.arity = 2;
TouchRelationship.prototype.symmetric = true;
TouchRelationship.prototype.constant = false;

TouchRelationship.membership = function(dist) {
	return dist <= 0.5 ? 1 : 0;
}

TouchRelationship.prototype.perceive = function(obj, other) {
  this.obj = obj;
  this.other = other;
  this.val = obj.phys_obj.distance(other.phys_obj) / obj.phys_scale;
}

TouchRelationship.prototype.get_activity = function() {
  return TouchRelationship.membership(this.val);
}

TouchRelationship.prototype.get_label = function() {
  return 'touches';
}
/// Object is on top of another object if it is above and touches it.
OnTopRelationship = function(obj, other) {
  this.perceive(obj, other);
}
OnTopRelationship.prototype.key = "on_top_of";
OnTopRelationship.prototype.targetType = 'obj';
OnTopRelationship.prototype.arity = 2;
OnTopRelationship.prototype.symmetric = false;
OnTopRelationship.prototype.constant = false;

OnTopRelationship.prototype.perceive = function(obj, other) {
  this.obj = obj;
  this.other = other;
  var touch = obj.object_node.getRel('touch', {other: other.object_node}).get_activity();
  var above = Math.max(obj.object_node.getRel('above', {other: other.object_node}).get_activity()
                      ,other.object_node.getRel('below', {other: obj.object_node}).get_activity());
  this.val = touch * above;
}

OnTopRelationship.prototype.get_activity = function() {
  return this.val == '?' ? 0 : this.val;
}

OnTopRelationship.prototype.get_label = function() {
  return 'on-top-of';
}
FarRelationship = function(obj, other) {
  this.perceive(obj, other);
}
FarRelationship.prototype.key = "far";
FarRelationship.prototype.targetType = 'obj';
FarRelationship.prototype.arity = 2;
FarRelationship.prototype.symmetric = true;
FarRelationship.prototype.constant = false;

// Input this at google: plot 1/(1+exp(20*(0.35-x/100))) from -10 to 110, 1-1/(1+exp(30*(0.2-x/100)))
FarRelationship.membership = function(dist) {
  var a_far = 20; // steepness of sigmoid function
  var m_far = 0.25; // distance at which sigmoid is 0.5 (on scale 0...1)
  var size = 100; // scene width and height
  return 1/(1+Math.exp(a_far*(m_far-dist/size)));
}

FarRelationship.prototype.perceive = function(obj, other) {
  this.obj = obj;
  this.other = other;
  this.val = obj.phys_obj.distance(other.phys_obj) / obj.phys_scale;
}

FarRelationship.prototype.get_activity = function() {
  return FarRelationship.membership(this.val);
}

FarRelationship.prototype.get_label = function() {
  return 'far';
}
/// Group attribute. A group is as far as the smallest distance of
/// any two members is far. Groups with 1 or 0 objects are not far.
FarAttribute = function(group) {
  this.perceive(group);
}
FarAttribute.prototype.key = "far";
FarAttribute.prototype.targetType = 'group';
FarAttribute.prototype.arity = 1;
FarAttribute.prototype.constant = false;

FarAttribute.prototype.perceive = function(group) {
  this.group = group;
  if (group.objs.length < 2) this.val = NaN;
  else {
    this.val = Infinity;
    for (var i=1; i<group.objs.length; i++) for (var j=0; j<i; j++) {
      var dist = group.objs[i].phys_obj.distance(group.objs[j].phys_obj) / group.objs[0].phys_scale;
      if (this.val > dist) this.val = dist;
    }
  }
}

FarAttribute.prototype.get_activity = function() {
  return isNaN(this.val) ? 0 : FarRelationship.membership(this.val);
}

FarAttribute.prototype.get_label = function() {
  return 'far';
}
CloseRelationship = function(obj, other) {
  this.perceive(obj, other);
}
CloseRelationship.prototype.key = "close";
CloseRelationship.prototype.targetType = 'obj';
CloseRelationship.prototype.arity = 2;
CloseRelationship.prototype.symmetric = true;
CloseRelationship.prototype.constant = false;

// Input this at google: plot 1/(1+exp(20*(0.35-x/100))) from -10 to 110, 1-1/(1+exp(30*(0.2-x/100)))
CloseRelationship.membership = function(dist) {
  var a_close = 30; // steepness of sigmoid function
  var m_close = 0.2; // distance at which sigmoid is 0.5 (on scale 0...1)
  var size = 100; // scene width and height
  return 1-1/(1+Math.exp(a_close*(m_close-dist/size)));
}

CloseRelationship.prototype.perceive = function(obj, other) {
  this.obj = obj;
  this.other = other;
  // if both objects are in the same scene, use the physics engine to get
  // the minimum distance between their surfaces
  if (obj.object_node.scene_node === other.object_node.scene_node) {
    this.val = obj.phys_obj.distance(other.phys_obj) / obj.phys_scale;
  }
  /// if the objects are from different scenes, simply compare the distance
  /// of their positions
  else {
    // a bit of scaling to be more permissive
    this.val = Point.len(obj.x-other.x, obj.y-other.y)*2/3;
  }
}

CloseRelationship.prototype.get_activity = function() {
  return CloseRelationship.membership(this.val);
}

CloseRelationship.prototype.get_label = function() {
  return 'close';
}
/// Group attribute. Groups where each object is connected with each other object through
/// a sequence of objects that are no further than X from each other are close to the degree
/// close(X).
/// Groups with 1 or 0 objects are not close.
/// This is a Minimum Spanning Tree problem, and we'll use the Kruskal's algorithm to solve
/// it (see http://en.wikipedia.org/wiki/Kruskal%27s_algorithm).
CloseAttribute = function(group) {
  this.perceive(group);
}
CloseAttribute.prototype.key = "close";
CloseAttribute.prototype.targetType = 'group';
CloseAttribute.prototype.arity = 1;
CloseAttribute.prototype.constant = false;

CloseAttribute.prototype.perceive = function(group) {
  this.group = group;
  if (group.objs.length < 2) this.val = NaN;
  else {
    // var pobjs = group.objs.map(function (on) { return on.phys_obj });
    // var tgs = group.scene_node.oracle.getSpatialGroups(20 * group.objs[0].phys_scale, pobjs);
    // if (tgs.length == 1) this.val = 1;
    // else this.val = 0;
    var nodes = [];
    for (var i=0; i<group.objs.length; i++) { nodes.push(i) }
    var edges = [], scale = group.objs[0].phys_scale;
    for (var i=1; i<group.objs.length; i++) for (var j=0; j<i; j++) {
      edges.push({a:i, b:j, dist: group.objs[i].phys_obj.distance(group.objs[j].phys_obj) / scale});
    };
    var mst = CloseAttribute.getMST(nodes, edges);
    // the last edge in the MST has the bigges distance
    this.val = mst[mst.length-1].dist;
  }
}

CloseAttribute.prototype.get_activity = function() {
  return (isNaN(this.val) ? 0 : CloseRelationship.membership(this.val));
}

CloseAttribute.prototype.get_label = function() {
  return 'close';
}

/// Nodes should be numbers, edges should be {a: node1, b: node2, dist: 1.34}.
CloseAttribute.getMST = function(nodes, edges) {
  var mst = [];
  var sets = nodes.map(function(node) { var s = {}; s[node] = true; return s });
  edges.sort(function(a,b) { return a.dist-b.dist} );
  for (var i=0; i<edges.length; i++) {
    var a = edges[i].a, b = edges[i].b;
    var idx_a, idx_b;
    for (var j=0; j<sets.length; j++) {
      if (a in sets[j]) idx_a = j;
      if (b in sets[j]) idx_b = j;
    }
    if (idx_a === idx_b) continue;
    mst.push(edges[i]);
    for (var key in sets[idx_b]) sets[idx_a][key] = true;
    sets[idx_b] = {};
  }
  return mst;
}
HitsRelationship = function(obj, other) {
  this.perceive(obj, other);
}
HitsRelationship.prototype.key = "hits";
HitsRelationship.prototype.targetType = 'obj';
HitsRelationship.prototype.arity = 2;
HitsRelationship.prototype.symmetric = false;
HitsRelationship.prototype.constant = true;

HitsRelationship.prototype.perceive = function(obj, other) {
  this.obj = obj;
  this.other = other;
  this.collisions = obj.object_node.scene_node.collisions.filter(
  	function (coll) { return coll.a === obj && coll.b === other }
  );
  // save the speed of the strongest collision in val
  this.val = this.collisions.length == 0 ? 0
             : d3.max(this.collisions, function (coll) { return coll.dv });
}

HitsRelationship.prototype.get_activity = function() {
  return this.val == 0 ? 0 : 1;
}

HitsRelationship.prototype.get_label = function() {
  return 'hits';
}
GetsHitRelationship = function(obj, other) {
  this.perceive(obj, other);
}
GetsHitRelationship.prototype.key = "gets_hit";
GetsHitRelationship.prototype.targetType = 'obj';
GetsHitRelationship.prototype.arity = 2;
GetsHitRelationship.prototype.symmetric = false;
GetsHitRelationship.prototype.constant = true;

GetsHitRelationship.prototype.perceive = function(obj, other) {
  this.obj = obj;
  this.other = other;
  this.collisions = obj.object_node.scene_node.collisions.filter(
  	function (coll) { return coll.b === obj && coll.a === other }
  );
  // save the speed of the strongest collision in val
  this.val = this.collisions.length == 0 ? 0
             : d3.max(this.collisions, function (coll) { return coll.dv });
}

GetsHitRelationship.prototype.get_activity = function() {
  return this.val == 0 ? 0 : 1;
}

GetsHitRelationship.prototype.get_label = function() {
  return 'gets-hit-by';
}
CollidesRelationship = function(obj, other) {
  this.perceive(obj, other);
}
CollidesRelationship.prototype.key = "collides";
CollidesRelationship.prototype.targetType = 'obj';
CollidesRelationship.prototype.arity = 2;
CollidesRelationship.prototype.symmetric = true;
CollidesRelationship.prototype.constant = true;

CollidesRelationship.prototype.perceive = function(obj, other) {
  this.obj = obj;
  this.other = other;
  this.collisions = obj.object_node.scene_node.collisions.filter(
  	function (coll) { return coll.a === obj && coll.b === other ||
                             coll.b === obj && coll.a === other }
  );
  // save the speed of the strongest collision in val
  this.val = this.collisions.length == 0 ? 0
             : d3.max(this.collisions, function (coll) { return coll.dv });
}

CollidesRelationship.prototype.get_activity = function() {
  return this.val == 0 ? 0 : 1;
}

CollidesRelationship.prototype.get_label = function() {
  return 'collides-with';
}
/// The label is 'supports'. The activity can have four levels:
/// 1.0 ... A directly supports B
/// 0.7 ... A indirectly supports B
/// 0.4 ... A stabilizes B
/// 0   ... A does not support B
/// See the checkSupport method for more details.
/// Which activity is still considered as active will depend on the context.
SupportsRelationship = function(obj, other) {
  this.perceive(obj, other);
}
SupportsRelationship.prototype.key = "supports";
SupportsRelationship.prototype.targetType = 'obj';
SupportsRelationship.prototype.arity = 2;
SupportsRelationship.prototype.symmetry = false;
SupportsRelationship.prototype.constant = false;

/// Returns an SupportsRelation instance, which is the perception of how well the
/// passed object supports the other object.
SupportsRelationship.prototype.perceive = function(obj, other) {
  this.obj = obj;
  this.other = other;
  this.val = this.checkSupports(obj.object_node, other.object_node, obj.object_node.scene_node.oracle);
}

SupportsRelationship.prototype.get_activity = function() {
  if (this.val == 'directly') return 1;
  if (this.val == 'indirectly') return 0.7;
  if (this.val == 'stabilizes') return 0.4;
  if (this.val == 'not') return 0;
  throw "unknown support value";
}

SupportsRelationship.prototype.get_label = function() {
	return 'supporting';
}

/// Returns whether the object node A 'directly, 'indirectly' supports the
/// object node B or merely 'stabilizes' it or does 'not' support it at all.
/// 1) A 'directly' supports B:
///   A touches B and B is not starting to move but it is with A removed
/// 2) A 'indirectly' supports B:
///   A does not touch B and B is not starting to move but it is with A removed
/// 3) A 'stabilizes' B:
///   B is on-top-of A, but does not move, also when A is removed OR
///   (B is stable, but becomes unstable if A is removed -- not implemented)
SupportsRelationship.prototype.checkSupports = function(A, B, oracle) {
  var moves_threshold   = 0.5
     ,touches_threshold = 0.5
     ,ontopof_threshold = 0.5
     ,close_threshold   = 0.5;

  if (A === B) return 'not';

	// no support if B moves anyway
  if (B.getAttr('moves').get_activity() > moves_threshold) return 'not';

  // is A touching B?
  var touch = A.getRel('touch', {other: B}).get_activity() > touches_threshold;

  // is B moving when A is removed?
  var bodyA = A.obj.phys_obj;
  var before = function() { oracle.pscene.wakeUp(); bodyA.SetActive(false); }
  var B_moves = oracle.analyzeFuture(0, before, function() {
    var moves_attr = new MovesAttribute(B.obj);
    return moves_attr.get_activity() > moves_threshold;
  });

  if (B_moves) return touch ? 'directly': 'indirectly';

  // B does not depend on A, but is it on-top-of A?
  var ontop = B.getRel('on_top_of', {other: A}).get_activity() > ontopof_threshold;
  if (ontop) return 'stabilizes';

  // is B near A and stable, but unstable without A?
  var near = A.getRel('close', {other: B}).get_activity() > close_threshold;
  if (near) {
    var B_stable = B.getAttr('stability').get_label() == 'stable';
    if (B_stable) {
      var B_stable_without_A = oracle.analyzeFuture(0, before, function() {
        var stable_attr = new StabilityAttribute(B.obj);
        return stable_attr.get_label() == 'stable';
      });
      if (!B_stable_without_A) return 'stabilizes';
    }
  }

  return 'not';
}
/// Group attribute, number of objects in the group.
CountAttribute = function(group) {
  this.perceive(group);
}
CountAttribute.prototype.key = "count";
CountAttribute.prototype.targetType = 'group';
CountAttribute.prototype.arity = 1;
CountAttribute.prototype.constant = true;

CountAttribute.prototype.perceive = function(group) {
  this.group = group;
  this.val = group.objs.length;
}

CountAttribute.prototype.get_activity = function() {
  return 1;
}

CountAttribute.prototype.get_label = function() {
	if (this.val < 4) return this.val;
	return ">=4";
}
/// Group attribute. A group is touching if all objects in the group are connected
/// to each other by a sequence of touching objects. Groups with 1 or 0 objects are
/// not touching.
TouchAttribute = function(group) {
  this.perceive(group);
}
TouchAttribute.prototype.key = "touching";
TouchAttribute.prototype.targetType = 'group';
TouchAttribute.prototype.arity = 1;
TouchAttribute.prototype.constant = false;

TouchAttribute.prototype.perceive = function(group) {
  this.group = group;
  if (group.objs.length < 2) this.val = 100;
  else {
    var nodes = [];
    for (var i=0; i<group.objs.length; i++) { nodes.push(i) }
    var edges = [], scale = group.objs[0].phys_scale;
    for (var i=1; i<group.objs.length; i++) for (var j=0; j<i; j++) {
      edges.push({a:i, b:j, dist: group.objs[i].phys_obj.distance(group.objs[j].phys_obj) / scale});
    };
    var mst = CloseAttribute.getMST(nodes, edges);
    // the last edge in the MST has the bigges distance
    this.val = mst[mst.length-1].dist;
  }
}

TouchAttribute.prototype.get_activity = function() {
  return (isNaN(this.val) ? 0 : TouchRelationship.membership(this.val));
}

TouchAttribute.prototype.get_label = function() {
  return 'touching';
}
var pbpSettings = (function() {
	res = {
    max_dist: 0.06 // maximal distance of an objects to a spatial group to belong to it /* TODO: use this everywhere */
   ,activation_threshold: 0.5 /* TODO: use this everywhere */
   ,obj_attrs: {}
   ,obj_rels: {}
   ,group_attrs: {}
	};
	// object attributes
	[LeftAttribute,
	 LeftMostAttribute,
	 RightAttribute,
	 RightMostAttribute,
	 BottomAttribute,
	 TopAttribute,
	 TopMostAttribute,
	 SingleAttribute,
	 OnGroundAttribute,
	 CircleAttribute,
	 SquareAttribute,
	 RectangleAttribute,
	 TriangleAttribute,
	 ShapeAttribute,
	 StabilityAttribute,
	 SmallAttribute,
	 LargeAttribute,
	 MovesAttribute,
	 MovableUpAttribute].forEach(function (attr) { res.obj_attrs[attr.prototype.key] = attr });
	// group attributes
	[CloseAttribute,
	 CountAttribute,
	 FarAttribute,
	 TouchAttribute
	].forEach(function (attr) { res.group_attrs[attr.prototype.key] = attr });
	// object relations
	[AboveRelationship,
	BelowRelationship,
	LeftRelationship,
	RightRelationship,
	BesideRelationship,
	FarRelationship,
	CloseRelationship,
	OnTopRelationship,
	TouchRelationship,
	HitsRelationship,
	GetsHitRelationship,
	CollidesRelationship,
	SupportsRelationship].forEach(function (rel) { res.obj_rels[rel.prototype.key] = rel });
	return res;
})();

var PBP = PBP || {};

/// Adds all keys+values in b to a (overwrites if exists) and returns a. If b is not an object, just
/// return a.
PBP.extend = function(a, b) {
  if (typeof(b) === 'object') for (var key in b) a[key] = b[key];
  return a;
}/// Copyright by Erik Weitnauer, 2013.

/// A GroupNode represents a group of objects in one scene. Pass the SceneNode the
/// group belongs to. Optionally, pass an selector array that was used to create the
/// group node.
GroupNode = function(scene_node, objs, selectors) {
  this.scene_node = scene_node;
  this.objs = objs || [];   // shapes
  this.times = {};
  // selectors that select this group node:
  this.selectors = selectors ? (Array.isArray(selectors) ? selectors.slice()
                                                         : [selectors])
                             : [new Selector()];
}

/// The ObjectNode will send 'perceived' and 'retrieved' events {feature, target}.
//asEventListener.call(GroupNode.prototype);

GroupNode.prototype.empty = function() {
  return this.objs.length === 0;
}

/// Returns a clone with the same scene node, a copy of the objs array.
/// CAUTION: The times field that holds all cached percepts is the same
/// reference as in the original group node!
GroupNode.prototype.clone = function() {
  var gn = new GroupNode(this.scene_node, this.objs.slice(), this.selectors);
  gn.times = this.times;
  return gn;
}

/// Creates and returns a single GroupNode of all objects of a scene. If the key_obj
/// parameter is passed, the key_obj is not included in the group.
GroupNode.sceneGroup = function(scene_node, key_obj) {
	var g = new GroupNode(scene_node);
  for (var i=0; i<scene_node.objs.length; i++) {
    var on = scene_node.objs[i];
    if (on != key_obj && on instanceof ObjectNode) g.objs.push(on.obj);
  }
  return g;
}

/// Creates a GroupNodes for each set of spatially close objects in the scene
/// that has more than one object.
GroupNode.spatialGroups = function(scene_node, max_dist) {
  var gns = [];
  if (typeof(max_dist) === 'undefined') max_dist = 0.06;
  var sg = scene_node.oracle.getSpatialGroups(max_dist);
  for (var i=0; i<sg.length; i++) {
    if (sg[i].length > 0) gns.push(new GroupNode(scene_node, sg[i].map(function (body) { return body.master_obj.obj })))
  }
  return gns;
}

/// list of all possible group attributes
GroupNode.attrs = pbpSettings.group_attrs;

/// Perceives all attributes and all relations to all other objs in the scene
/// at the current situation and saves the results under the passed time.
GroupNode.prototype.perceive = function(time) {
  var res = {};
  for (var a in GroupNode.attrs) {
    var attr = GroupNode.attrs[a];
    res[a] = new attr(this);
  }
  this.times[time] = res;
}

/// Returns the attribute for the passed time in the opts object (default is 'start').
/// If it was not perceived yet, it is perceived now, unless 'cache_only' is true in opts.
GroupNode.prototype.getAttr = function(key, opts) {
  var o = PBP.extend({}, opts);
  // if time was not passed, use the current state of the oracle
  if (!o.time) o.time = this.scene_node.oracle.curr_state;
  if (GroupNode.attrs[key].constant) o.time = 'start';
  // if the attr is cached, just return it
  if ((o.time in this.times) && (key in this.times[o.time])) {
    var res = this.times[o.time][key];
    //this.dispatchEvent('retrieved', {percept: res, target: this, time: o.time});
    return res;
  }
  if (o.cache_only) return false;
  // otherwise, goto the state and perceive it
  if (o.time) this.scene_node.oracle.gotoState(o.time);
  var res = new GroupNode.attrs[key](this);
  // cache it, if the state is a known one
  if (o.time) {
    if (!this.times[o.time]) this.times[o.time] = {};
    this.times[o.time][key] = res;
  }
  //this.dispatchEvent('perceived', {percept: res, target: this, time: o.time});
  return res;
}

GroupNode.prototype.getFromCache = function(key, opts) {
  opts = opts || {};
  opts.cache_only = true;
  return this.getAttr(key, opts);
}

GroupNode.prototype.get = GroupNode.prototype.getAttr;

/// Prints a description of the GroupNode.
GroupNode.prototype.describe = function() {
  console.log(this);
}
/// Copyright by Erik Weitnauer, 2012.

/// An ObjectNode represents a single object. Pass the object (shape) it represents
/// and the SceneNode it is part of.
ObjectNode = function(scene_node, obj) {
	this.obj = obj; obj.object_node = this;
  this.scene_node = scene_node;
	this.times = {};
  this.selectors = []; // selectors that match this object
}

/// list of all possible object attributes
ObjectNode.attrs = pbpSettings.obj_attrs;

/// list of all possible object relations
ObjectNode.rels = pbpSettings.obj_rels;

/// The ObjectNode will send 'perceived' and 'retrieved' events
/// {percept, target, othert, time}.
//asEventListener.call(ObjectNode.prototype);

/// Returns true if there is the passed relation type with the passed activity
/// with the passed other object node.
ObjectNode.prototype.hasRelation = function(key, time, active, other) {
  if (!(time in this.times)) return false;
  if (!(key in ObjectNode.rels) || !(key in this.times[time])) return false;
  return this.times[time][key].some((function(rel) {
    return rel.other === other.obj && (rel.get_activity() >= pbpSettings.activation_threshold) == active;
  }).bind(this));
};

/// Perceives all object attributes and all relations to all other objects
/// in the scene at the current situation and saves the results under the
/// passed time.
ObjectNode.prototype.perceive = function(time) {
  var res = {};
  for (var a in ObjectNode.attrs) {
    var attr = ObjectNode.attrs[a];
    res[a] = new attr(this.obj, this.scene_node);
  }
  for (var r in ObjectNode.rels) {
    var rel = ObjectNode.rels[r];
    res[r] = [];
    var objs = this.scene_node.objs;
    for (var i=0; i<objs.length; i++) {
      if (objs[i] == this) continue;
      if (typeof(GroupNode) != 'undefined' && objs[i] instanceof GroupNode) {
        if (rel.ObjectToGroup) res[r].push(rel.ObjectToGroup(this.obj, objs[i].objs, this.scene_node));
      } else if (objs[i] instanceof ObjectNode) {
        res[r].push(new rel(this.obj, objs[i].obj, this.scene_node));
      }
    }
    if (res[r].length == 0) delete res[r];
  }
  this.times[time] = res;
}

/// Dynamically retrieves and caches an attribute or feature. Optionally pass the time
/// as `time` field in the `opts` object. When getting a relationship feature, pass the
/// other ObjectNode as `other` field in `opts`.
/// To just get a perception from the cache and return false if its not there, put
/// `cache_only: true` in the `opts`.
ObjectNode.prototype.get = function(key, opts) {
  if (key in ObjectNode.attrs) return this.getAttr(key, opts);
  else if (key in ObjectNode.rels) return this.getRel(key, opts);
  else throw "unknown feature '" + key + "'";
}

ObjectNode.prototype.getFromCache = function(key, opts) {
  opts = opts || {};
  opts.cache_only = true;
  return this.get(key, opts);
}

/// Returns the attribute named `key`. If given, the `time` in the `opts` object is used,
/// otherwise the current state of the oracle is used. If the oracle is in no named state,
/// the perceived attribute is not cached, otherwise its returned if in cache or perceived,
/// cached and returned if not in cache.
ObjectNode.prototype.getAttr = function(key, opts) {
  var o = PBP.extend({}, opts);
  // if time was not passed, use the current state of the oracle
  if (!o.time) o.time = this.scene_node.oracle.curr_state;
  if (ObjectNode.attrs[key].constant) o.time = 'start';
  // if the attr is cached, just return it
  if ((o.time in this.times) && (key in this.times[o.time])) {
    var res = this.times[o.time][key];
    //this.dispatchEvent('retrieved', {percept: res, target: this, time: o.time});
    return res;
  }
  if (o.cache_only) return false;
  // otherwise, goto the state and perceive it
  if (o.time) this.scene_node.oracle.gotoState(o.time);
  var res = new ObjectNode.attrs[key](this.obj);
  // cache it, if the state is a known one
  if (o.time) {
    if (!this.times[o.time]) this.times[o.time] = {};
    this.times[o.time][key] = res;
  }
  //this.dispatchEvent('perceived', {percept: res, target: this, time: o.time});
  return res;
}

/// Returns the relationship named `key` with the `other` object node in the `opts` object.
/// If given, the `time` in the `opts` object is used,
/// otherwise the current state of the oracle is used. If the oracle is in no named state,
/// the perceived relationship is not cached, otherwise its returned if in cache or perceived,
/// cached and returned if not in cache.
/// If opts.get_all is set, the method will return an array of all relationships
/// that were perceived for the object so far. Use only in combination with opts.cache_only!
ObjectNode.prototype.getRel = function(key, opts) {
  var o = PBP.extend({}, opts);
  // if time was not passed, use the current state of the oracle
  if (!o.time) o.time = this.scene_node.oracle.curr_state;
  if (ObjectNode.rels[key].constant) o.time = 'start';
  // if the rel is cached, return it
  if ((o.time in this.times) && (key in this.times[o.time])) {
    var cache = this.times[o.time][key];
    if (o.get_all) return cache;
    var res = cache.filter(function (rel) { return rel.other === o.other.obj })[0];
    if (res) {
      //this.dispatchEvent('retrieved', {percept: res, target: this, time: o.time});
      return res;
    }
  }
  if (o.cache_only) return o.get_all ? [] : false;
  // otherwise, goto the state and perceive it
  if (o.time) this.scene_node.oracle.gotoState(o.time);
  var res = new ObjectNode.rels[key](this.obj, o.other.obj);
  // cache it, if the state is a known one
  if (o.time) {
    if (!this.times[o.time]) this.times[o.time] = {};
    if (!this.times[o.time][key]) this.times[o.time][key] = [];
    this.times[o.time][key].push(res);
  }
  //this.dispatchEvent('perceived', {percept: res, target: this, time: o.time
  //                                ,other: o.other});
  return res;
}

/// Returns a human readable description of the active attribute and relationship labels for
/// each object at each of the recorded times. If there are two times, 'start' and 'end', values
/// that don't change are summarized and shown first.
ObjectNode.prototype.describe = function(prefix) {
  prefix = prefix || '';
  var res = [prefix + 'Obj. ' + this.obj.id + ':'];
  var times = d3.keys(this.times);
  for (var time in this.times) res.push(prefix + this.describeState(time, '  '));
  return res.join("\n");
}

/// Returns a human readable description of the passed time (see the `describe` method).
ObjectNode.prototype.describeState = function(time, prefix) {
  prefix = prefix || '';
  var out = [];
  for (var a in ObjectNode.attrs) {
    var attr = this.times[time][a];
    if (!attr) continue;
    var active = attr.get_activity() >= 0.5;
    out.push((active ? '' : '!') + attr.get_label());
  }
  for (var r in ObjectNode.rels) {
    var rels = this.times[time][r];
    if (!rels) continue;
    for (var i=0; i<rels.length; i++) {
      if (!rels[i]) continue;
      var active = rels[i].get_activity() >= 0.5;
      out.push((active ? '' : '!') + rels[i].get_label() + ' ' + rels[i].other.id);
    }
  }
  return prefix + time + ": " + out.join(', ');
};
/// Copyright by Erik Weitnauer, 2013.

/// A SceneNode is a collection of several objects.
SceneNode = function(scene, oracle) {
  this.scene = scene;
  this.side = scene.side;
  this.id = scene.name || ('s'+Math.round(Math.random()*10000));
  this.oracle = oracle;
  this.objs = [];      // list of objects in the scene
  this.groups = [];    // list of object groups in the scene
  this.ground = null;
  this.frame = null;
  this.collisions = []; // list of collisions
  this.times = ['start', 'end'];
  this.init();
}

SceneNode.prototype.getAllGroup = function() {
  return GroupNode.sceneGroup(this);
}

SceneNode.prototype.init = function() {
  var movables = [], shapes = this.scene.shapes;
  for (var i=0; i<shapes.length; i++) {
    if (shapes[i].movable) movables.push(shapes[i]);
    else if (shapes[i].id == '_') this.ground = shapes[i];
    else if (shapes[i].id == '|') this.frame = shapes[i];
  }
}

/// Creates an empty ObjectNode for each shape in the scene that does not have an
/// associated ObjectNode yet.
SceneNode.prototype.registerObjects = function() {
  var movables = this.scene.shapes.filter(function(s) { return s.movable });
  for (var i=0; i<movables.length; i++) {
    if (!movables[i].object_node) this.objs.push(new ObjectNode(this, movables[i]));
  }
  if (this.ground && !this.ground.object_node)
    this.ground.object_node = new ObjectNode(this, this.ground);
}

/// Records the start state, simulates till the end state while recording all
/// collisions and records the end state.
SceneNode.prototype.perceiveCollisions = function() {
  this.oracle.gotoState("start");
  this.collisions = this.oracle.observeCollisions();
  // replace physical objects with shapes
  for (var i=0; i<this.collisions.length; i++) {
    this.collisions[i].a = this.collisions[i].a.master_obj;
    this.collisions[i].b = this.collisions[i].b.master_obj;
  }
}

/// Returns an SceneNode instance, which is the perception of the passed scene.
/// For now brute force: All movable objects in the scene are automatically
/// with all their attributes and relationships with each other for one snapshot
/// at the beginning and one snapshot at the end of time.
SceneNode.prototype.perceiveAll = function() {
  this.perceiveCollisions();
  for (var t=0; t<this.times.length; t++) {
    this.oracle.gotoState(this.times[t]);
    this.perceiveCurrent(this.times[t]);
  }
}

SceneNode.prototype.perceiveCurrent = function(state_name) {
  state_name = state_name || 'current';
  this.registerObjects();
  for (var i=0; i<this.objs.length; i++) this.objs[i].perceive(state_name);
}

/// Returns a human readable description of the scene.
SceneNode.prototype.describe = function(prefix) {
  prefix = prefix || '';
  var res = [prefix+'Objects:'];
  for (var i=0; i<this.objs.length; i++) {
    res.push(this.objs[i].describe(prefix+'  '));
  };
  res.push(prefix+'Collisions:');
  for (var i=0; i<this.collisions.length; i++) {
    var c = this.collisions[i];
    res.push(prefix + '  ' + c.a.id + ' hits ' + c.b.id);
  };
  return res.join("\n");
}
// Copyright 2014, Erik Weitnauer.

/** The Selector is used to focus on a subset of objects in a scene based on
 * a number of attributes and relations that must be fullfilled.
 * The selector can either have group or object attributes & relationships.
 * For obj. attrs, select() collects all matching objects inside a new group.
 * For group attrs, select() will return the whole group if it matches or
 * an empty group if it does not match.
 * The selector can be in unique mode, which means that result groups with more
 * than one element are returned as empty groups instead. */

 // FIXME: unique is not doing what is described above. Instead, it is only
 // used in the RelMatcher to decide whether to match all or exactly one of the
 // things we relate to.
var Selector = function(unique) {
	this.obj_attrs = [];	  // object attributes
	this.grp_attrs = [];	  // group attributes
	this.rels = [];         // object relationships
	this.unique = !!unique;

	this.cached_complexity = null;
}

/// Can be 'object', 'group' or 'mixed'. A blank selector is of 'object' type.
Selector.prototype.getType = function() {
	if (this.blank()) return 'object';
	if (this.grp_attrs.length === 0) return 'object';
	if (this.obj_attrs.length === 0 && this.rels.length === 0) return 'group';
	return 'mixed';
}

Selector.prototype.getComplexity = function() {
	var c = 0;
	for (var i=0; i<this.obj_attrs.length; i++) {
	  c += this.obj_attrs[i].getComplexity();
	}
	for (var i=0; i<this.grp_attrs.length; i++) {
	  c += this.grp_attrs[i].getComplexity();
	}
	for (var i=0; i<this.rels.length; i++) {
	  c += this.rels[i].getComplexity();
	}
	if (this.cached_complexity === null) this.cached_complexity = c;
	if (this.cached_complexity !== c) throw "cached complexity got stale!";
	return c;
}

/// Returns true if the selector has no matchers and will therefore match anything.
Selector.prototype.blank = function() {
	return (this.obj_attrs.length === 0
	     && this.grp_attrs.length === 0
	     && this.rels.length === 0)
}

Selector.prototype.hasRelationships = function() {
	return this.rels.length > 0;
}

Selector.prototype.featureCount = function() {
	return this.obj_attrs.length + this.grp_attrs.length + this.rels.length;
}

/// Calls the passed function once for each feature that is part of the
/// selector.
Selector.prototype.forEachFeature = function(fn) {
	var i;
	for (i=0; i<this.obj_attrs.length; i++)
		fn(pbpSettings.obj_attrs[this.obj_attrs[i].key]);
	for (i=0; i<this.grp_attrs.length; i++)
		fn(pbpSettings.group_attrs[this.grp_attrs[i].key]);
	for (i=0; i<this.rels.length; i++) {
		fn(pbpSettings.obj_rels[this.rels[i].key]);
		this.rels[i].other_sel.forEachFeature(fn);
	}
}

/** Returns a new selector that has all attributes from this and the passed selector.
 * In the case of a duplicate feature, the feature of the passed selector is used. */
Selector.prototype.mergedWith = function(other_sel) {
	var sel = new Selector();
	var add_attr = function(attr) { sel.add_attr(attr) };
	var add_rel = function(rel) { sel.add_rel(rel) };

	this.obj_attrs.forEach(add_attr);
	other_sel.obj_attrs.forEach(add_attr);
	this.grp_attrs.forEach(add_attr);
	other_sel.grp_attrs.forEach(add_attr);
	this.rels.forEach(add_rel);
	other_sel.rels.forEach(add_rel);

	return sel;
}

Selector.prototype.clone = function() {
	var sel = new Selector(this.unique);
	var add_attr = function(attr) { sel.add_attr(attr) };
	var add_rel = function(rel) { sel.add_rel(rel) };
	this.obj_attrs.forEach(add_attr);
	this.grp_attrs.forEach(add_attr);
	this.rels.forEach(add_rel);
	return sel;
}

/// Will extract the attribute's key, label, activation and constant property. Pass the time
/// at which the attribute values should match (default: 'start').
Selector.prototype.use_attr = function(attr, time) {
	this.add_attr(Selector.AttrMatcher.fromAttribute(attr, time));
	return this;
};

/// Adds the passed AttrMatcher. Will replace if an attr with the same key and
/// time is in the list already.
Selector.prototype.add_attr = function(attr_matcher) {
	var attrs = (attr_matcher.type === 'group') ? this.grp_attrs : this.obj_attrs;
	// if we have an attr of same type, replace
	for (var i=0; i<attrs.length; i++) {
		var attr = attrs[i];
	  if (attr.key === attr_matcher.key
	     && attr.time === attr_matcher.time
	  	 && attr.type === attr.type) {
	  	attrs[i] = attr_matcher;
	  	return this;
	  }
	}
	// its new, add to list
	attrs.push(attr_matcher);
	return this;
};

/// Will extract the relation key, label, activation, constant and symmetry properties. Pass the time
/// at which the attribute values should match (default: 'start'). Pass a selector that selects the other
/// object.
Selector.prototype.use_rel = function(other_sel, rel, time) {
	this.add_rel(Selector.RelMatcher.fromRelationship(other_sel, rel, time));
	return this;
};

/// Adds the passed RelMatcher. Will replace if a rel with the same key, target object
/// and time is in the list already.
Selector.prototype.add_rel = function(rel_matcher) {
	// if we have an attr of same type, replace
	for (var i=0; i<this.rels.length; i++) {
		var rel = this.rels[i];
	  if (rel.key === rel_matcher.key && rel.time == rel_matcher.time &&
	  	  rel.other_sel.equals(rel_matcher.other_sel)) {
	  	this.rels[i] = rel_matcher;
	  	return this;
	  }
	}
	// its new, add to list
	this.rels.push(rel_matcher);
	return this;
};

/// Returns true if the passed other selector has the same relationships and attributes.
/// They might be in a different order.
Selector.prototype.equals = function(other) {
	if (!other) return false;
	if (this === other) return true;
	if (this.obj_attrs.length !== other.obj_attrs.length) return false;
	if (this.grp_attrs.length !== other.grp_attrs.length) return false;
	if (this.rels.length !== other.rels.length) return false;
	var self = this;
	var differs = function(field) {
		return (!self[field].every(function (ours) {
			return other[field].some(function (theirs) {
		  	return ours.equals(theirs)
			})
		}))
	}
	if (differs('grp_attrs') || differs('obj_attrs') || differs('rels')) return false;
	return true;
}

/// Returns true if the passed object node matches the selector's object
/// attributes and relations. Optionally, an array of nodes that will be
/// condisered as relationship partners can be passed as second parameter. If
/// it isn't, all objects in the scene except `object` are used. If a test_fn
/// is passed, it is called for each node that matches the selector attributes
/// and only if the function returns true, the node is used. The relationships
/// of the selector are not used in this case.
Selector.prototype.matchesObject = function(object, others, test_fn) {
	return this.obj_attrs.every(function (attr) { return attr.matches(object) }) &&
				 (test_fn ? test_fn(object)
				 	        : this.rels.every(function (rel) { return rel.matches(object, others) }));
};

/// Returns true if the passed group node matches the selector's group attributes.
Selector.prototype.matchesGroup = function(group) {
	return this.grp_attrs.every(function (attr) { return attr.matches(group) });
};

/// Returns a group node. If a test_fn is passed, it is called for each object
/// node that matches the selector attributes and only if the function returns
/// true, the node is used. The relationships of the selector are not used in
/// this case.
Selector.prototype.select = function(group_node, scene_node, test_fn) {
	if (this.blank()) return group_node;

	var selector = this.mergedWith(group_node.selectors[0]);
	var gn = group_node.clone();
	var type = this.getType();
	var self = this;
	gn.selectors = [selector];
	// first apply object-level features
	if (type === 'mixed' || type === 'object') {
		var nodes = gn.objs
	  	.map(function (obj) { return obj.object_node })
	  	.filter(function (node) { return self.matchesObject(node, null, test_fn) })
	  	.map(function (on) { return on.obj });

		gn = new GroupNode(scene_node, nodes, selector);
	}
	// then apply group-level features
	if (type === 'mixed' || type === 'group') {
		if (!this.matchesGroup(gn)) gn = new GroupNode(scene_node, [], selector);
	}
	return gn;
};

Selector.prototype.applyToScene = function(scene) {
	var group = this.select(GroupNode.sceneGroup(scene), scene);
	group.selectors = [this];
	return group;
}

/// Returns a human readable description of the attributes used in this selector.
Selector.prototype.describe = function() {
	if (this.blank()) return (this.unique ? '[the object]' : '(any object)');
	var attrs = this.obj_attrs.map(function (attr) { return attr.describe() }).join(" and ");
	var grp_attrs = this.grp_attrs.map(function (attr) { return attr.describe() });
	var rels = this.rels.map(function (rel) { return rel.describe() });
	rels = rels.concat(grp_attrs).join(" and ");

	if (this.unique) return '[the ' + attrs + ' object' + (rels === '' ? '' : ' that is ' + rels) + ']';
	return '(' + attrs + ' objects' + (rels === '' ? '' : ' that are ' + rels) + ')';
};

Selector.prototype.describe2 = function(omit_mode) {
	if (this.blank()) {
	 	if (omit_mode) return '*';
	 	return (this.unique ? 'there is exactly one object' : 'any object');
	}
	var attrs = this.obj_attrs.map(function (attr) { return attr.describe() });
	var grp_attrs = this.grp_attrs.map(function (attr) { return attr.describe() }).join(" and ");
	var rels = this.rels.map(function (rel) { return rel.describe() });
	var res = attrs.concat(rels).concat(grp_attrs).join(" and ");
	if (omit_mode) {
	 	if (this.unique) return '[that is ' + res + ']';
	 	else return '[that are ' + res + ']';
	} else {
	 	if (this.unique) return '[exactly one object is ' + res + ']';
	 	else return '(objects that are ' + res + ')';
	}
};



Selector.AttrMatcher = function(key, label, active, time, type) {
	this.key = key;
	this.label = label;
	this.active = typeof(active) === 'undefined' ? true : active;
	if (key in pbpSettings.obj_attrs) {
		this.type = "object";
		this.constant = pbpSettings.obj_attrs[key].prototype.constant;
	} else {
		this.type = "group";
		this.constant = pbpSettings.group_attrs[key].prototype.constant;
	}
	this.time = time || 'start';
}

Selector.AttrMatcher.prototype.clone = function() {
	return new Selector.AttrMatcher( this.key, this.label, this.active
		                             , this.time, this.type);
}

/// Will extract the attribute's key, label, activation and constant property. Pass the time
/// at which the attribute values should match (default: 'start').
Selector.AttrMatcher.fromAttribute = function(attr, time) {
	return new Selector.AttrMatcher(
		attr.key, attr.get_label()
	 ,attr.get_activity() >= pbpSettings.activation_threshold
	 ,time);
}

Selector.AttrMatcher.prototype.getComplexity = function() {
	var c = 1;
	if (this.time !== 'start') c++;
	if (!this.active) c += 2;
	return c;
}

/// Returns true if the other AttrMatcher is the same as this one.
Selector.AttrMatcher.prototype.equals = function(other) {
	return (this.key === other.key && this.label === other.label &&
	        this.active === other.active && this.time === other.time);
}

/// Returns true if the passed node can supply the attribute and its activation and
/// label match.
Selector.AttrMatcher.prototype.matches = function(node) {
	var attr = node.getAttr(this.key, {time: this.time});
	if (!attr) return false;
	//console.log(this.key,'has activity',attr.get_activity());
	var active = attr.get_activity() >= pbpSettings.activation_threshold;
	return (active == this.active && attr.get_label() == this.label);
}

Selector.AttrMatcher.prototype.describe = function() {
	return (this.active ? '' : 'not ') + this.label +
				 (this.constant || this.time == "start" ? '' : ' at the ' + this.time);
}

/// CAUTION: other_sel is not allowed to use RelMatchers, itself! Otherwise
/// we could get into infinite recursion!
Selector.RelMatcher = function(other_sel, key, label, active, time) {
	this.other_sel = other_sel;
	this.key = key;
	this.label = label;
	this.active = typeof(active) === 'undefined' ? true : active;
	this.constant = pbpSettings.obj_rels[key].prototype.constant;
	this.symmetric = pbpSettings.obj_rels[key].prototype.symmetric;
	this.time = time || 'start';
}

Selector.RelMatcher.prototype.clone = function() {
	return new Selector.RelMatcher( this.other_sel, this.key, this.label
		                            , this.active, this.time);
}

Selector.RelMatcher.prototype.getComplexity = function() {
	var c = 1;
	if (this.time !== 'start') c++;
	if (!this.active) c += 2;
	c += this.other_sel.getComplexity();
	return c;
}

/// Returns true if the other RelMatcher is the same as this one.
Selector.RelMatcher.prototype.equals = function(other) {
	return (this.key === other.key && this.label === other.label &&
	        this.active === other.active && this.time === other.time &&
	        this.other_sel.equals(other.other_sel));
}

/// First uses its 'other' selector on the passed 'others' array of nodes. Returns true
/// if the passed 'node' can supply the relationship to any of the selected nodes and
/// the activation and label match.
/// If others is not passed, all nodes in the scene except the 'node' are used.
Selector.RelMatcher.prototype.matches = function(node, others) {
	if (this.other_sel.rels.length > 0) throw "the other-selector of"
	// select all other nodes in the scene as 'others', if they were not passed
	others = others || node.scene_node.objs.filter(function (on) { return on !== node });

	var self = this;

	var test_fn = function(other) {
		if (other === node) return false;
		var rel = node.getRel(self.key, {other: other, time: self.time});
		if (!rel) return false;
	  var active = rel.get_activity() >= pbpSettings.activation_threshold;
		return (active == self.active && rel.get_label() == self.label);
	}

	var match_fn = function(other) {
		return self.other_sel.matchesObject(other, null, test_fn);
	}

	var matching_others = others.filter(match_fn);

	if (!this.active) return matching_others.length === others.length;
	if (this.other_sel.unique && matching_others.length != 1) return false;
	return matching_others.length > 0;
}

/// Will extract the relation key, label, activation, constant and symmetry properties. Pass the time
/// at which the attribute values should match (default: 'start'). Pass a selector that selects the other
/// object.
Selector.RelMatcher.fromRelationship = function(other, rel, time) {
	return new Selector.RelMatcher(
		other, rel.key, rel.get_label()
	 ,rel.get_activity() >= pbpSettings.activation_threshold
	 ,time);
}

Selector.RelMatcher.prototype.describe = function() {
	return (this.active ? '' : 'not ') + this.label + " " +
				 this.other_sel.describe() +
				 (this.constant || this.time == "start" ? '' : ' at the ' + this.time);
}// Copyright 2014, Erik Weitnauer.

/// Holds an array of selectors.
/// Can be in one of 3 different modes: 'unique', 'exists', 'all'
/// (the default is 'exists').
/// main_side is either 'left', 'right', 'both'
Solution = function(selector, main_side, mode) {
	this.sel = selector;
	this.mode = mode || 'exists';
	this.setMainSide(main_side);
	this.matchedAgainst = [];
	this.lchecks = 0;
	this.rchecks = 0;
	this.lmatches = 0;
	this.rmatches = 0;
	this.scene_pair_count = 8;
	this.selects_single_objs = true;
}

Solution.prototype.setMainSide = function (main_side) {
	this.main_side = main_side || 'both';
	this.other_side = {left: 'right', right: 'left'}[this.main_side];
  return this;
}

Solution.prototype.wasMatchedAgainst = function(scene_pair_id) {
	return this.matchedAgainst.indexOf(scene_pair_id) !== -1;
}

Solution.prototype.isSolution = function() {
	return ( this.rmatches === 0 && this.lmatches == this.scene_pair_count
	      || this.lmatches === 0 && this.rmatches == this.scene_pair_count);
}

/// Returns whether combining this with the passed solution could in principle
/// be a solution.
Solution.prototype.compatibleWith = function(other) {
	if (this.lmatches < this.lchecks && other.rmatches < other.rchecks) return false;
	if (this.rmatches < this.rchecks && other.lmatches < other.lchecks) return false;
	return true;
}

Solution.prototype.checkScenePair = function(pair, pair_id) {
  var self = this;
  var selected_groups = [];
  pair.forEach(function (scene) {
  	var res_group = self.sel.applyToScene(scene);
    selected_groups.push(res_group);
    if (res_group.objs.length > 1) self.selects_single_objs = false;
    var matches = !res_group.empty();
    if (scene.side === 'left') {self.lchecks++; if (matches) self.lmatches++ }
    if (scene.side === 'right') {self.rchecks++; if (matches) self.rmatches++ }
  });
  this.matchedAgainst.push(pair_id);

  if (this.lmatches === 0 && this.rmatches === this.rchecks) this.setMainSide('right');
  else if (this.rmatches === 0 && this.lmatches === this.lchecks) this.setMainSide('left');
  else if (this.lmatches > 0 && this.rmatches === this.rchecks) this.setMainSide('both');
  else if (this.rmatches > 0 && this.lmatches === this.lchecks) this.setMainSide('both');
  else this.setMainSide('fail');

  return selected_groups;
}

Solution.prototype.check = function(scenes_l, scenes_r) {
	if (this.side !== 'left' && this.side !== 'right') return false;

	var main_scenes  = this.main_side == 'left'  ? scenes_l : scenes_r
	   ,other_scenes = this.main_side == 'right' ? scenes_l : scenes_r;

	return (main_scenes.every(this.check_scene.bind(this))
		     && !other_scenes.some(this.check_scene.bind(this)));
}

Solution.prototype.equals = function(other) {
	return (this.mode === other.mode
	     && this.sel.equals(other.sel));
}

Solution.prototype.mergedWith = function(other) {
	var mode = (this.mode === other.mode ? mode : 'exists');
	var side;
	if (other.main_side === this.main_side) side = this.main_side;
	else if (this.main_side === 'both') side = other.main_side;
	else if (other.main_side === 'both') side = this.main_side;
	else return null; // incompatible sides
	return new Solution(this.sel.mergedWith(other.sel), side, mode);
}

Solution.prototype.clone = function() {
	return new Solution(this.sel.clone(), this.main_side, this.mode);
}

/// Returns a group node that contains all objects that match the solution
/// in the passed scene.
Solution.prototype.applyToScene = function(scene) {
	if (this.main_side === 'left' && scene.side !== 'left') return new GroupNode(null, [], this.sel);
	if (this.main_side === 'right' && scene.side !== 'right') return new GroupNode(null, [], this.sel);
	return this.sel.applyToScene(scene);
}

/// Applies all selectors consecutively to the scene and checks
/// whether the resulting group of objects fits the mode of the
/// solution. If so it returns the number of objects in the resulting
/// group node, otherwise it returns false.
Solution.prototype.check_scene = function(scene) {
	var group0 = GroupNode.sceneGroup(scene);
	var group1 = this.sel.select(group0, scene);
	var N = group1.objs.length;
	var res = false;
	if (this.mode == 'unique' && N == 1) res = 1;
	else if (this.mode == 'exists' && N > 0) res = N;
	else if (this.mode == 'all' && N > 0 &&
	    group0.objs.length == N) res = N;
	scene.fits_solution = !!res;
	return res;
}

/// Returns a human readable description of the solution.
Solution.prototype.describe = function() {
	var str = "";
	if (this.main_side) str += this.main_side === 'both' ? "In all scenes, " : "Only in the " + this.main_side + " scenes, ";
	str += this.mode + ': ' + this.sel.describe();
	return str;
};
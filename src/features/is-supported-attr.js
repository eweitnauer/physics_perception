/// Reflects whether an object is supported by other objects. We'll turn all
/// other objects static and then check whether this object moves at the moment
/// or will be moving 0.1 seconds in the future. The activation is 0.5 for a
/// linear velocity of 0.1.
IsSupportedAttribute = function(obj) {
  this.perceive(obj);
}
IsSupportedAttribute.prototype.key = 'is_supported';
IsSupportedAttribute.prototype.targetType = 'obj';
IsSupportedAttribute.prototype.arity = 1;
IsSupportedAttribute.prototype.constant = false;

// google: "plot from -0.5 to 5, 1/(1+exp(40*(0.1-x)))"
IsSupportedAttribute.membership = function(lin_vel) {
  var a = 40; // steepness of sigmoid function
  var m = 0.1; // linear velocity at which sigmoid is 0.5
  return 1/(1+Math.exp(a*(m-lin_vel)));
}

IsSupportedAttribute.prototype.perceive = function(obj) {
  var oracle = obj.object_node.scene_node.oracle;
  function before_sim() {
    oracle.pscene.forEachDynamicBody(function(body) {
      if (body === obj.phys_obj) return;
      body.SetType(Box2D.Dynamics.b2Body.b2_staticBody);
    });
  }
  function after_sim() {
    this.val_soon = body.m_linearVelocity.Length();
  }
  this.obj = obj;
  // vel. right now
  var body = obj.phys_obj;
  this.val = body.m_linearVelocity.Length();
  // vel. in 0.1 seconds
  oracle.analyzeFuture(0.1, before_sim, after_sim.bind(this));
}

IsSupportedAttribute.prototype.get_activity = function() {
  return 1-Math.max(IsSupportedAttribute.membership(this.val), IsSupportedAttribute.membership(this.val_soon));
}

IsSupportedAttribute.prototype.get_label = function() {
  return 'is-supported';
}

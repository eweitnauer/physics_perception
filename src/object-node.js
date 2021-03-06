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

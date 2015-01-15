'use strict';
var Readable = require('readable-stream');
var Transform = Readable.Transform;
var inherits = require('inherits');
var defined = require('defined');
var nub = require('nub');
var path = require('path');

function Factor (files, opts) {
  var self = this;
  if (!(this instanceof Factor)) return new Factor(files, opts);
  Transform.call(this, { objectMode: true });

  if (!opts) opts = {};
  if (!files) files = [];
  this.basedir = defined(opts.basedir, process.cwd());

  this._streams = {};
  this._groups = {};
  this._buffered = {};

  this._ensureCommon = {};
  this._files = files.reduce(function (acc, file) {
    acc[path.resolve(self.basedir, file)] = true;
    return acc;
  }, {});
  this._rmap = opts.rmap || {};

  this._thresholdVal = typeof opts.threshold === 'number'
    ? opts.threshold : 1;
  this._defaultThreshold = function(row, group) {
    return group.length > this._thresholdVal || group.length === 0;
  };
  this._threshold = typeof opts.threshold === 'function'
    ? opts.threshold
    : this._defaultThreshold;
}

inherits(Factor, Transform);

Factor.prototype._transform = function (row, enc, next) {
  var self = this;
  var groups = nub(self._groups[row.id] || []);
  var id = this._resolveMap(row.id);

  if (self._files[id]) {
    var s = self._streams[id];
    if (!s) s = self._makeStream(row);
    groups.push(id);
  }
  groups.forEach(addGroups);

  if (self._ensureCommon[row.id] || self._threshold(row, groups)) {
    Object.keys(row.deps || {}).forEach(function(k) {
      self._ensureCommon[row.deps[k]] = true;
    });
    self.push(row);
  } else {
    groups.forEach(function (id) {
      self._streams[id].push(row);
    });
  }

  next();

  function addGroups (gid) {
    Object.keys(row.deps || {}).forEach(function (key) {
      var file = row.deps[key];
      var g = self._groups[file];
      if (!g) g = self._groups[file] = [];
      g.push(gid);
    });
  }
};

Factor.prototype._flush = function () {
  var self = this;

  Object.keys(self._streams).forEach(function (key) {
    self._streams[key].push(null);
  });
  self.push(null);
};

Factor.prototype._makeStream = function (row) {
  var s = new Readable({ objectMode: true });
  var id = this._resolveMap(row.id);
  s.file = id;
  s._read = function () {};
  this._streams[id] = s;
  this.emit('stream', s);
  return s;
};

Factor.prototype._resolveMap = function(id) {
  return this._rmap[id] || id;
};

module.exports = Factor;

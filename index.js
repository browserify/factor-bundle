var Transform = require('stream').Transform;
var Readable = require('stream').Readable;
var inherits = require('inherits');
var path = require('path');
var JSONStream = require('JSONStream');
var combine = require('stream-combiner');

module.exports = function (files, opts) {
    if (!opts) opts = {};
    if (opts.objectMode) return new Factor(files, opts);
    
    var fr = new Factor(files, opts);
    var parse = JSONStream.parse([true]);
    var dup = opts.raw
        ? combine(parse, fr)
        : combine(parse, fr, JSONStream.stringify())
    ;
    
    parse.on('error', function (err) { dup.emit('error', err) });
    fr.on('error', function (err) { dup.emit('error', err) });
    fr.on('stream', function (s) {
        if (opts.raw) dup.emit('stream', s)
        else dup.emit('stream', s.pipe(JSONStream.stringify()))
    });
    return dup;
};
inherits(Factor, Transform);

function Factor (files, opts) {
    var self = this;
    if (!(this instanceof Factor)) return new Factor(files, opts);
    Transform.call(this, { objectMode: true });
    
    if (!opts) opts = {};
    this.basedir = opts.basedir || process.cwd();
    
    this._streams = {};
    this._deps = {};
    this._buffered = {};
    this._files = files.reduce(function (acc, file) {
        acc[path.resolve(self.basedir, file)] = true;
        return acc;
    }, {});
    
    this._threshold = opts.threshold === undefined ? 1 : opts.threshold;
}

Factor.prototype._transform = function (row, enc, next) {
    var self = this;
    if (this._files[row.id]) {
        var s = this._streams[row.id];
        if (!s) s = this._makeStream(row);
        
        Object.keys(row.deps || {}).forEach(function (key) {
            var v = row.deps[key];
            if (!self._deps[v]) self._deps[v] = [];
            self._deps[v].push(row.id);
        });
        
        s.push(row);
    }
    else if (this._deps[row.id]) {
        this._buffered[row.id] = row;
    }
    else this.push(row);
    
    next();
};

Factor.prototype._flush = function () {
    var self = this;
    
    Object.keys(self._buffered).forEach(function (key) {
        var row = self._buffered[key];
        
        if (self._deps[key].length > 1) {
            self.push(row);
        }
        else self._deps[key].forEach(function (id) {
            self._streams[id].push(row);
        });
    });
    
    Object.keys(self._streams).forEach(function (key) {
        self._streams[key].push(null);
    });
    self.push(null);
};

Factor.prototype._makeStream = function (row) {
    var s = new Readable({ objectMode: true });
    s.file = row.id;
    s._read = function () {};
    this._streams[row.id] = s;
    this.emit('stream', s);
    return s;
};

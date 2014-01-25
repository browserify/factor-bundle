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
    this._groups = {};
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
        s.push(row);
        
        addGroups(row.id);
    }
    else if (this._groups[row.id]) {
        this._buffered[row.id] = row;
        this._groups[row.id].forEach(addGroups);
    }
    else this.push(row);
    
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
    
    Object.keys(this._buffered).forEach(function (file) {
        var row = self._buffered[file];
        var groups = self._groups[file];
        
        if (groups.length > self._threshold) {
            self.push(row);
        }
        else {
            groups.forEach(function (id) {
                self._streams[id].push(row);
            });
        }
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

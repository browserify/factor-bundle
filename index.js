var Transform = require('stream').Transform;
var through = require('through');
var Readable = require('stream').Readable;
var inherits = require('inherits');
var path = require('path');
var JSONStream = require('JSONStream');
var combine = require('stream-combiner');
var nub = require('nub');
var depsTopoSort = require('deps-topo-sort');
var reverse = require('reversepoint');
var fs = require('fs');
var wrap = require('./lib/wrap.js');
var pack = require('browser-pack');

module.exports = function f (b, opts) {
    if (!opts) opts = {};
    if (typeof b === 'string' || Array.isArray(b)) {
        return createStream(b, opts)
    }
    else if (b._pending) {
        b.on('_ready', function () {
            var s = f(b, opts)
            s.on('data', function (buf) { tf.push(buf) });
            tf._transform = function (buf, enc, next) {
                s.write(buf);
                next();
            };
            if (buffered) {
                buffered = null;
                s.write(buffered);
            }
            if (next) { next = null; next() }
        });
        var tf = new Transform({ objectMode: true });
        var buffered, next;
        tf._transform = function (buf, enc, next_) {
            buffered = buf;
            next = next_;
        };
        return tf;
    }
    else {
        var files = [].concat(opts.entries).concat(opts.e)
            .concat(opts._).filter(Boolean)
        ;
        if (files.length === 0) files = b._entries;
        var cwd = b._basedir || process.cwd();
        var fileMap = files.reduce(function (acc, x, ix) {
            acc[path.resolve(cwd, x)] = opts.o[ix];
            return acc;
        }, {});
        opts.objectMode = true;
        opts.raw = true;
        
        var s = createStream(files, opts);
        s.on('stream', function (bundle) {
            var ws = fs.createWriteStream(fileMap[bundle.file]);
            var rmap = {};
            bundle.pipe(through(function (row) {
                if (/^\//.test(row.id)) {
                    if (rmap[row.id]) {
                        row.id = rmap[row.id];
                    }
                    else {
                        var rowHash = b._hash(row.id);
                        rmap[row.id] = rowHash;
                        row.id = rowHash;
                    }
                }
                Object.keys(row.deps).forEach(function (key) {
                    var k = row.deps[key];
                    if (hashMap[k]) row.deps[key] = hashMap[k];
                    else if (/^\//.test(k)) {
                        if (!rmap[k]) rmap[k] = b._hash(row.id);
                        row.deps[key] = rmap[k];
                    }
                });
                this.queue(row);
            })).pipe(pack({ raw: true })).pipe(wrap()).pipe(ws);
        });

        var hashMap = {};
        s.on('data', function (row) {
            hashMap[row.id] = b.exports[row.id] = b._hash(row.id);
        });
        
        var deps = b.deps;
        b.deps = function (opts) {
            return deps.call(b, opts).pipe(s);
        };
        
        var bundle = b.bundle;
        b.bundle = function () {
            var s = bundle.apply(this, arguments);
            if (!s.unshift) s = new Readable().wrap(s);
            s.unshift('require=');
            return s;
        };
        return s;
    }
};

function createStream (files, opts) {
    if (!opts) opts = {};
    
    var fr = new Factor(files, opts);
    var parse, dup;
    
    if (opts.objectMode) {
        dup = combine(depsTopoSort(), reverse(), fr);
    }
    else {
        parse = JSONStream.parse([true]);
        dup = opts.raw
            ? combine(parse, depsTopoSort(), reverse(), fr)
            : combine(
                parse, depsTopoSort(), reverse(), fr, JSONStream.stringify()
            )
        ;
        parse.on('error', function (err) { dup.emit('error', err) });
    }
    
    fr.on('error', function (err) { dup.emit('error', err) });
    fr.on('stream', function (s) {
        if (opts.raw) dup.emit('stream', s)
        else dup.emit('stream', s.pipe(JSONStream.stringify()))
    });
    return dup;
}

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
    
    this._ensureCommon = {};
    this._files = files.reduce(function (acc, file) {
        acc[path.resolve(self.basedir, file)] = true;
        return acc;
    }, {});
    
    this._thresholdVal = typeof opts.threshold === "number"
        ? opts.threshold : 1
    ;
    this._defaultThreshold = function(row, group) {
        return group.length > this._thresholdVal || group.length === 0;
    };
    this._threshold = typeof opts.threshold === "function"
        ? opts.threshold
        : this._defaultThreshold
    ;
}

Factor.prototype._transform = function (row, enc, next) {
    var self = this;
    var groups = nub(self._groups[row.id] || []);

    if (self._files[row.id]) {
        var s = self._streams[row.id];
        if (!s) s = self._makeStream(row);
        groups.push(row.id);
    }
    groups.forEach(addGroups);

    if (self._ensureCommon[row.id] || self._threshold(row, groups)) {
        Object.keys(row.deps).forEach(function(k) {
            self._ensureCommon[row.deps[k]] = true;
        });
        self.push(row);
    }
    else {
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
    s.file = row.id;
    s._read = function () {};
    this._streams[row.id] = s;
    this.emit('stream', s);
    return s;
};

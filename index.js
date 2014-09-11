var Transform = require('stream').Transform;
var through = require('through2');
var Readable = require('stream').Readable;
var inherits = require('inherits');
var path = require('path');
var JSONStream = require('JSONStream');
var combine = require('stream-combiner');
var nub = require('nub');
var depsTopoSort = require('deps-topo-sort');
var reverse = require('reversepoint');
var fs = require('fs');
var pack = require('browser-pack');
var xtend = require('xtend');
var defined = require('defined');
var splicer = require('labeled-stream-splicer');

module.exports = function f (b, opts) {
    if (!opts) opts = {};
    if (typeof b === 'string' || Array.isArray(b)) {
        return createStream(b, opts)
    }

    var files = [].concat(opts.entries).concat(opts.e)
        .concat(opts._).filter(Boolean);

    var needRecords = !files.length;

    opts.outputs = defined(opts.outputs, opts.o, {});
    opts.objectMode = true;
    opts.raw = true;
    opts.rmap = {};

    var packOpts = xtend(b._options, {
        raw: true,
        hasExports: true
    });

    b.on('reset', addHooks);
    addHooks();

    function addHooks () {
        b.pipeline.get('record').push(through.obj(function(row, enc, next) {
            if (needRecords) {
                files.push(row.file);
            }
            next(null, row);
        }, function(next) {
            var cwd = defined(opts.basedir, b._options.basedir, process.cwd());
            var pipelines = files.reduce(function (acc, x, ix) {
                var pipeline = splicer.obj([
                    'pack', [ pack(packOpts) ],
                    'wrap', []
                ]);
                var output = opts.outputs[ix];
                if (output) {
                    var ws = isStream(output) ? output : fs.createWriteStream(output);
                    pipeline.push(ws);
                }
                acc[path.resolve(cwd, x)] = pipeline;
                return acc;
            }, {});

            // Force browser-pack to wrap the common bundle
            b._bpack.hasExports = true;

            Object.keys(pipelines).forEach(function (id) {
                b.emit('factor.pipeline', id, pipelines[id]);
            });

            var s = createStream(files, opts);
            s.on('stream', function (bundle) {
                bundle.pipe(pipelines[bundle.file]);
            });

            b.pipeline.get('pack').unshift(s);

            if (needRecords) files = [];

            next();
        }));

        b.pipeline.get('label').push(through.obj(function(row, enc, next) {
            opts.rmap[row.id] = row.file;
            next(null, row);
        }));
    }

    return b;

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
    var id = this._resolveMap(row.id);

    if (self._files[id]) {
        var s = self._streams[id];
        if (!s) s = self._makeStream(row);
        groups.push(id);
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
    var id = this._resolveMap(row.id);
    s.file = id;
    s._read = function () {};
    this._streams[id] = s;
    this.emit('stream', s);
    return s;
};

Factor.prototype._resolveMap = function(id) {
    return this._rmap[id] || id;
}

function isStream (s) { return s && typeof s.pipe === 'function' }

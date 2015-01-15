'use strict';
var through = require('through2');
var path = require('path');
var JSONStream = require('JSONStream');
var combine = require('stream-combiner');
var depsTopoSort = require('deps-topo-sort');
var reverse = require('reversepoint');
var fs = require('fs');
var pack = require('browser-pack');
var xtend = require('xtend');
var defined = require('defined');
var splicer = require('labeled-stream-splicer');
var Factor = require('./lib/factor');

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

    var cwd = defined(opts.basedir, b._options.basedir, process.cwd()),
        packOpts = xtend(b._options, {
          raw: true,
          hasExports: true
        });

    b.on('reset', addHooks);
    addHooks();

    function addHooks () {
        b.pipeline.get('record').push(through.obj(function(row, enc, next) {
            if (row.file && needRecords) {
                files.push(row.file);
            }
            next(null, row);
        }, function(next) {
            var pipelines = files.reduce(function (acc, x, ix) {
                var pipeline = splicer.obj([
                    'pack', [ pack(packOpts) ],
                    'wrap', []
                ]);
                var output = opts.outputs[ix];
                if (output) {
                    var ws = isStream(output) ? output : fs.createWriteStream(output);
                    pipeline.pipe(ws);
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
            opts.rmap[row.id] = path.resolve(cwd, row.file);
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

function isStream (s) { return s && typeof s.pipe === 'function' }

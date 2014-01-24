#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var factor = require('../');
var minimist = require('minimist');
var pack = require('browser-pack');

var argv = minimist(process.argv.slice(2));
var basedir = argv.basedir || process.cwd();

var fr = factor(argv._, { raw: true, root: basedir });
var files = argv._.reduce(function (acc, x, ix) {
    acc[path.resolve(basedir, argv._[ix])] = argv.o[ix];
    return acc;
}, {});

fr.on('stream', function (bundle) {
    var ws = fs.createWriteStream(files[bundle.file]);
    bundle.pipe(pack({ raw: true })).pipe(ws);
});
process.stdin.pipe(fr).pipe(pack({ raw: true })).pipe(process.stdout);

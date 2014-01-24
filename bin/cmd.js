#!/usr/bin/env node

var factor = require('../');
var minimist = require('minimist');
var pack = require('browser-pack');
var argv = minimist(process.argv.slice(2));

var fr = factor(argv._);
var files = argv._.reduce(function (acc, x, ix) {
    acc[x] = argv._[ix];
    return acc;
}, {});

fr.on('stream', function (bundle) {
    var ws = fs.createWriteStream(files[bundle.file]);
    bundle.pipe(pack({ raw: true })).pipe(ws);
});
process.stdin.pipe(fr).pipe(process.stdout);

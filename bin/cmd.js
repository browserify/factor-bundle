#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var factor = require('../');
var minimist = require('minimist');
var pack = require('browser-pack');
var Transform = require('stream').Transform;

var argv = minimist(process.argv.slice(2));
if (argv.h || argv.help || argv._.length === 0) {
    return fs.createReadStream(__dirname + '/usage.txt').pipe(process.stdout);
}

var basedir = argv.basedir || process.cwd();

var fr = factor(argv._, { raw: true, root: basedir });
var files = argv._.reduce(function (acc, x, ix) {
    acc[path.resolve(basedir, argv._[ix])] = argv.o[ix];
    return acc;
}, {});

var output = argv.o.length > files.length && argv.o[files.length] !== '-'
    ? fs.createWriteStream(argv.o[files.length]) : process.stdout
;

fr.on('stream', function (bundle) {
    var ws = fs.createWriteStream(files[bundle.file]);
    bundle.pipe(pack({ raw: true })).pipe(wrap()).pipe(ws);
});
process.stdin.pipe(fr).pipe(pack({ raw: true })).pipe(wrap()).pipe(output);

function wrap () {
    var tr = new Transform;
    tr._transform = function (buf, enc, next) {
        this.push(buf);
        next();
    };
    tr._flush = function () {
        this.push(';\n');
        this.push(null);
    };
    tr.push('require=');
    return tr;
}

var test = require('tape');
var tmp = require('osenv').tmpdir;
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var mkdirp = require('mkdirp');
var browserify = require('browserify');
var factor = require('../');
var concat = require('concat-stream');

var tmpdir = tmp() + '/factor-bundle-' + Math.random();
mkdirp.sync(tmpdir);

var cwd = process.cwd();
process.chdir(__dirname);

var files = [ './rel/x.js', './rel/y.js' ];
var outputs = [
    path.join(tmpdir, 'x.js'),
    path.join(tmpdir, 'y.js')
];

test('relative entry paths', function (t) {
    t.plan(2);
    t.on('end', function () { process.chdir(cwd) });
    
    var sources = {};
    var pending = 3;
    var b = browserify(files);
    
    b.plugin(factor, {
        o: [
            concat(function(data) {
                sources.x = data.toString('utf8');
                done();
            }),
            concat(function(data) {
                sources.y = data.toString('utf8');
                done();
            })
        ]
    });

    b.bundle().pipe(concat(function (data) {
        sources.common = data.toString('utf8');
        done();
    }));
    
    function done () {
        if (--pending !== 0) return;
        var x = sources.common + sources.x;
        var y = sources.common + sources.y;
        
        vm.runInNewContext(x, { console: { log: function (msg) {
            t.equal(msg, 55500);
        } } });
        
        vm.runInNewContext(y, { console: { log: function (msg) {
            t.equal(msg, 333);
        } } });
    }
});

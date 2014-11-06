var test = require('tape');
var tmp = require('osenv').tmpdir;
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var mkdirp = require('mkdirp');
var browserify = require('browserify');
var factor = require('../');
var concat = require('concat-stream');

var files = [
    __dirname + '/deps/x.js',
    __dirname + '/deps/y.js'
];
var tmpdir = tmp() + '/factor-bundle-' + Math.random();
mkdirp.sync(tmpdir);

test('outputs api', function (t) {
    t.plan(2);
    var b = browserify(files);
    b.plugin(factor, {
        outputs: [
            path.join(tmpdir, 'x.js'),
            path.join(tmpdir, 'y.js')
        ]
    });
    var w = fs.createWriteStream(path.join(tmpdir, 'common.js'));
    b.bundle().pipe(w);
    
    w.on('finish', function () {
        var common = fs.readFileSync(tmpdir + '/common.js', 'utf8');
        var x = fs.readFileSync(tmpdir + '/x.js', 'utf8');
        var y = fs.readFileSync(tmpdir + '/y.js', 'utf8');
        
        vm.runInNewContext(common + x, { console: { log: function (msg) {
            t.equal(msg, 55500);
        } } });
        
        vm.runInNewContext(common + y, { console: { log: function (msg) {
            t.equal(msg, 333);
        } } });
    });
});

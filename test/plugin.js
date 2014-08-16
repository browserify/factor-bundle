var test = require('tape');
var os = require('os');
var fs = require('fs');
var vm = require('vm');
var mkdirp = require('mkdirp');
var spawn = require('child_process').spawn;
var browserify = require('browserify');
var factor = require('../');
var concat = require('concat-stream');

var files = [
    __dirname + '/deps/x.js',
    __dirname + '/deps/y.js'
];
var tmpdir = os.tmpdir() + '/factor-bundle-' + Math.random();
mkdirp.sync(tmpdir);

test('browserify plugin', function (t) {
    t.plan(3);
    var args = files.concat('-p', '[',
        __dirname + '/..',
        '-o', tmpdir + '/x.js', '-o', tmpdir + '/y.js',
        ']', '-o', tmpdir + '/common.js'
    );
    var ps = spawn('browserify', args);
    ps.on('exit', function (code) {
        t.equal(code, 0);
        
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

test('browserify plugin streams', function(t) {
    t.plan(2);

    var b = browserify(files);
    var sources = {};
    b.plugin(factor, {
        o: [
            concat(function(data) { sources.x = data }),
            concat(function(data) { sources.y = data })
        ]
    });

    b.bundle().pipe(concat(function(data) {
        var common = data.toString('utf8');
        var x = sources.x.toString('utf8');
        var y = sources.y.toString('utf8');

        vm.runInNewContext(common + x, { console: { log: function (msg) {
            t.equal(msg, 55500);
        } } });

        vm.runInNewContext(common + y, { console: { log: function (msg) {
            t.equal(msg, 333);
        } } });
    }));
});

test('browserify plugin multiple bundle calls', function(t) {
    t.plan(4);

    var b = browserify(files);
    var sources = {};
    b.plugin(factor, {
        o: [
            function() { return concat(function(data) { sources.x = data }); },
            function() { return concat(function(data) { sources.y = data }); }
        ]
    });

    b.bundle().pipe(concat(function(data) {
        checkBundle(data);

        b.bundle().pipe(concat(checkBundle));
    }));

    function checkBundle(data) {
        var common = data.toString('utf8');
        var x = sources.x.toString('utf8');
        var y = sources.y.toString('utf8');

        vm.runInNewContext(common + x, { console: { log: function (msg) {
            t.equal(msg, 55500);
        } } });

        vm.runInNewContext(common + y, { console: { log: function (msg) {
            t.equal(msg, 333);
        } } });
    }
});

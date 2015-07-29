var test = require('tape');
var tmp = require('osenv').tmpdir;
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var mkdirp = require('mkdirp');
var browserify = require('browserify');
var factor = require('../');
var concat = require('concat-stream');
var through = require('through2');

var files = [
    __dirname + '/deps/x.js',
    __dirname + '/deps/y.js'
];

test('file outputs', function (t) {
    var tmpdir = tmp() + '/factor-bundle-' + Math.random();
    mkdirp.sync(tmpdir);

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

test('stream outputs', function (t) {
    var tmpdir = tmp() + '/factor-bundle-' + Math.random();
    mkdirp.sync(tmpdir);
    t.plan(2);
    var sources = {}, pending = 3;
    function write (key) {
        return concat(function (body) {
            sources[key] = body.toString('utf8');
            if (-- pending === 0) done();
        });
    }
    
    var b = browserify(files);
    b.plugin(factor, { outputs: [ write('x'), write('y') ] });
    b.bundle().pipe(write('common'));
    
    function done () {
        var common = sources.common, x = sources.x, y = sources.y;
        
        vm.runInNewContext(common + x, { console: { log: function (msg) {
            t.equal(msg, 55500);
        } } });
        
        vm.runInNewContext(common + y, { console: { log: function (msg) {
            t.equal(msg, 333);
        } } });
    }
});

test('function outputs', function (t) {
    var tmpdir = tmp() + '/factor-bundle-' + Math.random();
    mkdirp.sync(tmpdir);

    t.plan(2);
    var b = browserify(files);
    b.plugin(factor, {
        output: function() { return ' cat > ' + tmpdir + '/`basename $FILE`'; }
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

test('bundle twice', function (t) {
    var tmpdir = tmp() + '/factor-bundle-' + Math.random();
    mkdirp.sync(tmpdir);

    t.plan(4);
    var b = browserify(files);
    var outputs = [
        path.join(tmpdir, 'x.js'),
        path.join(tmpdir, 'y.js')
    ];
    b.on('reset', function(){
        b.pipeline.get('deps').push(through.obj(function(data, enc, next){
            if (data.file.indexOf('x.js') !== -1) {
                data.source = data.source.replace('z(5)', 'z(6)');
            }
            this.push(data);
            next();
        }));
    });
    b.plugin(factor, {
        outputs: outputs
    });
    validate(55500, 333, function(){
        validate(66600, 333);
    });
    function validate (xVal, yVal, cb) {
        var w = fs.createWriteStream(path.join(tmpdir, 'common.js'));
        b.bundle().pipe(w);
        w.on('finish', function(){
            var common = fs.readFileSync(tmpdir + '/common.js', 'utf8');
            var x = fs.readFileSync(tmpdir + '/x.js', 'utf8');
            var y = fs.readFileSync(tmpdir + '/y.js', 'utf8');
            
            vm.runInNewContext(common + x, { console: { log: function (msg) {
                t.equal(msg, xVal);
            } } });
            
            vm.runInNewContext(common + y, { console: { log: function (msg) {
                t.equal(msg, yVal);
            } } });
            if (cb) cb();
        });
    }
});

test('outpipe outputs', function (t) {
    var tmpdir = tmp() + '/factor-bundle-' + Math.random();
    mkdirp.sync(tmpdir);

    t.plan(2);
    var b = browserify(files);
    b.plugin(factor, {
        output: ' cat > ' + tmpdir + '/`basename $FILE`'
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

var test = require('tape');
var fs = require('fs');
var vm = require('vm');
var tmp = require('osenv').tmpdir;
var mkdirp = require('mkdirp');
var spawn = require('child_process').spawn;
var browserify = require('browserify');
var factor = require('../');
var concat = require('concat-stream');

var files = [
    __dirname + '/dedupe/a.js',
    __dirname + '/dedupe/b.js',
    __dirname + '/dedupe/c.js'
];
var tmpdir = tmp() + '/factor-bundle-' + Math.random();
mkdirp.sync(tmpdir);

test('browserify plugin handles deduped modules', function (t) {
    t.plan(4);
    var args = files.concat('-p', '[',
        __dirname + '/..',
        '-o', tmpdir + '/a.js', '-o', tmpdir + '/b.js', '-o', tmpdir + '/c.js',
        ']', '-o', tmpdir + '/common.js'
    );
    var ps = spawn('browserify', args);
    ps.on('exit', function (code) {
        t.equal(code, 0);

        var common = fs.readFileSync(tmpdir + '/common.js', 'utf8');
        var a = fs.readFileSync(tmpdir + '/a.js', 'utf8');
        var b = fs.readFileSync(tmpdir + '/b.js', 'utf8');
        var c = fs.readFileSync(tmpdir + '/c.js', 'utf8');

        vm.runInNewContext(common + a, { console: { log: function (msg) {
            t.equal(msg, 7770);
        } } });

        vm.runInNewContext(common + b, { console: { log: function (msg) {
            t.equal(msg, 1155);
        } } });

        vm.runInNewContext(common + c, { console: { log: function (msg) {
            t.equal(msg, 11550);
        } } });
    });
});

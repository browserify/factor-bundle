var test = require('tape');
var factor = require('../');
var mdeps = require('module-deps');
var through = require('through');
var path = require('path');
var fs = require('fs');

var files = [ 'x.js', 'y.js' ].map(function (file) {
    return path.join(__dirname, '../example', file);
});
var expected = {
    common: [ read('z.js') ],
    'x.js': [
        read('x.js', {
            entry: true,
            deps: { './z.js': norm('z.js'), './w.js': norm('w.js') }
        }),
        read('w.js')
    ],
    'y.js': [
        read('y.js', {
           entry: true,
           deps: { './z.js': norm('z.js') }
        })
    ]
};

test(function (t) {
    t.plan(3);
    
    var rows = [];
    var fr = factor(files, { objectMode: true, raw: true });
    fr.on('stream', function (bundle) {
        bundle.pipe(rowsOf(function (rows) {
            t.deepEqual(rows, expected[path.basename(bundle.file)]);
        }));
    });
    var md = mdeps(files);
    md.pipe(fr).pipe(rowsOf(function (rows) {
        t.deepEqual(rows, expected.common);
    }));
});

function rowsOf (cb) {
    var rows = [];
    return through(write, end);
    
    function write (row) { rows.push(row) }
    function end () { cb(rows) }
}

function read (name, ref) {
    if (!ref) ref = {};
    var file = norm(name);
    ref.id = file;
    ref.source = fs.readFileSync(file, 'utf8');
    if (!ref.deps) ref.deps = {};
    return ref;
}

function norm (file) {
    return path.normalize(__dirname + '/../example/' + file);
}

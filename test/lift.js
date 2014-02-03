var test = require('tape');
var through = require('through');
var factor = require('../');

var ROWS = {
    A: { id: '/a.js', deps: { '/c.js': '/c.js', '/z.js': '/z.js' } },
    B: { id: '/b.js', deps: { '/c.js': '/c.js', '/x.js': '/x.js' } },
    C: { id: '/c.js', deps: { '/d.js': '/d.js' } },
    D: { id: '/d.js', deps: { '/e.js': '/e.js' } },
    E: { id: '/e.js', deps: {} },
    X: { id: '/x.js', deps: { '/y.js': '/y.js' } },
    Y: { id: '/y.js', deps: { '/z.js': '/z.js' } },
    Z: { id: '/z.js', deps: { '/c.js': '/c.js' } }
};

var expected = {};
expected.common = [ ROWS.C, ROWS.D, ROWS.E, ROWS.Z ].sort(cmp);
expected['/a.js'] = [ ROWS.A ].sort(cmp);
expected['/b.js'] = [ ROWS.B, ROWS.X, ROWS.Y ].sort(cmp);

test('lift singly-shared dependencies', function (t) {
    t.plan(3);
    
    var files = [ '/a.js', '/b.js' ];
    var fr = factor(files, { objectMode: true, raw: true });
    fr.on('stream', function (bundle) {
        bundle.pipe(rowsOf(function (rows) {
            console.log('----- ' + bundle.file + ' ROWS -----');
            console.log(rows);
            t.deepEqual(rows.sort(cmp), expected[bundle.file]);
        }));
    });
    
    fr.pipe(rowsOf(function (rows) {
        console.log('----- COMMON ROWS -----');
        console.log(rows);
        t.deepEqual(rows.sort(cmp), expected.common);
    }));
    
    fr.write(ROWS.A);
    fr.write(ROWS.B);
    fr.write(ROWS.C);
    fr.write(ROWS.D);
    fr.write(ROWS.E);
    fr.write(ROWS.X);
    fr.write(ROWS.Y);
    fr.write(ROWS.Z);
    fr.end();
});

function rowsOf (cb) {
    var rows = [];
    return through(write, end);

    function write (row) { rows.push(row) }
    function end () { cb(rows) }
}

function cmp (a, b) {
    return a.id < b.id ? -1 : 1;
}

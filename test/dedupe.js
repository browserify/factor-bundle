var test = require('tape');
var through = require('through');
var factor = require('../');

var ROWS = {
    A: { id: 1, file: '/a.js', deps: { 'E': 5 } },
    B: { id: 2, file: '/b.js', deps: { 'D': 4 } },
    C: { id: 3, file: '/c.js', deps: { 'D': 4, 'X': 6 } },
    D: { id: 4, file: '/d.js', deps: { 'X': 6 }, dedupeIndex: 5 },
    E: { id: 5, file: '/e.js', deps: { 'X': 6 } },
    X: { id: 6, file: '/x.js', deps: {} }
};

var rmap = {
    1: '/a.js',
    2: '/b.js',
    3: '/c.js',
    4: '/d.js',
    5: '/e.js',
    6: '/x.js'
};

var expected = {};
expected.common = [ ROWS.D, ROWS.E, ROWS.X ].sort(cmp);
expected['/a.js'] = [ ROWS.A ];
expected['/b.js'] = [ ROWS.B ];
expected['/c.js'] = [ ROWS.C ];

test('ensure common if deduped to common dep', function (t) {
    t.plan(4);

    var files = [ '/a.js', '/b.js', '/c.js' ];
    var fr = factor(files, { objectMode: true, raw: true, rmap: rmap });
    fr.on('stream', function (bundle) {
        bundle.pipe(rowsOf(function (rows) {
            console.log('----- ' + bundle.file + ' ROWS -----');
            console.log(rows.sort(cmp));
            t.deepEqual(rows.sort(cmp), expected[bundle.file]);
        }));
    });

    fr.pipe(rowsOf(function (rows) {
        console.log('----- COMMON ROWS -----');
        console.log(rows.sort(cmp));
        t.deepEqual(rows.sort(cmp), expected.common);
    }));

    fr.write(ROWS.A);
    fr.write(ROWS.B);
    fr.write(ROWS.C);
    fr.write(ROWS.D);
    fr.write(ROWS.E);
    fr.write(ROWS.X);
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

var test = require('tape');
var through = require('through');
var factor = require('../');

var ROWS = {
    A: { id: '/a.js', deps: { '/c.js': '/c.js' } },
    B: { id: '/b.js', deps: { '/c.js': '/c.js' } },
    C: { id: '/c.js', deps: { 'd': undefined } }
};

var expected = {};
expected.common = [ ROWS.A, ROWS.C ].sort(cmp);
expected['/b.js'] = [ ROWS.B ].sort(cmp);

test('Copes with missing dependencies', function (t) {
    t.plan(2);

    var files = [ '/b.js' ];
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

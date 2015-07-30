var test = require('tape');
var factor = require('../');
var mdeps = require('module-deps');
var through = require('through');
var path = require('path');
var fs = require('fs');
var pack = require('browser-pack');
var concat = require('concat-stream');
var vm = require('vm');

test('more complicated dependencies', function (t) {
    t.plan(5);
    var files = [ 'x.js', 'y.js' ].map(function (file) {
      return path.join(__dirname, 'files', file);
    });

    var expected = {
        common: [ read('z.js'), read('a.js') ],
        'x.js': [
            read('x.js', {
                entry: true,
                deps: { './z.js': norm('z.js'), './w.js': norm('w.js') }
            }),
            read('w.js', {
                deps: { './a.js': norm('a.js') }
            })
        ],
        'y.js': [
            read('y.js', {
                entry: true,
                deps: { './z.js': norm('z.js'), './a.js': norm('a.js') }
            })
        ]
    };

    var packs = {
        common: pack({ raw: true }),
        'x.js': pack({ raw: true }),
        'y.js': pack({ raw: true })
    };
    
    var pending = 3;
    
    var sources = {};
    packs.common.pipe(concat(function (src) {
        sources.common = src;
        done();
    }));
    packs['x.js'].pipe(concat(function (src) {
        sources['x.js'] = src;
        done();
    }));
    packs['y.js'].pipe(concat(function (src) {
        sources['y.js'] = src;
        done();
    }));
    
    function done () {
        if (--pending !== 0) return;
        var srcx = 'require=' + sources.common
            + ';require=' + sources['x.js']
        ;
        function logx (msg) { t.equal(msg, 55500) }
        vm.runInNewContext(srcx, { console: { log: logx } });
        
        var srcy = 'require=' + sources.common
            + ';require=' + sources['y.js']
        ;
        function logy (msg) { t.equal(msg, 333) }
        vm.runInNewContext(srcy, { console: { log: logy } });
    }
    
    var rows = [];
    var fr = factor(files, { objectMode: true, raw: true });
    fr.on('stream', function (bundle) {
        var name = path.basename(bundle.file);
        bundle.pipe(rowsOf(function (rows) {
            t.deepEqual(rows, expected[name]);
        }));
        bundle.pipe(packs[name]);
    });
    var md = mdeps();
    md.pipe(fr)
    fr.pipe(rowsOf(function (rows) {
        t.deepEqual(rows, expected.common);
    }));
    fr.pipe(packs.common);
    files.forEach(function (file) { md.write({ file: file }) });
    md.end();
});

test('same module included twice', function (t) {
    //t.plan(5);
    t.plan(3);

    var files = [ 't.js' ].map(function (file) {
        return path.join(__dirname, 'files', file);
    });

    var expected = {
        common: [],
        't.js': sortRows([
            read('t.js', {
                entry: true,
                deps: { './a.js': norm('a.js'), './w.js': norm('w.js') }
            }),
            read('w.js', {
                deps: { './a.js': norm('a.js') }
            }),
            read('a.js')
        ])
    };

    var packs = {
        common: pack({ raw: true }),
        't.js': pack({ raw: true })
    };

    var pending = 2;

    var sources = {};
    packs.common.pipe(concat(function (src) {
        sources.common = src;
        done();
    }));
    packs['t.js'].pipe(concat(function (src) {
        sources['t.js'] = src;
        done();
    }));

    function done () {
        if (--pending !== 0) return;
        var srct = 'require=' + sources.common
            + ';require=' + sources['t.js']
        ;
        function logx (msg) { t.equal(msg, 300) }
        vm.runInNewContext(srct, { console: { log: logx } });
    }

    var rows = [];
    var fr = factor(files, { objectMode: true, raw: true });
    fr.on('stream', function (bundle) {
        var name = path.basename(bundle.file);
        bundle.pipe(rowsOf(function (rows) {
            t.deepEqual(rows, expected[name]);
        }));
        bundle.pipe(packs[name]);
    });
    var md = mdeps();
    md.pipe(fr)
    fr.pipe(rowsOf(function (rows) {
        t.deepEqual(rows, expected.common);
    }));
    fr.pipe(packs.common);
    files.forEach(function (file) { md.write({ file: file }) });
    md.end();
});

test('threshold function reorganizes bundles', function (t) {
    t.plan(5);
    var files = [ 'y.js', 't.js' ].map(function (file) {
      return path.join(__dirname, 'files', file);
    });

    var expected = {
        common: [
            read('z.js')
        ],
        't.js': sortRows([
            read('t.js', {
                entry: true,
                deps: { './a.js': norm('a.js'), './w.js': norm('w.js') }
            }),
            read('w.js', {
                deps: { './a.js': norm('a.js') }
            }),
            read('a.js')
        ]),
        'y.js': sortRows([
            read('y.js', {
                entry: true,
                deps: { './z.js': norm('z.js'), './a.js': norm('a.js') }
            }),
            read('a.js')
        ])
    };

    var packs = {
        common: pack({ raw: true }),
        't.js': pack({ raw: true }),
        'y.js': pack({ raw: true })
    };

    var pending = 3;

    var sources = {};
    packs.common.pipe(concat(function (src) {
        sources.common = src;
        done();
    }));
    packs['t.js'].pipe(concat(function (src) {
        sources['t.js'] = src;
        done();
    }));
    packs['y.js'].pipe(concat(function (src) {
        sources['y.js'] = src;
        done();
    }));

    function done () {
        if (--pending !== 0) return;
        var srct = 'require=' + sources.common
            + ';require=' + sources['t.js']
        ;
        function logt (msg) { t.equal(msg, 300) }
        vm.runInNewContext(srct, { console: { log: logt } });

        var srcy = 'require=' + sources.common
            + ';require=' + sources['y.js']
        ;
        function logy (msg) { t.equal(msg, 333) }
        vm.runInNewContext(srcy, { console: { log: logy } });
    }

    var rows = [];
    var fr = factor(files, { objectMode: true, raw: true, threshold: function(row, groups) {
        if (/.*a\.js$/.test(row.id)) {
            return false;
        };
        if (/.*[z]\.js$/.test(row.id)) {
            return true;
        };
        return this._defaultThreshold(row, groups);
    }});
    fr.on('stream', function (bundle) {
        var name = path.basename(bundle.file);
        bundle.pipe(rowsOf(function (rows) {
            t.deepEqual(rows, expected[name]);
        }));
        bundle.pipe(packs[name]);
    });
    var md = mdeps();
    md.pipe(fr)
    fr.pipe(rowsOf(function (rows) {
        t.deepEqual(rows, expected.common);
    }));
    fr.pipe(packs.common);
    files.forEach(function (file) { md.write({ file: file }) });
    md.end();
});

test('if dependent is in common, so is dependee', function (t) {
    t.plan(3);
    var files = [ 't.js' ].map(function (file) {
      return path.join(__dirname, 'files', file);
    });

    var expected = {
        common: [
            read('w.js', {
                deps: { './a.js': norm('a.js') }
            }),
            read('a.js')
        ],
        't.js': [
            read('t.js', {
                entry: true,
                deps: { './a.js': norm('a.js'), './w.js': norm('w.js') }
            })
        ]
    };

    var packs = {
        common: pack({ raw: true }),
        't.js': pack({ raw: true }),
    };

    var pending = 2;

    var sources = {};
    packs.common.pipe(concat(function (src) {
        sources.common = src;
        done();
    }));
    packs['t.js'].pipe(concat(function (src) {
        sources['t.js'] = src;
        done();
    }));

    function done () {
        if (--pending !== 0) return;
        var srct = 'require=' + sources.common
            + ';require=' + sources['t.js']
        ;
        function logt (msg) { t.equal(msg, 300) }
        vm.runInNewContext(srct, { console: { log: logt } });
    }

    var rows = [];
    var fr = factor(files, { objectMode: true, raw: true, threshold: function(row, groups) {
        if (/.*[w]\.js$/.test(row.id)) {
            return true;
        };
        return this._defaultThreshold(row, groups);
    }});
    fr.on('stream', function (bundle) {
        var name = path.basename(bundle.file);
        bundle.pipe(rowsOf(function (rows) {
            t.deepEqual(rows, expected[name]);
        }));
        bundle.pipe(packs[name]);
    });
    var md = mdeps();
    md.pipe(fr)
    fr.pipe(rowsOf(function (rows) {
        t.deepEqual(rows, expected.common);
    }));
    fr.pipe(packs.common);
    files.forEach(function (file) { md.write({ file: file }) });
    md.end();
});

function rowsOf (cb) {
    var rows = [];
    return through(write, end);

    function write (row) { rows.push(row) }
    function end () { cb(sortRows(rows)) }
}

function sortRows (rows) {
    return rows.sort(function (a, b) {
        return a.id < b.id ? 1 : -1;
    });
}

function read (name, ref) {
    if (!ref) ref = {};
    var file = norm(name);
    ref.id = file;
    ref.file = file;
    ref.source = fs.readFileSync(file, 'utf8');
    if (!ref.deps) ref.deps = {};
    return ref;
}

function norm (file) {
    return path.normalize(__dirname + '/files/' + file);
}

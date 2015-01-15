'use strict';
var Factor = require('../lib/factor');
var test = require('tape');
var through = require('through2');

var ROWS = {
  A: { id: '/a.js', deps: { '/c.js': '/c.js' } },
  B: { id: '/b.js', deps: { '/c.js': '/c.js' } },
  C: { id: '/c.js', deps: {} }
};

test('it should return Factor from the constructor, even if called without new', function(t) {
  t.plan(1);

  var factor = Factor();
  t.ok(factor instanceof Factor);
});

test('it should factor an empty stream', function(t) {
  t.plan(1);
  var count = 0;
  var factor = new Factor();

  factor.pipe(through.obj(
    function(chunk, enc, next) {
      t.fail('should not have had anything to work on');
      count++;
      next(null, chunk);
    },
    function(next) {
      t.equal(count, 0);
      next();
    }
  ));

  factor.end();
});

test('it should pass through all files to common if created with no entries', function(t) {
  t.plan(1);
  var factor = new Factor();

  var expectedCommon = [ ROWS.A, ROWS.B, ROWS.C].sort(cmp);

  factor.pipe(rowsOf(function(rows) {
    console.log('----- COMMON ROWS -----');
    console.log(rows);
    t.deepEqual(rows.sort(cmp), expectedCommon);
  }));

  factor.on('stream', function() {
    t.fail('no bundles should have been created');
  });

  factor.write(ROWS.A);
  factor.write(ROWS.B);
  factor.write(ROWS.C);
  factor.end();
});

test('it should factor out entry files', function(t) {
  t.plan(2);
  var entries = ['/b.js'];
  var factor = new Factor(entries);

  var expectedCommon = [ROWS.A, ROWS.C].sort(cmp);
  var expectedB = [ROWS.B].sort(cmp);

  factor.pipe(rowsOf(function(rows) {
    console.log('----- COMMON ROWS -----');
    console.log(rows);
    t.deepEqual(rows.sort(cmp), expectedCommon);
  }));

  factor.on('stream', function(bundle) {
    bundle.pipe(rowsOf(function(rows) {
      console.log('----- ' + bundle.file + ' ROWS -----');
      console.log(rows);
      t.deepEqual(rows.sort(cmp), expectedB);
    }));
  });

  factor.write(ROWS.A);
  factor.write(ROWS.B);
  factor.write(ROWS.C);
  factor.end();
});

test('it should factor, even if the row is malformed', function(t) {
  t.plan(2);

  var MALFORMED_ROWS = {
    A: { id: '/a.js', deps: { '/c.js': '/c.js' } },
    B: { id: '/b.js', deps: { '/c.js': '/c.js' } },
    C: { id: '/c.js' }
  };

  var entries = ['/b.js'];
  var factor = new Factor(entries);

  var expectedCommon = [MALFORMED_ROWS.A, MALFORMED_ROWS.C].sort(cmp);
  var expectedB = [MALFORMED_ROWS.B].sort(cmp);

  factor.pipe(rowsOf(function(rows) {
    console.log('----- COMMON ROWS -----');
    console.log(rows);
    t.deepEqual(rows.sort(cmp), expectedCommon);
  }));

  factor.on('stream', function(bundle) {
    bundle.pipe(rowsOf(function(rows) {
      console.log('----- ' + bundle.file + ' ROWS -----');
      console.log(rows);
      t.deepEqual(rows.sort(cmp), expectedB);
    }));
  });

  factor.write(MALFORMED_ROWS.A);
  factor.write(MALFORMED_ROWS.B);
  factor.write(MALFORMED_ROWS.C);
  factor.end();
});

test('it should not include in common a shared dependency below a threshold number', function(t) {
  t.plan(3);
  var entries = ['/a.js', '/b.js'];
  var factor = new Factor(entries, {
    threshold: 2
  });

  var expectedCommon = [].sort(cmp);
  var expected = {};
  expected['/a.js'] = [ROWS.A, ROWS.C].sort(cmp);
  expected['/b.js'] = [ROWS.B, ROWS.C].sort(cmp);

  factor.pipe(rowsOf(function(rows) {
    console.log('----- COMMON ROWS -----');
    console.log(rows);
    t.deepEqual(rows.sort(cmp), expectedCommon);
  }));

  factor.on('stream', function(bundle) {
    bundle.pipe(rowsOf(function(rows) {
      console.log('----- ' + bundle.file + ' ROWS -----');
      console.log(rows);
      t.deepEqual(rows.sort(cmp), expected[bundle.file]);
    }));
  });

  factor.write(ROWS.A);
  factor.write(ROWS.B);
  factor.write(ROWS.C);
  factor.end();
});

test('it should not include in common a dependency where threshold returns false', function(t) {
  t.plan(9);
  var entries = ['/a.js', '/b.js'];
  var factor = new Factor(entries, {
    threshold: function(row, group) {
      t.ok(row);
      t.ok(group);
      return false;
    }
  });

  var expectedCommon = [].sort(cmp);
  var expected = {};
  expected['/a.js'] = [ROWS.A, ROWS.C].sort(cmp);
  expected['/b.js'] = [ROWS.B, ROWS.C].sort(cmp);

  factor.pipe(rowsOf(function(rows) {
    console.log('----- COMMON ROWS -----');
    console.log(rows);
    t.deepEqual(rows.sort(cmp), expectedCommon);
  }));

  factor.on('stream', function(bundle) {
    bundle.pipe(rowsOf(function(rows) {
      console.log('----- ' + bundle.file + ' ROWS -----');
      console.log(rows);
      t.deepEqual(rows.sort(cmp), expected[bundle.file]);
    }));
  });

  factor.write(ROWS.A);
  factor.write(ROWS.B);
  factor.write(ROWS.C);
  factor.end();
});

test('should map dependencies to files', function(t) {
  t.plan(2);

  var RMAP_ROWS = {
    A: { id: '/a.js', deps: { '/c.js': 3 } },
    B: { id: '/b.js', deps: { '/c.js': 2 } },
    C: { id: '/c.js', deps: {} }
  };

  var RMAP = {
    1: '/a.js',
    2: '/b.js',
    3: '/c.js'
  };

  var entries = ['/b.js'];
  var factor = new Factor(entries, {
    rmap: RMAP
  });

  var expectedCommon = [RMAP_ROWS.A, RMAP_ROWS.C].sort(cmp);
  var expectedB = [RMAP_ROWS.B].sort(cmp);

  factor.pipe(rowsOf(function(rows) {
    console.log('----- COMMON ROWS -----');
    console.log(rows);
    t.deepEqual(rows.sort(cmp), expectedCommon);
  }));

  factor.on('stream', function(bundle) {
    bundle.pipe(rowsOf(function(rows) {
      console.log('----- ' + bundle.file + ' ROWS -----');
      console.log(rows);
      t.deepEqual(rows.sort(cmp), expectedB);
    }));
  });

  factor.write(RMAP_ROWS.A);
  factor.write(RMAP_ROWS.B);
  factor.write(RMAP_ROWS.C);
  factor.end();
});

function rowsOf (cb) {
  var rows = [];
  return through.obj(write, end);

  function write(row, enc, next) {
    rows.push(row);

    next(null, row);
  }
  function end(next) {
    cb(rows);
    next();
  }
}

function cmp (a, b) {
  return a.id < b.id ? -1 : 1;
}

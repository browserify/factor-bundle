var browserify = require('browserify');
var concat = require('concat-stream');

var files = [ './files/x.js', './files/y.js' ];
var b = browserify(files);

b.plugin('../', { outputs: [ write('x'), write('y') ] });
b.bundle().pipe(write('common'));

function write (name) {
    return concat(function (body) {
        console.log('// ----- ' + name + ' -----');
        console.log(body.toString('utf8'));
    });
}

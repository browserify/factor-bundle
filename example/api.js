var browserify = require('browserify');
var fs = require('fs');

var files = [ './files/x.js', './files/y.js' ];
var b = browserify(files);
b.plugin('../', { o: [ 'bundle/x.js', 'bundle/y.js' ] });
b.bundle().pipe(fs.createWriteStream('bundle/common.js'));

# factor-bundle

factor [browser-pack](https://npmjs.org/package/browser-pack) bundles into a
common bundle and entry-specific bundles

[![build status](https://secure.travis-ci.org/substack/factor-bundle.png)](http://travis-ci.org/substack/factor-bundle)

# example

x.js:

``` js
var z = require('./z.js');
var w = require('./w.js');
console.log(z(5) * w(2));
```

y.js:

``` js
var z = require('./z.js');
console.log(z(2) + 111);
```

z.js:

``` js
module.exports = function (n) { return n * 111 }
```

w.js:

``` js
module.exports = function (n) { return n * 50 }
```

Now run factor-bundle as a plugin (new in browserify 3.28.0):

``` sh
browserify x.js y.js -p [ factor-bundle -o bundle/x.js -o bundle/y.js ] \
  -o bundle/common.js
```

or you can pipe [module-deps](https://npmjs.org/package/module-deps) json
directly into the `factor-bundle` command:

``` sh
$ module-deps x.js y.js | factor-bundle \
  x.js -o bundle/x.js \
  y.js -o bundle/y.js \
  > bundle/common.js
```

or factor out an existing bundle already compiled by browserify:

``` sh
$ browserify x.js y.js > bundle.js
$ browser-unpack < bundle.js | factor-bundle \
  x.js -o bundle/x.js \
  y.js -o bundle/y.js \
  > bundle/common.js
```

Whichever one of these 3 options, you take, you can now have 2 pages, each with
a different combination of script tags but with all the common modules factored
out into a `common.js` to avoid transferring the same code multiple times:

``` html
<script src="/bundle/common.js"></script>
<script src="/bundle/x.js"></script>
```

``` html
<script src="/bundle/common.js"></script>
<script src="/bundle/y.js"></script>
```

to verify this works from node you can do:

```
$ cat bundle/common.js bundle/x.js | node
55500
$ cat bundle/common.js bundle/y.js | node
333
```

## command-line outpipe example

We can pipe each output file through some other processes. Here we'll do
minification with uglify compression with gzip:

``` sh
browserify files/*.js \
    -p [ factor-bundle -o 'uglifyjs -cm | gzip > bundle/`basename $FILE`.gz' ] \
    | uglifyjs -cm | gzip > bundle/common.js.gz
```

## api plugin example

If you prefer you can use the factor-bundle plugin api directly in code:

``` js
var browserify = require('browserify');
var fs = require('fs');

var files = [ './files/x.js', './files/y.js' ];
var b = browserify(files);
b.plugin('factor-bundle', { outputs: [ 'bundle/x.js', 'bundle/y.js' ] });
b.bundle().pipe(fs.createWriteStream('bundle/common.js'));
```

or instead of writing to files you can output to writable streams:

``` js
var browserify = require('browserify');
var concat = require('concat-stream');

var files = [ './files/x.js', './files/y.js' ];
var b = browserify(files);

b.plugin('factor-bundle', { outputs: [ write('x'), write('y') ] });
b.bundle().pipe(write('common'));

function write (name) {
    return concat(function (body) {
        console.log('// ----- ' + name + ' -----');
        console.log(body.toString('utf8'));
    });
}
```

# usage

You can use factor-bundle as a browserify plugin:

```
browserify -p [ factor-bundle OPTIONS ]

where OPTIONS are:

  -o  Output FILE or CMD that maps to a corresponding entry file at the same
      index. CMDs are executed with $FILE set to the corresponding input file.
      Optionally specify a function that returns a valid value for this argument.
 
  -e  Entry file to use, overriding the entry files listed in the original
      bundle.

```

or you can use the command:

```
usage: factor-bundle [ x.js -o bundle/x.js ... ] > bundle/common.js

Read `module-deps` json output from stdin, factoring each entry file out into
the corresponding output file (-o).

  -o FILE, -o CMD

    Write output to FILE or CMD. CMD is distinguished from FILE by the presence
    of one or more `>` or `|` characters. For example, use:
    
      factor-bundle browser/a.js browser/b.js \
        -o bundle/a.js -o bundle/b.js
    
    to write to a FILE. And do something like:

      factor-bundle browser/*.js \
        -o 'uglifyjs -cm | gzip > bundle/`basename $FILE`.gz'

    to use a CMD. In the CMD, $FILE is set to the corresponding input file path.

    If there is a trailing unpaired `-o`, that file will be used for the common
    bundle output. Otherwise, the final bundle is written to stdout.

```

# methods

``` js
var factor = require('factor-bundle')
```

## var fr = factor(files, opts={})

Return a transform stream `tr` that factors the array of entry path strings
`files` out into bundle files. The input format that `fr` expects is described
in the [module-deps package](https://npmjs.org/package/module-deps).

The output format for `fr` and each of the `fr` sub-streams given by each
`'stream'` event is also in the
[module-deps](https://npmjs.org/package/module-deps) format.

`opts.o` or `opts.outputs` should be an array that pairs up with the `files` array to specify
where each bundle output for each entry file should be written. The elements in
`opts.o` can be string filenames, writable streams, or functions that return a
string filename or writable stream.

`opts.entries` or `opts.e` should be the array of entry files to create
a page-specific bundle for each file. If you don't pass in an `opts.entries`,
this information is gathered from browserify itself.

The files held in common among `> opts.threshold` (default: 1) bundles will be
output on the `fr` stream itself. The entry-specific bundles are diverted into
each `'stream'` event's output. `opts.threshold` can be a number or a function
`opts.threshold(row, groups)` where `row` is a 
[module-deps](https://github.com/substack/module-deps) object and `groups` is 
an array of bundles which depend on the row. If the threshold function returns 
`true`, that row and all its dependencies will go to the `common` bundle. If 
false, the row (but not its dependencies) will go to each bundle in `groups`.
For example:

``` js
factor(files, {threshold: function(row, groups) {
    if (/.*a\.js$/.test(row.id)) return false;
    if (/.*[z]\.js$/.test(row.id)) return true;
    return this._defaultThreshold(row, groups);
}});
```

# events

## fr.on('stream', function (stream) {})

Each entry file emits a `'stream'` event containing all of the entry-specific
rows that are only used by that entry file (when `opts.threshold === 1`, the
default).

The entry file name is available as `stream.file`.

## b.on('factor.pipeline', function (file, pipeline) {})

Emits the full path to the entry file (`file`) and a [labeled-stream-splicer](https://npmjs.org/package/labeled-stream-splicer) (`pipeline`) for each entry file with these labels:

* `'pack'` - [browser-pack](https://npmjs.org/package/browser-pack)
* `'wrap'` - apply final wrapping

You can call `pipeline.get` with a label name to get a handle on a stream pipeline that you can `push()`, `unshift()`, or `splice()` to insert your own transform streams.

Event handlers must be attached *before* calling `b.plugin`.

# install

With [npm](https://npmjs.org) do:

```
npm install factor-bundle
```

# license

MIT

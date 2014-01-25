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

now pipe some [module-deps](https://npmjs.org/package/module-deps) json into
`factor-bundle`:

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

and now you can have 2 pages, each with a different combination of script tags
but with all the common modules factored out into a `common.js` to avoid
transferring the same code multiple times:

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

# usage

```
usage: factor-bundle [ x.js -o bundle/x.js ... ] > bundle/common.js

Read `module-deps` json output from stdin, factoring each entry file out into
the corresponding output file (-o).

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

The files held in common among `> opts.threshold` (default: 1) bundles will be
output on the `fr` stream itself. The entry-specific bundles are diverted into
each `'stream'` event's output.

# events

## fr.on('stream', function (stream) {})

Each entry file emits a `'stream'` event containing all of the entry-specific
rows that are only used by that entry file (when `opts.threshold === 1`, the
default).

The entry file name is available as `stream.file`.

# install

With [npm](https://npmjs.org) do:

```
npm install factor-bundle
```

# license

MIT

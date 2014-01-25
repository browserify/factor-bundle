# factor-bundle

factor [browser-pack](https://npmjs.org/package/browser-pack) bundles into a
common bundle and entry-specific bundles

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
$ cat bundle/common.js <(echo ';') bundle/x.js | node
55500
$ cat bundle/common.js <(echo ';') bundle/y.js | node
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


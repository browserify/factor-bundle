# browser-factor 

factor out 

# example

x.js:

```
var z = require('./z.js');
console.log(z(5) * 100);
```

y.js:

```
var z = require('./z.js');
console.log(z(2) + 111);
```

z.js:

```
module.exports = function (n) { return n * 111 }
```

now pipe some [module-deps](https://npmjs.org/package/module-deps) json into
`browser-factor`:

```
$ module-deps x.js y.js | browser-factor \
  x.js -o bundle/x.js \
  y.js -o bundle/y.js \
  > bundle/common.js
```

or factor out an existing bundle already compiled by browserify:

```
$ browserify x.js y.js > bundle.js
$ browser-unpack < bundle.jsj | browser-factor \
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

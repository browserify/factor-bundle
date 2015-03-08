#!/bin/bash

browserify files/*.js \
    -p [ ../ -o 'uglifyjs -cm | gzip > bundle/`basename $FILE`.gz' ] \
    | uglifyjs -cm | gzip > bundle/common.js.gz

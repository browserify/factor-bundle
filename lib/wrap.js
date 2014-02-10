var Transform = require('stream').Transform;

module.exports = function () {
    var tr = new Transform;
    tr._transform = function (buf, enc, next) {
        this.push(buf);
        next();
    };
    tr._flush = function () {
        this.push(';\n');
        this.push(null);
    };
    tr.push('\nrequire=');
    return tr;
};

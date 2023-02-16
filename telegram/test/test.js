const _ = require('lodash');
let arr = [{ "name": "a", "time": 1676452906921, "value": 100, "op": "tinycalf" }, { "name": "b", "time": 1676452909889, "value": 200, "op": "tinycalf" }, { "name": "a ", "time": 1676452917464, "value": 300, "op": "tinycalf" }];
let delArr = _.remove(arr, val => {
    return val.time < 1676453100000;
});

console(dix);
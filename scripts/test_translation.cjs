const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console, URL, AbortSignal, TextEncoder, setTimeout, print: console.log });
context.load = path => vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: path });
context.load('tests/translation.js');

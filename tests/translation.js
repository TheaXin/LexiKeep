// Run with JavaScriptCore (load) or another harness providing load/print.
var chrome = { runtime: { onInstalled: { addListener() {} }, onMessage: { addListener() {} } } };
var TextEncoder = globalThis.TextEncoder || class { encode(text) { return { length: unescape(encodeURIComponent(text)).length }; } };
load('src/background.js');
function assert(value, message) { if (!value) throw new Error(message); }
for (const source of ['Hello world. '.repeat(200), 'A'.repeat(2000), '中文🙂 Mixed context! '.repeat(80), 'line one\n\nline two? End.']) {
  const chunks = splitText(source);
  assert(chunks.join('') === source, 'Splitting must preserve every character');
  assert(chunks.every(part => new TextEncoder().encode(part).length <= 480), 'Query exceeds byte limit');
}
assert(sanitizeSettings({}).learningMode === false, 'Full context must be default');
assert(sanitizeSettings({ learningMode: true }).learningMode === true, 'Learning mode opt-in');
assert(sanitizeSettings({ maxProtectedWordsPerNode: 0 }).maxProtectedWordsPerNode === 0, 'Zero protected words');
print('PASS: lossless splitting, UTF-8 bounds, context defaults, settings');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const source = fs.readFileSync('waffle-app.js', 'utf8');
const start = source.indexOf('    function directoryPhotoTilePreviewUrl(');
const end = source.indexOf('\n    function setDirectoryDogPhotoImage(', start);
assert(start >= 0 && end > start, 'photo tile URL helper should remain directly testable');
const helper = source.slice(start, end);

function resolve(previewUrl, cssWidth, deviceScale) {
  const window = { location: { href: 'https://waffle.test/directory.html' }, devicePixelRatio: deviceScale };
  const tileShell = { getBoundingClientRect: () => ({ width: cssWidth }) };
  return Function('window', `${helper}; return directoryPhotoTilePreviewUrl;`)(window)(previewUrl, tileShell);
}

test('Drive roster rendition follows measured CSS width and device scale', () => {
  const driveUrl = 'https://drive.google.com/thumbnail?id=photo_123&sz=w1600';
  assert.equal(new URL(resolve(driveUrl, 180, 1)).searchParams.get('sz'), 'w320');
  assert.equal(new URL(resolve(driveUrl, 180, 2)).searchParams.get('sz'), 'w640');
  assert.equal(new URL(resolve(driveUrl, 300, 3)).searchParams.get('sz'), 'w960');
  assert.equal(new URL(resolve(driveUrl, 900, 3)).searchParams.get('sz'), 'w1600');
});

test('non-Drive previews remain untouched and matching Drive renditions are reused', () => {
  const external = 'https://images.example.test/milo.jpg?token=a%2Fb';
  const smallDrive = 'https://drive.google.com/thumbnail?id=photo_123&sz=w320';
  assert.equal(resolve(external, 180, 1), external);
  assert.equal(resolve('https://drive.google.com/file/d/photo_123/view', 180, 1), 'https://drive.google.com/file/d/photo_123/view');
  assert.equal(resolve(smallDrive, 180, 1), smallDrive);
  assert.equal(new URL(resolve(smallDrive, 180, 2)).searchParams.get('sz'), 'w640');
});

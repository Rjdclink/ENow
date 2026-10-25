import test from 'node:test';
import assert from 'node:assert/strict';
import {installGuide} from '../public/install.js';

test('iPad desktop user agents receive Home Screen instructions, not Mac Dock instructions',()=>{
  const g=installGuide({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',platform:'MacIntel',maxTouchPoints:5});
  assert.equal(g.id,'ios');assert.ok(g.steps.some(s=>s.includes('Add to Home Screen')));
});
test('Facebook and Android webviews direct installation to the device browser',()=>{
  for(const userAgent of ['Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/500.0]','Mozilla/5.0 (Linux; Android 15; Pixel 8; wv) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36']){
    const g=installGuide({userAgent});assert.equal(g.id,'embedded');assert.equal(g.copyLink,true);
  }
});
test('Mac Chrome and Safari show the correct installer for each browser',()=>{
  assert.equal(installGuide({userAgent:'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',platform:'MacIntel'}).id,'chrome');
  assert.equal(installGuide({userAgent:'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',platform:'MacIntel'}).id,'mac-safari');
});
test('Android, Windows Edge and existing installs receive suitable instructions',()=>{
  assert.equal(installGuide({userAgent:'Mozilla/5.0 (Linux; Android 15) Chrome/140.0 Mobile Safari/537.36'}).id,'android');
  assert.equal(installGuide({userAgent:'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36 Edg/140.0'}).id,'edge');
  assert.equal(installGuide({standalone:true}).id,'installed');
  assert.equal(installGuide({userAgent:'Mozilla/5.0 Android ENow/1.1.0'}).id,'installed');
});

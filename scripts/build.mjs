import {build} from 'esbuild';
import {mkdir,readdir,readFile} from 'node:fs/promises';
import {join,extname} from 'node:path';
const assets={},types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.apk':'application/vnd.android.package-archive'};
async function collect(dir,prefix=''){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,entry.name),url=prefix+'/'+entry.name;
    if(entry.isDirectory())await collect(path,url);
    else assets[url]={type:types[extname(entry.name)]||'application/octet-stream',body:(await readFile(path)).toString('base64')};
  }
}
await collect('public');
await mkdir('build',{recursive:true});
await build({entryPoints:['src/index.mjs'],outfile:'build/index.mjs',bundle:true,platform:'node',target:'node24',format:'esm',minify:true,banner:{js:"import{createRequire as __cr}from'node:module';const require=__cr(import.meta.url);"},plugins:[{name:'public-assets',setup(b){b.onLoad({filter:/static-assets\.mjs$/},()=>({contents:'export default '+JSON.stringify(assets),loader:'js'}));}}]});
console.log('Neon function built.');

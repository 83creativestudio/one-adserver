import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('publisher tag waits for image load and sends only one impression',async()=>{
 const nodes=[],pixels=[],slot={dataset:{onePlacement:'placement'},appendChild(){}};
 const ad={name:'Banner',imageUrl:'https://ads.example/image',clickUrl:'https://ads.example/click',impressionUrl:'https://ads.example/impression',width:300,height:250};
 const context={URL,fetch:async()=>({json:async()=>({ad})}),Image:function(){pixels.push(this)},document:{currentScript:{src:'https://ads.example/ad.js'},querySelectorAll:()=>[slot],createElement:(tag)=>{const element={tag,style:{},appendChild(){}};nodes.push(element);return element;}}};
 vm.runInNewContext(readFileSync(new URL('../public/ad.js',import.meta.url),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(pixels.length,0);
 const image=nodes.find(node=>node.tag==='img');assert.equal(image.src,ad.imageUrl);
 image.onload();image.onload();assert.equal(pixels.length,1);assert.equal(pixels[0].src,ad.impressionUrl);
});

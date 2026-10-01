(function(){
  var script=document.currentScript;
  if(!script)return;
  var base=new URL(script.src).origin;
  var slots=document.querySelectorAll('[data-one-placement]');
  slots.forEach(function(slot){
    if(slot.dataset.oneLoaded)return;
    slot.dataset.oneLoaded='1';
    var id=slot.dataset.onePlacement;
    fetch(base+'/api/serve?placement='+encodeURIComponent(id)).then(function(response){return response.json()}).then(function(payload){
      if(!payload.ad)return;
      var ad=payload.ad;
      var link=document.createElement('a');link.href=ad.clickUrl;link.target='_blank';link.rel='noopener noreferrer sponsored';
      var image=document.createElement('img');image.src=ad.imageUrl;image.alt=ad.name;image.width=ad.width;image.height=ad.height;image.style.maxWidth='100%';image.style.height='auto';image.style.display='block';
      link.appendChild(image);slot.appendChild(link);
      var pixel=new Image();pixel.src=ad.impressionUrl;slot._onePixel=pixel;
    }).catch(function(){/* An empty slot is the fallback. */});
  });
})();

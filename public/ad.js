(function(){
  var script=document.currentScript;
  if(!script)return;
  var base=new URL(script.src).origin;
  var media={
    mobile:window.matchMedia('(max-width: 767px)'),
    tablet:window.matchMedia('(min-width: 768px) and (max-width: 1199px)'),
    desktop:window.matchMedia('(min-width: 1200px)')
  };
  if(window.__oneAdserverScan){window.__oneAdserverScan();return;}
  function matches(slot){
    var device=slot.dataset.oneDevice || 'all';
    return device==='all' || !!(media[device] && media[device].matches);
  }
  function scan(){
    document.querySelectorAll('[data-one-placement]').forEach(function(slot){
      var eligible=matches(slot);
      if(slot.dataset.oneDevice && slot.dataset.oneDevice!=='all')slot.hidden=!eligible;
      if(!eligible || slot.dataset.oneLoaded)return;
      slot.dataset.oneLoaded='1';
      var id=slot.dataset.onePlacement;
      fetch(base+'/api/serve?placement='+encodeURIComponent(id)).then(function(response){return response.json()}).then(function(payload){
        if(!payload.ad)return;
        var ad=payload.ad;
        var link=document.createElement('a');link.href=ad.clickUrl;link.target='_blank';link.rel='noopener noreferrer sponsored';
        var image=document.createElement('img');image.alt=ad.name;image.width=ad.width;image.height=ad.height;image.style.maxWidth='100%';image.style.height='auto';image.style.display='block';
        image.onload=function(){if(slot._onePixel || !matches(slot))return;var pixel=new Image();slot._onePixel=pixel;pixel.src=ad.impressionUrl;};
        link.appendChild(image);slot.appendChild(link);
        image.src=ad.imageUrl;
      }).catch(function(){/* An empty slot is the fallback. */});
    });
  }
  window.__oneAdserverScan=scan;
  scan();
  Object.keys(media).forEach(function(device){
    if(media[device].addEventListener)media[device].addEventListener('change',scan);
    else if(media[device].addListener)media[device].addListener(scan);
  });
})();

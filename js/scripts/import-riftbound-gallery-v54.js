
// v5.4 Importador mejorado
// Cambios:
// - Extrae solo el nombre antes del primer punto.
// - Guarda imágenes oficiales.
// - Exporta cards-raw.json para depuración.
// - Preparado para detectar futuras APIs internas.

const fs=require('fs/promises');
const path=require('path');
const { chromium }=require('playwright');

(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 await page.goto('https://riftbound.leagueoflegends.com/es-es/card-gallery/',{waitUntil:'networkidle'});
 await page.waitForTimeout(5000);

 const cards=await page.evaluate(()=>{
   const imgs=[...document.querySelectorAll('img')];
   const out=[];
   for(const img of imgs){
      const alt=(img.alt||'').trim();
      const src=img.currentSrc||img.src||'';
      if(!src) continue;
      if(!/cmsassets\.rgpub\.io/.test(src)) continue;

      let name=alt;
      if(name.includes('.')) name=name.split('.')[0].trim();
      name=name.replace(/^Riftbound\s+(Unit|Spell|Gear|Legend|Battlefield):\s*/i,'');

      if(name.length<2) continue;
      out.push({name,image:src});
   }
   const m=new Map();
   out.forEach(c=>{if(!m.has(c.name))m.set(c.name,c);});
   return [...m.values()];
 });

 await fs.writeFile('data/cards-raw.json',JSON.stringify(cards,null,2));
 console.log('Cartas encontradas:',cards.length);
 await browser.close();
})();

const {E,loadDB}=require('./load.js');
module.exports=function dump(p){
for(const m of p.meals){console.log('==',m.label,m.kind,m.warnings);
 if(m.kind==='small') for(const o of m.options){ console.log('  ',o.tpl, p.dayTypes.map(d=>{const x=o.byDay[d];return d+':'+x.comps.filter(c=>!c.free).map(c=>c.id.slice(0,12)+' '+Math.round(c.g)+(c.alts.length?'['+c.alts.map(a=>a.id.slice(0,8)+' '+Math.round(a.g)).join(',')+']':'')).join(' + ')+' => '+Math.round(x.tot.K)+'k P'+E.r1(x.tot.P)+' T'+Math.round(m.targets[d].K)+'/'+E.r1(m.targets[d].P)}).join(' || '))}
 if(m.kind==='main') for(const d of p.dayTypes){const mm=m.main[d]; if(!mm){console.log('  null');continue;} console.log(' ',d,'tg',Math.round(mm.tg.K),E.r1(mm.tg.P),E.r1(mm.tg.C),E.r1(mm.tg.F),'ref',mm.ref.primo&&mm.ref.primo.id,mm.ref.primo&&mm.ref.primo.g,mm.ref.sec.id,mm.ref.sec.g,'oil',mm.oilMl,'tot',Math.round(mm.refTot.K),E.r1(mm.refTot.P));
   console.log('   primi',mm.primi.map(x=>x.ids.join('/')+' '+x.g).join(' | '));
   console.log('   secondi',mm.secondi.map(x=>x.key+' '+x.items.map(i=>Math.round(i.g)).join('+')+(x.notes.length?' ('+x.notes.join(', ')+')':'')).join(' | '));
   console.log('   cond',mm.condimenti.map(x=>x.items.map(i=>i.id.slice(0,10)+' '+Math.round(i.g)).join('+')).join(' | '));
   console.log('   legumi',JSON.stringify(mm.legumi&&{d:mm.legumi.dryG,c:mm.legumi.canG,t:mm.legumi.text}));}
}
for(const d of p.dayTypes) console.log(d,JSON.stringify({K:Math.round(p.days[d].tot.K),P:E.r1(p.days[d].tot.P),C:E.r1(p.days[d].tot.C),F:E.r1(p.days[d].tot.F),ok:p.days[d].ok,range:p.days[d].range.map(Math.round)}));
}

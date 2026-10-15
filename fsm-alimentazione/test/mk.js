const fs=require('fs'),path=require('path');
const {E,loadDB}=require('./load.js');
const D=require('../sito/docgen.js');
const JSZip=require(process.env.NPM_DIR+'/node_modules/jszip');
async function make(input,settings,seed,out){
  const db=loadDB(); const plan=E.generate(db,input,settings||{},seed||1);
  const blocks=D.buildDocModel(plan,settings||{});
  const buf=await D.makeDocx(JSZip,fs.readFileSync(path.join(__dirname,'../sito/FSM_ALIMENTAZIONE.docx')),blocks,{type:'nodebuffer',title:'x'});
  const fn=path.join(__dirname,'out',out||D.fileName(input)); fs.writeFileSync(fn,buf); return {plan,blocks,fn};
}
module.exports={make};
if(require.main===module){
  const input={name:'Filippo Messineo',goal:'Ricomposizione corporea - Fase 2 - Estremizzazione',onoff:true,on:{kcal:2000,P:165,F:65},off:{kcal:1820,P:165,F:85},nMeals:5,prefs:{flags:[]},planType:'multi'};
  make(input,{},1).then(r=>console.log(r.fn));
}

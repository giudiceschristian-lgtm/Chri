const path=require('path');
const XLSX=require(process.env.NPM_DIR+'/node_modules/xlsx');
const E=require('../sito/engine.js');
function loadDB(file){
  const wb=XLSX.readFile(file||path.join(__dirname,'../sito/Database_alimenti.xlsx'),{cellStyles:true});
  const rows=XLSX.utils.sheet_to_json(wb.Sheets['Alimenti'],{defval:null});
  const dict=wb.Sheets['Dizionario_colonne']?XLSX.utils.sheet_to_json(wb.Sheets['Dizionario_colonne'],{defval:null}):[];
  return E.buildDB(rows,dict,[]);
}
module.exports={E,XLSX,loadDB};

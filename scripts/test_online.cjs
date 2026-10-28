// Non-private fixed corpus; calls the real configured public translation service.
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({URL,TextEncoder,AbortSignal,setTimeout,console,fetch,chrome:{runtime:{onInstalled:{addListener(){}},onMessage:{addListener(){}}}}});
vm.runInContext(fs.readFileSync(path.join(root,'src/background.js'),'utf8'),context);
(async()=>{const results=[];fs.mkdirSync(path.join(root,'test-results'),{recursive:true});for(const item of JSON.parse(fs.readFileSync(path.join(root,'tests/corpus.json')))){const start=Date.now();try{results.push({...item,result:await vm.runInContext('translateText('+JSON.stringify(item.source)+')',context),ms:Date.now()-start});}catch(error){results.push({...item,error:error.message,ms:Date.now()-start});}fs.writeFileSync(path.join(root,'test-results/online-corpus.json'),JSON.stringify(results,null,2));console.log(results.at(-1));}})().catch(error=>{console.error(error);process.exitCode=1});

import {createBisContext} from '@bis/integration';
const context=createBisContext();
const button=document.getElementById('read') as HTMLButtonElement;
button.onclick=async()=>{
 button.disabled=true;
 try {
  await context.ready();
  const operationId=(document.getElementById('operation') as HTMLInputElement).value.trim();
  if(!operationId)throw Error('Enter the operation ID to inspect.');
  document.getElementById('result')!.textContent=JSON.stringify(await context.getContinueStatus(operationId),null,2);
 }catch(error){document.getElementById('result')!.textContent=error instanceof Error?error.message:'Status unavailable.';}
 finally{button.disabled=false;}
};
window.addEventListener('pagehide',()=>context.dispose(),{once:true});

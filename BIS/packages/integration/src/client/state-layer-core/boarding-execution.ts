// Session-owned work has no React lifecycle or document-visibility dependency.
// Only public operation IDs are retained here; signing state stays in the adapter.
const workers=new Map<string,Promise<unknown>>();
const key=(profileId:string,id:string)=>JSON.stringify([profileId,id]);
export function boardingWorkerActive(profileId:string,id:string) {return workers.has(key(profileId,id));}
export function runBoardingWorker<T>(profileId:string,id:string,work:()=>Promise<T>):Promise<T> {
  const owner=key(profileId,id);
  if(workers.has(owner))return Promise.reject(Error('This transfer is already processing.'));
  const result=Promise.resolve().then(work);
  workers.set(owner,result);
  const finished=()=>{if(workers.get(owner)===result)workers.delete(owner);};
  void result.then(finished,finished);
  return result;
}

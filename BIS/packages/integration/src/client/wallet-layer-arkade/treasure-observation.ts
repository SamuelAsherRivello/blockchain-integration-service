/** Bound local waiting, not remote execution. Timeout must retain a submitted operation as unknown. */
export async function observeTreasureRequest<T>(work:Promise<T>,milliseconds=15000):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([work,new Promise<never>((_resolve,reject)=>{
    timer=setTimeout(()=>reject(Error('Treasure observation is unavailable.')),milliseconds);
  })]);}finally{clearTimeout(timer);}
}

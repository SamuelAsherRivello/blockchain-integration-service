export function testLocks() {
  const held = new Map();
  return {async request(name, options, work) {
    const mode=options.mode ?? 'exclusive', current=held.get(name);
    if(current && (mode==='exclusive' || current.mode==='exclusive')) return work(null);
    const entry=current ?? {mode,count:0};entry.count++;held.set(name,entry);
    try {return await work({name,mode});}
    finally {if(--entry.count===0)held.delete(name);}
  }};
}

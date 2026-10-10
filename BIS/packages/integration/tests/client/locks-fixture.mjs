export function testLocks() {
  const held = new Map();
  return {async request(name, options, work) {
    const mode=options.mode ?? 'exclusive', current=held.get(name);
    if(current && (mode==='exclusive' || current.mode==='exclusive')) {
      if (options.ifAvailable) return work(null);
      await current.ready;
      return this.request(name, options, work);
    }
    const entry=current ?? {mode,count:0};entry.count++;held.set(name,entry);
    entry.ready ??= new Promise(resolve => entry.release=resolve);
    try {return await work({name,mode});}
    finally {if(--entry.count===0){held.delete(name);entry.release?.();}}
  }};
}

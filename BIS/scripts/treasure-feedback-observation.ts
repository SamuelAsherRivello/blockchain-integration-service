/** Browser-only passive measurement. Arm before the caller's ordinary click.
 * It never clicks, cancels, retries or changes a financial operation. A single
 * observation is not a p95 result or proof of a financial outcome.
 */
export async function observeTreasureClaimFeedback(){
  const buttons=[...document.querySelectorAll<HTMLButtonElement>('button')].filter(button=>button.textContent==='Claim LTO'&&button.getClientRects().length);
  if(buttons.length!==1||buttons[0].disabled||document.visibilityState!=='visible')throw Error('feedback-target-unavailable');
  const button=buttons[0],marker='data-bis-feedback-observing';
  if(button.hasAttribute(marker))throw Error('feedback-observation-already-active');
  return new Promise<{observed:boolean;inputReceived:boolean;trusted:boolean|null;eventToFrameMs:number|null;targetMs:100;targetMet:boolean}>(resolve=>{
    let start:number|undefined,trusted:boolean|null=null,frame:number|undefined,finished=false;
    const busy=()=>button.isConnected&&button.disabled&&button.getAttribute('aria-busy')==='true';
    const finish=(observed:boolean)=>{
      if(finished)return;finished=true;clearTimeout(timer);observer.disconnect();
      button.removeEventListener('click',input,true);button.removeAttribute(marker);
      if(frame!==undefined)cancelAnimationFrame(frame);
      const eventToFrameMs=observed&&start!==undefined?performance.now()-start:null;
      resolve({observed,inputReceived:start!==undefined,trusted,eventToFrameMs,targetMs:100,targetMet:eventToFrameMs!==null&&eventToFrameMs<=100});
    };
    const check=()=>{
      if(start===undefined||frame!==undefined||!busy())return;
      frame=requestAnimationFrame(()=>{frame=undefined;if(busy())finish(true);});
    };
    const input=(event:MouseEvent)=>{start=performance.now();trusted=event.isTrusted;check();};
    const observer=new MutationObserver(check);
    observer.observe(button,{attributes:true,attributeFilter:['disabled','aria-busy']});
    button.addEventListener('click',input,{capture:true,once:true});
    // This only bounds measurement. It cannot cancel a click already delivered.
    const timer=setTimeout(()=>finish(false),2000);
    button.setAttribute(marker,'true');
  });
}

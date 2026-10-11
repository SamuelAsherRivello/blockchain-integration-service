/** A label describes identity only; it never grants operation readiness. */
export function walletAddressLabel(input: {address?:string; selected:boolean; loading?:boolean; unavailable?:boolean}) {
  if(input.address)return {text:`${input.address.slice(0,7)}…${input.address.slice(-6)}`,title:input.address};
  if(input.unavailable)return {text:'Unavailable',title:undefined};
  if(input.loading || input.selected)return {text:'Loading…',title:undefined};
  return {text:'Not connected',title:undefined};
}

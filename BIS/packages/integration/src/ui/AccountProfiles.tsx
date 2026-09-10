import { useState } from 'react';
import type { BisContext } from '../core/context';

export function shortProfileId(profileId:string) {
  return profileId.length<=19?profileId:`${profileId.slice(0,9)}…${profileId.slice(-8)}`;
}

export function AccountProfiles({context,profiles,activeProfileId,busy=false}:{context:BisContext;profiles:readonly string[];activeProfileId?:string;busy?:boolean}) {
  const [adding,setAdding]=useState(false);
  return <div className="bis-actions bis-profile-chooser" aria-label="Saved player profiles">
    <div className="bis-profile-list">
      {profiles.map(profileId=>{
        const active=profileId===activeProfileId;
        return <button key={profileId} className={`bis-button bis-profile-choice${active?' bis-profile-active':''}`} disabled={busy} aria-current={active?'true':undefined} onClick={()=>void context.selectProfile(profileId)}>
          <span>{shortProfileId(profileId)}</span>{active&&<strong>Active</strong>}
        </button>;
      })}
    </div>
    {!adding?<button className="bis-button bis-primary" disabled={busy} onClick={()=>setAdding(true)}>Add Profile</button>:<>
      <p className="bis-field-label">Add Profile</p>
      <button className="bis-button bis-primary" disabled={busy} onClick={()=>void context.createAccount()}>⚡ Create</button>
      <button className="bis-button" disabled={busy} onClick={()=>context.openRestoreAccount()}>⚡ Restore</button>
    </>}
    <button className="bis-button bis-back" disabled={busy} onClick={()=>context.closeAccount()}>Back</button>
  </div>;
}

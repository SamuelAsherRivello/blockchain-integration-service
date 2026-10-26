/** Public transaction terms only. This is a typed candidate protocol, not an
 * active endpoint or authority to sign an arbitrary message. */
export type TreasureActorProofRequest=Readonly<{
  artifactVersion:4;branch:'reject'|'cancel'|'refund';operationId:string;
  offerSessionId:string;hostReference:string;startedAtMs:number;
  funding:Readonly<{txid:string;vout:number}>;arkTx:string;checkpoint:string;playerProof?:string;
}>;
export type TreasureActorSigningBody=Readonly<{
  id:string;operationId:string;network:'mutinynet';profileId:string;method:'signMessage';
  args:readonly [Readonly<{$type:'bytes';value:string}>,'schnorr'];
  treasureActorProof:TreasureActorProofRequest;treasureActorPlan:string;connectionToken:string;
}>;

// Test-only public fixtures. Production engine files are not modified.
package arkade

import (
 "bytes"
 "encoding/hex"
 "encoding/json"
 "fmt"
 "os"
 "testing"

 "github.com/btcsuite/btcd/txscript/v2"
 "github.com/btcsuite/btcd/wire/v2"
)

type bisActorFixture struct {
 Name string `json:"name"`
 Script string `json:"script"`
 Transaction string `json:"transaction"`
 PrevScript string `json:"prevScript"`
 InputAmount int64 `json:"inputAmount"`
 Now int64 `json:"now"`
 Expiry *int64 `json:"expiry"`
 Witness []string `json:"witness"`
}
type bisActorFetcher struct { output *wire.TxOut }
func (f bisActorFetcher) FetchPrevOutput(wire.OutPoint) *wire.TxOut { return f.output }
func (f bisActorFetcher) FetchPrevOutArkTx(wire.OutPoint) *wire.MsgTx { return nil }
func (f bisActorFetcher) FetchVtxoPrevOutPkScript(wire.OutPoint) []byte { return f.output.PkScript }

func TestBISTreasureActorAuthorizationFixtures(t *testing.T) {
 var fixtures []bisActorFixture
 if err:=json.NewDecoder(os.Stdin).Decode(&fixtures);err!=nil{t.Fatal(err)}
 if len(fixtures)==0||len(fixtures)>128{t.Fatal("fixture count outside test bounds")}
 results:=make([]bool,len(fixtures))
 for i,f:=range fixtures {
  script,err:=hex.DecodeString(f.Script);if err!=nil{t.Fatal(err)}
  raw,err:=hex.DecodeString(f.Transaction);if err!=nil{t.Fatal(err)}
  previous,err:=hex.DecodeString(f.PrevScript);if err!=nil{t.Fatal(err)}
  tx:=wire.NewMsgTx(3);if err=tx.Deserialize(bytes.NewReader(raw));err!=nil{t.Fatal(err)}
  if len(tx.TxIn)!=1{t.Fatal("fixture must have one exact input")}
  fetcher:=bisActorFetcher{&wire.TxOut{Value:f.InputAmount,PkScript:previous}}
  vm,err:=NewEngine(script,tx,0,txscript.NewSigCache(8),nil,f.InputAmount,fetcher)
  if err!=nil{continue}
  vm.currentTime=BigNumFromInt64(f.Now)
  vm.expiry=f.Expiry
  stack:=make([][]byte,len(f.Witness))
  for j,encoded:=range f.Witness{stack[j],err=hex.DecodeString(encoded);if err!=nil{t.Fatal(err)}}
  vm.SetStack(stack)
  results[i]=vm.Execute()==nil
 }
 encoded,err:=json.Marshal(results);if err!=nil{t.Fatal(err)}
 fmt.Printf("BIS_ACTOR_RESULTS=%s\n",encoded)
}

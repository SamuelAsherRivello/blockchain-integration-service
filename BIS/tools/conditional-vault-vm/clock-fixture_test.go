// Copied as a test-only file into the pinned upstream arkade package.
// Only the clock is supplied by the fixture. Production VM code is unchanged.
package arkade

import (
 "encoding/hex"
 "encoding/json"
 "fmt"
 "os"
 "testing"
 "github.com/btcsuite/btcd/txscript/v2"
 "github.com/btcsuite/btcd/wire/v2"
)
type bisOutput struct { Script string `json:"script"`; Amount int64 `json:"amount"` }
type bisFixture struct {
 Script string `json:"script"`
 InputAmount int64 `json:"inputAmount"`
 Outputs []bisOutput `json:"outputs"`
 Inputs int `json:"inputs"`
 Now int64 `json:"now"`
}
type bisFetcher struct { amount int64 }
func (f bisFetcher) FetchPrevOutput(wire.OutPoint) *wire.TxOut { return &wire.TxOut{Value:f.amount,PkScript:[]byte{0x51}} }
func (f bisFetcher) FetchPrevOutArkTx(wire.OutPoint) *wire.MsgTx { return nil }
func (f bisFetcher) FetchVtxoPrevOutPkScript(wire.OutPoint) []byte { return []byte{0x51} }
func TestBISConditionalVaultClockFixtures(t *testing.T) {
 var fixtures []bisFixture
 if err:=json.NewDecoder(os.Stdin).Decode(&fixtures);err!=nil{t.Fatal(err)}
 results:=make([]bool,len(fixtures))
 for i,f:=range fixtures {
  script,err:=hex.DecodeString(f.Script);if err!=nil{t.Fatal(err)}
  tx:=wire.NewMsgTx(2)
  for j:=0;j<f.Inputs;j++ {tx.AddTxIn(&wire.TxIn{Sequence:0xffffffff})}
  for _,o:=range f.Outputs {pk,err:=hex.DecodeString(o.Script);if err!=nil{t.Fatal(err)};tx.AddTxOut(&wire.TxOut{Value:o.Amount,PkScript:pk})}
  vm,err:=NewEngine(script,tx,0,txscript.NewSigCache(8),nil,f.InputAmount,bisFetcher{f.InputAmount})
  if err!=nil{continue}
  vm.currentTime=BigNumFromInt64(f.Now)
  results[i]=vm.Execute()==nil
 }
 encoded,err:=json.Marshal(results);if err!=nil{t.Fatal(err)}
 fmt.Printf("BIS_RESULTS=%s\n",encoded)
}

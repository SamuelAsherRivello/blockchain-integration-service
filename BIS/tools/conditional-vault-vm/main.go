// Builds inside the pinned upstream emulator module. Input/output contain public fixtures only.
package main

import (
 "bytes"
 "encoding/hex"
 "encoding/json"
 "fmt"
 "os"
 "github.com/arkade-os/emulator/pkg/arkade"
 "github.com/btcsuite/btcd/txscript/v2"
 "github.com/btcsuite/btcd/wire/v2"
)

type output struct { Script string `json:"script"`; Amount int64 `json:"amount"` }
type fixture struct {
 Script string `json:"script"`
 InputAmount int64 `json:"inputAmount"`
 Outputs []output `json:"outputs"`
 Inputs int `json:"inputs"`
 BitcoinTx string `json:"bitcoinTx"`
 PreviousScript string `json:"previousScript"`
}
type fetcher struct { amount int64; script []byte }
func (f fetcher) FetchPrevOutput(wire.OutPoint) *wire.TxOut { script:=f.script; if len(script)==0 {script=[]byte{0x51}}; return &wire.TxOut{Value:f.amount, PkScript:script} }
func (f fetcher) FetchPrevOutArkTx(wire.OutPoint) *wire.MsgTx { return nil }
func (f fetcher) FetchVtxoPrevOutPkScript(wire.OutPoint) []byte { return []byte{0x51} }

func execute(f fixture) error {
 if f.BitcoinTx!="" {
  raw,err:=hex.DecodeString(f.BitcoinTx);if err!=nil{return err}
  tx:=wire.NewMsgTx(2);if err=tx.Deserialize(bytes.NewReader(raw));err!=nil{return err}
  pk,err:=hex.DecodeString(f.PreviousScript);if err!=nil{return err}
  prev:=fetcher{amount:f.InputAmount,script:pk}
  hashes:=txscript.NewTxSigHashes(tx,prev)
  engine,err:=txscript.NewEngine(pk,tx,0,txscript.StandardVerifyFlags,txscript.NewSigCache(8),hashes,f.InputAmount,prev)
  if err!=nil{return err};return engine.Execute()
 }
 script, err := hex.DecodeString(f.Script); if err != nil { return err }
 tx := wire.NewMsgTx(2)
 if f.Inputs < 1 || f.Inputs > 8 || len(f.Outputs) > 8 { return fmt.Errorf("invalid fixture") }
 for i:=0; i<f.Inputs; i++ { tx.AddTxIn(&wire.TxIn{Sequence:0xffffffff}) }
 for _, o := range f.Outputs { pk, err := hex.DecodeString(o.Script); if err != nil { return err }; tx.AddTxOut(&wire.TxOut{Value:o.Amount, PkScript:pk}) }
 prev := fetcher{amount:f.InputAmount}
 engine, err := arkade.NewEngine(script, tx, 0, txscript.NewSigCache(8), nil, f.InputAmount, prev)
 if err != nil { return err }
 return engine.Execute()
}
func main() {
 var fixtures []fixture
 if err := json.NewDecoder(os.Stdin).Decode(&fixtures); err != nil { os.Exit(2) }
 results := make([]bool,len(fixtures))
 for i,f := range fixtures { err := execute(f); results[i] = err==nil; if err!=nil && os.Getenv("BIS_VM_DIAGNOSTICS")=="1" { fmt.Fprintf(os.Stderr,"fixture %d: %v\n",i,err) } }
 if err := json.NewEncoder(os.Stdout).Encode(results); err != nil { os.Exit(2) }
}

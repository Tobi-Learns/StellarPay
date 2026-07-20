import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, Networks, TransactionBuilder, WebAuth } from "@stellar/stellar-sdk";
import { verifyWalletChallenge } from "./wallet-challenge.ts";

function fixture() {
  const server = Keypair.random();
  const owner = Keypair.random();
  const domain = "stellarpay.example";
  const xdr = WebAuth.buildChallengeTx(server, owner.publicKey(), domain, 300, Networks.TESTNET, domain);
  const signed = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  signed.sign(owner);
  return { server, owner, domain, xdr, signedXdr: signed.toXDR() };
}

test("accepts the selected wallet signature on the bound network and domain", () => {
  const value = fixture();
  assert.doesNotThrow(() => verifyWalletChallenge({
    originalXdr: value.xdr,
    signedXdr: value.signedXdr,
    address: value.owner.publicKey(),
    network: Networks.TESTNET,
    homeDomain: value.domain,
    serverAddress: value.server.publicKey(),
  }));
});

test("rejects a wrong signer", () => {
  const value = fixture();
  const attacker = Keypair.random();
  const signed = TransactionBuilder.fromXDR(value.xdr, Networks.TESTNET);
  signed.sign(attacker);
  assert.throws(() => verifyWalletChallenge({
    originalXdr: value.xdr,
    signedXdr: signed.toXDR(),
    address: value.owner.publicKey(),
    network: Networks.TESTNET,
    homeDomain: value.domain,
    serverAddress: value.server.publicKey(),
  }));
});

test("rejects tampering and wrong domain bindings", () => {
  const value = fixture();
  const other = fixture();
  assert.throws(() => verifyWalletChallenge({
    originalXdr: other.xdr,
    signedXdr: value.signedXdr,
    address: value.owner.publicKey(),
    network: Networks.TESTNET,
    homeDomain: value.domain,
    serverAddress: value.server.publicKey(),
  }), /changed/);
  assert.throws(() => verifyWalletChallenge({
    originalXdr: value.xdr,
    signedXdr: value.signedXdr,
    address: value.owner.publicKey(),
    network: Networks.TESTNET,
    homeDomain: "wrong.example",
    serverAddress: value.server.publicKey(),
  }));
  assert.throws(() => verifyWalletChallenge({
    originalXdr: value.xdr,
    signedXdr: value.signedXdr,
    address: value.owner.publicKey(),
    network: Networks.PUBLIC,
    homeDomain: value.domain,
    serverAddress: value.server.publicKey(),
  }));
});

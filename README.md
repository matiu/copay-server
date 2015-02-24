# bitcore-wallet-service


[![Build Status](https://img.shields.io/travis/bitpay/bitcore-wallet-service.svg?branch=master&style=flat-square)](https://travis-ci.org/bitpay/bitcore-wallet-service)
[![Coverage Status](https://coveralls.io/repos/bitpay/bitcore-wallet-service/badge.svg?branch=master)](https://coveralls.io/r/bitpay/bitcore-wallet-service?branch=master)


A Multisig HD Wallet Service, with minimun server trust.

# Quick Guide

``` bash
 # Start the server
 npm ./app.js
 
 # Try the CLI interface
 cd bit-wallet
 
 # Create a 2-of-2 wallet (john.dat is the file where the wallet critical data will be stored, add -t for testnet)
 ./bit  create 2-2 john 
  * Secret to share:
    JevjEwaaxW6gdAZjqgWcimL525DR8zQsAXf4cscWDa8u1qKTN5eFGSFssuSvT1WySu4YYLYMUPT
 ./bit  status
 
 # Use -h or BIT_HOST to setup the base URL for your server.
 # Use -f or BIT_FILE to setup the wallet data file
 
 # Join the wallet from other copayer
   ./bit -f pete.dat join JevjEwaaxW6gdAZjqgWcimL525DR8zQsAXf4cscWDa8u1qKTN5eFGSFssuSvT1WySu4YYLYMUPT
   
   export BIT_FILE=pete.dat
   ./bit -f pete.dat status
   ./bit address 
   ./bit balance
   
 # Spend coins. Amount can be specified in btc, bit or sat (default)
   ./bit send 1xxxxx 100bit "100 bits to mother"

 # You can use 100bit or 0.00001btc or 10000sat.  (Set up BIT_UNIT to btc/sat/bit so select output unit).

 # List pending TX Proposals
   ./bit status
   
 # Sign or reject TXs from other copayers
   ./bit -f pete.dat reject <id>
   ./bit -f pete.dat sign <id>
   
   # List all commands:
    ./bit --help
 
    
  ```
  
  
# Local  data

Copayers store its extended private key and their copayer's extended public key locally. We call this the ``Wallet Critical Data``. Extended private keys are never sent to the server.
  
  
# Password protection 

Local data can be encrypted by the bit-wallet. Use the `-n` parameter to define the access level permited for no password operation. Available access levels are: `none` (password is required for everything, localfile is fully encrypted) `readonly`, `readwrite` and `full` (password is not ever required, local file is fully unencrypted) .

### encrypts everything by default
```
bit create myWallet 2-3 --nopasswd none  
Password:
```

### allows readonly operations without password (encrypts xpriv, and leave readonlySigningKey unencrypted)
```
bit create myWallet 2-3 -p --nopasswd readonly
```
### allows readwrite operations without password (only encrypts xpriv)
```
bit create myWallet 2-3 -p --nopasswd readwrite
```
 

# Advanced Operation

## Mobility
You can safely access a wallet from different devices. Just copy the wallet file (`bit.dat` by default). If you need to reduce the file to the mínimum (for example to fit it on a QR) or change it's access level (by removing certain data on it), see `export` in the following section.

## Export, with different access levels
It is possible to export a wallet with restricted access level. The levels are:

    readonly : allows to read wallet data: balance, tx proposals 
    readwrite: + allows to create addresses and unsigned tx prposals 
    full     : + allows sign tx prposals 

`readonly` will only export the Wallet's Extended PublicKeys, and only the derived private key required for signing 'GET' request (readonly) to the server. `readwrite` will add the derived private key required for signing all other requests (as POST) so readwrite access will be possible. And `full` will export also the Extended Private Key, which is necesary for signing wallet's transactions.  `bit import` can handle any for the levels correctly.


```
# full access
bit export -o wallet.dat
# readonly access 
bit export -o wallet.dat --access readonly
# readwrite access (can create addresses, propose transactions, reject TX, but does not have signing keys)

# Import the wallet , with giveng access level
bit import wallet.dat

# Export also support QR output:
bit export --qr
```

## Export / Import with a new given password (TODO)
```
bit export -o output.dat -e
bit import output.dat 
```

## If you need to migrate to other server, after importing the wallet use `recreate` 
```
bit recreate 
```

# Airgapped Operation

### On the Air-gapped device
```
bit genkey
bit export -o wallet.dat --readonly  (or --nosigning)
```
### Proxy machine
```
bit join secret -i wallet.dat
bit balance
# Export pending transaction to be signed offline
bit txproposals -o txproposals.dat
```

## Back to air-gapped device

### To check tx proposals:
```
bit txproposals -i txproposals.dat
```
First time txproposals is running on the air gapped devices, the public keys of the copayers will be imported from the txproposals archive. That information is exported automatically by the proxy machine, and encrypted copayer's xpriv derivatives.

### Sign them
```
bit sign  -i txproposals.dat -o txproposals-signed.dat
# Or With filter
bit sign  e01e -i txproposals.dat -o txproposals-signed.dat
```
## Back to proxy machine
```
bit sign -i txproposals-signed.dat
```


# Security Considerations
 * Private keys are never send to the server. Copayers store them locally.
 * Extended public keys are stored on the server. This allows the server to easily check wallet balance, send offline notifications to copayers, etc.
 * During wallet creation a wallet secret is created by the initial copayer containg a private key. All copayers need to prove they have the secret by signing their information with this private key when joining the wallet. The secret should be shared using secured channels.

## All server responses are verified:
  * Addresses, change addresses are derived independently and locally by the copayers from their local data.
  * TX Proposals templates are signed by copayers, and verified by others, so the server cannot create / tamper them

## Notes
 * A copayer could join the wallet more than once, and there is no mechanism to prevent it. Copayers should use the command 'confirm' to check other copayer's identity.

##  In case the server is compromised
 * It could be possible to see past (and future) wallet's transactions.
 * It is not possible to spend wallet funds, since private keys are never sent nor stored at the server
 * It is not possible to tamper tx proposals or wallet addresses since they are computed and verified by copayers
 * Copayers could switch to another server using their local data (see `recreate` command). In this case only the wallet extended data will be lost (pending and past transaction proposals, some copayer metadata).


  
# Server API

## create a wallet
 POST  `/v1/wallets`
## join a wallet
 POST  `/v1/wallets/:id/copayers`

 ...

 [To be completed, see expressapp.js]
 



'use strict';

var _ = require('lodash');
var util = require('util');
var $ = require('preconditions').singleton();
var Uuid = require('uuid');

var Address = require('./address');
var Copayer = require('./copayer');
var AddressManager = require('./addressmanager');
var WalletUtils = require('../walletutils');

function Wallet() {
  this.version = '1.0.0';
};

Wallet.create = function(opts) {
  opts = opts || {};

  var x = new Wallet();

  x.createdOn = Math.floor(Date.now() / 1000);
  x.id = Uuid.v4();
  x.name = opts.name;
  x.m = opts.m;
  x.n = opts.n;
  x.status = 'pending';
  x.publicKeyRing = [];
  x.addressIndex = 0;
  x.copayers = [];
  x.pubKey = opts.pubKey;
  x.network = opts.network;
  x.addressManager = AddressManager.create();

  return x;
};

Wallet.fromObj = function(obj) {
  var x = new Wallet();

  x.createdOn = obj.createdOn;
  x.id = obj.id;
  x.name = obj.name;
  x.m = obj.m;
  x.n = obj.n;
  x.status = obj.status;
  x.publicKeyRing = obj.publicKeyRing;
  x.copayers = _.map(obj.copayers, function(copayer) {
    return Copayer.fromObj(copayer);
  });
  x.pubKey = obj.pubKey;
  x.network = obj.network;
  x.addressManager = AddressManager.fromObj(obj.addressManager);

  return x;
};

/* For compressed keys, m*73 + n*34 <= 496 */
Wallet.COPAYER_PAIR_LIMITS = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 4,
  6: 4,
  7: 3,
  8: 3,
  9: 2,
  10: 2,
  11: 1,
  12: 1,
};

/**
 * Get the maximum allowed number of required copayers.
 * This is a limit imposed by the maximum allowed size of the scriptSig.
 * @param {number} totalCopayers - the total number of copayers
 * @return {number}
 */
Wallet.getMaxRequiredCopayers = function(totalCopayers) {
  return Wallet.COPAYER_PAIR_LIMITS[totalCopayers];
};

Wallet.verifyCopayerLimits = function(m, n) {
  return (n >= 1 && n <= 12) && (m >= 1 && m <= Wallet.COPAYER_PAIR_LIMITS[n]);
};

Wallet.prototype.isShared = function() {
  return this.n > 1;
};

Wallet.prototype.addCopayer = function(copayer) {
  this.copayers.push(copayer);

  if (this.copayers.length < this.n) return;

  this.status = 'complete';
  this.publicKeyRing = _.pluck(this.copayers, 'xPubKey');
};

Wallet.prototype.getCopayer = function(copayerId) {
  return _.find(this.copayers, {
    id: copayerId
  });
};

Wallet.prototype.getNetworkName = function() {
  return this.network;
};


Wallet.prototype.getPublicKey = function(copayerId, path) {
  var copayer = this.getCopayer(copayerId);
  return copayer.getPublicKey(path);
};

Wallet.prototype.isComplete = function() {
  return this.status == 'complete';
};

Wallet.prototype.createAddress = function(isChange) {
  $.checkState(this.isComplete());

  var path = this.addressManager.getNewAddressPath(isChange);
  return Address.create(WalletUtils.deriveAddress(this.publicKeyRing, path, this.m, this.network));
};


module.exports = Wallet;

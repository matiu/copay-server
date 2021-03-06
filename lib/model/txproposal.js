'use strict';

var _ = require('lodash');
var Uuid = require('uuid');
var Bitcore = require('bitcore');
var Address = Bitcore.Address;

var TxProposalAction = require('./txproposalaction');

function TxProposal() {
  this.version = '1.0.0';
};

TxProposal.create = function(opts) {
  opts = opts || {};

  var x = new TxProposal();

  var now = Date.now();
  x.createdOn = Math.floor(now / 1000);
  x.id = ('00000000000000' + now).slice(-14) + Uuid.v4();
  x.creatorId = opts.creatorId;
  x.toAddress = opts.toAddress;
  x.amount = opts.amount;
  x.message = opts.message;
  x.proposalSignature = opts.proposalSignature;
  x.changeAddress = opts.changeAddress;
  x.inputs = [];
  x.inputPaths = [];
  x.requiredSignatures = opts.requiredSignatures;
  x.requiredRejections = opts.requiredRejections;
  x.status = 'pending';
  x.actions = {};

  return x;
};

TxProposal.fromObj = function(obj) {
  var x = new TxProposal();

  x.version = obj.version;
  x.createdOn = obj.createdOn;
  x.id = obj.id;
  x.creatorId = obj.creatorId;
  x.toAddress = obj.toAddress;
  x.amount = obj.amount;
  x.message = obj.message;
  x.proposalSignature = obj.proposalSignature;
  x.changeAddress = obj.changeAddress;
  x.inputs = obj.inputs;
  x.requiredSignatures = obj.requiredSignatures;
  x.requiredRejections = obj.requiredRejections;
  x.status = obj.status;
  x.txid = obj.txid;
  x.inputPaths = obj.inputPaths;
  x.actions = obj.actions;
  _.each(x.actions, function(action, copayerId) {
    x.actions[copayerId] = TxProposalAction.fromObj(action);
  });

  return x;
};


TxProposal.prototype._updateStatus = function() {
  if (this.status != 'pending') return;

  if (this.isRejected()) {
    this.status = 'rejected';
  } else if (this.isAccepted()) {
    this.status = 'accepted';
  }
};


TxProposal.prototype._getCurrentSignatures = function() {
  var acceptedActions = _.filter(this.actions, function(x) {
    return x && x.type == 'accept';
  });

  return _.map(acceptedActions, function(x) {
    return {
      signatures: x.signatures,
      xpub: x.xpub,
    };
  });
};

TxProposal.prototype._getBitcoreTx = function() {
  var self = this;

  var t = new Bitcore.Transaction();

  _.each(this.inputs, function(i) {
    t.from(i, i.publicKeys, self.requiredSignatures)
  });

  t.to(this.toAddress, this.amount)
    .change(this.changeAddress);

  t._updateChangeOutput();

  var sigs = this._getCurrentSignatures();
  _.each(sigs, function(x) {
    self._addSignaturesToBitcoreTx(t, x.signatures, x.xpub);
  });

  return t;
};

TxProposal.prototype.getNetworkName = function() {
  return Bitcore.Address(this.toAddress).toObject().network;
};

TxProposal.prototype.getRawTx = function() {
  var t = this._getBitcoreTx();

  return t.serialize();
};


/**
 * getActors
 *
 * @return {String[]} copayerIds that performed actions in this proposal (accept / reject)
 */
TxProposal.prototype.getActors = function() {
  return _.keys(this.actions);
};


/**
 * getActionBy
 *
 * @param {String} copayerId
 * @return {Object} type / createdOn
 */
TxProposal.prototype.getActionBy = function(copayerId) {
  return this.actions[copayerId];
};

TxProposal.prototype.addAction = function(copayerId, type, comment, signatures, xpub) {
  var action = TxProposalAction.create({
    copayerId: copayerId,
    type: type,
    signatures: signatures,
    xpub: xpub,
    comment: comment,
  });
  this.actions[copayerId] = action;
  this._updateStatus();
};

TxProposal.prototype._addSignaturesToBitcoreTx = function(t, signatures, xpub) {
  var self = this;

  if (signatures.length != this.inputs.length)
    throw new Error('Number of signatures does not match number of inputs');

  var oks = 0,
    i = 0,
    x = new Bitcore.HDPublicKey(xpub);

  _.each(signatures, function(signatureHex) {
    var input = self.inputs[i];
    try {
      var signature = Bitcore.crypto.Signature.fromString(signatureHex);
      var pub = x.derive(self.inputPaths[i]).publicKey;
      var s = {
        inputIndex: i,
        signature: signature,
        sigtype: Bitcore.crypto.Signature.SIGHASH_ALL,
        publicKey: pub,
      };
      i++;

      t.applySignature(s);
      oks++;
    } catch (e) {};
  });

  if (oks != t.inputs.length)
    throw new Error('Wrong signatures');
};


TxProposal.prototype.sign = function(copayerId, signatures, xpub) {
  try {
    // Tests signatures are OK
    var t = this._getBitcoreTx();
    this._addSignaturesToBitcoreTx(t, signatures, xpub);

    this.addAction(copayerId, 'accept', null, signatures, xpub);
    return true;
  } catch (e) {
    return false;
  }
};

TxProposal.prototype.reject = function(copayerId, reason) {
  this.addAction(copayerId, 'reject', reason);
};

TxProposal.prototype.isPending = function() {
  return !_.contains(['broadcasted', 'rejected'], this.status);
};

TxProposal.prototype.isAccepted = function() {
  var votes = _.countBy(_.values(this.actions), 'type');
  return votes['accept'] >= this.requiredSignatures;
};

TxProposal.prototype.isRejected = function() {
  var votes = _.countBy(_.values(this.actions), 'type');
  return votes['reject'] >= this.requiredRejections;
};

TxProposal.prototype.isBroadcasted = function() {
  return this.status == 'broadcasted';
};

TxProposal.prototype.setBroadcasted = function(txid) {
  this.txid = txid;
  this.status = 'broadcasted';
};

module.exports = TxProposal;

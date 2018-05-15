// Game2048Contract stores players score 
// Player can update their score and see best scores
// Built for Nebulas Incentive Program by Zenack

var Game2048Contract = function () {
  // Data stored by the smart contract
  LocalContractStorage.defineProperty(this, "player_count")
  LocalContractStorage.defineMapProperty(this, "player_to_id")
  LocalContractStorage.defineMapProperty(this, "id_to_score")
}

Game2048Contract.prototype = {
  // Init is called once, when the contract is deployed
  init: function () {
    this.player_count = 0;
  },

  // send player score to the smart contract
  postScore: function (name, score) {
    // Users only pay the gas fee.
    if (Blockchain.transaction.value != 0) {
      throw new Error("I don't want your money.");
    }

    // Check if name is not empty
    if (!name || name.length === 0) {
      throw new Error("Name is empty");
    }

    // Check if name is not empty
    if (!score || score.length === 0) {
      throw new Error("Score is empty");
    }

    // Get player id for the transaction
    var player_id = this.player_to_id.get(Blockchain.transaction.from);
    if (!player_id) {
      // First score from this player, we assign a new ID
      player_id = this.player_count;
      this.player_count++;
      this.player_to_id.put(Blockchain.transaction.from, player_id);
    }

    // Add score to player
    this.id_to_score.put(player_id, { player_id, name, score, date: Date.now() });
  },

  // get player score 
  getMyScore: function () {
    var player_id = this.player_to_id.get(Blockchain.transaction.from);
    if (player_id) {
      return this.id_to_score.get(player_id);
    }
  },

  // get all scores 
  getScores: function () {
    var scores = [];

    for (var i = 0; i < this.player_count; i++) {
      var player_score = this.id_to_score.get(i);
      scores.push(player_score);
    }

    return scores;
  },

  // get player count
  getPlayerCount: function () {
    return this.player_count;
  },
}

module.exports = Game2048Contract

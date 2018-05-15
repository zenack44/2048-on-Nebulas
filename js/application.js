// Global variables used by our Dapp
var contract_address = "n1rptWohgwPUH511Mn7Lr2LNE6nmd94gMZ9";
var user_account = null;

// Gas hard coded for simplicity, ideally your app would allow for changing the gas price, etc.
var is_mainnet = true;
var nebulas_chain_id, nebulas_domain;
var gas_price = 1000000;
var gas_limit = 200000;

var score_is_saved = false;
var player_has_nas = false;

if (is_mainnet) {
  nebulas_chain_id = 1;
  nebulas_domain = "https://mainnet.nebulas.io";
} else {
  nebulas_chain_id = 1001;
  nebulas_domain = "https://testnet.nebulas.io";
}

// The nebulas API, used for signing transactions, etc
var nebulas = require("nebulas");
var neb = new nebulas.Neb();
neb.setRequest(new nebulas.HttpRequest(nebulas_domain));

// Adds the wallet selection workflow, from the Nebulas wallet
uiBlock.insert({
  selectWalletFile: [".select-wallet-file", onUnlockFile]
});

$(".app-notice").hide();

// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function () {
  new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);
});

// Reload page
function reload() {
  window.location.reload();
}

// Restart ame
function restart() {
  score_is_saved = false;
}

// Convert date from timestamp 
function timeConverter(UNIX_timestamp) {
  var a = new Date(UNIX_timestamp);
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var year = a.getFullYear();
  var month = months[a.getMonth()];
  var date = a.getDate();
  var time = date + ' ' + month + ' ' + year;
  return time;
}

// Called by the Refresh button
function onLoad() {
  // Call Nebulas Network
  neb.api.call({
    from: contract_address, // Using the contract here so this can be called without loggin on.
    to: contract_address,
    value: 0,
    nonce: 0, // Nonce is irrelavant when read-only (there is no transaction charge)
    gasPrice: gas_price,
    gasLimit: gas_limit,
    contract: { function: "getScores" }
  }).then(function (resp) {
    $("#top_scores").empty();

    var scores = JSON.parse(resp.result);

    // Sort scores
    var sortedScores = scores.slice(0);
    sortedScores.sort(function (a, b) {
      var x = a.score;
      var y = b.score;
      return x > y ? -1 : x < y ? 1 : 0;
    });

    var max = (sortedScores.length > 20) ? 20 : sortedScores.length;

    if (max > 0) {
      $("#top_scores").append("<p><strong class=\"important\">Highest scores</strong></p>");

      // Print top 20 players by score
      for (var i = 0; i < max; i++) {
        var $span = $("<span></span>").text(
          sortedScores[i]["name"] + " - "
          + sortedScores[i]["score"] + " - "
          + timeConverter(sortedScores[i]["date"]));
        $("#top_scores").append($span);
        $("#top_scores").append("<br>");
      }

      $("#top_scores").append("<hr>");
    }
  });
}

// Called by the post button
function onClickPostScore() {
  // Player has to be connected
  if (!user_account) {
    swal({
      title: "Oops!",
      text: "You have to connect your nebulas wallet\nto save your score on the blockchain",
      icon: "warning",
      button: false,
    });
  }
  // Player has NAS to send the transaction
  else if (!player_has_nas) {
    swal({
      title: "Oops!",
      text: "You don't have enough NAS on your wallet\n to pay gas for the transaction",
      icon: "warning",
      button: false,
    });
  }
  // Player has to enter a name
  else if (!$("#name").val() || $("#name").val().length === 0) {
    swal({
      title: "Almost good!",
      text: "You should enter a name.",
      icon: "warning",
      button: false,
    });
    // Score already saved
  } else if (score_is_saved) {
    swal({
      title: "Click on New Game",
      text: "You score has already been saved.",
      icon: "warning",
      button: false,
    });
  } else {

    try {
      // Get value from page with jquery
      var name = $("#name").val();
      var score = $("#score").text();
      if (score.includes("+")) {
        score = score.substring(0, score.indexOf('+'));
      }

      // Every transaction has a sequential ID, called 'Nonce'
      neb.api.getAccountState(user_account.getAddressString())
        .then(function (resp) {
          var nonce = parseInt(resp.nonce) + 1;
          var gTx = new nebulas.Transaction(
            nebulas_chain_id,
            user_account,
            contract_address,
            0,
            nonce,
            gas_price,
            gas_limit,
            {
              function: "postScore",
              args: JSON.stringify([name, score])
            });

          gTx.signTransaction();
          neb.api.sendRawTransaction(gTx.toProtoString());
        });

      // Prevent to send two times the same score
      score_is_saved = true;

      // Success
      swal({
        title: "Good Game!",
        text: "You score has been saved on the blockchain!",
        icon: "success",
        button: false,
      });
    }
    catch (err) {
      swal({
        title: "Oups!",
        text: "You score has not been saved on the blockchain.",
        icon: "error",
        button: false,
      });
    }
  }
}

// Called by the Nebulas library when the user selects their wallet file and enters the password.
function onUnlockFile(swf, fileJson, account, password) {

  // Remove notice if exist
  var $notice = $(".app-notice");
  if ($notice.length) {
    $notice.remove();
  }

  // Password must be filled
  if ($.trim(password) == "") {
    $("<div class=\"app-notice ko\"><p>Password field is empty</p></div>").insertAfter(".above-game");
  } else {
    try {
      account.fromKey(fileJson, password); // Load account information 
      user_account = account; // Save it in a global variable

      //select-wallet-file
      $("<div class=\"app-notice ok\"><p><strong class=\"important\">Connected : </strong>" +
        user_account.getAddressString() + "</p></div>").insertAfter(".above-game");
      $(".select-wallet-file").hide();
      $("#send_score").attr("disabled", false);

      if (user_account) {
        // This second call only happens when the user is logged in
        neb.api.call({
          from: user_account.getAddressString(),
          to: contract_address,
          value: 0,
          nonce: 0,
          gasPrice: gas_price,
          gasLimit: gas_limit,
          contract: { function: "getMyScore" }
        }).then(function (resp) {
          var player_score = JSON.parse(resp.result);
          if (player_score) {
            var content = "<p><strong class=\"important\">My score</strong><br /> " +
              player_score["name"] + " - " + player_score["score"] + " - " + timeConverter(player_score["date"]) + "<p>";
            $("#my_score").empty();
            $("#my_score").append(content);
          }
        });
      }

      // Get user information
      neb.api.getAccountState(user_account.getAddressString())
        .then(function (resp) {
          if (resp.error) {
            throw new Error(resp.error);
          } else if (resp.balance > gas_price) {
            player_has_nas = true;
          }
        });
    }
    catch (err) {
      $("<div class=\"app-notice ko\"><p>" + err.message + "</p></div>").insertAfter(".above-game");
    }
  }

  // Show notice
  $(".app-notice").show();
}

onLoad();
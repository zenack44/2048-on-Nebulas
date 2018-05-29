// Wait till the browser is ready to render the game (avoids glitches)
window.requestAnimationFrame(function() {
  new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager);
});

// Global variables used by our Dapp
var contract_address = "n1rptWohgwPUH511Mn7Lr2LNE6nmd94gMZ9";
var player_address = null;
var nebulas = require("nebulas"), Account = Account, neb = new nebulas.Neb();
neb.setRequest(new nebulas.HttpRequest("https://mainnet.nebulas.io"))

var NebPay = require("nebpay");
var nebPay = new NebPay();

var isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
var notice = null;
var gas_price = 1000000;
var gas_limit = 200000;
var score_is_saved = false;

// Check if the extension is installed
if (!isChrome) {
  $("<div class=\"app-notice ko\"><p>To submit your score on the blockchain, please use : " +
      "<a href=\"https://www.google.com/chrome/\" target=\"_blank\"> Chrome</a></p></div>").insertAfter(".above-game");
} else if (typeof(webExtensionWallet) === "undefined") {
  $("<div class=\"app-notice ko\"><p>To submit your score, please install : " +
      "<a href=\"https://github.com/ChengOrangeJu/WebExtensionWallet\" target=\"_blank\"> Nebulas Web Extension Wallet</a></p></div>").insertAfter(".above-game");
}

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

// Called on page load
function onLoad() {
  // Call Nebulas Network
  neb.api.call({
      from: contract_address, // Using the contract here so this can be called without loggin on.
      to: contract_address,
      value: 0,
      nonce: 0, // Nonce is irrelavant when read-only (there is no transaction charge)
      gasPrice: gas_price,
      gasLimit: gas_limit,
      contract: {
          function: "getScores"
      }
  }).then(function(resp) {
      $("#top_scores").empty();

      var scores = JSON.parse(resp.result);

      // Sort scores
      var sortedScores = scores.slice(0);
      sortedScores.sort(function(a, b) {
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
                  sortedScores[i]["name"] + " - " +
                  sortedScores[i]["score"] + " - " +
                  timeConverter(sortedScores[i]["date"]));
              $("#top_scores").append($span);
              $("#top_scores").append("<br>");
          }

          $("#top_scores").append("<hr>");
      }
  });
}

// Called by the post score button
function onClickPostScore() {

  if (typeof(webExtensionWallet) === "undefined") {
      swal({
          title: "Oops!",
          text: "You have to install Nebulas Web Wallet Extension\nto save your score on the blockchain",
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

          var callArgs = "[\"" + $("#input_title").val() + "\",\"" + $("#input_content").val() + "\"]";

          nebPay.call(contract_address, 0, "postScore", JSON.stringify([name, score]), {
              listener: function(resp) {

                if(resp.indexOf('Error') = -1){
                  // Prevent to send two times the same score
                  score_is_saved = true;

                  // Success
                  swal({
                      title: "Thank you!",
                      text: "You score has been saved on the blockchain!",
                      icon: "success",
                      button: false,
                  });
                }
              }
          });
      } catch (err) {
          swal({
              title: "Oups!",
              text: "You score has not been saved on the blockchain.",
              icon: "error",
              button: false,
          });
      }
  }
}

// Load page
onLoad();
window.postMessage({
  "target": "contentscript",
  "data": {},
  "method": "getAccount",
}, "*");

// Listen message from contentscript
window.addEventListener('message', function(e) {

  var $notice = $(".app-notice");

  // If user is connected to his wallet
  if (e && e.data && !!e.data.data.account) {
      // Remove notice
      if ($notice.length) {
          $notice.remove();
      }
      // notice = "<div class=\"app-notice ok\"><p><strong class=\"important\">Connected : </strong> "+e.data.data.account+"</p></div>";
      $("<div class=\"app-notice ok\"><p><strong class=\"important\">Connected : </strong> " + e.data.data.account + "</p></div>").insertAfter(".above-game");
      player_address = e.data.data.account;

      // Get user score
      neb.api.call({
          from: player_address,
          to: contract_address,
          value: 0,
          nonce: 0,
          gasPrice: gas_price,
          gasLimit: gas_limit,
          contract: {
              function: "getMyScore"
          }
      }).then(function(resp) {
          var player_score = JSON.parse(resp.result);
          if (player_score) {
              var content = "<p><strong class=\"important\">My score</strong><br /> " +
                  player_score["name"] + " - " + player_score["score"] + " - " + timeConverter(player_score["date"]) + "<p>";
              $("#my_score").empty();
              $("#my_score").append(content);
          }
      });

  } else if (!$notice.length) {
      $("<div class=\"app-notice\"><p>Nebulas Web Extension Wallet has been detected successfully</p></div>").insertAfter(".above-game");
  }
});
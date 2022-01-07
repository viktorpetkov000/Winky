$(function() {
  // If tic tac toe is opened
  $("#ttt").on("click", function() {
    // Check if user is logged in
    if (!socket.userdata) {
      message('You must be logged in.')
      return;
    }

    // If already in game, don't switch over
    if (socket.game == $(this).attr('id')) return;

    // Get game id and store it
    socket.game = $(this).attr('id');
    socket.emit('leaveLastRoom');

    // Clear game div and remove event listeners
    $("#lobby").empty();
    $("#lobby").off();

    // Append room, chat and game divs
    $('\
    <div id="tttGame">\
      <div id="gameWrapper">\
        <h1 id="turn">Tic tac toe</h1>\
        <canvas id="tttCanvas"></canvas>\
      </div>\
      <div id="rooms"></div>\
      <div id="createWrapper">\
        <button id="create">Create a new room</button>\
        <button id="start">Start game</button>\
      </div>\
      <div id="chat"></div>\
      <div id="msgWrapper">\
        <input id="msg" class="text ui-widget-content ui-corner-all" placeholder="Type here to chat"></input>\
        <button id="send">Send</button>\
      </div>\
    </div>').hide().appendTo('#lobby').fadeIn(500); // Add fade in effect

    // Create a new room and display prompt window
    $("#lobby").on( "click", '#create', function() {
      $("#prompt").dialog('option', 'title', 'Enter a name');
      $("#newName").val("");
      $("#prompt").dialog('open');
      $("#prompt").off('click', '#submitName');
      $("#prompt").on( "click", "#submitName", function() {
        if ($("#newName").val()) {
          socket.emit('tttCreateRoom', {userdata: socket.userdata, name: $("#newName").val()});
          $("#prompt").dialog('close');
        }
      });
    });

    // Create a new chat message and send it to server for validation
    $("#lobby").on( "click", "#send", function() {
      socket.emit('tttCheckMessage', {userdata: socket.userdata, msg: $("#msg").val()});
    });

    // Start game room
    $("#lobby").on( "click", "#start", function() {
      socket.emit('tttStart');
    });

    // Send chat message on enter
    $('#lobby').keypress(function(e){
      if (e.keyCode==13) {
        $("#send").click();
      }
    });

    // Disable start game button
    $("#start").prop('disabled', true);

    // Get chat history and active rooms from Server
    socket.emit('tttRequestData');
  });

  // Receive the available data
  socket.on('tttGetData', function(data){
      // Check if game is correct
      // Append each room with fade-in
      for (i = 0; i < data.rooms.length; i++) {
        let id = 'ttt-' + data.rooms[i].id;
        $('<div class="room" id=room' + id + '>\
            <span id="name">Name: ' + data.rooms[i].name + '</span>\
            <div id="right">\
              <span id="host">Host: ' + data.rooms[i].host.username +'</span>|\
              <span id="players">Players: ' + data.rooms[i].length + '/2</span>\
              <button id="join">Join</button>\
              <button id="leave" style="display:none">Leave</button>\
            </div>\
          </div>').hide().appendTo('#tttGame #rooms').fadeIn(500);
        // Add join button functionality
        $("#room" + id).on( "click", "#join", function() {
          socket.emit('tttJoinRoom', id);
        });
        // Add leave button functionality
        $("#room" + id).on( "click", "#leave", function() {
          socket.emit('tttLeaveRoom',id);
        });
        // If this is the first room, smooth the top-left border
        if (document.getElementById('rooms').childNodes.length == 1) {
          $("#room" + id).css('border-top-left-radius', '50px');
        }
      }

    // Load chat history
    for (i = 0; i < data.history.length; i++) {
      $("#chat").append('<p class="chatmessage">' + data.history[i].username + ": " + data.history[i].message + '</p>');
      var chat = document.getElementById("chat");
      // Scroll down
      chat.scrollTop = chat.scrollHeight;
    }
  });

  // Create a new room
  socket.on('tttNewRoom', function(data){
    // Append new room with fade-in
    let id = 'ttt-' + data.id;
    $('<div class="room" id=room' + data.id + '>\
        <span id="name">Name: ' + data.name + '</span>\
        <div id="right">\
          <span id="host">Host: ' + data.host.username + '</span>|\
          <span id="players">Players: ' + data.players + '/2</span>\
          <button id="join">Join</button>\
          <button id="leave" style="display:none">Leave</button>\
        </div>\
      </div>').hide().appendTo('#tttGame #rooms').fadeIn(500);
    // Add join button functionality
    $("#room" + data.id).on( "click", "#join", function() {
      socket.emit('tttJoinRoom', data.id);
    });
    // Add leave button functionality
    $("#room" + data.id).on("click", "#leave", function() {
      socket.emit('tttLeaveRoom', data.id);
    });
    // If this is the first room, smooth the top-left border
    if (document.getElementById('rooms').childNodes.length == 1) {
      $("#room" + data.id).css('border-top-left-radius', '50px');
    }
  });

  // Message if a new player joins and enable start game
  socket.on('tttUserJoined', function(user) {
    $("#turn").text('Playing against: ' + user);
    message(user + ' has joined.');
    $("#start").prop('disabled', false)
  })

  // Message if a player leaves, hide game if it is in play and disable start game
  socket.on('tttUserLeft', function(data) {
    message(data.user.username + ' has left.');
    $("#turn").text('Waiting for another player..');
    $("#start").prop('disabled', true)
    if (data.room.started) {
      $("#tttCanvas").off();
      $("#tttCanvas").hide();
      $("#start").text('Start game');
    }
  })

  // Message on room join, switch buttons, add currentRoom
  socket.on('tttJoinedRoom', function(data){
    if (data.players == 2)
      $("#turn").text('Waiting for host to start game..');
    else
      $("#turn").text('Waiting for another player..');
    message('Joined room ' + data.name);
    socket.currentRoom = data.id;
    $('#turn').show()
    $('#room' + data.id + ' #join').hide();
    $('#room' + data.id + ' #leave').show();
  });

  // Message on room leave, switch buttons, remove currentRoom, hide game if started
  socket.on('tttLeftRoom', function(data){
    message('Left room ' + data.room.name + '.');
    socket.currentRoom = "";
    $('#room' + data.id + ' #leave').hide();
    $('#room' + data.id + ' #join').show();
    $("#turn").hide();
    $("#start").prop('disabled', true)
    if (data.room.started) {
      $("#tttCanvas").off();
      $("#tttCanvas").hide();
      $("#start").text('Start game');
    }
  });

  // Delete chat input after message is sent
  socket.on('tttRefreshMessage', function() {
    $("#msg").val("");
  });

  // Append newly created chat message to chat
  socket.on('tttNewMessage', function(data) {
    $("#chat").append('<p class="chatmessage">' + data.username + ": " + data.msg + '</p>');
    var chat = document.getElementById("chat");
    chat.scrollTop = chat.scrollHeight;
  });

  // Remove room from list
  socket.on('tttDestroyRoom', function(id) {
    $('#room' + id + ' #leave').hide();
    $('#room' + id + ' #join').hide();
    $("#room" + id).fadeOut(510, function() {
      // Check if this is the first room
      if ($('#room' + id).is(':first-child')) {
        // Add border smoothing to the second room
        $('#rooms').children('.room').eq(1).css('border-top-left-radius', '50px');
      }
      // Remove room
      $('#room' + id).remove()
    });
  });

  // Update player count
  socket.on('tttUpdatePlayers', function(data) {
    if (data.host) {
      $('#room' + data.id + ' #host').text("Host: " + data.host);
    }
    $('#room' + data.id + ' #players').text("Players: " + data.players + "/2");
  });

  // After game is prepared
  socket.on("tttPrepared", function() {
    playttt();
  });

  // Tic tac toe functions
  function playttt() {

    // Clear canvas event listeners and redraw
    $("#tttCanvas").off();
    $("#tttCanvas").show();
    $("#turn").show();
    $("#start").prop('disabled', true)
    socket.off('tttUpdate');
    socket.off('tttEndGame');

    // Define variables

    // Canvas instance
    let canvas = document.getElementById('tttCanvas'),

    // Canvas context instance
    ctx = canvas.getContext('2d'),

    // Size of the cells
    cellSize = 160

    // Representation of the game board state
    map = [
        0, 0, 0,
        0, 0, 0,
        0, 0, 0,
    ],

    // Winning states
    winPatterns = [
        0b111000000, 0b000111000, 0b000000111, // Rows
        0b100100100, 0b010010010, 0b001001001, // Columns
        0b100010001, 0b001010100, // Diagonals
    ],

    // Constants for symbol values
    BLANK = 0, X = 1, O = -1,

    // Mouse position
    mouse = {
        x: -1,
        y: -1,
    },

    // Current player tracker
    currentPlayer = X,

    // Game state
    gameOver = false,

    // User's symbol
    yourSymbol = "";

    // Winning cells
    winCells = [];

    // Set canvas size
    canvas.width = canvas.height = 3 * cellSize;

    // Fix positions on mouse out
    $("#tttCanvas").on('mouseout', function () {
      mouse.x = mouse.y = -1;
    });

    // Stop tracking mouse position on mouse out
    $("#tttCanvas").on('mouseout', function () {
      mouse.x = mouse.y = -1;
    });

    // Get mouse position
    $("#tttCanvas").on('mousemove', function (e) {
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left,
          y = e.clientY - rect.top;

      mouse.x = x;
      mouse.y = y;
    });

    // Make a move and send to server for validation
    $("#tttCanvas").on('click', function (e) {
      socket.emit('tttPlay', {x: mouse.x, y: mouse.y, player: socket.userdata.username})
    });

    // Update game variables and text after server validation
    socket.on('tttUpdate', function(server) {
      var room = server.data
      map = room.map;
      winPatterns = room.winPatterns;
      currentPlayer = room.currentPlayer;
      gameOver = room.gameOver;
      winCells = room.winCells;
      if (server.start) {
        if (room.host.username == socket.userdata.username) {
          yourSymbol = room.hostSymbol;
        } else if (room.partner.username == socket.userdata.username) {
          yourSymbol = room.clientSymbol;
        }
      }
      if (yourSymbol != currentPlayer) {
        $('#turn').text('It\'s your turn');
      } else {
        if (room.host.username == socket.userdata.username)
          $('#turn').text('It\'s ' + room.partner.username + '\'s turn');
        else
          $('#turn').text('It\'s ' + room.host.username + '\'s turn');
      }
    });

    // Update game variables and end game after server validation
    socket.on('tttEndGame', function(server) {
      var room = server.data;
      map = room.map;
      winPatterns = room.winPatterns;
      currentPlayer = room.currentPlayer;
      gameOver = room.gameOver;
      winCells = room.winCells;
      $('#turn').text(server.result + "\nWaiting for rematch..");
      if (socket.userdata.username == room.host.username) {
        $("#start").prop('disabled', false)
        $("#start").text('Rematch');
      }
    });

    // Draw function
    function draw () {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawMouseHighlight();
      drawWinHighlight();
      drawBoard();
      fillBoard();

      // Draw on mouse hover
      function drawMouseHighlight () {
        if (gameOver) return;
        var cellNum = getCellByCoords(mouse.x, mouse.y),
            cellCoords = getCellCoords(cellNum);
        if (map[cellNum] == BLANK) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fillRect(cellCoords.x, cellCoords.y, cellSize, cellSize);
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.translate(cellCoords.x + cellSize / 2, cellCoords.y + cellSize / 2);
          if (yourSymbol != X)
            drawX();
          else
            drawO();
          ctx.restore();
        } else {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
          ctx.fillRect(cellCoords.x, cellCoords.y, cellSize, cellSize);
        }
      }

      // Draw the winning cells highlight
      function drawWinHighlight () {
        if (gameOver) {
          ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
          winCells.forEach(function (i) {
            var cellCoords = getCellCoords(i);
            ctx.fillRect(cellCoords.x, cellCoords.y, cellSize, cellSize);
          });
        }
      }

      // Draw the board
      function drawBoard () {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(cellSize, 0);
        ctx.lineTo(cellSize, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cellSize * 2, 0);
        ctx.lineTo(cellSize * 2, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, cellSize);
        ctx.lineTo(canvas.width, cellSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, cellSize * 2);
        ctx.lineTo(canvas.width, cellSize * 2);
        ctx.stroke();
      }

      // Fill the board
      function fillBoard () {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 5;
        for (var i = 0; i < map.length; i++) {
          var coords = getCellCoords(i);
          ctx.save();
          ctx.translate(coords.x + cellSize / 2, coords.y + cellSize / 2);
          if (map[i] == X) {
            drawX();
          } else if (map[i] == O) {
            drawO();
          }
          ctx.restore();
        }
      }

      // Draw the X symbol
      function drawX () {
        ctx.beginPath();
        ctx.moveTo(-cellSize / 3, -cellSize / 3);
        ctx.lineTo(cellSize / 3, cellSize / 3);
        ctx.moveTo(cellSize / 3, -cellSize / 3);
        ctx.lineTo(-cellSize / 3, cellSize / 3);
        ctx.stroke();
      }

      // Draw the O symbol
      function drawO () {
          ctx.beginPath();
          ctx.arc(0, 0, cellSize / 3, 0, Math.PI * 2);
          ctx.stroke();
      }
      requestAnimationFrame(draw);
    }

    // Get coordinates for squares
    function getCellCoords (cell) {
      var x = (cell % 3) * cellSize,
        y = Math.floor(cell / 3) * cellSize;
      return {
        'x': x,
        'y': y,
      };
    }

    // Get square by the coordinates
    function getCellByCoords (x, y) {
      return (Math.floor(x / cellSize) % 3) + Math.floor(y / cellSize) * 3;
    }

    // Draw the game
    draw();
  }
});

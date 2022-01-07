$(function() {
  // If draw togetherg is opened
  $("#dtt").on("click", function() {
    // Check if user is logged in
    if (!socket.userdata) {
      message('You must be logged in.')
      return;
    }

    // If already in game, don't swith over
    if (socket.game == $(this).attr('id')) return;

    // Get game id and store it
    socket.game = $(this).attr('id');
    socket.emit('leaveLastRoom');

    // Clear game div and remove event listeners
    $("#lobby").empty();
    $("#lobby").off();

    // Append game screen
    $('\
    <div id="dttGame">\
      <div id="gameWrapper">\
        <div class="center">\
          <h1 id="title">Draw together</h1>\
        </div>\
        <div id="rooms"></div>\
        <canvas id="dttCanvas"></canvas>\
      </div>\
    </div>').hide().appendTo('#lobby').fadeIn(500); // Add fade in effect

    // Get available rooms
    socket.emit('dttRequestRooms');

    // Create a new room and display prompt window
    $("#lobby").on( "click", '#dttCreate', function() {
      $("#prompt").dialog('option', 'title', 'Enter a name');
      $("#newName").val("");
      $("#prompt").dialog('open');
      $("#prompt").off('click', '#submitName');
      $("#prompt").on( "click", "#submitName", function() {
        if ($("#newName").val()) {
          socket.emit('dttCreateRoom', {userdata: socket.userdata, name: $("#newName").val()});
          $("#prompt").dialog('close');
        }
      });
    });
  });

  socket.on('dttGetRooms', function(data){
    // Append create new room button
    $('\
    <div class="room" id="dttCreate">\
        <span id="createRoom">Create a new room </span><span id="plus">+</span>\
    </div>').hide().appendTo('#dttGame #rooms').fadeIn(500);
    // Append each room with fade-in
    for (i = 0; i < data.rooms.length; i++) {
      let id = 'dtt-' + data.rooms[i].id;
      $('<div class="room" id=room' + id + '>\
          <span id="name">Name: ' + data.rooms[i].name + ' |</span>\
          <span id="host">Host: ' + data.rooms[i].host.username +' | </span>\
          <span id="players">Players: ' + data.rooms[i].length + '/6  </span>\
        </div>').hide().appendTo('#dttGame #rooms').fadeIn(500);
      $("#room" + id).on( "click", function() {
        socket.emit('dttJoinRoom', id);
      });
    }
  });

  socket.on('dttNewRoom', function(data){
    // Append new room with fade-in
    let id = 'dtt-' + data.id;
    $('<div class="room" id=room' + data.id + '>\
        <span id="name">Name: ' + data.name + ' |</span>\
        <span id="host">Host: ' + data.host.username + ' | </span>\
        <span id="players">Players: ' + data.players + '/6 </span>\
      </div>').hide().appendTo('#dttGame  #rooms').fadeIn(500);
    $("#room" + data.id).on( "click", function() {
      socket.emit('dttJoinRoom', data.id);
    });
  });

  // On room create
  socket.on('dttCreatedRoom', function(data){
    message('Created room ' + data.name)
    $('#title').css('font-size','42px').text('Waiting for other players..');
    $('#rooms').hide();
    socket.currentRoom = data.id;
    $('\
    <div class="roomLobby" id=roomLobby' + data.id + '>\
      <div class="player" id="player1"><img src="' + generateAvatar(data.host) + '"/><span>' + data.host + '</span></div>\
      <div class="player" id="player2"></div>\
      <div class="player" id="player3"></div>\
      <div class="player" id="player4"></div>\
      <div class="player" id="player5"></div>\
      <div class="player" id="player6"></div>\
    </div>\
    <div id="gameButtons">\
      <button id="leave">Leave room</button>\
      <button id="start">Start game</button>\
    </div>').hide().appendTo('#dttGame #gameWrapper').fadeIn(500);
    $("#leave").on("click", function() {
      socket.emit('dttLeaveRoom', data.id);
    });
    $("#start").on("click", function() {
      socket.emit('dttStart');
    });
    $("#split").hide();
    $("#start").prop('disabled', true);
  });

  // On room join
  socket.on('dttJoinedRoom', function(data){
    var room = data.room
    message('Joined room ' + room.name)
    $('#title').css('font-size','42px').text('Waiting for host to start..');
    $('#rooms').hide();
    socket.currentRoom = data.id;
    $('\
    <div class="roomLobby" id=roomLobby' + data.id + '>\
      <div class="player" id="player1"></div>\
      <div class="player" id="player2"></div>\
      <div class="player" id="player3"></div>\
      <div class="player" id="player4"></div>\
      <div class="player" id="player5"></div>\
      <div class="player" id="player6"></div>\
    </div>\
    <div id="gameButtons">\
      <button id="leave">Leave room</button>\
      <button id="start">Start game</button>\
    </div>').hide().appendTo('#gameWrapper').fadeIn(500);
    $("#leave").on("click", function() {
      socket.emit('dttLeaveRoom', data.id);
    });
    $("#start").on("click", function() {
      socket.emit('dttStart');
    });
    for (i = 1; i <= data.players; i++) {
      $('<img src="' + generateAvatar(room['player' + i].username) + '"/>\
      <span>' + room['player' + i].username + '</span>').hide().appendTo("#player" + i).fadeIn(500);
    }
    $("#start").prop('disabled', true);
    $("#split").hide();
    if (room.started) {
      socket.emit("dttPrepared");
      playdtt(room);
    }
  });

  // When user joins
  socket.on('dttUserJoined', function(data) {
    // Get room instance
    var room = data.room;
    message(data.username + ' has joined the room.');
    // Generate avatar
    $('<img src="' + generateAvatar(data.room['player' + room.length].username) + '"/>\
    <span>' + data.room['player' + room.length].username + '</span>').hide().appendTo("#player" + room.length).fadeIn(500);
    // Check if user is host
    if (socket.userdata.username == room.player1.username)
      $("#start").prop('disabled', false)
    // If game is started get board and player list
    if (room.started) {
      $("#playerList").remove();
      $('<div id="playerList"></div>').prependTo("#dttGame #gameWrapper").fadeIn(500);
      for (i = 1; i <= room.length; i++) {
        $('<div class="playerInGame" id="' + i + '"><img src="' + generateAvatar(room['player' + i].username) + '"/>\
        <span>' + room['player' + i].username + '</span></div>').appendTo("#playerList").fadeIn(500);
      }
    }
  });

  // When user leaves
  socket.on('dttUserLeft', function(data) {
    // Get room instance
    var room = data.room
    // Empty all the player boxes
    for (i = 1; i <= 6; i++) {
      $('#player' + i).empty();
    }
    // Fill the player boxes with current players
    for (i = 1; i <= room.length; i++) {
      $('<img src="' + generateAvatar(room['player' + i].username) + '"/>\
      <span>' + room['player' + i].username + '</span>').hide().appendTo("#player" + i).fadeIn(500);
    }
    message(data.user.username + ' has left.');
    // Disable startgame if alone in room
    if (room.length <= 1) {
      $("#start").prop('disabled', true);
    }
    // Fill playerlist when player joins
    if (room.length > 1) {
      $('#playerList').empty();
      for (i = 1; i <= room.length; i++) {
        $('<div class="playerInGame" id="' + i + '"><img src="' + generateAvatar(room['player' + i].username) + '"/>\
        <span>' + room['player' + i].username + '</span></div>').appendTo("#playerList").fadeIn(500);
      }
    } else {
      // Show lobby and hide game
      $("#split").show();
      $('#title').show();
      $('#playerList').remove();
      $('#dttCanvas').hide();
      $('.roomLobby').show();
      $('#gameButtons').show();
      $("#dttGame #gameWrapper").css('background-color', 'transparent');
      socket.emit("dttExitLobby");
      $("#colors").remove();
    }
  })

  // Destroy room
  socket.on('dttDestroyRoom', function(id) {
    $("#room" + id).fadeOut(500, function(){
      $('#room' + id).remove();
    });
  });

  // Message on room leave
  socket.on('dttLeftRoom', function(data) {
    if (data.sameGame)
      socket.emit("dttRequestRooms");
    message('Left room ' + data.room.name + '.');
    socket.currentRoom = "";
    // Remove lobby and hide game
    $("#split").show();
    $('#title').css('font-size','80px').text('Waiting for host to start..');
    $('#title').text('Draw together');
    $("#roomLobby" + data.id).remove();
    $("#gameButtons").remove();
    $("#title").show();
    $("#rooms").empty();
    $("#rooms").show();
    $("#colors").remove();
    $("#dttGame #gameWrapper").css('background-color', 'transparent');
  });


  // Update players in room
  socket.on('dttUpdatePlayers', function(data) {
    if (data.host) {
      $('#room' + data.id + ' #host').text("Host: " + data.host);
    }
    $('#room' + data.id + ' #players').text("Players: " + data.players + "/6");
  });

  // After game is prepared
  socket.on("dttPrepare", function(room) {
    socket.emit("dttPrepared");
    playdtt(room);
  });

  // Avatar generator function
  function generateAvatar(name) {
    var initials = name.split(' ').map(function(str) { return str ? str[0].toUpperCase() : "";}).join('');
    var canvas = document.createElement('canvas');
    var radius = 30;
    var margin = 5;
    // Round the avatar
    canvas.width = radius*2+margin*2;
    canvas.height = radius*2+margin*2;
    var ctx = canvas.getContext('2d');
    ctx.beginPath();
    // Some math
    ctx.arc(radius+margin,radius+margin,radius, 0, 2 * Math.PI, false);
    ctx.closePath();
    ctx.fillStyle = 'grey';
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = 'center';
    // More math
    ctx.fillText(initials, radius+5,radius*4/3+margin);
    // Return the complete avatar data
    return canvas.toDataURL();
  }

  function playdtt(room) {
    // Show and hide necessary divs
    $(".roomLobby").hide();
    $("#dttCanvas").off();
    $("#gameButtons").hide();
    $("#title").hide();
    $("#dttCanvas").show().fadeIn(500);
    $("#dttGame #gameWrapper").css('background-color', 'white');
    socket.off("drawOthers");
    socket.off("dttSaveBoard");
    $('<div id="playerList"></div>').prependTo("#dttGame #gameWrapper").fadeIn(500);
    for (i = 1; i <= room.length; i++) {
      $('<div class="playerInGame" id="' + i + '"><img src="' + generateAvatar(room['player' + i].username) + '"/>\
      <span>' + room['player' + i].username + '</span></div>').appendTo("#playerList").fadeIn(500);
    }
    $('\
    <div id="colors">\
      <div class="color" id="black"></div>\
      <div class="color" id="red"></div>\
      <div class="color" id="blue"></div>\
      <div class="color" id="green"></div>\
      <div class="color" id="yellow"></div>\
      <div class="color" id="purple"></div>\
      <div class="color" id="white"></div>\
    </div>').appendTo("#dttGame #gameWrapper").fadeIn(500);

    // Canvas instance
    var canvas = document.getElementById('dttCanvas');

    // Canvas context instance
    var ctx = canvas.getContext('2d');

    // Clear screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get canvas rect instance
    var rect = canvas.getBoundingClientRect();

    // Mouse status
    var drawing = false;
    var x, y, prevX, prevY;

    // Current color
    var current = {
      color: 'black',
      size: 2
    };

    $(".color").on('click', '', function() {
      current.color = $(this).attr('id');
      if (current.color == 'white')
	current.size = 10
      else
        current.size = 2
    });

    // Load board from server
    if (room.board) {
      var img = new Image();
      img.onload = function() {
        canvas.getContext("2d").drawImage(img, 0, 0);
      };
      img.src = room.board;
    }

    // Start drawing
    $("#dttCanvas").on('mousedown', function(e) {
      drawing = true;
      prevX = x;
      prevY = y;
      // Send board to server
      socket.emit("dttSaveBoard", canvas.toDataURL());
    });

    // Stop drawing
    $("#dttCanvas").on('mouseup', function() {
      drawing = false;
      // Send board to server
      socket.emit("dttSaveBoard", canvas.toDataURL());
    });

    // Actually draw
    $("#dttCanvas").on('mousemove', function(e) {
      // Get client board size so we can divide the positions by it
      // and that way we can render the drawing on smaller screens
      // at the same positions
      var w = canvas.width;
      var h = canvas.height;

      // Get mouse position
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;

      // Send drawing to server
      if (drawing) {
        socket.emit('draw', {
          'x1': prevX / w,
          'y1': prevY / h,
          'x2': x / w,
          'y2': y / h,
          'color': current.color,
          'size': current.size
        });

        // Draw for client
        drawLine(ctx, prevX, prevY, x, y, current.color, current.size);

        // Update values
        prevX = x;
        prevY = y;

      }
    });

    // Stop drawing if mouse leaves the screen and send board to server
    $("#dttCanvas").on('mouseout', function() {
      drawing = false;
      socket.emit("dttSaveBoard", canvas.toDataURL());
    });

    // Actually draw
    function drawLine(ctx, x1, y1, x2, y2, color, size){
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.stroke();
      ctx.closePath();
    }

    // Resize the board for the first time
    resizeCanvas();

    // Resize the board
    function resizeCanvas() {
      // Get board state before resize
      var beforeResize = canvas.toDataURL();
      // Clear board
      rect = canvas.getBoundingClientRect();
      // Get new size
      canvas.width  = $("#dttCanvas").innerWidth();
      canvas.height = $("#dttCanvas").innerHeight();
      // Make new image instance
      var img = new Image();
      img.onload = function() {
        // Resize and draw the new previous board state
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height);
      };
      // Get the previous board state
      img.src = beforeResize
    }

    // Resize event
    if (window.attachEvent)
      window.attachEvent("onresize",resizeCanvas);
    else
      window.addEventListener("resize",resizeCanvas,false);

    // Draw when someone else draws
    socket.on('drawOthers', function(data) {
      var w = canvas.width;
      var h = canvas.height;
      drawLine(ctx, data.x1 * w, data.y1 * h, data.x2 * w, data.y2 * h, data.color, data.size);
    });
  }
});

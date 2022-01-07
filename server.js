// Include express files
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io').listen(server);

// Replace deprecated mpromise with bluebird
var Promise = require("bluebird");

// Include bcrypt files for password hashing
var bcrypt = require('bcryptjs');

// Include striptags files for html sanitizing
var striptags = require('striptags');

// Include mongoose files for MongoDB
var mongoose = require('mongoose');
// Schema instance
var Schema = mongoose.Schema;
// Schema for user registration > Mongoose
var userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  online: Boolean,
  admin: Boolean
});
// Model for user > Mongoose
var User = mongoose.model('User', userSchema);
// Schema for chat history
var chatSchema = new Schema({
  username: { type: String },
  message: { type: String }
});
// Model for chat history
var chatHistory = mongoose.model('chatHistory', chatSchema);

// For user input sanitization
var reg=/[^a-zA-Z0-9\ !.,?;:~\-_\\<>=\+[\]{}()\u0400-\u04FF]+/;

// Allow use for directories and rename paths
app.use('/jquery', express.static(__dirname + '/node_modules/jquery/dist/'));
app.use('/jquery-ui', express.static(__dirname + '/node_modules/jquery-ui/'));
app.use('/hover', express.static(__dirname + '/node_modules/hover/'));
app.use('/', express.static(__dirname + '/'));

// Define main file
app.get('/',function(req,res){
    res.sendFile(__dirname+'/index.html');
});

// Listen to port
server.listen(process.env.PORT || 8081,function(){
    console.log('Listening on '+server.address().port);
});

// Connect to database
try {
  mongoose.connect("mongodb://localhost:27017/test", function(){
    useMongoClient: true
  });
} catch (e) {
  mongoose.connect("mongodb://87.227.196.86:27017/test", function(){
    useMongoClient: true
  });
}
// Create DB instance
var db = mongoose.connection;
// Check for errors
db.on('error', console.error.bind(console, 'connection error:'));
// When connection is opened send message
db.once('open', function() {
  console.log("Connected to database!");
});

// ID counters for game rooms
var tttID = 0;
var dttID = 0;

// Connection for Main server
io.on('connection', function (socket) {
  // Register user
  socket.on("registerUser", function(data) {
    // Validations
    // Check if user is already logged in
    if (socket.userdata) {
      message("Already logged in.");
      return;
    }
    // Search database for username
    User.findOne({username:data.username},'username',function(err, person) {
      // Check if username exists in database
      if (person) {
        message("Username already exists.");
        return;
      }

      // Check if username is longer than 4 characters
      if (data.username.length < 4) {
        message("Username is too short.");
        return;
      }

      // Check if password is longer than 6 characters
      if (data.password.length <= 6) {
        message("Password is too short.");
        return;
      }

      // Check if passwords match
      if (data.password != data.password2) {
        message("Passwords do not match");
        return;
      }

      // Create user model
      var newUser = User({
        username: data.username,
        // Hash password and salt it 10 times
        password: bcrypt.hashSync(data.password, 10),
        online: true
      });

      // Save user to database
      newUser.save(function() {
        message("User created!")
        socket.userdata = newUser;
        socket.emit("loginClient", newUser);
      });
    })
  });

  // Login user
  socket.on("loginUser", function(data) {
    // Check if user is already logged in
    if (socket.userdata) {
      message("Already logged in.");
      return;
    }
    //Search for data by username
    User.findOne({username:data.username},'',function(err, dbdata) {
      // Check if data is found
      if (!dbdata) {
        message("Username or password is incorrect");
        return;
      }

      // Compare password and hashed password
      if (!(bcrypt.compareSync(data.password, dbdata.password))) {
        message("Username or password is incorrect");
        return;
      }

      if (dbdata.online) {
        message("You're already logged in.");
        return;
      }

      // Set user as online
      dbdata.online = true;
      dbdata.save(function (err, updated) {
        socket.userdata = updated;
        delete socket.userdata.password
        delete socket.userdata.online
        socket.emit("loginClient", dbdata);
      });
    });
  });

  // On disconnect
  socket.on('disconnect', function() {
    // Set user as offline
    if (socket.userdata) {
      User.findOne({username:socket.userdata.username},'',function(err, dbdata) {
        dbdata.online = false;
        dbdata.save(function (err, updated) {
          leaveLastRoom();
        });
      });
    }
  });

  // Logout username
  socket.on("logoutUser", function() {
    socket.emit('logoutClient');
  });

  // Display messages to client
  function message(msg) {
    socket.emit("displayMessage", msg);
  }

  function messageRoom(id, msg) {
    io.sockets.in(id).emit("displayMessage", msg);
  }

  ////////////////////////////
  // Tic tac toe
  ////////////////////////////

  // Send room list to client
  socket.on('tttRequestData',function() {
    var rooms = [];
    // Search chat history in database
    chatHistory.find(function(err, history) {
      for (i = 0; i <= tttID; i++) {
        if (io.of("/").adapter.rooms['ttt-' + i]) {
          rooms.push(io.of("/").adapter.rooms['ttt-' + i]);
        }
      }
      // Send active rooms and chat history
      socket.game = 'ttt';
      socket.emit('tttGetData',{rooms: rooms, ids: tttID, history: history});
    });
  });

  // Create a new room
  socket.on('tttCreateRoom', function(data){

    // Check if user is logged in
    if (!socket.userdata) {
      message("You must be logged in to create a room.");
      return;
    }

    // Check if room has a name
    if (!data.name) return;

    // Sanitize user input
    var name = striptags(data.name);
    name = name.replace(/\s\s+/g, ' ');
    // Check if room name has forbidden characters
    if (reg.test(name)) {
      message("Room name contains forbidden characters");
      return;
    }

    // Check if room name is less than 2 characters long
    if (name.length < 2) {
      message("Room name must be at least 2 characters long.");
      return;
    }

    // Check if room name is longer than 18 characters long
    if (name.length >= 18) {
      message("Room name cannot be longer than 18 characters");
      return;
    }

    // Increase ID of tic tac toe rooms by 1
    var id = 'ttt-' + (++tttID);
    leaveLastRoom(id);
    // Join room
    socket.join(id);
    // Store new room data in server
    var room = io.of("/").adapter.rooms[id];
    room.host = socket.userdata;
    room.name = name;
    room.id = tttID;
    // Create the new room for clients
    io.of('/').emit("tttNewRoom", {host: room.host, name: name, id: id, players: room.length});
    // Join the new room
    socket.emit("tttJoinedRoom", {name: room.name, players: room.length, id:id});
  });

  // Join a room
  socket.on('tttJoinRoom', function(id){
    // Check if logged in
    if (!socket.userdata) return;
    // Check if room exists
    if (!io.of("/").adapter.rooms[id]) {
      message("Room doesn't exist.");
      return;
    }
    // Get room instance
    var room = io.of("/").adapter.rooms[id]
    // Check if already in same room
    if (socket.rooms[id]) {
      message("You cannot join the same room twice.");
      return;
    }
    // Check if room is full
    if (room.length >= 2) {
      message("Room is full");
      return;
    }
    // Leave last room, join new one and update player count
    leaveLastRoom(id)
    socket.join(id);
    socket.emit("tttJoinedRoom",{name: room.name, players: room.length, id:id});
    socket.in(id).emit('tttUserJoined', socket.userdata.username);
    socket.userdata.room = room;
    io.of('/').emit("tttUpdatePlayers", {id:id, players: room.length});
    room.partner = socket.userdata;
  });

  // Leave a room
  socket.on("tttLeaveRoom", function() {
    // Check if logged in
    if (!socket.userdata) return;
    // Check if in room
    if (!socket.rooms[socket.userdata.roomID]) return;
    leaveLastRoom('', socket.userdata.roomID, true);
  });

  // Validate chat message and send it to clients
  socket.on("tttCheckMessage", function(data) {
    // Sanitize user input
    if (!socket.userdata) return;
    if (!data.msg) return;
    var msg = striptags(data.msg);
    msg = msg.replace(/\s\s+/g, ' ');
    if (reg.test(data.msg)) return;
    if (msg.length >= 120) {
      message("Message cannot be longer than 120 characters.")
      return;
    }
    // Create new message document
    var newMessage = chatHistory({
      username: socket.userdata.username,
      message: msg
    })
    // Save it to database
    newMessage.save(function () {
      socket.emit("tttRefreshMessage");
      io.of('/').emit("tttNewMessage", {username: socket.userdata.username, msg: msg});
    })
  });

  socket.on('tttStart', function(data) {
    // Check if logged in
    if (!socket.userdata) return;
    // Check if in the room
    if (io.of("/").adapter.rooms[socket.userdata.roomID]) {
      // Get room instance
      var room = io.of("/").adapter.rooms[socket.userdata.roomID];
    } else {
      message('You are not in this room');
      return;
    }
    // Check if there is another player
    if (room.length != 2) {
      message("You need another player to start the game.")
      return;
    }
    // Check if user is the host
    if (socket.userdata.username != room.host.username) {
      message("Only the host can start the game.")
      return;
    }
    // Check if game is already in play
    if (room.playing) {
      message("Game is already in play")
      return;
    }
    // Prepare the users in the room
    io.sockets.in(socket.userdata.roomID).emit('tttPrepared');

    // Define the game variables

    // Start the game
    room.started = true;
    room.playing = true;

    // Representation of the game board state
    room.map = [
      0, 0, 0,
      0, 0, 0,
      0, 0, 0,
    ],

    // Winning states
    room.winPatterns = [
      0b111000000, 0b000111000, 0b000000111, // Rows
      0b100100100, 0b010010010, 0b001001001, // Columns
      0b100010001, 0b001010100, // Diagonals
    ],

    // Size of the cells
    room.cellSize = 160,

    // Constants for symbol values
    BLANK = 0, X = 1, O = -1,

    // Current player tracker
    room.currentPlayer = X,

    // Game state
    room.gameOver = false,

    // Winning cells
    room.winCells = [];

    // Randomize player symbols
    var random = Math.floor((Math.random() * 2) + 1)
    if (random == 1) {
      room.hostSymbol = X;
      room.clientSymbol = O;
    } else {
      room.hostSymbol = O;
      room.clientSymbol = X;
    }

    // Assign symbols to players
    if (room.host.username == socket.userdata.username && room.currentPlayer == room.clientSymbol)
      room.currentPlayer = room.clientSymbol;
    else if (room.partner.username == socket.userdata.username && room.currentPlayer == room.hostSymbol) {
      room.currentPlayer = room.hostSymbol;
    }

    // Update the client variables
    io.sockets.in(socket.userdata.roomID).emit('tttUpdate', {
      data: room,
      start: true,
      turn: ((room.currentPlayer == X)? 'X': 'O') + '\'s turn.'
    });
  });

  // When a move is made
  socket.on('tttPlay', function(client) {
    // Check if logged in
    if (!socket.userdata) return;
    // Get room instance
    var room = io.of("/").adapter.rooms[socket.userdata.roomID];
    // Assign symbols to players
    if (room.host.username == socket.userdata.username && room.currentPlayer == room.clientSymbol)
      room.currentPlayer = room.clientSymbol;
    else if (room.partner.username == socket.userdata.username && room.currentPlayer == room.hostSymbol) {
      room.currentPlayer = room.hostSymbol;
    } else return;

    // Get the chosen cell
    var cell = getCellByCoords(client.x, client.y)

    // Don't allow move if game finished
    if (room.gameOver) return;

    // If cell is filled, don't allow move
    if (room.map[cell] != BLANK) {
      return;
    }

    // Fill cell with player symbol value
    room.map[cell] = room.currentPlayer;

    // Check if game has been won
    var winCheck = checkWin(room.currentPlayer);
    if (winCheck != 0) {
      room.gameOver = true;
      var bit = 1;
      for (var i = room.map.length - 1; i >= 0; i--) {
        if ((bit & winCheck) === bit) {
          room.winCells.push(i);
        }
        bit <<= 1;
      }
      io.sockets.in(socket.userdata.roomID).emit('tttEndGame', {
        data: room,
        result: ((room.currentPlayer == X)? 'X': 'O') + ' wins!'
      });
      room.playing = false;
      return;
    } else if (room.map.indexOf(BLANK) == -1) {
      room.gameOver = true;
      io.sockets.in(socket.userdata.roomID).emit('tttEndGame', {
        data: room,
        result: "Tie!"
      });
      room.playing = false;
      return;
    }
    room.currentPlayer *= -1;

    // Update board state
    io.sockets.in(socket.userdata.roomID).emit('tttUpdate', {
      data: room,
      turn: ((room.currentPlayer == X)? 'X': 'O') + '\'s turn.'
    });

    function checkWin (player) {
      var playerMapBitMask = 0;
      for (var i = 0; i < room.map.length; i++) {
        playerMapBitMask <<= 1;
        if (room.map[i] == player)
          playerMapBitMask += 1;
      }
      for (var i = 0; i < room.winPatterns.length; i++) {
        if ((playerMapBitMask & room.winPatterns[i]) == room.winPatterns[i]) {
          return room.winPatterns[i];
        }
      }
      return 0;
    }

    function getCellByCoords (x, y) {
      return (Math.floor(x / room.cellSize) % 3) + Math.floor(y / room.cellSize) * 3;
    }

  });

  /////////////////////////////////////
  // Draw together
  /////////////////////////////////////

  // Send room list to client
  socket.on('dttRequestRooms',function() {
    // Check if logged in
    if (!socket.userdata) return;
    var rooms = [];

    // Get active rooms
    for (i = 0; i <= dttID; i++) {
      if (io.of("/").adapter.rooms['dtt-' + i]) {
        rooms.push(io.of("/").adapter.rooms['dtt-' + i]);
      }
    }

    // Send active rooms
    socket.game = 'dtt'
    socket.emit('dttGetRooms',{rooms: rooms, ids: dttID});
  });

  socket.on('dttCreateRoom', function(data){

    // Check if user is logged in
    if (!socket.userdata) {
      message("You must be logged in to create a room.");
      return;
    }

    // Check if room has a name
    if (!data.name) return;

    // Sanitize user input
    var name = striptags(data.name);
    name = name.replace(/\s\s+/g, ' ');
    // Check if room name has forbidden characters
    if (reg.test(name)) {
      message("Room name contains forbidden characters");
      return;
    }

    // Check if room name is less than 3 characters long
    if (name.length < 2) {
      message("Room name must be at least 2 characters long.");
      return;
    }

    // Check if room name is longer than 18 characters long
    if (name.length >= 18) {
      message("Room name cannot be at longer than 18 characters");
      return;
    }

    // Increase ID of tic tac toe rooms by 1
    var id = 'dtt-' + (++dttID);
    leaveLastRoom(id);
    // Join room
    socket.join(id);
    // Store new room data in server
    var room = io.of("/").adapter.rooms[id];
    room.host = socket.userdata;
    room.name = name;
    room.id = dttID;
    socket.playerNum = room.length;
    var playerNum = socket.playerNum;
    room["player" + playerNum] = socket.userdata
    room["player" + playerNum].place = playerNum;
    socket.broadcast.emit("dttNewRoom", {host: room.host, name: name, id: id, players: room.length});
    socket.emit("dttCreatedRoom", {host: room.host.username, name: name, id:id});
  });

  // Join a room
  socket.on('dttJoinRoom', function(id){

    // Check if logged in
    if (!socket.userdata) return;
    // Check if room exists
    if (!io.of("/").adapter.rooms[id]) {
      message("Room doesn't exist.");
      return;
    }
    var room = io.of("/").adapter.rooms[id]
    // Check if already in room
    if (socket.rooms[id]) {
      message("You cannot join the same room twice.");
      return;
    }
    // Check if room is full
    if (room.length >= 6) {
      message("Room is full");
      return;
    }
    leaveLastRoom(id);
    socket.join(id);
    socket.playerNum = room.length;
    var playerNum = socket.playerNum;
    room["player" + playerNum] = socket.userdata;
    room["player" + playerNum].place = playerNum;
    socket.emit("dttJoinedRoom",{room: room, playerNum: playerNum, players: room.length, id:id});
    socket.in(id).emit('dttUserJoined', {room: room, username: socket.userdata.username});
    socket.room = room;
    io.of('/').emit("dttUpdatePlayers", {id:id, players: room.length});
    if (room.started) {
      socket.on('draw', function (data) {
        io.sockets.in(socket.userdata.roomID).emit('draw', data);
      });
    }
  });

  // Leave a room
  socket.on("dttLeaveRoom", function() {
    // Check if logged in
    if (!socket.userdata) return;
    // Check if in room
    if (!socket.rooms[socket.userdata.roomID]) return;
    leaveLastRoom('', socket.userdata.roomID, true);
  });

  socket.on("dttStart", function() {
    // Check if logged in
    if (!socket.userdata) return;
    // Check you're in the room
    if (io.of("/").adapter.rooms[socket.userdata.roomID]) {
      // Get room instance
      var room = io.of("/").adapter.rooms[socket.userdata.roomID];
    } else {
      message('You are not in this room');
      return;
    }
    // Check if there is at least another player
    if (room.length < 2) {
      message("You need at least another player to start the game.")
      return;
    }
    // Check if user is host
    if (socket.userdata.username != room.host.username) {
      message("Only the host can start the game.")
      return;
    }
    // Check if game is already in play
    if (room.playing) {
      message("Game is already in play")
      return;
    }
    // Start the game
    room.started = true;
    // Prepare for clients
    io.sockets.in(socket.userdata.roomID).emit('dttPrepare', room);
  });

  socket.on('dttPrepared', function() {
    // Get room instance
    var room = io.of("/").adapter.rooms[socket.userdata.roomID];

    // When someone draws, draw for everyone else but him
    socket.on('draw', function (data) {
     socket.broadcast.to(socket.userdata.roomID).emit('drawOthers', data);
    });

    // Save board state
    socket.on("dttSaveBoard", function(board) {
      room.board = board;
    })
  })

  // Stop the game and clear the board
  socket.on('dttExitLobby', function() {
    var room = io.of("/").adapter.rooms[socket.userdata.roomID];
    room.started = false;
    room.board = "";

  });

  socket.on('leaveLastRoom', function () {
    leaveLastRoom();
  });

  function leaveLastRoom(newRoomID, currentID, sameGame) {
    if (!socket.userdata) return;
    if (socket.userdata.roomID) {
      var room = io.of("/").adapter.rooms[socket.userdata.roomID];
      socket.emit(socket.game + "LeftRoom", {room: room, id: socket.userdata.roomID, sameGame: sameGame});
      socket.leave(socket.userdata.roomID);
      destroyRoom(socket.userdata.roomID);
      socket.userdata.roomID = null;
    } else if (currentID && sameGame) {
      var room = io.of("/").adapter.rooms[currentID];
      socket.emit(socket.game +  "LeftRoom", {room: room, id: currentID, sameGame: sameGame});
      socket.leave(currentID);
      destroyRoom(currentID);
    }
    socket.userdata.roomID = newRoomID;
  }

  // Remove room
  function destroyRoom(id) {
    // Check if room exists
    if (!io.of("/").adapter.rooms[id]) {
      io.of('/').emit(socket.game + "DestroyRoom", id);
    } else {
      var room = io.of("/").adapter.rooms[id];
      if (room.length >= 1) {
        if (socket.game == 'dtt') {
          socket.playerNum = room["player" + socket.playerNum].place
          for (i = socket.playerNum; i < 6; i++) {
            if (room['player' + i] && room['player' + (i+1)])
              room['player' + i] = room['player' + (i+1)]
          }
          if (socket.userdata.username == room.host.username) {
            room.host = room.player2
          };
          socket.in(id).emit(socket.game + 'UserLeft', {room: room, playerNum:socket.playerNum, user:socket.userdata});
        }
        else
          socket.in(id).emit(socket.game + 'UserLeft', {room: room, user:socket.userdata});
        if (socket.game == 'ttt') {
          if (room.started) {
            room.started = false;
            room.playing = false;
          }
          if (socket.userdata.username == room.host.username) {
            room.host = room.partner
            delete room.partner;
          };
        }
      }
      io.of('/').emit(socket.game +  "UpdatePlayers", {host: room.host.username, id:id, players: room.length});
    }
  }
});

// Connection for Test Server
io.of("/test").on('connection', function(socket) {

});

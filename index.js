var socket = io();
$(function() {
  // Check if user is logged in
  if (!socket.loggedIn) {
    $("#menu").append('<button id="login">Login</button>');
    $("#menu").append('<button id="register" style="margin-left:4px;">Register</button>');
  } else {
    $("#menu").append('<button id="profile">Profile</button>')
    $("#menu").append('<button id="logout" style="margin-left:4px;">Logout</button>')
  }

  // Login window settings
  $("#window").dialog({
    autoOpen: false,
    show: {
      effect: "blind",
      duration: 600
    },
    hide: {
      effect: "blind",
      duration: 500
    },
    resizable: false
  });

  $("#prompt").dialog({
    autoOpen: false,
    modal: true,
    show: {
      effect: "blind",
      duration: 600
    },
    hide: {
      effect: "blind",
      duration: 500
    },
    resizable: false
  });

  $('#message').dialog({
    dialogClass: "message",
    autoOpen: false,
    title: "Message",
    show: {
      effect: "blind",
      duration: 200
    },
    hide: {
      effect: "blind",
      duration: 600
    },
    resizable: false,
    position: {
      my: "center top",
      at: "right top"
    },
    open: function(e, ui) {
      setTimeout("$('#message').empty",5000);
      setTimeout("$('#message').dialog('close')",5000);
    }
  });

  // Login button
  $("#menu").on( "click", "#login", function() {
    $("#window").empty();
    // Append login form to window
    $("#window").append('\
    <form>\
      <fieldset>\
        <input type="text" id="username" class="text ui-widget-content ui-corner-all" placeholder="Username">\
        <input type="password" id="password" class="text ui-widget-content ui-corner-all" placeholder="Password">\
      </fieldset>\
    </form>\
    <button id="loginUser">Login</button>')
    $("#window").dialog("option", 'title', 'Login');
    $("#window").dialog("open");
  });

  // Send login data to server
  $("#window").on( "click", "#loginUser", function() {
    socket.emit("loginUser", {
      username: $("#username").val(),
      password: $("#password").val()
    });
  });

  // Register button
  $("#menu").on( "click", "#register", function() {
    // Check if user is logged in
    if (!socket.userdata) {
      $("#window").empty();
      // Append registration form to window
      $("#window").append('\
      <form>\
        <fieldset>\
          <input type="text" id="username" class="text ui-widget-content ui-corner-all" placeholder="Username">\
          <input type="password" id="password" class="text ui-widget-content ui-corner-all" placeholder="Password">\
          <input type="password" id="password2" class="text ui-widget-content ui-corner-all" placeholder="Confirm Password">\
        </fieldset>\
      </form>\
      <button id="registerUser">Register</button>')
      $("#window").dialog("option", 'title', 'Register');
      $("#window").dialog("open");
    }
  });

  // Send registration data to server
  $("#window").on( "click", "#registerUser", function() {
    if (!socket.userdata) {
      socket.emit("registerUser", {
        username: $("#username").val(),
        password: $("#password").val(),
        password2: $("#password2").val()
      });
    }
  });

  // Profile page
  $("#menu").on( "click", "#profile", function() {
    if (socket.userdata) {
      console.log(socket.userdata);
    } else {
      message("Not logged in.")
    }
  });

  // Logout button
  $("#menu").on( "click", "#logout", function() {
    socket.emit('leaveRoom', socket.currentRoom);
    socket.emit("logoutUser");
    $("#lobby").hide("fade", 500, function(){
      $("#lobby").empty();
    });
  });

  // Press login/register button on enter
  $('#window').keypress(function(e){
    if (e.keyCode==13) {
      $('#loginUser').click();
      $('#registerUser').click();
    }
  });

  $('#prompt').keypress(function(e){
    if (e.keyCode==13) {
      $('#submitName').click();
    }
  });

  $("#menu").on( "click", "#logout", function() {
    socket.emit('leaveRoom', socket.currentRoom);
    socket.emit("logoutUser");
    $("#lobby").hide("fade", 500, function(){
      $("#lobby").empty();
    });
  });

  // Login client
  socket.on("loginClient", function(data) {
    // Add profile/logout buttons
    $("#menu").append('<button id="profile">Profile</button>')
    $("#menu").append('<button id="logout" style="margin-left:4px;">Logout</button>')
    // Remove login/register buttons
    $("#login").remove()
    $("#register").remove()
    // Close window
    $("#window").dialog("close");
    // Load userdata (User is logged in)
    socket.userdata = data;
    delete socket.userdata.password
  });

  // Logout client
  socket.on("logoutClient", function(){
    location.reload();
  });

  // Display message
  socket.on("displayMessage", function(msg) {
    if (!msg) return;
    $("#message").empty();
    $("#message").append('<p>' + msg + '</p>');
    $("#message").dialog("open");
  });

});

function message(msg) {
  if (!msg) return;
  $("#message").empty();
  $("#message").append('<p>' + msg + '</p>');
  $("#message").dialog("open");
}

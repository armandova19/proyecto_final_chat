const express = require('express'),
socket = require('socket.io'),
mysql = require('mysql'),
cookieParser = require('cookie-parser'),
session = require('express-session');

var app = express();
var roomName = '';
const nameBot = "BotChat";

var server = app.listen(3030, function () {
  console.log("Servidor en marcha, port 3030.");
});

var io = socket(server);

var sessionMiddleware = session({
  secret: "keyUltraSecret",
  resave: true,
  saveUninitialized: true
});

io.use(function (socket, next) {
  sessionMiddleware(socket.request, socket.request.res, next);
});

app.use(sessionMiddleware);
app.use(cookieParser());

const config = {     /**/ 
  "host": "localhost",
  "user": "root",
  "password": "",
  "base": "chat"
};

var db = mysql.createConnection({  /*funcion creada para la conexion a la base de datos*/ 
  host     : 'localhost',
  user     : 'root',
  password : '',
  database : 'chat'
});

db.connect(function (err) {
  if (!!err)/*el if nos sirve para validar o verificar que la conexion a la base no tuviera algun error */
  throw err;
    //de no haber ningun error semuestra un mensaje en la terminal, que se ha conectado a la base
  console.log('MySQL conectado: ' + config.host + ", usuario: " + config.user + ", Base de datos: " + config.base);
});

app.use(express.static('./'));//aqui nos direcciona al inicio en login

io.on('connection', function (socket) {
  var req = socket.request;

  console.log(req.session);
    //en este if verificamos si el usuario esta dado de alta en la base de datos
	if(req.session.userID != null){
		db.query("SELECT * FROM accounts WHERE id=?", [req.session.userID], function(err, rows, fields){
			console.log('Sesión iniciada con el UserID: ' + req.session.userID + ' Y nombre de usuario: ' + req.session.Username);
			socket.emit("logged_in", {user: req.session.Username, email: req.session.correo});
		});//si el usuario esta registrado 
	}else{
		console.log('No hay sesión iniciada');
	}

	socket.on("login", function(data){
		console.log(data);
	  const user = data.user,
	  pass = data.pass;
	  roomID = data.roomID;
	  roomName = data.roomName;

	  db.query("SELECT * FROM accounts WHERE Username=?", [user], function(err, rows, fields){
		  if(rows.length == 0){//por lo que hacemos una sentencia sql seleccionando los usuarios que estan registrados
            //si no existe tendria que registrarse
		  	console.log("El usuario no existe, favor de registrarse!");
		  }else{
		  		console.log(rows);
		  		
		  		const dataUser = rows[0].Username,
			  	dataPass = rows[0].Password,
			  	dataCorreo = rows[0].email;

				if(dataPass == null || dataUser == null){
				  	socket.emit("error");
				}
				if(user == dataUser && pass == dataPass){
					console.log("Usuario correcto!");
					socket.emit("logged_in", {user: user, email: dataCorreo, room: roomName, roomID: roomID});
					req.session.userID = rows[0].id;
					req.session.Username = dataUser;
					req.session.correo = dataCorreo;
					req.session.roomID = roomID;
					req.session.roomName = roomName;
					req.session.save();
					socket.emit('historial');
					socket.join(req.session.roomName);
					bottxt('entroSala');
				}else{
				  	socket.emit("invalido");
				}
		  }
	  });
	});

	socket.on('historial', function(){
		console.log('Buscando el historial de la sala: ' + req.session.roomName);

		db.query('SELECT s.nombre_sala, u.Username, m.mensaje FROM mensajes = INNER JOIN salas s ON s.id = m.sala_id INNER JOIN users u ON u.id=m.user_id WHERE m.sala_id = ' + req.session.roomID + 'ORDER BY m.id ASC', function(err,rows,fields){
			socket.emit('armadoHistorial', rows);
		});
	});
	
	socket.on('addUser', function(data){
		const user = data.user,
		pass = data.pass,
		email = data.email;
		
		if(user != "" && pass != "" && email != ""){//este if verifica que todos los campos esten llenos con la informacion correspondiente
			console.log("Registrando el usuario: " + user);
            //en esta parte insertamos el usuario con una sentencia sql, que el usuario quedara registrado en la base de datos
		  	db.query("INSERT INTO accounts(`Username`, `Password`, `email`) VALUES(?, ?, ?)", [user, pass, email], function(err, result){
			  if(!!err)
			  throw err;

			  console.log(result);

			  console.log('Usuario ' + user + " se dio de alta correctamente!.");
			  socket.emit('UsuarioOK');
			});
		}else{
			socket.emit('vacio');
		}
	});

	socket.on('cambiodesala', function(data){
		const idSala = data.idSala,
		nombreSala = data.nombreSala;
		
		socket.leave(req.session.roomName);

		req.session.roomID = idSala;
		req.session.roomName = nombreSala;

		socket.join(req.session.roomName);
		bottxt('cambioSala');
	});
	
	socket.on('mjsNuevo', function(data){ // Función para crear el mensaje nuevo.
		
			db.query("INSERT INTO mensajes(`mensaje`, `user_id`, `sala_id`, `fecha`) VALUES(?, ?, ?, CURDATE())", [data, req.session.userID, req.session.roomID], function(err, result){
			  if(!!err)
			  throw err;

			  console.log(result);

			  console.log('Mensaje dado de alta correctamente!.');//este mensaje solo se vera reflejado en la terminal
			  
			  		socket.broadcast.to(req.session.roomName).emit('mensaje', {
						usuario: req.session.Username,
						mensaje: data
					});
					
					socket.emit('mensaje', {
						usuario: req.session.Username,
						mensaje: data
					});
			});
		
	});

	socket.on('getSalas', function(data){//en esta parte de la base de datos todas las salas que existen en la misma
		db.query('SELECT id, nombre_sala from salas', function(err, result, fields){
			if(err) throw err;
			socket.emit('Salas', result);
		});
	});


	
	function bottxt(data){
		entroSala = 'Bienvenido a la sala ' + req.session.roomName;//se obtiene el nombre de la sala que el usuario seleciono
		cambioSala = 'cambiaste de sala a ' + req.session.roomName;//obtenemos el nombre de la sala de la que se cambio segun el usuario
		sefue = 'el usuario ' + req.session.Username + ' ha salido.';

		if(data =="entroSala"){
			socket.emit('mensaje', {//emite un mensaje dentro del chat, indicando a la sala que se selecciono
				usuario: nameBot,
				mensaje: entroSala
			});
		}

		if(data =="cambioSala"){//emite un mensaje con el nombre de la sala, a la que se cambio el usuario
			socket.emit('mensaje', {
				usuario: nameBot,
				mensaje: cambioSala
			});
		}

		if(data =="salioUsuario"){
			socket.emit('mensaje', {
				usuario: nameBot,
				mensaje: sefue
			});
		}
	}
	socket.on('salir', function(request, response){

		bottxt('salioUsuario');//tambien se destruye la sesion de la sala en la que estaba el usuario

		socket.leave(req.session.roomName);
		req.session.destroy();//destruye la sesion iniciada
	});
});
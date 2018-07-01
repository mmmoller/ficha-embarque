var express = require('express');
var router = express.Router();
var User = require('../models/user');
var Cadastro = require('../models/cadastro');
var bCrypt = require('bcrypt-nodejs');
var moment = require('moment');
var mongoose = require('mongoose');
var nodemailer = require('nodemailer');


module.exports = function(passport){ // Rotas
	// /TESTE
	// Testar como se comporta ao guardar uma data no BD
	
	// /'INDEX'
	router.get('/', function(req, res) {
		res.render('index', {message: req.flash('message')});
	});
	
	router.post('/', function(req, res){

		var newCadastro = new Cadastro();
		newCadastro.nome = req.param('nome');
		newCadastro.identidade = req.param('identidade'); 
		newCadastro.cracha = req.param('cracha'); 
		newCadastro.divisao = req.param('divisao'); 
		newCadastro.trecho = req.param('trecho'); 
		newCadastro.data = req.param('data');
		newCadastro.relacao = req.param('relacao');
		newCadastro.estado = "solicitação de reserva";
		newCadastro.email = req.param('email');
		newCadastro.observacao = req.param('observacao');
		console.log(req.param('data'));
		
		// Se a data for valida
		if (moment(newCadastro.data).isValid()){
			var data = moment(newCadastro.data).format("YYYY-MM-DD");
			//data.hour(0);
			newCadastro.data = data;
			newCadastro.save(function (err) {
				if (err) return handleError(err,req,res);
			});
			req.flash('message', "Solicitação realizada com sucesso, aguarde aprovação por e-mail");
			
			var text = 'A solicitação de embarque do(a) ' + newCadastro.nome +
				" foi realizada com sucesso para o dia " + moment(newCadastro.data).format("DD/MM/YYYY") + ", no trecho " + newCadastro.trecho +
				", aguarde aprovação por-email. Segue a lista dos passageiros solicitada: \n\n";
				
			for (var i = 0, j = 0; i < newCadastro.relacao.length/4; i++, j++){
				text+= newCadastro.relacao[i*4] + ". \n"
			}
			
			var subject = "Solicitação de embarque realizada - Aguarde aprovação"
			
			acceptMail(newCadastro, text, subject)
		
			res.redirect('/');
		}
		else {
			req.flash('message', "!Data invalida");
			res.redirect('/');
		}
		
	});
			
	// /LOGIN
	router.get('/login/autorizar', function(req,res){
		res.render('login', {endereco: "autorizar", message: req.flash('message') });
	});
	
	router.get('/login/visualizar', function(req,res){
		res.render('login', {endereco: "visualizar", message: req.flash('message') });
	});
	
	router.get('/logout', function(req, res) {
		req.logout();
		res.redirect('/');
	});
	
	router.post('/login/autorizar', passport.authenticate('login', {
		// Autenticação pelo passport.
		successRedirect: '/autorizar',
		failureRedirect: '/login/autorizar',
		failureFlash : true
	}));
	
	router.post('/login/visualizar', passport.authenticate('login', {
		// Autenticação pelo passport.
		successRedirect: '/visualizar',
		failureRedirect: '/login/visualizar',
		failureFlash : true
	}));

	// /AUTORIZAR
	router.get('/autorizar', isAuthenticatedAuth, function(req, res){
		Cadastro.find({'estado': "solicitação de reserva"}, function(err, cadastros) {
			if (err) return handleError(err,req,res);
			if (cadastros){
				res.render('autorizar', {cadastros: cadastros, message: req.flash('message')});
			}
			else {
				req.flash('message', "Não existem solicitações");
				res.redirect('/autorizar');
			}
		});
	});
	
	router.post('/autorizar', isAuthenticatedAuth, function(req, res){
		
		Cadastro.findOne({_id: req.param('_id')},function(err, cadastro){
			if (err) return handleError(err,req,res);
			if (cadastro){
				
				var autorizacao = {};
				
				if (Array.isArray(req.param("autorizacao"))){
					autorizacao = req.param("autorizacao");
				}
				else {
					autorizacao = [req.param("autorizacao")];
				}
				
				motivo = req.param("observacao");
				
				console.log(autorizacao)
				console.log(autorizacao.length);
				console.log(motivo);
				
				var text = 'A solicitação de embarque do(a) ' + cadastro.nome + 
				" no dia " + moment(cadastro.data).format("DD/MM/YYYY") + ", no trecho " + cadastro.trecho +
				" foi avaliada.\n\n Relação dos passageiros AUTORIZADOS: \n\n";
				
				for (var i = 0, j = 0; i < cadastro.relacao.length/4; i++, j++){
					
					if (autorizacao[j] == "sim"){
						text+= cadastro.relacao[i*4]
						text+= " foi AUTORIZADO(A). \n";
					}
				}
				
				text+= "\n Relação dos passageiros NÃO-autorizados: \n\n"
				
				for (var i = 0, j = 0; i < cadastro.relacao.length/4; i++, j++){
					if (autorizacao[j] == "nao"){
						text+= cadastro.relacao[i*4]
						text+= " NÃO foi autorizado(a). \n"
						cadastro.relacao.splice(i*4, 4);
						i--;
					}
				}
				
				
				
				
				
				if (motivo){
					text+="\n\nMotivo: " + motivo;
				}
				
				var subject = "Solicitação de embarque avaliada";
				
				Cadastro.find({"data": req.param("data"), "estado": "autorizada", "trecho": req.param("trecho")}, function(err, cadastros) {
		
					if (err) return handleError(err,req,res);
					if (cadastros){
						var total = 0;
						for (var i = 0; i < cadastros.length; i++)
							total+= cadastros[i].relacao.length/4;
						
						if (total+cadastro.relacao.length/4 > 30){
							var msg = "!Solicitação avaliada com sucesso. Existem " + Number(total+cadastro.relacao.length/4) + " solitações autorizadas para esse trecho nessa data!"
							req.flash('message', msg)
						}
						else{
							var msg = "Solicitação avaliada com sucesso. Existem " + Number(total+cadastro.relacao.length/4) + " solitações autorizadas para esse trecho nessa data."
							req.flash('message', msg);
						}
						
						acceptMail(cadastro, text, subject);
						cadastro.estado = "autorizada";
						cadastro.save(function (err) {
							if (err) return handleError(err,req,res);
						});
						if (cadastro.relacao.length == 0)
							cadastro.remove();
						
						res.redirect('/autorizar');
					}
					else {
						req.flash('message', "!Não há cadastros no sistema!");
					}
					
				});
			}
			else {
				req.flash('message', "!Solicitação não existente");
				res.redirect('/autorizar');
			}
		
		});
	});

	// apenas os autorizados
	// /VISUALIZAR
	router.get('/visualizar', isAuthenticatedView, function(req, res){
		
		var data = moment().format("YYYY-MM-DD");
		if (req.param('data') != undefined && req.param('data')){
			data = moment(req.param('data')).format("YYYY-MM-DD");
		}
		
		var trecho = "SLZ-AK"
		if (req.param('trecho') != undefined && req.param('trecho')){
			trecho = req.param("trecho");
		}
		
		Cadastro.find({"data": data, "estado": "autorizada", "trecho": trecho}, function(err, cadastros) {
			
			if (err) return handleError(err,req,res);
			if (cadastros){
				
				res.render("visualizar", {trecho: trecho, cadastros: cadastros, user: req.user.username});
			}
			else {
				req.flash('message', "!Não há");
				res.send('Não há');
			}
			
		});
	});

	// DELETE
	/*
	router.get('/delete', function(req, res){
		User.remove({}, function(err) { 
			console.log('Users removed')
		});
		Cadastro.remove({}, function(err) { 
			console.log('Cadastros removed')
		});
		res.send("Deletado");
	});*/
	
	// CRIAR
	router.get('/criar', function(req,res){
		BDAdmin();
		//BDPopulate();
		res.send("Criado");
	});
	
	// REPOPULATE
	/*
	router.get('/repopulate', function(req,res){
		Cadastro.remove({}, function(err) { 
			console.log('Cadastros removed')
		});
		BDPopulate();
		res.redirect('/autorizar');
	});*/
	
	
	return router;
}

{ // Functions

function BDAdmin(req, res){
	User.findOne({ 'username' :  'admin' }, function(err, user) {
		if (err){
			return handleError(err,req,res);
		}
		if (user){
			user.password = createHash('casn2018');
			user.save(function(err){
				if (err) return handleError(err,req,res);
			});
			return;
		}
		var newUser = new User();
		
		newUser.username = 'admin';
		newUser.password = createHash('casn2018');
		newUser.save(function (err) {
			if (err) return handleError(err,req,res);
		});
	});
	
	User.findOne({ 'username' :  'fiscal' }, function(err, user) {
		if (err){
			return handleError(err,req,res);
		}
		if (user){
			user.password = createHash('fenix2018');
			user.save(function(err){
				if (err) return handleError(err,req,res);
			});
			return;
		}
		var newUser = new User();
		
		newUser.username = 'fiscal';
		newUser.password = createHash('fenix2018');
		newUser.save(function (err) {
			if (err) return handleError(err,req,res);
		});
	});
	
	return
}

function BDPopulate(req, res){
	for (var i = 1; i < 5; i++){
		var rel = [];
		var trecho = "SLZ-AK";
		if (i%2 == 0){
			trecho = "AK-SLZ";
		}
		for (var j = 0; j < i*4; j++){
			if (j%4 == 0){
				rel[j] = "dependente" + i + "" + j
			}
			if (j%4 == 1){
				rel[j] = "identidade" + i + "" + j
			}
			if (j%4 == 2){
				rel[j] = "grau" + i + "" + j
			}
			if (j%4 == 3){
				rel[j] = "motivo" + i + "" + j
			}
		}
		createCadastro( "responsavel teste"+i, "identidade"+i, "cracha"+i, "divisao"+i,
		trecho, moment().format("YYYY-MM-DD"), rel, i+"email@email.com", "observacao"+i, req, res);
	}
	return
}

function createCadastro(nome, identidade, cracha, divisao, 
trecho, data, relacao, email, observacao, req, res){
	var newCadastro = new Cadastro();
	newCadastro.nome = nome;
	newCadastro.identidade = identidade;
	newCadastro.cracha = cracha;
	newCadastro.divisao = divisao;
	newCadastro.trecho = trecho;
	var _data = moment(data).format("YYYY-MM-DD")
	newCadastro.data = _data;
	newCadastro.relacao = relacao;
	newCadastro.estado = "solicitação de reserva";
	newCadastro.email = email;
	newCadastro.observacao = observacao;
	newCadastro.save(function (err) {
		if (err) return handleError(err,req,res);
	});
}

function acceptMail(cadastro, text, subject){
	
	var texto = text +
	"\n\nEssa mensagem é gerada automaticamente pelo sistema. O sistema ainda está em fase de teste.";
	
	var mailOptions = {
		from: 'fichaembarque@gmail.com',
		to: cadastro.email,
		subject: subject,
		text: texto
	};

	transporter.sendMail(mailOptions, function(error, info){
		if (error) {
			console.log(error);
		} else {
			console.log('Email sent: ' + info.response);
		}
	});
}

function rejectMail(cadastro){
	
	var text = 'A solicitação de embarque do(a) ' + cadastro.posto + " " + cadastro.nome +
	" foi rejeitada." + 
	"\n\n\nEssa mensagem é gerada automaticamente pelo sistema. O sistema ainda está em fase de teste.";
	
	var mailOptions = {
		from: 'fichaembarque@gmail.com',
		to: cadastro.email,
		subject: 'Solicitação de reserva rejeitada',
		text: text
	};

	transporter.sendMail(mailOptions, function(error, info){
		if (error) {
			console.log(error);
		} else {
			console.log('Email sent: ' + info.response);
		}
	});
}

function handleError(err,req,res){
	console.log(err);
	res.send(err);
}

var isAuthenticated = function (req, res, next) {
	// if user is authenticated in the session, call the next() to call the next request handler 
	// Passport adds this method to request object. A middleware is allowed to add properties to
	// request and response objects
	
	if (req.isAuthenticated())
		return next();
	// if the user is not authenticated then redirect him to the login page
	res.redirect('/login');
}

var isAuthenticatedView = function (req, res, next) {
	// if user is authenticated in the session, call the next() to call the next request handler 
	// Passport adds this method to request object. A middleware is allowed to add properties to
	// request and response objects
	
	if (req.isAuthenticated() && (req.user.username == "fiscal" || req.user.username == "admin"))
		return next();
	// if the user is not authenticated then redirect him to the login page
	res.redirect('/login/visualizar');
}

var isAuthenticatedAuth = function (req, res, next) {
	// if user is authenticated in the session, call the next() to call the next request handler 
	// Passport adds this method to request object. A middleware is allowed to add properties to
	// request and response objects
	
	if (req.isAuthenticated() && req.user.username == "admin")
		return next();
	if (req.isAuthenticated() && req.user.username == "fiscal"){
		req.logout();
		req.flash('message', "!Fiscal não pode autorizar fichas de embarque");
	}
	// if the user is not authenticated then redirect him to the login page
	res.redirect('/login/autorizar');
}



}

{ // Variables

var createHash = function(password){
	return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
}

var transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: 'fichaembarque@gmail.com',
		pass: 'Senha123'
	}
});
	
}
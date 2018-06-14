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
			res.redirect('/');
		}
		else {
			req.flash('message', "!Data invalida");
			res.redirect('/');
		}
		
	});
			
	// /LOGIN
	router.get('/login', function(req,res){
		// Se já estiver logado, não precisa logar de novo.
		if (req.isAuthenticated()){
			res.redirect('/autorizar')
		}
		res.render('login', { message: req.flash('message') });
	});
	
	router.post('/login', passport.authenticate('login', {
		// Autenticação pelo passport.
		successRedirect: '/autorizar',
		failureRedirect: '/login',
		failureFlash : true
	})); 

	// /AUTORIZAR
	router.get('/autorizar', isAuthenticated, function(req, res){
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
	
	router.post('/autorizar', isAuthenticated, function(req, res){
		
		Cadastro.findOne({_id: req.param('_id')},function(err, cadastro){
			if (err) return handleError(err,req,res);
			if (cadastro){
				if (req.param("tipo") == "autorizada"){
					acceptMail(cadastro);
					cadastro.estado = "autorizada";
					req.flash('message', "Solicitação autorizada");
					cadastro.save(function (err) {
						if (err) return handleError(err,req,res);
					});
				}
				else {
					rejectMail(cadastro);
					cadastro.remove();
					req.flash('message', "!Solicitação não autorizada");
				}
				
				res.redirect('/autorizar');
			}
			else {
				req.flash('message', "!Solicitação não existente");
				res.redirect('/autorizar');
			}
		
		});
	});

	// apenas os autorizados
	// /VISUALIZAR
	router.get('/visualizar', function(req, res){
		
		var data = moment().format("YYYY-MM-DD");
		if (req.param('data') != undefined && req.param('data')){
			data = moment(req.param('data')).format("YYYY-MM-DD");
		}
		
		Cadastro.find({"data": data, "estado": "autorizada"}, function(err, cadastros) {
			
			if (err) return handleError(err,req,res);
			if (cadastros){
				
				res.render("visualizar", {cadastros: cadastros});
			}
			else {
				req.flash('message', "!Não há");
				res.send('Não há');
			}
			
		});
	});

	// DELETE
	router.get('/delete', function(req, res){
		User.remove({}, function(err) { 
			console.log('Users removed')
		});
		Cadastro.remove({}, function(err) { 
			console.log('Cadastros removed')
		});
		res.send("Deletado");
	});
	
	// CRIAR
	router.get('/criar', function(req,res){
		BDAdmin();
		//BDPopulate();
		res.send("Criado");
	});
	
	
	return router;
}

{ // Functions

function BDAdmin(req, res){
	User.findOne({ 'username' :  'admin' }, function(err, user) {
		if (err){
			return handleError(err,req,res);
		}
		if (user){
			user.password = createHash('admin');
			user.save(function(err){
				if (err) return handleError(err,req,res);
			});
			return;
		}
		var newUser = new User();
		
		newUser.username = 'admin';
		newUser.password = createHash('admin');
		newUser.save(function (err) {
			if (err) return handleError(err,req,res);
		});
	});
	return
}

function BDPopulate(req, res){
	for (var i = 1; i < 10; i++){
		createCadastro( "hospede"+i, "guerra"+i, 1111111*i, 111111*i,
		"unidade"+i, "endereço"+i, 
		"("+i+i+")"+" "+i+i+i+i+i+"-"+i+i+i+i, 
		i + "email@email.com", ""+i+i+i+"."+i+i+i+"."+i+i+i+"-"+i+i,
		moment().format("YYYY-MM-DD"),
		moment().add(i+1, "days").format("YYYY-MM-DD"),
		0, "1o Tenente", "curso"+i, "Aluno", "M"
		);
	}
	return
}

function createCadastro(nome, posto, saram, cracha, divisao, 
trecho, data, relacao, estado, email){
	var newCadastro = new Cadastro();
	newCadastro.nome = nome;
	newCadastro.posto = posto;
	newCadastro.saram = saram;
	newCadastro.cracha = cracha;
	newCadastro.divisao = divisao;
	newCadastro.trecho = trecho;
	var _data = moment(data).format("YYYY-MM-DD")
	_data.hour(0);
	newCadastro.data = _data;
	newCadastro.relacao = relacao;
	newCadastro.estado = "solicitação de reserva";
	newCadastro.email = email; 
	newCadastro.save(function (err) {
		if (err) return handleError(err,req,res);
	});
}

function acceptMail(cadastro){
	
	var text = 'A solicitação de embarque do(a) ' + cadastro.posto
	+ " " + cadastro.nome + " foi realizada com sucesso." +
	"\n\n\nEssa mensagem é gerada automaticamente pelo sistema. O sistema ainda está em fase de teste.";
	
	var mailOptions = {
		from: 'fichaembarque@gmail.com',
		to: cadastro.email,
		subject: 'Solicitação de reserva confirmada',
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
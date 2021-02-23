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
	router.get('/teste', function(req, res) {
		/*
		var tarray = ["a0", "b0", "c0", "d0", "a2", "b2", "c2", "d2", "a3", "b3", "c3", "d3", "a0", "b0", "c0", "d0", "a2", "b2", "c2", "d2", "a3", "b3", "c3", "d3"];
		for (var i = 0; i < tarray.length; i++){
			if (i%5 == 3){
				tarray.splice(i+1, 0, "e" + i/5)
			}
		}
		console.log(tarray);
		*/
		res.send("banana")
	});
	
	// NOVO ENDEREÇO!
	router.get('*', function(req,res){  
	    	res.redirect('https://www.embarquecla.tk/index.php/solicitacao-lancha');
	});
	
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

			for (var i = 0; i < newCadastro.relacao.length; i++){
				if (i%5 == 3){
					newCadastro.relacao.splice(i+1, 0, "Em análise");
				}
			}

			newCadastro.save(function (err) {
				if (err) return handleError(err,req,res);
			});
			req.flash('message', "Solicitação realizada com sucesso, aguarde aprovação por e-mail");
			
			var text = 'A solicitação de embarque do(a) ' + newCadastro.nome +
				" foi realizada com sucesso para o dia " + moment(newCadastro.data).format("DD/MM/YYYY") + ", no trecho " + newCadastro.trecho +
				", aguarde aprovação por-email. Segue a lista dos passageiros solicitada: \n\n";
				
			for (var i = 0; i < newCadastro.relacao.length/5; i++){
				text+= newCadastro.relacao[i*5] + ". \n"
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
				res.render('autorizar', {cadastros: cadastros, user: req.user.username, message: req.flash('message')});
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
				cadastro.avaliacao = motivo;
				
				var text = 'A solicitação de embarque do(a) ' + cadastro.nome + 
				" no dia " + moment(cadastro.data).format("DD/MM/YYYY") + ", no trecho " + cadastro.trecho +
				" foi avaliada.\n\n Relação dos passageiros APROVADOS: \n\n";
				
				for (var i = 0, j = 0; i < cadastro.relacao.length/5; i++, j++){
					
					if (autorizacao[j] == "sim"){
						text+= cadastro.relacao[i*5]
						text+= " foi APROVADO(A). \n";
						cadastro.relacao.splice((i*5)+4, 1, "Aprovado")
					}
				}
				
				text+= "\n Relação dos passageiros REPROVADOS: \n\n"
				
				for (var i = 0, j = 0; i < cadastro.relacao.length/5; i++, j++){
					if (autorizacao[j] == "nao"){
						text+= cadastro.relacao[i*5]
						text+= " foi REPROVADO(a). \n"
						cadastro.relacao.splice((i*5)+4, 1, "Reprovado")
					}
				}
				
				if (motivo){
					text+="\n\nObservação: " + motivo;
				}
				
				var subject = "Solicitação de embarque avaliada";
				
				Cadastro.find({"data": req.param("data"), "estado": "analisada", "trecho": req.param("trecho")}, function(err, cadastros) {
		
					if (err) return handleError(err,req,res);
					if (cadastros){
						var total = 0;

						for (var i = 0; i < cadastros.length; i++){
							for (var j = 4; j < cadastros[i].relacao.length; j+=5){
								if (cadastros[i].relacao[j] == "Aprovado"){
									total++;
								}
							}
						}

						for (var j = 4; j < cadastro.relacao.length; j+=5){
							if (cadastro.relacao[j] == "Aprovado"){
								total++;
							}
						}
						
						if (total > 30){
							var msg = "!Solicitação avaliada com sucesso. Existem " + Number(total) + " solitações autorizadas para esse trecho nessa data!"
							req.flash('message', msg)
						}
						else{
							var msg = "Solicitação avaliada com sucesso. Existem " + Number(total) + " solitações autorizadas para esse trecho nessa data."
							req.flash('message', msg);
						}
						
						acceptMail(cadastro, text, subject);
						cadastro.estado = "analisada";
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

	// /ALTERAR
	router.get('/alterar', isAuthenticatedAuth, function(req, res){

		var data = moment().format("YYYY-MM-DD");
		if (req.param('data') != undefined && req.param('data')){
			data = moment(req.param('data')).format("YYYY-MM-DD");
		}
		
		Cadastro.find({"data": data, 'estado': "analisada"}, function(err, cadastros) {
			if (err) return handleError(err,req,res);
			if (cadastros){
				res.render('alterar', {cadastros: cadastros, user: req.user.username, message: req.flash('message')});
			}
			else {
				req.flash('message', "Não existem solicitações");
				res.redirect('/alterar');
			}
		});
	});

	router.post('/alterar', isAuthenticatedAuth, function(req, res){
		
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
				cadastro.avaliacao = motivo;
				
				var text = 'A solicitação de embarque do(a) ' + cadastro.nome + 
				" no dia " + moment(cadastro.data).format("DD/MM/YYYY") + ", no trecho " + cadastro.trecho +
				" foi REavaliada.\n\n Relação dos passageiros APROVADOS: \n\n";
				
				for (var i = 0, j = 0; i < cadastro.relacao.length/5; i++, j++){
					
					if (autorizacao[j] == "sim"){
						text+= cadastro.relacao[i*5]
						text+= " foi APROVADO(A). \n";
						cadastro.relacao.splice((i*5)+4, 1, "Aprovado")
					}
				}
				
				text+= "\n Relação dos passageiros REPROVADOS: \n\n"
				
				for (var i = 0, j = 0; i < cadastro.relacao.length/5; i++, j++){
					if (autorizacao[j] == "nao"){
						text+= cadastro.relacao[i*5]
						text+= " foi REPROVADO(a). \n"
						cadastro.relacao.splice((i*5)+4, 1, "Reprovado")
					}
				}
				
				if (motivo){
					text+="\n\nObservação: " + motivo;
				}
				
				var subject = "Solicitação de embarque REavaliada";
				
				Cadastro.find({"data": req.param("data"), "estado": "analisada", "trecho": req.param("trecho")}, function(err, cadastros) {
		
					if (err) return handleError(err,req,res);
					if (cadastros){
						var total = 0;

						for (var i = 0; i < cadastros.length; i++){
							for (var j = 4; j < cadastros[i].relacao.length; j+=5){
								if (cadastros[i].relacao[j] == "Aprovado"){
									total++;
								}
							}
						}

						for (var j = 4; j < cadastro.relacao.length; j+=5){
							if (cadastro.relacao[j] == "Aprovado"){
								total++;
							}
						}
						
						if (total > 30){
							var msg = "!Solicitação REavaliada com sucesso. Existem " + Number(total) + " solitações autorizadas para esse trecho nessa data!"
							req.flash('message', msg)
						}
						else{
							var msg = "Solicitação REavaliada com sucesso. Existem " + Number(total) + " solitações autorizadas para esse trecho nessa data."
							req.flash('message', msg);
						}
						
						acceptMail(cadastro, text, subject);
						cadastro.estado = "analisada";
						cadastro.save(function (err) {
							if (err) return handleError(err,req,res);
						});
						if (cadastro.relacao.length == 0)
							cadastro.remove();
						
						res.redirect('/alterar');
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

	router.get('/relatorio', isAuthenticatedAuth, function(req, res){
		

		var data = moment().format("YYYY-MM");
		if (req.param('data') != undefined && req.param('data')){
			data = req.param('data');
		}
		
		Cadastro.find({"data": {$regex : data}}, function(err, cadastros) {
			
			if (err) return handleError(err,req,res);
			if (cadastros){
				
				res.render("relatorio", {cadastros: cadastros, data: data, user: req.user.username});
			}
			else {
				req.flash('message', "!Não há");
				res.send('Não há');
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
		
		Cadastro.find({"data": data, "estado": "analisada", "trecho": trecho}, function(err, cadastros) {
			
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

	
	// /CONSULTAR
	router.get('/consultar', function(req, res){
		
		var saram = req.param("saram");
		//console.log(saram)
		
		
		Cadastro.find({"identidade": saram}, function(err, cadastros) {
			//console.log(cadastros)
			if (err) return handleError(err,req,res);
			if (cadastros){
				res.render("consultar", {cadastros: cadastros});
			}
			else {
				req.flash('message', "!Error");
				res.send('Não existe nenhum cadastro no sistema');
			}
			
		});
	});
	
	
	// DELETE
	router.get('/delete', function(req, res){
		/*
		User.remove({}, function(err) { 
			console.log('Users removed')
		});
		Cadastro.remove({}, function(err) { 
			console.log('Cadastros removed')
		});
		*/
		res.send("Deletado");
	});
	
	// CRIAR
	router.get('/criar', function(req,res){
		BDAdmin();
		//BDPopulate();
		res.send("Criado");
	});
	
	// REPOPULATE
	
	router.get('/repopulate', function(req,res){
		/*
		Cadastro.remove({}, function(err) { 
			console.log('Cadastros removed')
		});
		BDPopulate();
		res.redirect('/autorizar');*/
		res.send("Repopulate");
	});
	
	// Ajustar de 4 para 5
	router.get('/ajustar', function(req,res){
		/*
		Cadastro.find({}, function(err, cadastros) {
			
			if (err) return handleError(err,req,res);
			if (cadastros){
				
				//console.log(cadastros)
				for (var x = 0; x < cadastros.length; x++){
					for (var i = 0; i < cadastros[x].relacao.length; i++){
						if (i%5 == 3){
							if (cadastros[x].estado == "solicitação de reserva"){
								cadastros[x].relacao.splice(i+1, 0, "Em análise");
							}
							else if (cadastros[x].estado == "autorizada" || cadastros[x].estado == "analisada"){
								cadastros[x].relacao.splice(i+1, 0, "Aprovado");
								cadastros[x].estado = "analisada";
							}
						}
					}
					console.log(cadastros[x].relacao);
					cadastros[x].save(function (err) {
						if (err) return handleError(err,req,res);
					});
				}
				res.send("Ajustar");


			}
			else {
				req.flash('message', "!Não há");
				res.send('Não há');
			}
			
		});
		*/
		res.send("Ajustar")
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
			if (process.env.ADMIN_PASS)
				user.password = createHash(process.env.ADMIN_PASS);
			else
				user.password = createHash("admin");
			user.save(function(err){
				if (err) return handleError(err,req,res);
			});
			return;
		}
		var newUser = new User();
		
		newUser.username = 'admin';
		if (process.env.ADMIN_PASS)
			newUser.password = createHash(process.env.ADMIN_PASS);
		else
			newUser.password = createHash("admin");
		newUser.save(function (err) {
			if (err) return handleError(err,req,res);
		});
	});
	
	User.findOne({ 'username' :  'fiscal' }, function(err, user) {
		if (err){
			return handleError(err,req,res);
		}
		if (user){
			if (process.env.FISCAL_PASS)
				user.password = createHash(process.env.FISCAL_PASS);
			else
				user.password = createHash('fenix2018');
			user.save(function(err){
				if (err) return handleError(err,req,res);
			});
			return;
		}
		var newUser = new User();
		
		newUser.username = 'fiscal';
		if (process.env.FISCAL_PASS)
			newUser.password = createHash(process.env.FISCAL_PASS);
		else
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
			/*
			if (j%5 == 4){
				rel[j] = "solicitação"
			}*/
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
	"\n\nA ficha de embarque é avaliada pelo Chefe da Seção de Transporte Marítimo, para eventuais dúvidas, entrar em contato através do funcional (98)99126-0456." +
	"\n\nEssa mensagem é gerada automaticamente pelo sistema, favor não responder.";
	
	
	var mailOptions = {
		from: 'fichaembarque@gmail.com',
		to: cadastro.email,
		subject: subject,
		text: texto
	};

	//console.log(process.env.EMAIL_PASS)

	var transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: 'fichaembarque@gmail.com',
			pass: process.env.EMAIL_PASS
		}
	});

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


var createHash = function(password){
	return bCrypt.hashSync(password, bCrypt.genSaltSync(10), null);
}

}

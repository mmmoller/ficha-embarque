var mongoose = require('mongoose');

module.exports = mongoose.model('Cadastro',{
	nome: String,
	identidade: String,
	cracha: String,
	divisao: String,
	trecho: String,
	data: String,
	relacao: [String],
	estado: String,
	email: String
});

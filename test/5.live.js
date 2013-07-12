var expect = expect || require("expect.js");
var phenotype = phenotype || require('../phenotype');

describe('Live updates', function(){
	describe('Proxy.create for live updates on this platform is', function(){
		it((phenotype.ProxyIsSupported ? '' : 'not ') + 'supported', phenotype.ProxyIsSupported ? function(){} : null)
	});
	describe('modifying a Trait', function(){
		
	})
	describe('modifying an existing object', function(){
		
	})
})
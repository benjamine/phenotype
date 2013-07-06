var expect = require("expect.js");
var phenotype = require('../phenotype');
describe('Trait', function(){

	var Trait = phenotype.Trait;

	describe('name', function(){
		it('is taken from constructor', function(){
			expect(new Trait('exampleName').name).to.be('exampleName');
		})
		it('trait can be anonymous', function(){
			expect(new Trait().name).to.match(/^Anonymous\d+$/);
			expect(new Trait().name).to.match(/^Anonymous\d+$/);
		})
	})

	describe('definition', function(){
		it('gets inherited by children', function(){
			var definition = { a: 1, b: {}, c: function() { } };
			var child = new Trait(definition).create();
			expect(phenotype.flatObject(child)).to.eql(definition);
		})
		it('gets inherited by descendants', function(){
			var definition = { a: 1, b: {}, c: function() { } };
			var descendant = new Trait(new Trait(new Trait(new Trait(definition)))).create();
			expect(phenotype.flatObject(descendant)).to.eql(definition);
		})
		it('children override parents', function(){
			var method = function(){};
			var other = function(){};
			var parent = new Trait({ method: phenotype.pending, other: other });
			var child = new Trait(parent, { method: method });
			expect(child.create().other).to.be(other);
			expect(child.create().method).to.be(method);
		})
	})

	describe('composition', function(){
		it('supports multiple inheritance', function(){
			var definitionA = { a: 1 };
			var definitionB = { b: {} };
			var definitionC = { c: function(){} };
			var combinedDefinition = { a: definitionA.a, b: definitionB.b, c: definitionC.c };
			var child = new Trait(new Trait(definitionA), new Trait(definitionB), new Trait(definitionC)).create();
			expect(phenotype.flatObject(child)).to.eql(combinedDefinition);
		})
		describe('required members', function(){
			before(function(){
				this.missing = function(){};
				this.Abstract = new Trait({ missing: phenotype.member.required, other: function(){} });
			})
			it('throw error on create', function(){
				var Abstract = this.Abstract;
				expect(function(){
					Abstract.create();
				}).to.throwException(function(e){
					expect(e.required).to.be.a(phenotype.member.Required);
					expect(e.requiredMember).to.be('missing');
					expect(e.requiredBy).to.be(Abstract);
				})
			})
			describe('unless they are added at', function(){
				it('object definition', function(){
					expect(this.Abstract.create({ missing: this.missing }).missing).to.be(this.missing);
				})
				it('a sibling trait', function(){
					var combinedTrait = new Trait(this.Abstract, new Trait({ missing: this.missing }));
					var combinedObject = phenotype.create(this.Abstract, new Trait({ missing: this.missing }));
					expect(combinedTrait.create().missing).to.be(this.missing);
					expect(combinedObject.missing).to.be(this.missing);
				})
				it('a child trait', function(){
					var combinedTrait = new Trait(this.Abstract, { missing: this.missing });
					expect(combinedTrait.create().missing).to.be(this.missing);
				})
				it('a parent trait', function(){
					this.Abstract.add(new Trait({ missing: this.missing }));
					expect(this.Abstract.create().missing).to.be(this.missing);
				})
			})
		})
		describe('conflicts', function(){
			before(function(){
				this.Jet = new Trait('Jet', { fly: function(){} });
				this.Bird = new Trait('Bird', { fly: function(){}, sing: function() {} });
				this.Bee = new Trait('Bee', { fly: function(){}, pollenize: function(){} });
			})
			describe('throw error on create if member is defined', function(){
				it('in 2 siblings', function(){
					var Jet = this.Jet, Bird = this.Bird;
					var trait = new Trait(Jet, Bird);
					expect(function(){
						trait.create();
					}).to.throwException(function(e){
						expect(e.conflict).to.be.a(phenotype.member.Conflict);
						expect(e.conflict.memberName).to.be('fly');
						expect(e.conflict.sources).to.have.length(2);
						expect(e.conflict.sources[0].source).to.be(Jet);
						expect(e.conflict.sources[1].source).to.be(Bird);
					});
				})
				it('in 3 siblings', function(){
					var Jet = this.Jet, Bird = this.Bird, Bee = this.Bee;
					var trait = new Trait(Jet, Bird, Bee);
					expect(function(){
						trait.create();
					}).to.throwException(function(e){
						expect(e.conflict).to.be.a(phenotype.member.Conflict);
						expect(e.conflict.memberName).to.be('fly');
						expect(e.conflict.sources).to.have.length(3);
						expect(e.conflict.sources[0].source).to.be(Jet);
						expect(e.conflict.sources[1].source).to.be(Bird);
						expect(e.conflict.sources[2].source).to.be(Bee);
					});
				})
				it('in siblings ancestors', function(){
					var Jet = this.Jet, Bird = this.Bird, Bee = this.Bee;
					var JetChild = new Trait('JetChild', new Trait(this.Jet));
					var BirdChild = new Trait('BirdChild', new Trait('BirdAndBee', new Trait(this.Bird)), new Trait(Bee));
					var trait = new Trait('EFEF', JetChild, BirdChild);
					expect(function(){
						trait.create();
					}).to.throwException(function(e){
						expect(e.conflict).to.be.a(phenotype.member.Conflict);
						expect(e.conflict.memberName).to.be('fly');
						expect(e.conflict.sources).to.have.length(2);
						expect(e.conflict.sources[0].source).to.be(Jet);
						expect(e.conflict.sources[1].source).to.be(BirdChild);
					});
				})
			})
			describe('unless they are', function(){
				it('overriden by child trait', function(){
					var newFly = function(){};
					var child = new Trait(this.Jet, this.Bird, this.Bee, { fly: newFly }).create();
					expect(child.fly).to.be(newFly);
				})
				it('overriden by object definition', function(){
					var newFly = function(){};
					var child = new Trait(this.Jet, this.Bird, this.Bee).create({ fly: newFly });
					expect(child.fly).to.be(newFly);
				})
				it('solved choosing 1 source (member.from)', function(){
					var child = new Trait(this.Jet, this.Bird, this.Bee, { 
						fly: phenotype.member.from(this.Bird)
					}).create();
					expect(child.fly).to.be(this.Bird.create().fly);
				})
				it('solved using an alias (member.aliasOf)', function(){
					var Rocket = new Trait({ launch: function(){} });
					var child = new Trait(this.Jet, this.Bird, Rocket, { 
						fly: phenotype.member.aliasOf(Rocket, 'launch')
					}).create();
					expect(child.fly).to.be(Rocket.create().launch);
				})
			})
		})
		describe('invoking ancestors', function(){
			describe('ancestor()', function(){
				it ('calls ancestor member', function(){
					var Parent = new Trait({ 
						list: [],
						build: function(){
							this.list.push(1); 
						}
					});
					var Child = new Trait(Parent, {
						build: phenotype.member.ancestor().then(function(){
							this.list.push(2);
						})
					});
					var child = Child.create();
					child.build();
					expect(child.list).to.be.eql([1,2]);
				})
				it ('throws error if multiple ancestors', function(){
					var Parent = new Trait({ 
						list: [],
						build: function(){
							this.list.push(1); 
						}
					});
					var Parent2 = new Trait(new Trait({
						list: phenotype.member.required,
						build: function(){
							this.list.push(1.2);
						}
					}));
					var Child = new Trait(Parent, Parent2, {
						build: phenotype.member.ancestor().then(function(){
							this.list.push(2);
						})
					});
					expect(function(){
						Child.create();
					}).to.throwException(function(e){
						expect(e.combinationMultipleAncestors).to.have.length(2);
						expect(e.combinationMultipleAncestors[0]).to.be(Parent);
						expect(e.combinationMultipleAncestors[1]).to.be(Parent2);
					});
				})
			})
			describe('ancestors()', function(){
				it ('calls ancestors in order', function(){
					var Parent = new Trait({ 
						list: [],
						build: function(prefix){
							this.list.push(prefix + 1); 
						}
					});
					var Parent2a = new Trait({
						list: phenotype.member.required,
						build: function(prefix){
							this.list.push(prefix + 2.1);
						}
					});
					var Parent2b = new Trait({
						list: phenotype.member.required,
						build: function(prefix){
							this.list.push(prefix + 2.2);
						}
					});
					var Parent2 = new Trait(Parent2a, Parent2b, {
						list: phenotype.member.required,
						build: phenotype.member.ancestors().then(function(prefix){
							this.list.push(prefix + 2);
						})
					});
					var Child = new Trait(Parent, Parent2, {
						build: phenotype.member.ancestors().then(function(prefix){
							this.list.push(prefix + 4);
						})
					});
					var child = Child.create();
					child.build('a');
					expect(child.list).to.be.eql(['a1', 'a2.1', 'a2.2', 'a2', 'a4']);
				})
				it ('calls ancestors in order', function(){
					var Parent = new Trait({ 
						list: [],
						build: function(prefix){
							this.list.push(prefix + 1); 
						}
					});
					var Parent2a = new Trait({
						list: phenotype.member.required,
						build: function(prefix){
							this.list.push(prefix + 2.1);
						}
					});
					var Parent2b = new Trait({
						list: phenotype.member.required,
						build: function(prefix){
							this.list.push(prefix + 2.2);
						}
					});
					var Parent2 = new Trait(Parent2a, Parent2b, {
						list: phenotype.member.required,
						build: phenotype.member.ancestors().then(function(prefix){
							this.list.push(prefix + 2);
						})
					});
					var Child = new Trait(Parent, Parent2, {
						build: phenotype.member.ancestors().then(function(prefix){
							this.list.push(prefix + 4);
						})
					});
					var child = Child.create();
					child.build('a');
					expect(child.list).to.be.eql(['a1', 'a2.1', 'a2.2', 'a2', 'a4']);
				})
			})
		})
	})


})
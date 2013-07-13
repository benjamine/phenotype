/* global require, describe, before, it */
var expect = expect || require('expect.js');
var phenotype = phenotype || require('../phenotype');
var Trait = phenotype.Trait;
var Meta = phenotype.Meta;

describe('Trait', function(){
    'use strict';

    describe('#name', function(){
        it('is taken from constructor', function(){
            expect(new Trait('exampleName').name).to.be('exampleName');
        });
        it('trait can be anonymous', function(){
            expect(new Trait().name).to.match(/^Anonymous\d+$/);
            expect(new Trait().name).to.match(/^Anonymous\d+$/);
        });
    });

    describe('#definition', function(){
        it('gets inherited by children', function(){
            var definition = { a: 1, b: {}, c: function() { } };
            var child = new Trait(definition).create();
            expect(phenotype.flatObject(child)).to.eql(definition);
        });
        it('gets inherited by descendants', function(){
            var definition = { a: 1, b: {}, c: function() { } };
            var descendant = new Trait(new Trait(new Trait(new Trait(definition)))).create();
            expect(phenotype.flatObject(descendant)).to.eql(definition);
        });
        it('children override parents', function(){
            var method = function(){};
            var other = function(){};
            var parent = new Trait({ method: phenotype.pending, other: other });
            var child = new Trait(parent, { method: method });
            expect(child.create().other).to.be(other);
            expect(child.create().method).to.be(method);
        });
    });
    describe('can be composed', function(){
        it('supports multiple inheritance', function(){
            var definitionA = { a: 1 };
            var definitionB = { b: {} };
            var definitionC = { c: function(){} };
            var combinedDefinition = { a: definitionA.a, b: definitionB.b, c: definitionC.c };
            var child = new Trait(new Trait(definitionA), new Trait(definitionB), new Trait(definitionC)).create();
            expect(phenotype.flatObject(child)).to.eql(combinedDefinition);
        });
        describe('required members', function(){
            before(function(){
                this.missing = function(){};
                this.Abstract = new Trait({ missing: phenotype.member.required, other: function(){} });
            });
            it('throw error on create', function(){
                var Abstract = this.Abstract;
                expect(function(){
                    Abstract.create();
                }).to.throwException(function(e){
                    expect(e.required).to.be.a(phenotype.member.Required);
                    expect(e.requiredMember).to.be('missing');
                    expect(e.requiredBy).to.be(Abstract);
                });
            });
            describe('unless they are added at', function(){
                it('object definition', function(){
                    expect(this.Abstract.create({ missing: this.missing }).missing).to.be(this.missing);
                });
                it('a sibling trait', function(){
                    var combinedTrait = new Trait(this.Abstract, new Trait({ missing: this.missing }));
                    var combinedObject = phenotype.create(this.Abstract, new Trait({ missing: this.missing }));
                    expect(combinedTrait.create().missing).to.be(this.missing);
                    expect(combinedObject.missing).to.be(this.missing);
                });
                it('a child trait', function(){
                    var combinedTrait = new Trait(this.Abstract, { missing: this.missing });
                    expect(combinedTrait.create().missing).to.be(this.missing);
                });
                it('a parent trait', function(){
                    this.Abstract.add(new Trait({ missing: this.missing }));
                    expect(this.Abstract.create().missing).to.be(this.missing);
                });
            });
        });
        describe('conflicts', function(){
            before(function(){
                this.Jet = new Trait('Jet', { fly: function(){} });
                this.Bird = new Trait('Bird', { fly: function(){}, sing: function() {} });
                this.Bee = new Trait('Bee', { fly: function(){}, pollenize: function(){} });
            });
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
                });
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
                });
                it('in siblings ancestors', function(){
                    var Jet = this.Jet, Bee = this.Bee;
                    var JetChild = new Trait('JetChild', new Trait(this.Jet));
                    var BirdChild = new Trait('BirdChild', new Trait('BirdAndBee',
                        new Trait(this.Bird)), new Trait(Bee));
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
                });
            });
            describe('unless they are', function(){
                it('overriden by child trait', function(){
                    var newFly = function(){};
                    var child = new Trait(this.Jet, this.Bird, this.Bee, { fly: newFly }).create();
                    expect(child.fly).to.be(newFly);
                });
                it('overriden by object definition', function(){
                    var newFly = function(){};
                    var child = new Trait(this.Jet, this.Bird, this.Bee).create({ fly: newFly });
                    expect(child.fly).to.be(newFly);
                });
                it('solved choosing 1 source (member.from)', function(){
                    var child = new Trait(this.Jet, this.Bird, this.Bee, {
                        fly: phenotype.member.from(this.Bird)
                    }).create();
                    expect(child.fly).to.be(this.Bird.create().fly);
                });
                it('solved using an alias (member.aliasOf)', function(){
                    var Rocket = new Trait({ launch: function(){} });
                    var child = new Trait(this.Jet, this.Bird, Rocket, {
                        fly: phenotype.member.aliasOf(Rocket, 'launch')
                    }).create();
                    expect(child.fly).to.be(Rocket.create().launch);
                });
            });
        });
        describe('invoking ancestors', function(){
            describe('single ancestor', function(){
                it ('can be called', function(){
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
                });
                it ('throws error if multiple ancestors are found', function(){
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
                });
            });
            describe('ancestors', function(){
                before(function(){
                    this.ApplePacker = new Trait({
                        pack: function(basket) {
                            basket.push('apples');
                        }
                    });
                    this.SandwichPacker = new Trait({
                        pack: function(basket) {
                            basket.push('sandwich');
                        }
                    });
                    this.JuicePacker = new Trait({
                        pack: function(basket) {
                            basket.push('juice');
                        }
                    });
                });
                it ('can be called in order', function(){
                    var PicnicPacker = new Trait(this.ApplePacker, this.SandwichPacker, this.JuicePacker, {
                        pack: phenotype.member.ancestors().then(function(basket){
                            basket.push('napkins');
                        })
                    });
                    var basket = [];
                    PicnicPacker.create().pack(basket);
                    expect(basket).to.be.eql(['apples', 'sandwich', 'juice', 'napkins']);
                });
                it('can be preceded', function(){
                    var PicnicPacker = new Trait(this.ApplePacker, this.SandwichPacker, this.JuicePacker, {
                        pack: phenotype.member.ancestors().before(function(basket){
                            basket.push('napkins');
                        })
                    });
                    var basket = [];
                    PicnicPacker.create().pack(basket);
                    expect(basket).to.be.eql(['napkins', 'apples', 'sandwich', 'juice']);
                });
                it('can be wrapped', function(){
                    var PicnicPacker = new Trait(this.ApplePacker, this.SandwichPacker, this.JuicePacker, {
                        pack: phenotype.member.ancestors().wrap(function(inner) {
                            return function() {
                                var bag = { basket: [] };
                                inner.call(this, bag.basket);
                                bag.sealed = true;
                                return bag;
                            };
                        })
                    });
                    var bag = PicnicPacker.create().pack();
                    expect(bag).to.be.eql({ sealed: true, basket: [ 'apples', 'sandwich', 'juice' ] });
                });
                describe('can be piped', function(){
                    before(function(){
                        this.Peeler = new Trait('Peeler', {
                            process: function(err, thing) {
                                return 'peeled ' + thing;
                            }
                        });
                        this.Chopper = new Trait('Chopper', {
                            process: function(err, thing) {
                                return 'chopped ' + thing;
                            }
                        });
                        this.Mixer = new Trait('Mixer', {
                            mixingTimeout: 300,
                            process: function(err, thing) {
                                // mixing takes time
                                var async = phenotype.async(this.mixingTimeout);
                                setTimeout(function(){
                                    async.done('mixed ' + thing);
                                }, 30);
                                return async;
                            }
                        });
                        this.Oven = new Trait('Oven', {
                            process: function(err, thing) {
                                if (thing.substr(-4) === 'rock') {
                                    throw new Error('you can\'t bake a rock!');
                                }
                                return 'baked ' + thing;
                            }
                        });
                    });
                    it('chaining sync parents', function(){
                        var foodProcessor = new Trait(this.Peeler, this.Chopper, {
                            process: phenotype.member.ancestors().pipe()
                        }).create();
                        expect(foodProcessor.process(null, 'banana')).to.be('chopped peeled banana');
                    });
                    it('chaining sync parents with an error', function(){
                        var foodProcessor = new Trait(this.Peeler, this.Chopper, this.Oven, {
                            process: phenotype.member.ancestors().pipe()
                        }).create();
                        expect(function(){
                            foodProcessor.process(null, 'rock');
                        }).to.throwException('you can\'t bake a rock!');
                    });
                    it('chaining async parents', function(done){
                        var foodProcessor = new Trait(this.Peeler, this.Chopper, this.Mixer, this.Oven, {
                            process: phenotype.member.ancestors().pipe()
                        }).create();
                        foodProcessor.process(null, 'banana').then(function(err, result){
                            expect(result).to.be('baked mixed chopped peeled banana');
                            done();
                        });
                    });
                    it('chaining async parents with error', function(done){
                        var foodProcessor = new Trait(this.Peeler, this.Chopper, this.Mixer, this.Oven, {
                            process: phenotype.member.ancestors().pipe()
                        }).create();
                        foodProcessor.process(null, 'rock').then(function(err){
                            expect(err).to.be.an(Error);
                            expect(err.message).to.be('you can\'t bake a rock!');
                            done();
                        });
                    });
                    it('chaining async parents with timeout', function(done){
                        var foodProcessor = new Trait(this.Peeler, this.Chopper, this.Mixer, this.Oven, {
                            process: phenotype.member.ancestors().pipe()
                        }).create();
                        foodProcessor.mixingTimeout = 5;
                        foodProcessor.process(null, 'apple').then(function(err){
                            expect(err).to.be.an(Error);
                            expect(err.async).to.be.a(phenotype.Async);
                            expect(err.message).to.be('timeout');
                            done();
                        });
                    });
                });
            });
        });
    });
    describe('#has', function(){
        it('determines Traits relationship', function(){
            var Animal = new Trait();
            var Mammal = new Trait(Animal);
            var Flyer = new Trait();
            var Swimmer = new Trait();
            var Bird = new Trait(Animal);

            var Dog = new Trait(Mammal);
            var Bat = new Trait(Mammal, Flyer);
            var Duck = new Trait(Bird, Flyer, Swimmer);

            expect(Mammal.has(Animal)).to.be(true);
            expect(Bird.has(Animal)).to.be(true);
            expect(Dog.has(Mammal)).to.be(true);
            expect(Dog.has(Animal)).to.be(true);
            expect(Duck.has(Bird)).to.be(true);
            expect(Duck.has(Animal)).to.be(true);
            expect(Duck.has(Flyer)).to.be(true);
            expect(Duck.has(Swimmer)).to.be(true);
            expect(Bat.has(Mammal)).to.be(true);
            expect(Bat.has(Flyer)).to.be(true);

            expect(Animal.has(Bird)).to.be(false);
            expect(Mammal.has(Dog)).to.be(false);
            expect(Bird.has(Duck)).to.be(false);
            expect(Duck.has(Mammal)).to.be(false);
            expect(Dog.has(Flyer)).to.be(false);
        });
    });
});
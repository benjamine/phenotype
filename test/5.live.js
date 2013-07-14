/* global require, describe, before, it */
var expect = expect || require('expect.js');
var phenotype = phenotype || require('../src/phenotype');
var Trait = phenotype.Trait;
var Meta = phenotype.Meta;

describe('Live updates', function(){
    'use strict';
    before(function(){
        this.Animal = new Trait({
            eat: function(){},
            die: function() {},
        });
        this.Insect = new Trait(this.Animal, {
            legs: phenotype.member.property({
                defaultValue: 6
            })
        });
        this.Vertebrate = new Trait(this.Animal);
        this.Mammal = new Trait(this.Vertebrate, { womb: true });
        this.Flyer = new Trait({ wings: true });
        this.Swimmer = new Trait({ swim: function(){} });
        this.Bird = new Trait(this.Vertebrate, this.Flyer, { wings: 2 });

        this.Fly = new Trait(this.Insect, this.Flyer, { suck: phenotype.member.aliasOf(this.Animal, 'eat') });
        this.Dog = new Trait(this.Mammal);
        this.Bat = new Trait(this.Mammal, this.Flyer);
        this.Duck = new Trait(this.Bird, this.Swimmer);
    });
    describe('On the current platform', function(){
        if (phenotype.dynamic) {
            it('phenotype objects are dynamic', function(){
                expect(phenotype.dynamic).to.be(true);
            });
            it('then created objects are not frozen (get updates live)', function(){
                var dog = this.Dog.create();
                var dogMeta = Meta.of(dog);
                expect(dogMeta.frozen).to.not.be(true);
            });
        } else {
            it('phenotype objects are NOT dynamic (Proxy is not supported)', function(){
                expect(phenotype.dynamic).to.not.be(true);
            });
            it('then created objects are always frozen (use phenotype.refresh)', function(){
                var dog = this.Dog.create();
                var dogMeta = Meta.of(dog);
                expect(dogMeta.frozen).to.be(true);
            });
        }
    });
    describe('modifying a Trait', function(){
        it('adding a member', function(){
            var dog = this.Dog.create();
            var sleepFunction = function(){};
            this.Animal.add({ sleep: sleepFunction });
            // not needed if phenotype.dynamic on current platform
            phenotype.refresh(dog);
            expect(this.Animal.definition.sleep).to.be(sleepFunction);
            expect(dog.sleep).to.be(sleepFunction);
        });
        it('removing a member', function(){
            var dog = this.Dog.create();
            this.Mammal.remove({ womb: true });
            // not needed if phenotype.dynamic on current platform
            phenotype.refresh(dog);
            expect(this.Mammal.definition.womb).to.be(undefined);
            expect(dog.womb).to.be(undefined);
        });
        it('modifying a Property', function(){
            var fly = this.Fly.create();
            this.Insect.definition.legs.options.defaultValue = 5;
            // not needed if phenotype.dynamic on current platform
            phenotype.refresh(fly);
            expect(fly.legs).to.be.a(Function);
            expect(fly.legs.property).to.be.a(phenotype.member.Property);
            expect(fly.legs.property.options.defaultValue).to.be(5);
            expect(fly.legs()).to.be(5);
        });
        it('modiying an alias', function(){
            var fly = this.Fly.create();
            this.Fly.definition.suck.memberName = 'die';
            // not needed if phenotype.dynamic on current platform
            phenotype.refresh(fly);
            expect(fly.suck).to.be(this.Animal.definition.die);
        });
        it('adding a parent', function(){
            var dog = this.Dog.create();
            var feedPet = function(){};
            var Pet = new Trait({ feed: feedPet });
            this.Dog.add(Pet);
            // not needed if phenotype.dynamic on current platform
            phenotype.refresh(dog);
            expect(this.Dog.has(Pet)).to.be(true);
            expect(Meta.of(dog).has(Pet)).to.be(true);
            expect(dog.feed).to.be(feedPet);
        });
        it('removing a parent', function(){
            var duck = this.Duck.create();
            this.Bird.remove(this.Vertebrate);
            // not needed if phenotype.dynamic on current platform
            phenotype.refresh(duck);
            expect(this.Duck.has(this.Vertebrate)).to.be(false);
            expect(this.Duck.has(this.Animal)).to.be(false);
            expect(Meta.of(duck).has(this.Vertebrate)).to.be(false);
            expect(duck.eat).to.be(undefined);
        });
    });
    describe('modifying an existing object', function(){
        it('adding a member', function(){
            var duck = this.Duck.create();
            var duckWalk = function(){};
            Meta.of(duck).add({ walk: duckWalk });
            // not needed if phenotype.dynamic on current platform
            phenotype.refresh(duck);
            expect(duck.walk).to.be(duckWalk);
        });
        it('removing a member', function(){
            var duck = this.Duck.create({ name: 'Bruce' });
            Meta.of(duck).remove({ name: true });
            // not needed if phenotype.dynamic on current platform
            phenotype.refresh(duck);
            expect(duck.name).to.be(undefined);
        });
        it('adding a Trait', function(){
            var penguin = this.Bird.create();
            this.Swimmer.addTo(penguin);
            // not needed if phenotype.dynamic on current platform
            phenotype.refresh(penguin);
            expect(Meta.of(penguin).has(this.Swimmer)).to.be(true);
            expect(penguin.swim).to.be(this.Swimmer.definition.swim);
        });
        it('removing a Trait', function(){
            var penguin = phenotype.create(this.Bird, this.Swimmer);
            this.Swimmer.removeFrom(penguin);
            // not needed if phenotype.dynamic on current platform
            phenotype.refresh(penguin);
            expect(Meta.of(penguin).has(this.Swimmer)).to.be(false);
            expect(penguin.swim).to.be(undefined);
        });
    });
    describe('mixin Traits on non-phenotype objects', function(){
        it('mixin a trait', function(){
            var dinosaur = {};
            this.Vertebrate.addTo(dinosaur);
            expect(dinosaur.eat).to.be(this.Animal.definition.eat);
        });
        it('validates requirements', function(){
            var Walker = new Trait({
                legs: phenotype.member.required,
                walk: function(){
                    /* global console */
                    console.log('moving ' + this.legs + ' legs');
                }
            });
            var monkey = { legs: 2 };
            Walker.addTo(monkey);
            expect(monkey.walk).to.be(Walker.definition.walk);
            expect(monkey.legs).to.be(2);
        });
        it('throws if required members are missing', function(){
            var Walker = new Trait({
                legs: phenotype.member.required,
                walk: function(){
                    console.log('moving ' + this.legs + ' legs');
                }
            });
            var fish = { fins: 8 };
            expect(function(){
                Walker.addTo(fish);
            }).to.throwException(function(e){
                expect(e.required).to.be.a(phenotype.member.Required);
                expect(e.requiredMember).to.be('legs');
                expect(e.requiredBy).to.be(Walker);
            });
        });
    });
});
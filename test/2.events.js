/* global require, describe, before, it */
var expect = expect || require('expect.js');
var phenotype = phenotype || require('../src/phenotype');
var Trait = phenotype.Trait;

describe('Events', function(){
    'use strict';
    var EventEmitter = phenotype.EventEmitter;
    var HasEvents = phenotype.HasEvents;
    before(function(){
        this.Dog = new Trait(HasEvents, {
            bark: function(){
                this.emit('barked');
            },
            eat: function(){
                this.belly = this.belly || [];
                var args = Array.prototype.slice.call(arguments);
                args.unshift('ate');
                this.emit.apply(this, args);
            }
        });
    });
    describe('HasEvents', function(){
        it('is a Trait', function(){
            expect(phenotype.HasEvents).to.be.a(Trait);
        });
        it('turns objects into event emitters', function(){
            var dog = this.Dog.create();
            dog.bark();
            expect(dog.on).to.be.a(Function);
            expect(dog.off).to.be.a(Function);
            expect(dog.emit).to.be.a(Function);
            expect(EventEmitter.of(dog)).to.be.a(EventEmitter);
        });
    });
    describe('EventEmitter', function(){
        describe('#emit', function(){
            it('emits events by type name', function(){
                var dog = this.Dog.create();
                dog.emit('sleeping');
                dog.emit('waked', 34);
            });
            it('emits Event objects', function(){
                var dog = this.Dog.create();
                dog.emit(new phenotype.Event('snoring', ['loud']));
            });
        });
        describe('#on', function(){
            describe('subscribes to emitted events using', function(){
                it('an event type', function(){
                    var dog = this.Dog.create();
                    dog.on('barked', function(){
                        this.barkCount = (this.barkCount || 0) + 1;
                    });
                    dog.emit('barked');
                    dog.emit('walked');
                    dog.emit('barked');
                    expect(dog.barkCount).to.be(2);
                });
                it('space-separated event types', function(){
                    var dog = this.Dog.create();
                    dog.on('barked walked', function(){
                        this.totalCount = (this.totalCount || 0) + 1;
                    });
                    dog.emit('barked');
                    dog.emit('walked');
                    dog.emit('sitted');
                    expect(dog.totalCount).to.be(2);
                });
                it('an event object map', function(){
                    var dog = this.Dog.create();
                    dog.on({
                        barked: function(){
                            this.barkCount = (this.barkCount || 0) + 1;
                        },
                        sniffed: function(){
                            this.sniffCount = (this.sniffCount || 0) + 1;
                        }
                    });
                    dog.emit('sniffed');
                    dog.emit('barked');
                    dog.emit('sniffed');
                    expect(dog.barkCount).to.be(1);
                    expect(dog.sniffCount).to.be(2);
                });
            });
            describe('forwards all event arguments', function(){
                it('named args', function(){
                    var dog = this.Dog.create();
                    dog.on('ate', function(e, food, quantity){
                        for (var i = 0; i < quantity; i++) {
                            dog.belly.push(food);
                        }
                    });
                    dog.eat('bone', 1);
                    dog.eat('sock', 2);
                    expect(dog.belly).to.be.eql(['bone', 'sock', 'sock']);
                });
                it('all args', function(){
                    var dog = this.Dog.create();
                    dog.on('ate', function(){
                        Array.prototype.push.apply(dog.belly, Array.prototype.slice.call(arguments, 1));
                    });
                    dog.eat('bone', 'chicken', 'sock');
                    expect(dog.belly).to.be.eql(['bone', 'chicken', 'sock']);
                });
            });
            describe('handlers receive an Event object with', function(){
                describe('#source', function(){
                    it('is the object emitting the event', function(){
                        var dog = this.Dog.create();
                        var barkingDog = null;
                        dog.on('barked', function(e){
                            barkingDog = e.source;
                        });
                        dog.emit('barked');
                        expect(barkingDog).to.be(dog);
                    });
                });
                describe('#type', function(){
                    it('is the event type name', function(){
                        var dog = this.Dog.create();
                        var eventType = null;
                        dog.on('barked', function(e){
                            eventType = e.type;
                        });
                        dog.emit('barked');
                        expect(eventType).to.be('barked');
                    });
                });
                describe('#args', function(){
                    it('the Event itself and the arguments the emit function received', function(){
                        var dog = this.Dog.create();
                        var eventArgs = null;
                        dog.on('barked', function(e){
                            expect(e).to.be.a(phenotype.Event);
                            eventArgs = e.args;
                        });
                        dog.emit('barked', 1, 2, 3);
                        expect(eventArgs[0]).to.be.a(phenotype.Event);
                        expect(eventArgs.slice(1)).to.be.eql([ 1, 2, 3 ]);
                    });
                });
            });
        });
        describe('#off', function(){
            describe('desubscribes from events using', function(){
                it('an event type', function(){
                    var dog = this.Dog.create();
                    dog.on('barked', function(){
                        this.barkCount = (this.barkCount || 0) + 1;
                    });
                    dog.emit('barked');
                    dog.off('barked');
                    dog.emit('barked');
                    dog.emit('barked');
                    expect(dog.barkCount).to.be(1);
                });
                it('space-separated event types', function(){
                    var dog = this.Dog.create();
                    dog.on('barked walked', function(){
                        this.totalCount = (this.totalCount || 0) + 1;
                    });
                    dog.emit('barked');
                    dog.emit('walked');
                    dog.off('walked barked');
                    dog.emit('barked');
                    dog.emit('barked');
                    dog.emit('walked');
                    dog.emit('walked');
                    expect(dog.totalCount).to.be(2);
                });
                it('an event object map', function(){
                    var dog = this.Dog.create();
                    dog.on({
                        barked: function(){
                            this.barkCount = (this.barkCount || 0) + 1;
                        },
                        sniffed: function(){
                            this.sniffCount = (this.sniffCount || 0) + 1;
                        }
                    });
                    dog.emit('sniffed');
                    dog.emit('barked');
                    dog.emit('sniffed');
                    dog.off({
                        barked: false,
                        sniffed: false
                    });
                    dog.emit('sniffed');
                    dog.emit('barked');
                    dog.emit('sniffed');
                    expect(dog.barkCount).to.be(1);
                    expect(dog.sniffCount).to.be(2);
                });
            });
            describe('specifying a specific handlers', function(){
                it('desubscribes that handler from event', function(){
                    var dog = this.Dog.create();
                    var handler1 = function(){
                        this.barkCount = (this.barkCount || 0) + 1;
                    };
                    var handler2 = function(){
                        this.barkCount = (this.barkCount || 0) + 4;
                    };
                    dog.on('barked', handler1);
                    dog.on('barked', handler2);
                    dog.emit('barked');
                    dog.off('barked', handler2);
                    dog.emit('barked');
                    expect(dog.barkCount).to.be(6);
                });
            });
            describe('without arguments', function(){
                it('desubscribes all', function(){
                    var dog = this.Dog.create();
                    dog.on({
                        barked: function(){
                            this.barkCount = (this.barkCount || 0) + 1;
                        },
                        sniffed: function(){
                            this.sniffCount = (this.sniffCount || 0) + 1;
                        }
                    });
                    dog.emit('barked');
                    dog.emit('sniffed');
                    dog.off();
                    expect(dog.barkCount).to.be(1);
                    expect(dog.sniffCount).to.be(1);
                });
            });
        });
    });
});
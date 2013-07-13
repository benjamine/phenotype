/* global require, describe, before, it */
var expect = expect || require('expect.js');
var phenotype = phenotype || require('../phenotype');
var Trait = phenotype.Trait;
var Meta = phenotype.Meta;

describe('Meta', function(){
    'use strict';
    it('is attached to objects created by Traits', function(){
        var Car = new Trait({ wheels: 4 });
        var car = Car.create();
        expect(Meta.of(car)).to.be.a(Meta);
    });
    before(function(){
        this.Machine = new Trait({ engine: {} });
        this.Car = new Trait(this.Machine, { wheels: 4 });
        this.car = this.Car.create(this.carDefinition = { color: 'black' });
        this.MissileLauncher = new Trait({ fire: function(){} });
        this.MissileLauncher.addTo(this.car);
    });
    describe('.of', function(){
        it('returns the Meta of an object (if exists)', function(){
            expect(Meta.of(this.car)).to.be.a(Meta);
            expect(Meta.of({})).to.be(undefined);
        });
    });
    describe('#traits', function(){
        it('list object applied traits', function(){
            expect(Meta.of(this.car).traits).to.be.eql([this.Car, this.MissileLauncher]);
        });
    });
    describe('#definition', function(){
        it('holds the object definition', function(){
            expect(Meta.of(this.car).definition).to.be.eql({ color: 'black' });
        });
    });
    describe('#has', function(){
        it('determines if an object has a Trait', function(){
            expect(Meta.of(this.car).has(this.Car)).to.be(true);
            expect(Meta.of(this.car).has(this.MissileLauncher)).to.be(true);
            expect(Meta.of(this.car).has(this.Machine)).to.be(true);
            expect(Meta.of(this.car).has(new Trait())).to.be(false);
        });
    });
    describe('#sourceOf', function(){
        it('contains the source (trait or definition) of each member', function(){
            expect(Meta.of(this.car).sourceOf.color).to.be(this.carDefinition);
            expect(Meta.of(this.car).sourceOf.engine).to.be(this.Machine);
            expect(Meta.of(this.car).sourceOf.fire).to.be(this.MissileLauncher);
        });
    });
});
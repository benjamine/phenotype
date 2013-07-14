/* global require, describe, before, it */
var expect = expect || require('expect.js');
var phenotype = phenotype || require('../src/phenotype');
var Trait = phenotype.Trait;

describe('Property', function(){
    'use strict';
    it('are used as Trait members', function(){
        var tree = new Trait({
            branches: phenotype.member.property()
        }).create();
        expect(tree.branches).to.be.a(Function);
        expect(tree.branches.property).to.be.a(phenotype.member.Property);
    });
    before(function(){
        this.Tree = new Trait({
            branches: phenotype.member.property()
        });
    });
    describe('#options', function(){
        describe('#defaultValue', function(){
            it('can specify a return value when stored value is undefined', function(){
                var tree = this.Tree.create({ color: phenotype.member.property({
                    defaultValue: 'green'
                })});
                expect(tree.color()).to.be('green');
            });
        });
        describe('#storageName', function(){
            it('is the field where property value is stored', function(){
                var tree = this.Tree.create();
                tree.branches(234);
                expect(tree[tree.branches.property.storageName]).to.be(234);
                expect(tree.branches()).to.be(234);
            });
            it('is optional, default is convention based', function(){
                var tree = this.Tree.create();
                tree.branches(234);
                expect(tree.branches.property.storageName).to.be(phenotype.conventions.storageNamePrefix + 'branches');
                expect(tree[phenotype.conventions.storageNamePrefix + 'branches']).to.be(234);
            });
            it('can be specified', function(){
                var tree = this.Tree.create({
                    leaves: phenotype.member.property({ storageName: '__leaves__' })
                });
                tree.leaves(531);
                /* jshint camelcase: false */
                expect(tree.__leaves__).to.be(531);
            });
        });
        describe('#getter', function(){
            it('makes a readonly calculated property', function(){
                var tree = this.Tree.create({
                    leaves: phenotype.member.property({
                        getter: function(){
                            return this.branches() * 10;
                        }
                    })
                });
                tree.branches(3);
                expect(tree.leaves.property.isReadOnly()).to.be(true);
                expect(tree.leaves()).to.be(30);
            });
            it('can be used as only argument', function(){
                var tree = this.Tree.create({
                    leaves: phenotype.member.property(function(){
                        return this.branches() * 10;
                    })
                });
                tree.branches(3);
                expect(tree.leaves.property.isReadOnly()).to.be(true);
                expect(tree.leaves()).to.be(30);
            });
        });
        describe('#setter', function(){
            it('makes a calculated property writeable', function(){
                var tree = this.Tree.create({
                    leaves: phenotype.member.property({ getter: function(){
                        return this.branches() * 10;
                    }, setter: function(value){
                        this.branches(value / 10);
                    }})
                });
                tree.leaves(80);
                expect(tree.leaves.property.isReadOnly()).to.be(false);
                expect(tree.leaves()).to.be(80);
                expect(tree.branches()).to.be(8);
            });
        });
    });
    describe('if object has events', function(){
        it('properties emit when changed', function(){
            var tree = new Trait(phenotype.HasEvents, this.Tree).create();
            var changedEvent;
            tree.branches(30);
            tree.on('brancheschanged', function(e){
                changedEvent = e;
            });
            tree.branches(32);
            expect(changedEvent).to.be.a(phenotype.Event);
            expect(changedEvent.source).to.be(tree);
            expect(changedEvent.type).to.be('brancheschanged');
        });
        it('old and new values are event arguments', function(){
            var tree = new Trait(phenotype.HasEvents, this.Tree).create();
            var eventData;
            tree.branches(30);
            tree.on('brancheschanged', function(e, data){
                eventData = data;
            });
            tree.branches(32);
            expect(eventData.previousValue).to.be(30);
            expect(eventData.value).to.be(32);
        });
        it('no event is emitted if value is the same', function(){
            var pear = { name: 'pear' };
            var tree = new Trait(phenotype.HasEvents, this.Tree, {
                fruit: phenotype.member.property()
            }).create();
            var anEvent = null;
            tree.branches(30);
            tree.fruit(pear);
            tree.on('brancheschanged fruitchanged', function(e){
                anEvent = e;
            });
            tree.branches(30);
            tree.fruit(pear);
            expect(anEvent).to.be(null);
        });
    });
});